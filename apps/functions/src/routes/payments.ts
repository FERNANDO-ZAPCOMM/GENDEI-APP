import { Router, Request, Response } from 'express';
import { getFirestore } from 'firebase-admin/firestore';
import { verifyAuth } from '../middleware/auth';

const router = Router();
const db = getFirestore();
const CLINICS = 'gendei_clinics';

// GET /payments/clinic/:clinicId
router.get('/clinic/:clinicId', verifyAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const clinicId = req.params.clinicId;
    const limit = Math.min(parseInt(String(req.query.limit || '200'), 10) || 200, 500);

    if (user?.clinicId !== clinicId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const snapshot = await db
      .collection(CLINICS)
      .doc(clinicId)
      .collection('orders')
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();

    const payments = snapshot.docs.map((doc) => {
      const data = doc.data() as Record<string, any>;
      return {
        id: doc.id,
        clinicId,
        appointmentId: data.appointmentId || '',
        patientPhone: data.patientPhone || '',
        patientName: data.patientName || '',
        amountCents: data.amountCents || 0,
        paymentStatus: data.paymentStatus || data.status || 'pending',
        paymentMethod: data.paymentMethod || 'pix',
        paymentSource: data.paymentSource || data.provider || 'pagseguro',
        transferMode: data.transferMode || (data.paymentMethod === 'card' ? 'automatic' : 'manual'),
        paymentId: data.paymentId || '',
        createdAt: data.createdAt || null,
        updatedAt: data.updatedAt || null,
        paidAt: data.paidAt || null,
      };
    });

    return res.json(payments);
  } catch (error: any) {
    console.error('Error getting payments:', error);
    return res.status(500).json({ message: error.message });
  }
});

export default router;
