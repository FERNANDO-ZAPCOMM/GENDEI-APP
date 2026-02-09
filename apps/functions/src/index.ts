// Gendei Cloud Functions
// Clinic appointment scheduling platform
// Last deploy: 2026-01-11

import * as dotenv from 'dotenv';
dotenv.config();

import * as functions from 'firebase-functions/v1';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import express from 'express';
import cors from 'cors';

// Initialize Firebase Admin
if (getApps().length === 0) {
  initializeApp();
}
const db = getFirestore();

// Import routes - Gendei clinic management
import clinicsRouter from './routes/clinics';
import professionalsRouter from './routes/professionals';
import servicesRouter from './routes/services';
import appointmentsRouter from './routes/appointments';
import patientsRouter from './routes/patients';
import conversationsRouter from './routes/conversations';
import metaRouter from './routes/meta';
import whatsappRouter from './routes/whatsapp';
import remindersRouter from './routes/reminders';
import teamRouter from './routes/team';
import paymentsRouter from './routes/payments';

// Import services
import { sendScheduledReminders } from './services/reminders';
import { cleanupExpiredPaymentHolds } from './services/payment-holds';

// Create Express app
const app = express();

// Middleware
app.use(cors({ origin: true }));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'Gendei API',
    timestamp: new Date().toISOString()
  });
});

// Mount routes
app.use('/clinics', clinicsRouter);
app.use('/professionals', professionalsRouter);
app.use('/services', servicesRouter);
app.use('/appointments', appointmentsRouter);
app.use('/patients', patientsRouter);
app.use('/conversations', conversationsRouter);
app.use('/meta', metaRouter);
app.use('/whatsapp', whatsappRouter);
app.use('/reminders', remindersRouter);
app.use('/team', teamRouter);
app.use('/payments', paymentsRouter);

// Error handler
app.use(
  (
    err: Error,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
);

// Export the Express app as a Firebase Function
export const api = functions
  .region('us-central1')
  .runWith({
    timeoutSeconds: 60,
    memory: '256MB',
  })
  .https.onRequest(app);

// ============================================
// SCHEDULED FUNCTIONS
// ============================================

// Send appointment reminders (runs every 15 minutes)
// Sends 24h and 2h reminders for upcoming appointments
export const scheduledReminders = functions
  .region('us-central1')
  .runWith({
    timeoutSeconds: 300,
    memory: '512MB',
  })
  .pubsub.schedule('every 15 minutes')
  .onRun(async () => {
    console.log('Starting scheduled reminder check...');

    try {
      const result = await sendScheduledReminders();
      console.log('Scheduled reminders completed:', result);
    } catch (error) {
      console.error('Scheduled reminders failed:', error);
      throw error;
    }
  });

// Cleanup unpaid pending holds and release slots (runs every 5 minutes)
export const scheduledPaymentHoldCleanup = functions
  .region('us-central1')
  .runWith({
    timeoutSeconds: 300,
    memory: '512MB',
  })
  .pubsub.schedule('every 5 minutes')
  .onRun(async () => {
    console.log('Starting scheduled payment-hold cleanup...');

    try {
      const result = await cleanupExpiredPaymentHolds();
      console.log('Payment-hold cleanup completed:', result);
    } catch (error) {
      console.error('Payment-hold cleanup failed:', error);
      throw error;
    }
  });

// ============================================
// FIRESTORE TRIGGERS
// ============================================

// Trigger when appointment status changes to send notifications
export const onAppointmentStatusChange = functions
  .region('us-central1')
  .runWith({
    timeoutSeconds: 60,
    memory: '256MB',
  })
  .firestore.document('gendei_appointments/{appointmentId}')
  .onUpdate(async (change, context) => {
    const { appointmentId } = context.params;
    const beforeData = change.before.data();
    const afterData = change.after.data();

    // Check if status changed
    if (beforeData.status === afterData.status) {
      return;
    }

    console.log(`Appointment ${appointmentId} status changed: ${beforeData.status} -> ${afterData.status}`);

    // Handle status-specific notifications
    const newStatus = afterData.status;

    if (newStatus === 'confirmed') {
      // Payment received - confirmation already sent by payment webhook
      console.log(`Appointment ${appointmentId} confirmed (payment received)`);
    } else if (newStatus === 'cancelled') {
      // Send cancellation notification to clinic admin
      console.log(`Appointment ${appointmentId} cancelled`);
      // TODO: Send notification to clinic
    } else if (newStatus === 'confirmed_presence') {
      // Patient confirmed attendance
      console.log(`Appointment ${appointmentId} - patient confirmed presence`);
    }
  });

function getPhoneVariants(phone?: string): string[] {
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

async function findConversationRef(clinicId: string, patientPhone?: string) {
  const variants = getPhoneVariants(patientPhone);
  if (variants.length === 0) return null;

  const conversationsRef = db.collection('gendei_clinics').doc(clinicId).collection('conversations');

  for (const variant of variants) {
    const doc = await conversationsRef.doc(variant).get();
    if (doc.exists) return doc.ref;
  }

  const fields = ['waUserPhone', 'waUserId', 'phone'];
  for (const field of fields) {
    for (const variant of variants) {
      const snapshot = await conversationsRef.where(field, '==', variant).limit(1).get();
      if (!snapshot.empty) return snapshot.docs[0].ref;
    }
  }

  return null;
}

// Keep conversation appointment tag in sync for all appointment writes (API + agent + scripts).
export const syncConversationAppointmentContext = functions
  .region('us-central1')
  .runWith({
    timeoutSeconds: 60,
    memory: '256MB',
  })
  .firestore.document('gendei_clinics/{clinicId}/appointments/{appointmentId}')
  .onWrite(async (change, context) => {
    const { clinicId, appointmentId } = context.params;
    const afterData = change.after.exists ? change.after.data() : null;

    // We only persist current appointment context for existing appointments.
    if (!afterData) return;

    const conversationRef = await findConversationRef(clinicId, afterData.patientPhone);
    if (!conversationRef) return;

    await conversationRef.set({
      appointmentContext: {
        appointmentId,
        status: afterData.status || null,
        date: afterData.date || null,
        time: afterData.time || null,
        patientPhone: afterData.patientPhone || null,
        patientName: afterData.patientName || null,
        professionalName: afterData.professionalName || null,
        serviceName: afterData.serviceName || null,
        updatedAt: FieldValue.serverTimestamp(),
      },
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  });

// Trigger when new clinic is created to set up defaults
export const onClinicCreate = functions
  .region('us-central1')
  .runWith({
    timeoutSeconds: 60,
    memory: '256MB',
  })
  .firestore.document('gendei_clinics/{clinicId}')
  .onCreate(async (snapshot, context) => {
    const { clinicId } = context.params;
    const clinicData = snapshot.data();

    console.log(`New clinic created: ${clinicId} - ${clinicData.name}`);

    // TODO: Set up default settings, send welcome email, etc.
  });
