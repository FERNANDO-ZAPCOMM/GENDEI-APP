// Gendei Appointments Route
// CRUD operations for appointments
// Appointments are stored under: gendei_clinics/{clinicId}/appointments/{appointmentId}

import { Router, Request, Response } from 'express';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { verifyAuth } from '../middleware/auth';

const router = Router();
const db = getFirestore();

const CLINICS = 'gendei_clinics';

// Helper function to get appointments from clinic subcollection
async function getAppointmentsForClinic(
  clinicId: string,
  startDate?: string,
  endDate?: string,
  professionalId?: string,
  status?: string
) {
  // Query from nested subcollection: gendei_clinics/{clinicId}/appointments
  const snapshot = await db.collection(CLINICS)
    .doc(clinicId)
    .collection('appointments')
    .get();

  let appointments = snapshot.docs.map((doc: any) => ({
    id: doc.id,
    ...doc.data()
  }));

  // Filter by date range in memory
  if (startDate) {
    appointments = appointments.filter((apt: any) => apt.date >= startDate);
  }
  if (endDate) {
    appointments = appointments.filter((apt: any) => apt.date <= endDate);
  }
  if (professionalId) {
    appointments = appointments.filter((apt: any) => apt.professionalId === professionalId);
  }
  if (status) {
    appointments = appointments.filter((apt: any) => apt.status === status);
  }

  // Sort by date and time
  appointments.sort((a: any, b: any) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return (a.time || '').localeCompare(b.time || '');
  });

  return appointments;
}

// GET /appointments/clinic/:clinicId - Get appointments for a clinic (path param version)
router.get('/clinic/:clinicId', verifyAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const clinicId = req.params.clinicId;
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;
    const professionalId = req.query.professionalId as string;
    const status = req.query.status as string;

    if (user?.uid !== clinicId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const appointments = await getAppointmentsForClinic(clinicId, startDate, endDate, professionalId, status);
    return res.json(appointments);
  } catch (error: any) {
    console.error('Error getting appointments:', error);
    return res.status(500).json({ message: error.message });
  }
});

// GET /appointments?clinicId=xxx - Get appointments for a clinic (query param version)
router.get('/', verifyAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const clinicId = req.query.clinicId as string || user?.uid;
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;
    const professionalId = req.query.professionalId as string;
    const status = req.query.status as string;

    if (!clinicId) {
      return res.status(400).json({ message: 'Clinic ID is required' });
    }

    if (user?.uid !== clinicId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const appointments = await getAppointmentsForClinic(clinicId, startDate, endDate, professionalId, status);
    return res.json(appointments);
  } catch (error: any) {
    console.error('Error getting appointments:', error);
    return res.status(500).json({ message: error.message });
  }
});

// GET /appointments/today?clinicId=xxx - Get today's appointments
router.get('/today', verifyAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const clinicId = req.query.clinicId as string || user?.uid;

    if (!clinicId) {
      return res.status(400).json({ message: 'Clinic ID is required' });
    }

    if (user?.uid !== clinicId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const today = new Date().toISOString().split('T')[0];

    const snapshot = await db.collection(CLINICS)
      .doc(clinicId)
      .collection('appointments')
      .where('date', '==', today)
      .orderBy('time')
      .get();

    const appointments = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return res.json(appointments);
  } catch (error: any) {
    console.error('Error getting today appointments:', error);
    return res.status(500).json({ message: error.message });
  }
});

