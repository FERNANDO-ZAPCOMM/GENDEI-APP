import type { Appointment } from './clinic-types';

export const PAYMENT_HOLD_MINUTES = 15;

function parseFirestoreDate(input: unknown): Date | null {
  if (!input) return null;
  if (input instanceof Date) return input;

  if (typeof input === 'string') {
    const d = new Date(input);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  if (typeof input === 'object') {
    const obj = input as Record<string, unknown>;
    if (typeof obj.toDate === 'function') {
      try {
        const d = (obj.toDate as () => Date)();
        return d instanceof Date && !Number.isNaN(d.getTime()) ? d : null;
      } catch {
        return null;
      }
    }

    const secondsRaw = obj.seconds ?? obj._seconds;
    if (typeof secondsRaw === 'number') {
      const nanosRaw = obj.nanoseconds ?? obj._nanoseconds;
      const millis = secondsRaw * 1000 + (typeof nanosRaw === 'number' ? Math.floor(nanosRaw / 1_000_000) : 0);
      const d = new Date(millis);
      return Number.isNaN(d.getTime()) ? null : d;
    }
  }

  return null;
}

export function isPendingPaymentAppointment(appointment: Partial<Appointment>): boolean {
  return (
    appointment.status === 'pending' &&
    appointment.paymentType === 'particular' &&
    (appointment.signalCents ?? 0) > 0 &&
    !appointment.signalPaid
  );
}

export function getPendingPaymentHoldInfo(
  appointment: Partial<Appointment>,
  now: Date = new Date(),
  holdMinutes: number = PAYMENT_HOLD_MINUTES
): { expiresAt: Date | null; isExpired: boolean; minutesLeft: number | null } | null {
  if (!isPendingPaymentAppointment(appointment)) return null;

  const createdAt = parseFirestoreDate(appointment.createdAt) ?? parseFirestoreDate(appointment.updatedAt);
  if (!createdAt) {
    return { expiresAt: null, isExpired: false, minutesLeft: null };
  }

  const expiresAt = new Date(createdAt.getTime() + holdMinutes * 60 * 1000);
  const diffMs = expiresAt.getTime() - now.getTime();
  const minutesLeft = Math.max(0, Math.ceil(diffMs / 60000));

  return {
    expiresAt,
    isExpired: diffMs <= 0,
    minutesLeft,
  };
}

