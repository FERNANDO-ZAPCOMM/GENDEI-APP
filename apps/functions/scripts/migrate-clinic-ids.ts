/**
 * Migration Script: Composite Clinic IDs
 *
 * Migrates clinic documents from old format (doc ID = userId)
 * to new composite format (doc ID = userId_vertical).
 *
 * For each clinic doc where the ID does NOT already contain a valid vertical suffix:
 * 1. Read the `vertical` field (default 'geral')
 * 2. Create a new doc at `gendei_clinics/{userId}_{vertical}` with all data
 * 3. Copy subcollections: professionals, services, appointments, conversations (+ messages)
 * 4. Copy token doc: `gendei_tokens/{userId}` → `gendei_tokens/{userId}_{vertical}`
 * 5. Update root-level appointment docs: `gendei_appointments` clinicId field
 * 6. Update root-level patient docs: `gendei_patients` clinicIds array entries
 *
 * Run with: npx ts-node scripts/migrate-clinic-ids.ts
 *
 * IMPORTANT: Run in staging first, verify, then production.
 * The script is idempotent - running it again will skip already-migrated clinics.
 */

import * as admin from 'firebase-admin';

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

const CLINICS = 'gendei_clinics';
const TOKENS = 'gendei_tokens';
const APPOINTMENTS = 'gendei_appointments';
const PATIENTS = 'gendei_patients';

const VALID_VERTICALS = new Set([
  'med', 'dental', 'psi', 'nutri', 'fisio',
  'dermato', 'oftalmo', 'pediatra', 'fono', 'estetica', 'geral',
]);

const SUBCOLLECTIONS = ['professionals', 'services', 'appointments', 'conversations'];

function isAlreadyComposite(docId: string): boolean {
  const lastUnderscore = docId.lastIndexOf('_');
  if (lastUnderscore === -1) return false;
  const suffix = docId.substring(lastUnderscore + 1);
  return VALID_VERTICALS.has(suffix);
}

async function copySubcollection(
  sourceParent: admin.firestore.DocumentReference,
  targetParent: admin.firestore.DocumentReference,
  subcollectionName: string
): Promise<number> {
  const snapshot = await sourceParent.collection(subcollectionName).get();
  let count = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    await targetParent.collection(subcollectionName).doc(doc.id).set(data);
    count++;

    // If this is conversations, also copy nested messages
    if (subcollectionName === 'conversations') {
      const messagesSnapshot = await sourceParent
        .collection('conversations')
        .doc(doc.id)
        .collection('messages')
        .get();

      for (const msgDoc of messagesSnapshot.docs) {
        await targetParent
          .collection('conversations')
          .doc(doc.id)
          .collection('messages')
          .doc(msgDoc.id)
          .set(msgDoc.data());
      }
    }
  }

  return count;
}

async function migrateClinic(clinicDoc: admin.firestore.QueryDocumentSnapshot): Promise<boolean> {
  const oldId = clinicDoc.id;
  const data = clinicDoc.data();

  // Skip if already composite format
  if (isAlreadyComposite(oldId)) {
    console.log(`  SKIP ${oldId} (already composite)`);
    return false;
  }

  const vertical = data.vertical || 'geral';
  const newId = `${oldId}_${vertical}`;

  // Check if target already exists (idempotency)
  const targetDoc = await db.collection(CLINICS).doc(newId).get();
  if (targetDoc.exists) {
    console.log(`  SKIP ${oldId} → ${newId} (target already exists)`);
    return false;
  }

  console.log(`  MIGRATING ${oldId} → ${newId} (vertical: ${vertical})`);

  // 1. Create new clinic doc with same data + ownerId set to raw userId
  const newData = {
    ...data,
    ownerId: oldId, // Ensure ownerId is the raw Firebase UID
    vertical,
    migratedFrom: oldId,
    migratedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  await db.collection(CLINICS).doc(newId).set(newData);

  // 2. Copy subcollections
  const sourceRef = db.collection(CLINICS).doc(oldId);
  const targetRef = db.collection(CLINICS).doc(newId);

  for (const subcol of SUBCOLLECTIONS) {
    const count = await copySubcollection(sourceRef, targetRef, subcol);
    if (count > 0) {
      console.log(`    Copied ${count} docs from ${subcol}`);
    }
  }

  // 3. Copy token doc
  const tokenDoc = await db.collection(TOKENS).doc(oldId).get();
  if (tokenDoc.exists) {
    await db.collection(TOKENS).doc(newId).set(tokenDoc.data()!);
    console.log(`    Copied token doc`);
  }

  // 4. Update root-level appointments (clinicId field)
  const appointmentsSnapshot = await db.collection(APPOINTMENTS)
    .where('clinicId', '==', oldId)
    .get();

  if (!appointmentsSnapshot.empty) {
    const batch = db.batch();
    let batchCount = 0;

    for (const aptDoc of appointmentsSnapshot.docs) {
      batch.update(aptDoc.ref, { clinicId: newId });
      batchCount++;

      // Firestore batches have a 500 operation limit
      if (batchCount >= 450) {
        await batch.commit();
        batchCount = 0;
      }
    }

    if (batchCount > 0) {
      await batch.commit();
    }

    console.log(`    Updated ${appointmentsSnapshot.size} appointment docs`);
  }

  // 5. Update root-level patients (clinicIds array)
  const patientsSnapshot = await db.collection(PATIENTS)
    .where('clinicIds', 'array-contains', oldId)
    .get();

  if (!patientsSnapshot.empty) {
    for (const patDoc of patientsSnapshot.docs) {
      const patData = patDoc.data();
      const updatedClinicIds = (patData.clinicIds || []).map(
        (id: string) => id === oldId ? newId : id
      );
      await patDoc.ref.update({ clinicIds: updatedClinicIds });
    }
    console.log(`    Updated ${patientsSnapshot.size} patient docs`);
  }

  // 6. Mark old doc as migrated (don't delete yet)
  await sourceRef.update({
    _migrated: true,
    _migratedTo: newId,
    _migratedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return true;
}

async function main() {
  console.log('=== Clinic ID Migration: Old Format → Composite Format ===\n');

  const allClinics = await db.collection(CLINICS).get();
  console.log(`Found ${allClinics.size} total clinic documents\n`);

  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  for (const clinicDoc of allClinics.docs) {
    try {
      const didMigrate = await migrateClinic(clinicDoc);
      if (didMigrate) {
        migrated++;
      } else {
        skipped++;
      }
    } catch (error) {
      console.error(`  ERROR migrating ${clinicDoc.id}:`, error);
      errors++;
    }
  }

  console.log(`\n=== Migration Complete ===`);
  console.log(`  Migrated: ${migrated}`);
  console.log(`  Skipped:  ${skipped}`);
  console.log(`  Errors:   ${errors}`);
  console.log(`\nOld docs marked with _migrated=true. Delete them after verification.`);
}

main().catch(console.error);
