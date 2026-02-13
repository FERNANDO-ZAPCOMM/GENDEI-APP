import { getFirestore } from 'firebase-admin/firestore';

const db = getFirestore();

/**
 * Get all possible phone number variants for lookup
 * Handles different formatting: raw digits, +prefix, etc.
 */
export function getPhoneVariants(phone?: string): string[] {
  if (!phone) return [];
  const cleaned = String(phone).trim();
  if (!cleaned) return [];

  const digits = cleaned.replace(/\D/g, '');
  const plusDigits = digits ? `+${digits}` : '';
  const variants = new Set<string>([cleaned]);
  if (digits) variants.add(digits);
  if (plusDigits) variants.add(plusDigits);
  return Array.from(variants);
}

/**
 * Find conversation document reference for a given phone number
 * Tries multiple phone variants and field names
 */
export async function findConversationForPhone(
  clinicId: string,
  patientPhone?: string
): Promise<FirebaseFirestore.DocumentReference | null> {
  const variants = getPhoneVariants(patientPhone);
  if (variants.length === 0) return null;

  const conversationsRef = db.collection('gendei_clinics').doc(clinicId).collection('conversations');

  // Try direct document ID match first (fastest)
  for (const variant of variants) {
    const doc = await conversationsRef.doc(variant).get();
    if (doc.exists) return doc.ref;
  }

  // Try field queries as fallback
  const fields = ['waUserPhone', 'waUserId', 'phone'];
  for (const field of fields) {
    for (const variant of variants) {
      const snapshot = await conversationsRef.where(field, '==', variant).limit(1).get();
      if (!snapshot.empty) return snapshot.docs[0].ref;
    }
  }

  return null;
}
