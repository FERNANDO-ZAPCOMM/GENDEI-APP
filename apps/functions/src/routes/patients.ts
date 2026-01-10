// Gendei Patients Route
// Operations for patient management

import { Router, Request, Response } from 'express';
import { getFirestore } from 'firebase-admin/firestore';
import { verifyAuth } from '../middleware/auth';

const router = Router();
const db = getFirestore();

const PATIENTS = 'gendei_patients';
const APPOINTMENTS = 'gendei_appointments';

// GET /patients?clinicId=xxx - Get patients for a clinic
router.get('/', verifyAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const clinicId = req.query.clinicId as string || user?.uid;
    const search = req.query.search as string;
    const limit = parseInt(req.query.limit as string) || 50;

    if (!clinicId) {
      return res.status(400).json({ message: 'Clinic ID is required' });
    }

    if (user?.uid !== clinicId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    let query = db.collection(PATIENTS)
      .where('clinicIds', 'array-contains', clinicId)
      .orderBy('name')
      .limit(limit);

    const snapshot = await query.get();

    let patients = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Client-side search if provided
    if (search) {
      const searchLower = search.toLowerCase();
      patients = patients.filter(p =>
        (p as any).name?.toLowerCase().includes(searchLower) ||
        (p as any).phone?.includes(search) ||
        (p as any).cpf?.includes(search)
      );
    }

    return res.json(patients);
  } catch (error: any) {
    console.error('Error getting patients:', error);
    return res.status(500).json({ message: error.message });
  }
});

// GET /patients/:patientId - Get specific patient
router.get('/:patientId', verifyAuth, async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const user = (req as any).user;
    const clinicId = user?.uid;

    const doc = await db.collection(PATIENTS).doc(patientId).get();

    if (!doc.exists) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    const patient = doc.data();

    // Verify access
    if (!patient?.clinicIds?.includes(clinicId)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    return res.json({
      id: doc.id,
      ...patient
    });
  } catch (error: any) {
    console.error('Error getting patient:', error);
    return res.status(500).json({ message: error.message });
  }
});

// GET /patients/:patientId/appointments - Get patient's appointments
router.get('/:patientId/appointments', verifyAuth, async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const user = (req as any).user;
    const clinicId = user?.uid;
    const includePast = req.query.includePast === 'true';

    // Verify patient exists and clinic has access
    const patientDoc = await db.collection(PATIENTS).doc(patientId).get();

    if (!patientDoc.exists) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    const patient = patientDoc.data();

    if (!patient?.clinicIds?.includes(clinicId)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    let query = db.collection(APPOINTMENTS)
      .where('patientId', '==', patientId)
      .where('clinicId', '==', clinicId);

    if (!includePast) {
      const today = new Date().toISOString().split('T')[0];
      query = query.where('date', '>=', today);
    }

    const snapshot = await query.orderBy('date').orderBy('time').get();

    const appointments = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return res.json(appointments);
  } catch (error: any) {
    console.error('Error getting patient appointments:', error);
    return res.status(500).json({ message: error.message });
  }
});

