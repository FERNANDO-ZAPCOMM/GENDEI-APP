// Gendei Services Route
// CRUD operations for clinic services (procedures, consultations, etc.)

import { Router, Request, Response } from 'express';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { verifyAuth } from '../middleware/auth';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
const db = getFirestore();

const CLINICS = 'gendei_clinics';

// GET /services?clinicId=xxx - Get all services for a clinic
router.get('/', verifyAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const clinicId = req.query.clinicId as string || user?.clinicId;

    if (!clinicId) {
      return res.status(400).json({ message: 'Clinic ID is required' });
    }

    if (user?.clinicId !== clinicId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const servicesRef = db.collection(CLINICS).doc(clinicId).collection('services');
    const snapshot = await servicesRef.where('active', '==', true).orderBy('name').get();

    const services = snapshot.docs.map(doc => ({
      id: doc.id,
      clinicId,
      ...doc.data()
    }));

    return res.json(services);
  } catch (error: any) {
    console.error('Error getting services:', error);
    return res.status(500).json({ message: error.message });
  }
});

// GET /services/:serviceId?clinicId=xxx - Get specific service
router.get('/:serviceId', verifyAuth, async (req: Request, res: Response) => {
  try {
    const { serviceId } = req.params;
    const user = (req as any).user;
    const clinicId = req.query.clinicId as string || user?.clinicId;

    if (!clinicId) {
      return res.status(400).json({ message: 'Clinic ID is required' });
    }

    if (user?.clinicId !== clinicId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const doc = await db.collection(CLINICS)
      .doc(clinicId)
      .collection('services')
      .doc(serviceId)
      .get();

    if (!doc.exists) {
      return res.status(404).json({ message: 'Service not found' });
    }

    return res.json({
      id: doc.id,
      clinicId,
      ...doc.data()
    });
  } catch (error: any) {
    console.error('Error getting service:', error);
    return res.status(500).json({ message: error.message });
  }
});

// POST /services - Create new service
router.post('/', verifyAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const clinicId = req.body.clinicId || user?.clinicId;

    if (!clinicId) {
      return res.status(400).json({ message: 'Clinic ID is required' });
    }

    if (user?.clinicId !== clinicId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const {
      name,
      description = '',
      priceCents = 0,
      signalPercentage,
      durationMinutes = 30,
      professionalIds = [],
      acceptsParticular = true,
      acceptsConvenio = true,
      convenios = []
    } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Service name is required' });
    }

    const serviceId = `svc_${uuidv4().slice(0, 8)}`;

    const serviceData = {
      name,
      description,
      priceCents,
      signalPercentage: signalPercentage || null,
      durationMinutes,
      professionalIds,
      acceptsParticular,
      acceptsConvenio,
      convenios,
      active: true,
      createdAt: FieldValue.serverTimestamp()
    };

    await db.collection(CLINICS)
      .doc(clinicId)
      .collection('services')
      .doc(serviceId)
      .set(serviceData);

    return res.status(201).json({
      id: serviceId,
      clinicId,
      ...serviceData,
      createdAt: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error creating service:', error);
    return res.status(500).json({ message: error.message });
  }
});

// PUT /services/:serviceId - Update service
router.put('/:serviceId', verifyAuth, async (req: Request, res: Response) => {
  try {
    const { serviceId } = req.params;
    const user = (req as any).user;
    const clinicId = req.body.clinicId || user?.clinicId;

    if (!clinicId) {
      return res.status(400).json({ message: 'Clinic ID is required' });
    }

    if (user?.clinicId !== clinicId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const docRef = db.collection(CLINICS)
      .doc(clinicId)
      .collection('services')
      .doc(serviceId);

    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ message: 'Service not found' });
    }

    const allowedFields = [
      'name', 'description', 'priceCents', 'signalPercentage',
      'durationMinutes', 'professionalIds', 'acceptsParticular',
      'acceptsConvenio', 'convenios', 'active'
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
      id: serviceId,
      clinicId,
      ...updatedDoc.data()
    });
  } catch (error: any) {
    console.error('Error updating service:', error);
    return res.status(500).json({ message: error.message });
  }
});

// DELETE /services/:serviceId - Delete (deactivate) service
router.delete('/:serviceId', verifyAuth, async (req: Request, res: Response) => {
  try {
    const { serviceId } = req.params;
    const user = (req as any).user;
    const clinicId = req.query.clinicId as string || user?.clinicId;

    if (!clinicId) {
      return res.status(400).json({ message: 'Clinic ID is required' });
    }

    if (user?.clinicId !== clinicId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const docRef = db.collection(CLINICS)
      .doc(clinicId)
      .collection('services')
      .doc(serviceId);

    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ message: 'Service not found' });
    }

    await docRef.update({
      active: false,
      deactivatedAt: FieldValue.serverTimestamp()
    });

    return res.json({ message: 'Service deactivated successfully' });
  } catch (error: any) {
    console.error('Error deleting service:', error);
    return res.status(500).json({ message: error.message });
  }
});

export default router;
