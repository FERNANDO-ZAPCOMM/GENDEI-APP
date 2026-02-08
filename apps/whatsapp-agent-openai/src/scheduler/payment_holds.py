"""Helpers for unpaid payment-hold lifecycle."""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, List, Optional

from .models import Appointment, AppointmentStatus, PaymentType

DEFAULT_PAYMENT_HOLD_MINUTES = 15


def _coerce_datetime(value: Any) -> Optional[datetime]:
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    if hasattr(value, "isoformat"):
        try:
            return datetime.fromisoformat(value.isoformat())
        except Exception:
            return None
    if isinstance(value, str):
        raw = value.strip()
        if not raw:
            return None
        if raw.endswith("Z"):
            raw = raw[:-1] + "+00:00"
        try:
            return datetime.fromisoformat(raw)
        except Exception:
            return None
    return None


def is_payment_hold_appointment(appointment: Appointment) -> bool:
    return (
        appointment.status == AppointmentStatus.PENDING
        and appointment.payment_type == PaymentType.PARTICULAR
        and not appointment.signal_paid
        and appointment.signal_cents > 0
    )


def is_unpaid_hold_expired(
    appointment: Appointment,
    hold_minutes: int = DEFAULT_PAYMENT_HOLD_MINUTES,
    now: Optional[datetime] = None,
) -> bool:
    if not is_payment_hold_appointment(appointment):
        return False
    created_at = _coerce_datetime(appointment.created_at) or _coerce_datetime(appointment.updated_at)
    if not created_at:
        return False
    now_dt = now or datetime.now(created_at.tzinfo)
    return now_dt >= (created_at + timedelta(minutes=max(1, hold_minutes)))


def release_expired_unpaid_holds(
    db: Any,
    appointments: List[Appointment],
    hold_minutes: int = DEFAULT_PAYMENT_HOLD_MINUTES,
) -> List[Appointment]:
    released: List[Appointment] = []
    for appointment in appointments:
        if not is_unpaid_hold_expired(appointment, hold_minutes=hold_minutes):
            continue
        if db:
            db.update_appointment(
                appointment.id,
                {
                    "status": AppointmentStatus.CANCELLED.value,
                    "cancellationReason": (
                        f"Reserva expirada por falta de pagamento do sinal ({hold_minutes} min)"
                    ),
                    "cancelledAt": datetime.now().isoformat(),
                },
                clinic_id=appointment.clinic_id,
            )
        appointment.status = AppointmentStatus.CANCELLED
        released.append(appointment)
    return released

