// Gendei Reminders Service
// Handles sending appointment reminders via WhatsApp

import { getFirestore, FieldPath, FieldValue } from 'firebase-admin/firestore';
import axios from 'axios';
import { getVerticalTerms } from './verticals';

const db = getFirestore();

const CLINICS = 'gendei_clinics';
const TOKENS = 'gendei_tokens';
const APPOINTMENTS_SUBCOLLECTION = 'appointments';
const GENDEI_SERVICE_SECRET = process.env.GENDEI_SERVICE_SECRET || '';

// WhatsApp Agent URL (Cloud Run)
const WHATSAPP_AGENT_URL = process.env.WHATSAPP_AGENT_URL ||
  'https://gendei-whatsapp-agent-818713106542.us-central1.run.app';

interface ReminderResult {
  sent24h: number;
  sent2h: number;
  errors: number;
}

interface ReminderAppointment {
  id: string;
  clinicId: string;
  patientPhone: string;
  patientName: string;
  professionalName: string;
  date: string;
  time: string;
  status?: string;
  reminder24hSent?: boolean;
  reminder2hSent?: boolean;
  _ref: FirebaseFirestore.DocumentReference;
  [key: string]: any;
}

/**
 * Send scheduled reminders for all appointments
 * Called by Cloud Scheduler every 15 minutes
 */
export async function sendScheduledReminders(): Promise<ReminderResult> {
  const result: ReminderResult = {
    sent24h: 0,
    sent2h: 0,
    errors: 0
  };

  try {
    const now = new Date();

    // Get appointments needing 24h reminder (23-25 hours from now)
    const reminder24hStart = new Date(now.getTime() + 23 * 60 * 60 * 1000);
    const reminder24hEnd = new Date(now.getTime() + 25 * 60 * 60 * 1000);

    // Get appointments needing 2h reminder (1.5-2.5 hours from now)
    const reminder2hStart = new Date(now.getTime() + 1.5 * 60 * 60 * 1000);
    const reminder2hEnd = new Date(now.getTime() + 2.5 * 60 * 60 * 1000);

    // Query for 24h reminders
    const appointments24h = await getAppointmentsInWindow(
      reminder24hStart,
      reminder24hEnd,
      'reminder24hSent'
    );

    // Query for 2h reminders
    const appointments2h = await getAppointmentsInWindow(
      reminder2hStart,
      reminder2hEnd,
      'reminder2hSent'
    );

    console.log(`Found ${appointments24h.length} appointments needing 24h reminder`);
    console.log(`Found ${appointments2h.length} appointments needing 2h reminder`);

    // Send 24h reminders
    for (const apt of appointments24h) {
      try {
        await sendReminder(apt, '24h');
        result.sent24h++;
      } catch (error) {
        console.error(`Error sending 24h reminder for ${apt.id}:`, error);
        result.errors++;
      }
    }

    // Send 2h reminders
    for (const apt of appointments2h) {
      try {
        await sendReminder(apt, '2h');
        result.sent2h++;
      } catch (error) {
        console.error(`Error sending 2h reminder for ${apt.id}:`, error);
        result.errors++;
      }
    }

    return result;
  } catch (error) {
    console.error('Error in sendScheduledReminders:', error);
    throw error;
  }
}

/**
 * Get appointments in a time window that haven't received a specific reminder
 */
async function getAppointmentsInWindow(
  windowStart: Date,
  windowEnd: Date,
  reminderField: string
): Promise<any[]> {
  const startDate = windowStart.toISOString().split('T')[0];
  const endDate = windowEnd.toISOString().split('T')[0];

  // Query nested appointments in date range with confirmed status
  const snapshot = await db.collectionGroup(APPOINTMENTS_SUBCOLLECTION)
    .where('date', '>=', startDate)
    .where('date', '<=', endDate)
    .where('status', 'in', ['confirmed', 'confirmed_presence'])
    .get();

  const appointments: ReminderAppointment[] = [];

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const apt = { id: doc.id, ...data, _ref: doc.ref } as ReminderAppointment;

    // Check if reminder already sent
    if (apt[reminderField]) {
      continue;
    }

    // Parse appointment datetime and check if in window
    const aptDatetime = new Date(`${data.date}T${data.time}:00`);

    if (aptDatetime >= windowStart && aptDatetime <= windowEnd) {
      appointments.push(apt);
    }
  }

  return appointments;
}

/**
 * Send a reminder for an appointment
 */