// GET /appointments/:appointmentId - Get specific appointment
router.get('/:appointmentId', verifyAuth, async (req: Request, res: Response) => {
  try {
    const { appointmentId } = req.params;
    const user = (req as any).user;
    const clinicId = user?.uid;

    if (!clinicId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    // Query from nested path: gendei_clinics/{clinicId}/appointments/{appointmentId}
    const doc = await db.collection(CLINICS)
      .doc(clinicId)
      .collection('appointments')
      .doc(appointmentId)
      .get();

    if (!doc.exists) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    const appointment = doc.data();

    return res.json({
      id: doc.id,
      ...appointment
    });
  } catch (error: any) {
    console.error('Error getting appointment:', error);
    return res.status(500).json({ message: error.message });
  }
});

// PUT /appointments/:appointmentId - Update appointment
router.put('/:appointmentId', verifyAuth, async (req: Request, res: Response) => {
  try {
    const { appointmentId } = req.params;
    const user = (req as any).user;
    const clinicId = user?.uid;

    if (!clinicId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    // Query from nested path
    const docRef = db.collection(CLINICS)
      .doc(clinicId)
      .collection('appointments')
      .doc(appointmentId);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    const allowedFields = [
      'status', 'notes', 'date', 'time', 'professionalId',
      'cancellationReason'
    ];

    const updateData: any = {
      updatedAt: FieldValue.serverTimestamp()
    };

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    }

    // Handle status-specific updates
    if (req.body.status === 'confirmed') {
      updateData.confirmedAt = FieldValue.serverTimestamp();
    } else if (req.body.status === 'cancelled') {
      updateData.cancelledAt = FieldValue.serverTimestamp();
    } else if (req.body.status === 'completed') {
      updateData.completedAt = FieldValue.serverTimestamp();
    }

    await docRef.update(updateData);

    const updatedDoc = await docRef.get();

    return res.json({
      id: appointmentId,
      ...updatedDoc.data()
    });
  } catch (error: any) {
    console.error('Error updating appointment:', error);
    return res.status(500).json({ message: error.message });
  }
});

// PUT /appointments/:appointmentId/status - Update appointment status
router.put('/:appointmentId/status', verifyAuth, async (req: Request, res: Response) => {
  try {
    const { appointmentId } = req.params;
    const { status, reason } = req.body;
    const user = (req as any).user;
    const clinicId = user?.uid;

    if (!clinicId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    if (!status) {
      return res.status(400).json({ message: 'Status is required' });
    }

    const validStatuses = [
      'pending', 'confirmed', 'awaiting_confirmation',
      'confirmed_presence', 'completed', 'cancelled', 'no_show'
    ];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const docRef = db.collection(CLINICS)
      .doc(clinicId)
      .collection('appointments')
      .doc(appointmentId);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    const updateData: any = {
      status,
      updatedAt: FieldValue.serverTimestamp()
    };

    if (status === 'confirmed') {
      updateData.confirmedAt = FieldValue.serverTimestamp();
    } else if (status === 'cancelled') {
      updateData.cancelledAt = FieldValue.serverTimestamp();
      if (reason) {
        updateData.cancellationReason = reason;
      }
    } else if (status === 'completed') {
      updateData.completedAt = FieldValue.serverTimestamp();
    }

    await docRef.update(updateData);

    return res.json({
      message: 'Status updated successfully',
      appointmentId,
      status
    });
  } catch (error: any) {
    console.error('Error updating appointment status:', error);
    return res.status(500).json({ message: error.message });
  }
});

// PUT /appointments/:appointmentId/reschedule - Reschedule appointment
router.put('/:appointmentId/reschedule', verifyAuth, async (req: Request, res: Response) => {
  try {
    const { appointmentId } = req.params;
    const { date, time, professionalId } = req.body;
    const user = (req as any).user;
    const clinicId = user?.uid;

    if (!clinicId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    if (!date || !time) {
      return res.status(400).json({ message: 'Date and time are required' });
    }

    const docRef = db.collection(CLINICS)
      .doc(clinicId)
      .collection('appointments')
      .doc(appointmentId);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    const updateData: any = {
      date,
      time,
      status: 'pending',
      reminder24hSent: false,
      reminder2hSent: false,
      updatedAt: FieldValue.serverTimestamp()
    };

    if (professionalId) {
      updateData.professionalId = professionalId;
    }

    await docRef.update(updateData);

    const updatedDoc = await docRef.get();

    return res.json({
      id: appointmentId,
      ...updatedDoc.data()
    });
  } catch (error: any) {
    console.error('Error rescheduling appointment:', error);
    return res.status(500).json({ message: error.message });
  }
});

// DELETE /appointments/:appointmentId - Cancel appointment
router.delete('/:appointmentId', verifyAuth, async (req: Request, res: Response) => {
  try {
    const { appointmentId } = req.params;
    const user = (req as any).user;
    const clinicId = user?.uid;
    const reason = req.query.reason as string || 'Cancelado pela clínica';

    if (!clinicId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const docRef = db.collection(CLINICS)
      .doc(clinicId)
      .collection('appointments')
      .doc(appointmentId);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    await docRef.update({
      status: 'cancelled',
      cancellationReason: reason,
      cancelledAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });

    return res.json({ message: 'Appointment cancelled successfully' });
  } catch (error: any) {
    console.error('Error cancelling appointment:', error);
    return res.status(500).json({ message: error.message });
  }
});

export default router;
