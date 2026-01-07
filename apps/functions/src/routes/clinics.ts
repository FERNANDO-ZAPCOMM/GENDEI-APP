// Gendei Clinics Route
// CRUD operations for clinic management

import { Router, Request, Response } from 'express';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { verifyAuth } from '../middleware/auth';

const router = Router();
const db = getFirestore();

// Collection names
const CLINICS = 'gendei_clinics';

// GET /clinics - Get current user's clinic
router.get('/', verifyAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const clinicId = user?.uid;

    if (!clinicId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const clinicDoc = await db.collection(CLINICS).doc(clinicId).get();

    if (!clinicDoc.exists) {
      return res.status(404).json({ message: 'Clinic not found' });
    }

    return res.json({
      id: clinicDoc.id,
      ...clinicDoc.data()
    });
  } catch (error: any) {
    console.error('Error getting clinic:', error);
    return res.status(500).json({ message: error.message });
  }
});

// GET /clinics/:clinicId - Get specific clinic
router.get('/:clinicId', verifyAuth, async (req: Request, res: Response) => {
  try {
    const { clinicId } = req.params;
    const user = (req as any).user;

    // Verify access
    if (user?.uid !== clinicId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const clinicDoc = await db.collection(CLINICS).doc(clinicId).get();

    if (!clinicDoc.exists) {
      return res.status(404).json({ message: 'Clinic not found' });
    }

    return res.json({
      id: clinicDoc.id,
      ...clinicDoc.data()
    });
  } catch (error: any) {
    console.error('Error getting clinic:', error);
    return res.status(500).json({ message: error.message });
  }
});

// POST /clinics - Create new clinic
router.post('/', verifyAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const clinicId = user?.uid;

    if (!clinicId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const {
      name,
      phone,
      email,
      address,
      city,
      state,
      zipCode,
      cnpj,
      signalPercentage = 15
    } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Clinic name is required' });
    }

    const clinicData = {
      name,
      ownerId: clinicId,
      phone: phone || '',
      email: email || user?.email || '',
      address: address || '',
      city: city || '',
      state: state || '',
      zipCode: zipCode || '',
      cnpj: cnpj || null,
      whatsappConnected: false,
      whatsappPhoneNumberId: null,
      whatsappWabaId: null,
      paymentGateway: 'pagseguro',
      signalPercentage,
      adminIds: [],
      timezone: 'America/Sao_Paulo',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    };

    await db.collection(CLINICS).doc(clinicId).set(clinicData);

    return res.status(201).json({
      id: clinicId,
      ...clinicData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error creating clinic:', error);
    return res.status(500).json({ message: error.message });
  }
});

// PUT /clinics/:clinicId - Update clinic
router.put('/:clinicId', verifyAuth, async (req: Request, res: Response) => {
  try {
    const { clinicId } = req.params;
    const user = (req as any).user;

    // Verify ownership
    if (user?.uid !== clinicId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const clinicDoc = await db.collection(CLINICS).doc(clinicId).get();

    if (!clinicDoc.exists) {
      return res.status(404).json({ message: 'Clinic not found' });
    }

    const allowedFields = [
      'name', 'phone', 'email', 'address', 'city', 'state',
      'zipCode', 'cnpj', 'signalPercentage', 'timezone'
    ];

    const updateData: any = {
      updatedAt: FieldValue.serverTimestamp()
    };

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    }

    await db.collection(CLINICS).doc(clinicId).update(updateData);

    const updatedDoc = await db.collection(CLINICS).doc(clinicId).get();

    return res.json({
      id: clinicId,
      ...updatedDoc.data()
    });
  } catch (error: any) {
    console.error('Error updating clinic:', error);
    return res.status(500).json({ message: error.message });
  }
});

// GET /clinics/:clinicId/settings - Get clinic settings
router.get('/:clinicId/settings', verifyAuth, async (req: Request, res: Response) => {
  try {
    const { clinicId } = req.params;
    const user = (req as any).user;

    if (user?.uid !== clinicId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const settingsRef = db.collection(CLINICS).doc(clinicId).collection('settings');
    const settingsDocs = await settingsRef.get();

    const settings: any = {};
    settingsDocs.forEach(doc => {
      settings[doc.id] = doc.data();
    });

    return res.json(settings);
  } catch (error: any) {
    console.error('Error getting clinic settings:', error);
    return res.status(500).json({ message: error.message });
  }
});

// PUT /clinics/:clinicId/settings/:key - Update clinic setting
router.put('/:clinicId/settings/:key', verifyAuth, async (req: Request, res: Response) => {
  try {
    const { clinicId, key } = req.params;
    const user = (req as any).user;

    if (user?.uid !== clinicId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { value } = req.body;

    await db.collection(CLINICS).doc(clinicId).collection('settings').doc(key).set({
      value,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });

    return res.json({ key, value });
  } catch (error: any) {
    console.error('Error updating clinic setting:', error);
    return res.status(500).json({ message: error.message });
  }
});

// GET /clinics/:clinicId/stats - Get clinic statistics
router.get('/:clinicId/stats', verifyAuth, async (req: Request, res: Response) => {
  try {
    const { clinicId } = req.params;
    const user = (req as any).user;

    if (user?.uid !== clinicId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Get appointment counts
    const today = new Date().toISOString().split('T')[0];

    const [
      totalAppointments,
      todayAppointments,
      pendingAppointments,
      totalPatients,
      totalProfessionals
    ] = await Promise.all([
      db.collection('gendei_appointments')
        .where('clinicId', '==', clinicId)
        .count().get(),
      db.collection('gendei_appointments')
        .where('clinicId', '==', clinicId)
        .where('date', '==', today)
        .count().get(),
      db.collection('gendei_appointments')
        .where('clinicId', '==', clinicId)
        .where('status', '==', 'pending')
        .count().get(),
      db.collection('gendei_patients')
        .where('clinicIds', 'array-contains', clinicId)
        .count().get(),
      db.collection(CLINICS).doc(clinicId).collection('professionals')
        .where('active', '==', true)
        .count().get()
    ]);

    return res.json({
      totalAppointments: totalAppointments.data().count,
      todayAppointments: todayAppointments.data().count,
      pendingAppointments: pendingAppointments.data().count,
      totalPatients: totalPatients.data().count,
      totalProfessionals: totalProfessionals.data().count
    });
  } catch (error: any) {
    console.error('Error getting clinic stats:', error);
    return res.status(500).json({ message: error.message });
  }
});

export default router;