// GET /patients/by-phone/:phone - Get patient by phone number
router.get('/by-phone/:phone', verifyAuth, async (req: Request, res: Response) => {
  try {
    const { phone } = req.params;
    const user = (req as any).user;
    const clinicId = user?.uid;

    // Normalize phone number
    const normalizedPhone = phone.replace(/\D/g, '');

    const snapshot = await db.collection(PATIENTS)
      .where('phone', '==', normalizedPhone)
      .limit(1)
      .get();

    if (snapshot.empty) {
      // Also try with + prefix
      const snapshot2 = await db.collection(PATIENTS)
        .where('phone', '==', `+${normalizedPhone}`)
        .limit(1)
        .get();

      if (snapshot2.empty) {
        return res.status(404).json({ message: 'Patient not found' });
      }

      const patient = snapshot2.docs[0].data();

      if (!patient?.clinicIds?.includes(clinicId)) {
        return res.status(403).json({ message: 'Access denied' });
      }

      return res.json({
        id: snapshot2.docs[0].id,
        ...patient
      });
    }

    const patient = snapshot.docs[0].data();

    if (!patient?.clinicIds?.includes(clinicId)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    return res.json({
      id: snapshot.docs[0].id,
      ...patient
    });
  } catch (error: any) {
    console.error('Error getting patient by phone:', error);
    return res.status(500).json({ message: error.message });
  }
});

// POST /patients - Create new patient
router.post('/', verifyAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const clinicId = user?.uid;

    if (!clinicId) {
      return res.status(400).json({ message: 'Clinic ID is required' });
    }

    const { name, phone, email, dateOfBirth, cpf, address, notes, tags } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Patient name is required' });
    }

    // Normalize phone number if provided
    const normalizedPhone = phone ? phone.replace(/\D/g, '') : null;

    // Check if patient already exists with this phone for this clinic
    if (normalizedPhone) {
      const existingSnapshot = await db.collection(PATIENTS)
        .where('phone', '==', normalizedPhone)
        .limit(1)
        .get();

      if (!existingSnapshot.empty) {
        const existingPatient = existingSnapshot.docs[0];
        const existingData = existingPatient.data();

        // If patient exists but not for this clinic, add clinic to clinicIds
        if (!existingData.clinicIds?.includes(clinicId)) {
          await existingPatient.ref.update({
            clinicIds: [...(existingData.clinicIds || []), clinicId],
            updatedAt: new Date()
          });
        }

        return res.json({
          id: existingPatient.id,
          ...existingData,
          clinicIds: [...(existingData.clinicIds || []), clinicId]
        });
      }
    }

    const patientData = {
      name,
      phone: normalizedPhone,
      email: email || null,
      dateOfBirth: dateOfBirth || null,
      cpf: cpf || null,
      address: address || null,
      notes: notes || null,
      tags: tags || [],
      clinicIds: [clinicId],
      totalAppointments: 0,
      lastAppointmentAt: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const docRef = await db.collection(PATIENTS).add(patientData);

    return res.status(201).json({
      id: docRef.id,
      ...patientData
    });
  } catch (error: any) {
    console.error('Error creating patient:', error);
    return res.status(500).json({ message: error.message });
  }
});

// PATCH /patients/:patientId - Update patient
router.patch('/:patientId', verifyAuth, async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const user = (req as any).user;
    const clinicId = user?.uid;

    const docRef = db.collection(PATIENTS).doc(patientId);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    const patient = doc.data();

    // Verify access
    if (!patient?.clinicIds?.includes(clinicId)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const allowedFields = ['name', 'phone', 'email', 'dateOfBirth', 'cpf', 'address', 'notes', 'tags'];
    const updateData: any = { updatedAt: new Date() };

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        // Normalize phone if updating
        if (field === 'phone' && req.body[field]) {
          updateData[field] = req.body[field].replace(/\D/g, '');
        } else {
          updateData[field] = req.body[field];
        }
      }
    }

    await docRef.update(updateData);

    const updatedDoc = await docRef.get();

    return res.json({
      id: patientId,
      ...updatedDoc.data()
    });
  } catch (error: any) {
    console.error('Error updating patient:', error);
    return res.status(500).json({ message: error.message });
  }
});

// DELETE /patients/:patientId - Remove patient from clinic (soft delete)
router.delete('/:patientId', verifyAuth, async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const user = (req as any).user;
    const clinicId = user?.uid;

    const docRef = db.collection(PATIENTS).doc(patientId);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    const patient = doc.data();

    // Verify access
    if (!patient?.clinicIds?.includes(clinicId)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Remove clinic from patient's clinicIds (soft delete for this clinic)
    const updatedClinicIds = (patient.clinicIds || []).filter((id: string) => id !== clinicId);

    if (updatedClinicIds.length === 0) {
      // If no clinics left, delete the patient entirely
      await docRef.delete();
    } else {
      // Otherwise just remove this clinic from the list
      await docRef.update({
        clinicIds: updatedClinicIds,
        updatedAt: new Date()
      });
    }

    return res.json({ message: 'Patient removed successfully' });
  } catch (error: any) {
    console.error('Error deleting patient:', error);
    return res.status(500).json({ message: error.message });
  }
});

export default router;