async function sendReminder(appointment: any, type: '24h' | '2h'): Promise<void> {
  const { clinicId, patientPhone, patientName, professionalName, date, time } = appointment;

  // Get clinic info
  const clinicDoc = await db.collection(CLINICS).doc(clinicId).get();
  if (!clinicDoc.exists) {
    throw new Error(`Clinic ${clinicId} not found`);
  }

  const clinic = clinicDoc.data();

  if (!clinic?.whatsappConnected || !clinic?.whatsappPhoneNumberId) {
    console.log(`Clinic ${clinicId} not connected to WhatsApp, skipping reminder`);
    return;
  }

  // Get access token
  const tokenDoc = await db.collection(TOKENS).doc(clinicId).get();
  const accessToken = tokenDoc.exists ? tokenDoc.data()?.accessToken : null;

  if (!accessToken) {
    console.log(`No access token for clinic ${clinicId}, skipping reminder`);
    return;
  }

  // Format reminder message with vertical-aware terminology
  const terms = getVerticalTerms(clinic.vertical);
  const message = formatReminderMessage(
    type,
    patientName,
    professionalName,
    date,
    time,
    clinic.address || '',
    terms.appointmentTerm,
    terms.professionalEmoji,
    terms.showArriveEarlyTip
  );

  // Send via WhatsApp Agent
  try {
    await axios.post(
      `${WHATSAPP_AGENT_URL}/api/send-reminder`,
      {
        clinicId,
        phoneNumberId: clinic.whatsappPhoneNumberId,
        accessToken,
        patientPhone,
        message,
        reminderType: type,
        appointmentId: appointment.id
      },
      {
        headers: {
          'X-Gendei-Service-Secret': GENDEI_SERVICE_SECRET,
        },
      }
    );

    // Mark reminder as sent
    const updateField = type === '24h' ? 'reminder24hSent' : 'reminder2hSent';
    const updateTimeField = type === '24h' ? 'reminder24hAt' : 'reminder2hAt';

    await appointment._ref.update({
      [updateField]: true,
      [updateTimeField]: FieldValue.serverTimestamp(),
      // Update status for 24h reminder to await confirmation
      ...(type === '24h' ? { status: 'awaiting_confirmation' } : {})
    });

    console.log(`✅ ${type} reminder sent for appointment ${appointment.id}`);
  } catch (error: any) {
    console.error(`Failed to send ${type} reminder:`, error.message);
    throw error;
  }
}

/**
 * Format reminder message with vertical-aware terminology
 */
function formatReminderMessage(
  type: '24h' | '2h',
  patientName: string,
  professionalName: string,
  date: string,
  time: string,
  address: string,
  appointmentTerm: string,
  professionalEmoji: string,
  showArriveEarlyTip: boolean
): string {
  const firstName = patientName.split(' ')[0];

  // Parse date for display
  const [_year, month, day] = date.split('-');
  const formattedDate = `${day}/${month}`;

  const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const dateObj = new Date(`${date}T12:00:00`);
  const dayName = dayNames[dateObj.getDay()];

  if (type === '24h') {
    return (
      `Oi, *${firstName}*! 👋\n\n` +
      `Passando pra lembrar que sua ${appointmentTerm} é *amanhã*:\n\n` +
      `📅 *${dayName}, ${formattedDate}* às *${time}*\n` +
      `${professionalEmoji} *${professionalName}*\n` +
      (address ? `📍 *${address}*\n\n` : '\n') +
      `Você confirma presença?`
    );
  } else {
    const arrivalTip = showArriveEarlyTip
      ? ' Lembre-se de chegar 15 minutos antes.'
      : '';
    return (
      `Oi, *${firstName}*! 👋\n\n` +
      `Sua ${appointmentTerm} é daqui a *2 horas*!\n\n` +
      `🕐 *Hoje às ${time}*\n` +
      `${professionalEmoji} *${professionalName}*\n` +
      (address ? `📍 *${address}*\n\n` : '\n') +
      `Te esperamos!${arrivalTip}`
    );
  }
}

/**
 * Send a single reminder (for testing or manual triggers)
 */
export async function sendSingleReminder(
  appointmentId: string,
  type: '24h' | '2h'
): Promise<boolean> {
  try {
    let snapshot = await db.collectionGroup(APPOINTMENTS_SUBCOLLECTION)
      .where(FieldPath.documentId(), '==', appointmentId)
      .limit(1)
      .get();

    if (snapshot.empty) {
      snapshot = await db.collectionGroup(APPOINTMENTS_SUBCOLLECTION)
        .where('id', '==', appointmentId)
        .limit(1)
        .get();
    }

    if (snapshot.empty) {
      console.error(`Appointment ${appointmentId} not found`);
      return false;
    }

    const doc = snapshot.docs[0];
    const appointment = { id: doc.id, ...doc.data(), _ref: doc.ref };
    await sendReminder(appointment, type);
    return true;
  } catch (error) {
    console.error(`Error sending single reminder:`, error);
    return false;
  }
}
