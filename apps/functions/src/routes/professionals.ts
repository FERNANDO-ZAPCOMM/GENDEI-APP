// Gendei Professionals Route
// CRUD operations for clinic professionals (doctors, therapists, etc.)

import { Router, Request, Response } from 'express';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { verifyAuth } from '../middleware/auth';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
const db = getFirestore();

const CLINICS = 'gendei_clinics';

// GET /professionals?clinicId=xxx - Get all professionals for a clinic
router.get('/', verifyAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const clinicId = req.query.clinicId as string || user?.uid;

    if (!clinicId) {
      return res.status(400).json({ message: 'Clinic ID is required' });
    }

    // Verify access
    if (user?.uid !== clinicId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const professionalsRef = db.collection(CLINICS).doc(clinicId).collection('professionals');
    const snapshot = await professionalsRef.orderBy('name').get();

    const professionals = snapshot.docs.map(doc => ({
      id: doc.id,
      clinicId,
      ...doc.data()
    }));

    return res.json(professionals);
  } catch (error: any) {
    console.error('Error getting professionals:', error);
    return res.status(500).json({ message: error.message });
  }
});

// GET /professionals/:professionalId?clinicId=xxx - Get specific professional
router.get('/:professionalId', verifyAuth, async (req: Request, res: Response) => {
  try {
    const { professionalId } = req.params;
    const user = (req as any).user;
    const clinicId = req.query.clinicId as string || user?.uid;

    if (!clinicId) {
      return res.status(400).json({ message: 'Clinic ID is required' });
    }

    if (user?.uid !== clinicId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const doc = await db.collection(CLINICS)
      .doc(clinicId)
      .collection('professionals')
      .doc(professionalId)
      .get();

    if (!doc.exists) {
      return res.status(404).json({ message: 'Professional not found' });
    }

    return res.json({
      id: doc.id,
      clinicId,
      ...doc.data()
    });
  } catch (error: any) {
    console.error('Error getting professional:', error);
    return res.status(500).json({ message: error.message });
  }
});

// POST /professionals - Create new professional
router.post('/', verifyAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const clinicId = req.body.clinicId || user?.uid;

    if (!clinicId) {
      return res.status(400).json({ message: 'Clinic ID is required' });
    }

    if (user?.uid !== clinicId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const {
      name,
      specialty,
      title = '',
      crm,
      email,
      phone,
      workingHours = {},
      appointmentDuration = 30,
      bufferTime = 0,
      serviceIds = []
    } = req.body;

    if (!name || !specialty) {
      return res.status(400).json({ message: 'Name and specialty are required' });
    }

    const professionalId = `prof_${uuidv4().slice(0, 8)}`;

    const professionalData = {
      name,
      specialty,
      title,
      crm: crm || null,
      email: email || null,
      phone: phone || null,
      workingHours,
      appointmentDuration,
      bufferTime,
      serviceIds,
      active: true,
      createdAt: FieldValue.serverTimestamp()
    };

    await db.collection(CLINICS)
      .doc(clinicId)
      .collection('professionals')
      .doc(professionalId)
      .set(professionalData);

    return res.status(201).json({
      id: professionalId,
      clinicId,
      ...professionalData,
      createdAt: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error creating professional:', error);
    return res.status(500).json({ message: error.message });
  }
});

// PUT /professionals/:professionalId - Update professional
router.put('/:professionalId', verifyAuth, async (req: Request, res: Response) => {
  try {
    const { professionalId } = req.params;
    const user = (req as any).user;
    const clinicId = req.body.clinicId || user?.uid;

    if (!clinicId) {
      return res.status(400).json({ message: 'Clinic ID is required' });
    }

    if (user?.uid !== clinicId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const docRef = db.collection(CLINICS)
      .doc(clinicId)
      .collection('professionals')
      .doc(professionalId);

    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ message: 'Professional not found' });
    }

    const allowedFields = [
      'name', 'specialty', 'title', 'crm', 'email', 'phone',
      'workingHours', 'appointmentDuration', 'bufferTime',
      'serviceIds', 'active'
    ];

    const updateData: any = {
      updatedAt: FieldValue.serverTimestamp()
    };

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    }

    await docRef.update(updateData);

    const updatedDoc = await docRef.get();

    return res.json({
      id: professionalId,
      clinicId,
      ...updatedDoc.data()
    });
  } catch (error: any) {
    console.error('Error updating professional:', error);
    return res.status(500).json({ message: error.message });
  }
});

// DELETE /professionals/:professionalId - Delete (deactivate) professional
router.delete('/:professionalId', verifyAuth, async (req: Request, res: Response) => {
  try {
    const { professionalId } = req.params;
    const user = (req as any).user;
    const clinicId = req.query.clinicId as string || user?.uid;

    if (!clinicId) {
      return res.status(400).json({ message: 'Clinic ID is required' });
    }

    if (user?.uid !== clinicId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const docRef = db.collection(CLINICS)
      .doc(clinicId)
      .collection('professionals')
      .doc(professionalId);

    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ message: 'Professional not found' });
    }

    // Soft delete - just mark as inactive
    await docRef.update({
      active: false,
      deactivatedAt: FieldValue.serverTimestamp()
    });

    return res.json({ message: 'Professional deactivated successfully' });
  } catch (error: any) {
    console.error('Error deleting professional:', error);
    return res.status(500).json({ message: error.message });
  }
});

// GET /professionals/:professionalId/availability - Get professional's availability
router.get('/:professionalId/availability', verifyAuth, async (req: Request, res: Response) => {
  try {
    const { professionalId } = req.params;
    const user = (req as any).user;
    const clinicId = req.query.clinicId as string || user?.uid;
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;

    if (!clinicId) {
      return res.status(400).json({ message: 'Clinic ID is required' });
    }

    // Get professional
    const profDoc = await db.collection(CLINICS)
      .doc(clinicId)
      .collection('professionals')
      .doc(professionalId)
      .get();

    if (!profDoc.exists) {
      return res.status(404).json({ message: 'Professional not found' });
    }

    const professional = profDoc.data();
    const workingHours = professional?.workingHours || {};

    // Get existing appointments to exclude
    let appointmentsQuery = db.collection('gendei_appointments')
      .where('clinicId', '==', clinicId)
      .where('professionalId', '==', professionalId);

    if (startDate) {
      appointmentsQuery = appointmentsQuery.where('date', '>=', startDate);
    }
    if (endDate) {
      appointmentsQuery = appointmentsQuery.where('date', '<=', endDate);
    }

    const appointmentsSnapshot = await appointmentsQuery.get();

    const bookedSlots = new Set<string>();
    appointmentsSnapshot.forEach(doc => {
      const apt = doc.data();
      if (apt.status !== 'cancelled' && apt.status !== 'no_show') {
        bookedSlots.add(`${apt.date}_${apt.time}`);
      }
    });

    return res.json({
      professionalId,
      workingHours,
      bookedSlots: Array.from(bookedSlots),
      appointmentDuration: professional?.appointmentDuration || 30,
      bufferTime: professional?.bufferTime || 0
    });
  } catch (error: any) {
    console.error('Error getting availability:', error);
    return res.status(500).json({ message: error.message });
  }
});

export default router;
