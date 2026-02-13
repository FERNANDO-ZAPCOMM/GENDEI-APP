import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { findConversationForPhone } from '../utils/phone';

const db = getFirestore();

const PAYMENT_HOLD_MINUTES = Number(process.env.PAYMENT_HOLD_MINUTES || 15);
const HOLD_MS = Math.max(1, PAYMENT_HOLD_MINUTES) * 60 * 1000;

export interface PaymentHoldCleanupResult {
  scanned: number;
  expired: number;
  skipped: number;
  errors: number;
}

function parseDate(input: any): Date | null {
  if (!input) return null;

  if (input instanceof Date) return Number.isNaN(input.getTime()) ? null : input;

  if (input instanceof Timestamp) {
    const d = input.toDate();
    return Number.isNaN(d.getTime()) ? null : d;
  }

  if (typeof input === 'string') {
    const d = new Date(input);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  if (typeof input?.toDate === 'function') {
    try {
      const d = input.toDate();
      return d instanceof Date && !Number.isNaN(d.getTime()) ? d : null;
    } catch {
      return null;
    }
  }

  return null;
}

function needsPendingPaymentRelease(data: Record<string, any>): boolean {
  const status = String(data.status || '').toLowerCase();
  if (status !== 'pending') return false;

  const paymentType = String(data.paymentType || data.payment_type || '').toLowerCase();
  const signalPaid = Boolean(data.signalPaid ?? data.signal_paid ?? false);
  const signalCents = Number(data.signalCents ?? data.signal_cents ?? 0);

  // Backward compatibility for legacy fields.
  const depositAmount = Number(data.depositAmount ?? 0);
  const depositPaid = Boolean(data.depositPaid ?? false);

  const pendingSignal = paymentType === 'particular' && signalCents > 0 && !signalPaid;
  const pendingLegacyDeposit = depositAmount > 0 && !depositPaid;

  return pendingSignal || pendingLegacyDeposit;
}

async function syncCancelledAppointmentContext(
  appointmentRef: FirebaseFirestore.DocumentReference,
  appointmentData: Record<string, any>
): Promise<void> {
  try {
    const clinicId = appointmentRef.parent.parent?.id;
    if (!clinicId) return;

    const conversationRef = await findConversationForPhone(clinicId, appointmentData.patientPhone);
    if (!conversationRef) return;

    await conversationRef.set({
      appointmentContext: {
        appointmentId: appointmentRef.id,
        status: 'cancelled',
        date: appointmentData.date || null,
        time: appointmentData.time || null,
        patientPhone: appointmentData.patientPhone || null,
        patientName: appointmentData.patientName || null,
        professionalName: appointmentData.professionalName || null,
        serviceName: appointmentData.serviceName || null,
        updatedAt: FieldValue.serverTimestamp(),
      },
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  } catch (error) {
    console.error(`Failed to sync cancelled appointment context for ${appointmentRef.path}:`, error);
  }
}

export async function cleanupExpiredPaymentHolds(): Promise<PaymentHoldCleanupResult> {
  const result: PaymentHoldCleanupResult = {
    scanned: 0,
    expired: 0,
    skipped: 0,
    errors: 0,
  };

  const now = Date.now();
  const docs = await db.collectionGroup('appointments').where('status', '==', 'pending').get();

  let batch = db.batch();
  let ops = 0;

  for (const doc of docs.docs) {
    result.scanned += 1;
    const data = doc.data() as Record<string, any>;

    try {
      if (!needsPendingPaymentRelease(data)) {
        result.skipped += 1;
        continue;
      }

      const createdAt = parseDate(data.createdAt) || parseDate(data.updatedAt);
      if (!createdAt) {
        result.skipped += 1;
        continue;
      }

      if (now - createdAt.getTime() < HOLD_MS) {
        result.skipped += 1;
        continue;
      }

      batch.update(doc.ref, {
        status: 'cancelled',
        cancellationReason: `Reserva expirada por falta de pagamento do sinal (${PAYMENT_HOLD_MINUTES} min)`,
        cancelledAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      await syncCancelledAppointmentContext(doc.ref, data);
      ops += 1;
      result.expired += 1;

      if (ops >= 400) {
        await batch.commit();
        batch = db.batch();
        ops = 0;
      }
    } catch (error) {
      result.errors += 1;
      console.error(`Failed to process payment hold for ${doc.ref.path}:`, error);
    }
  }

  if (ops > 0) {
    await batch.commit();
  }

  return result;
}
