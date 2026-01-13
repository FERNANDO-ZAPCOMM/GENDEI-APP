# Gendei Appointments Module
# Handles appointment creation, updates, and queries

import logging
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
import uuid
from .models import Appointment, AppointmentStatus, PaymentType, Patient

logger = logging.getLogger(__name__)


def create_appointment(
    db,
    clinic_id: str,
    patient_phone: str,
    professional_id: str,
    date_str: str,
    time_str: str,
    patient_name: str,
    professional_name: str,
    service_id: Optional[str] = None,
    payment_type: str = "particular",
    total_cents: int = 0,
    signal_percentage: int = 15,
    convenio_name: Optional[str] = None,
    convenio_number: Optional[str] = None,
    patient_cpf: Optional[str] = None,
    patient_birth_date: Optional[str] = None,
    duration_minutes: int = 30
) -> Optional[Appointment]:
    """
    Create a new appointment.

    Returns:
        Created Appointment object or None if failed
    """
    try:
        # Generate appointment ID
        appointment_id = f"apt_{uuid.uuid4().hex[:12]}"

        # Calculate signal amount
        if payment_type == "convenio":
            signal_cents = 0
        else:
            signal_cents = int(total_cents * signal_percentage / 100)

        # Create or update patient
        patient_id = patient_phone.replace("+", "").replace("-", "").replace(" ", "")
        patient = Patient(
            id=patient_id,
            phone=patient_phone,
            name=patient_name,
            cpf=patient_cpf,
            birth_date=patient_birth_date,
            convenio_name=convenio_name,
            convenio_number=convenio_number,
            clinic_ids=[clinic_id]
        )
        db.upsert_patient(patient)

        # Create appointment
        appointment = Appointment(
            id=appointment_id,
            clinic_id=clinic_id,
            patient_id=patient_id,
            professional_id=professional_id,
            service_id=service_id,
            date=date_str,
            time=time_str,
            duration_minutes=duration_minutes,
            status=AppointmentStatus.PENDING,
            payment_type=PaymentType(payment_type),
            total_cents=total_cents,
            signal_cents=signal_cents,
            signal_paid=False,
            convenio_name=convenio_name,
            convenio_number=convenio_number,
            patient_name=patient_name,
            patient_phone=patient_phone,
            professional_name=professional_name
        )

        # Save to database
        db.create_appointment(appointment)

        logger.info(f"✅ Appointment {appointment_id} created for {patient_name} on {date_str} {time_str}")
        return appointment

    except Exception as e:
        logger.error(f"Error creating appointment: {e}")
        return None


def update_appointment_status(
    db,
    appointment_id: str,
    new_status: AppointmentStatus,
    notes: Optional[str] = None,
    cancellation_reason: Optional[str] = None
) -> bool:
    """
    Update appointment status.

    Returns:
        True if successful
    """
    try:
        update_data = {
            "status": new_status.value,
            "updatedAt": datetime.now().isoformat()
        }

        if new_status == AppointmentStatus.CONFIRMED:
            update_data["confirmedAt"] = datetime.now().isoformat()
        elif new_status == AppointmentStatus.CANCELLED:
            update_data["cancelledAt"] = datetime.now().isoformat()
            if cancellation_reason:
                update_data["cancellationReason"] = cancellation_reason
        elif new_status == AppointmentStatus.COMPLETED:
            update_data["completedAt"] = datetime.now().isoformat()

        if notes:
            update_data["notes"] = notes

        db.update_appointment(appointment_id, update_data)

        logger.info(f"✅ Appointment {appointment_id} status updated to {new_status.value}")
        return True

    except Exception as e:
        logger.error(f"Error updating appointment status: {e}")
        return False


def mark_appointment_paid(
    db,
    appointment_id: str,
    payment_id: str
) -> bool:
    """
    Mark appointment signal as paid.

    Returns:
        True if successful
    """
    try:
        update_data = {
            "signalPaid": True,
            "signalPaymentId": payment_id,
            "status": AppointmentStatus.CONFIRMED.value,
            "confirmedAt": datetime.now().isoformat(),
            "updatedAt": datetime.now().isoformat()
        }

        db.update_appointment(appointment_id, update_data)

        logger.info(f"✅ Appointment {appointment_id} marked as paid (payment: {payment_id})")
        return True

    except Exception as e:
        logger.error(f"Error marking appointment as paid: {e}")
        return False


def get_appointments_by_phone(
    db,
    patient_phone: str,
    clinic_id: Optional[str] = None,
    include_past: bool = False
) -> List[Appointment]:
    """
    Get appointments for a patient by phone number.

    Returns:
        List of Appointment objects
    """
    try:
        patient_id = patient_phone.replace("+", "").replace("-", "").replace(" ", "")
        appointments = db.get_patient_appointments(patient_id, clinic_id)

        if not include_past:
            today = datetime.now().date().isoformat()
            appointments = [
                a for a in appointments
                if a.date >= today and a.status.value not in ["cancelled", "completed", "no_show"]
            ]

        # Sort by date and time
        appointments.sort(key=lambda a: (a.date, a.time))

        return appointments

    except Exception as e:
        logger.error(f"Error getting appointments by phone: {e}")
        return []


def get_appointments_by_clinic(
    db,
    clinic_id: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    professional_id: Optional[str] = None,
    status: Optional[AppointmentStatus] = None
) -> List[Appointment]:
    """
    Get appointments for a clinic with optional filters.

    Returns:
        List of Appointment objects
    """
    try:
        appointments = db.get_clinic_appointments(
            clinic_id=clinic_id,
            start_date=start_date,
            end_date=end_date,
            professional_id=professional_id
        )

        if status:
            appointments = [a for a in appointments if a.status == status]

        # Sort by date and time
        appointments.sort(key=lambda a: (a.date, a.time))

        return appointments

    except Exception as e:
        logger.error(f"Error getting appointments by clinic: {e}")
        return []


def get_upcoming_appointments(
    db,
    clinic_id: str,
    hours_ahead: int = 24
) -> List[Appointment]:
    """
    Get appointments happening in the next N hours.
    Useful for sending reminders.

    Returns:
        List of Appointment objects
    """
    try:
        now = datetime.now()
        end_time = now + timedelta(hours=hours_ahead)

        # Get today's and tomorrow's appointments
        start_date = now.date().isoformat()
        end_date = end_time.date().isoformat()

        appointments = db.get_clinic_appointments(
            clinic_id=clinic_id,
            start_date=start_date,
            end_date=end_date
        )

        # Filter to only confirmed appointments within the time window
        upcoming = []
        for apt in appointments:
            if apt.status.value not in ["confirmed", "confirmed_presence", "awaiting_confirmation"]:
                continue

            # Parse appointment datetime
            apt_dt = datetime.strptime(f"{apt.date} {apt.time}", "%Y-%m-%d %H:%M")

            if now <= apt_dt <= end_time:
                upcoming.append(apt)

        # Sort by datetime
        upcoming.sort(key=lambda a: (a.date, a.time))

        return upcoming

    except Exception as e:
        logger.error(f"Error getting upcoming appointments: {e}")
        return []


def cancel_appointment(
    db,
    appointment_id: str,
    reason: str = "Cancelado pelo paciente"
) -> bool:
    """
    Cancel an appointment.

    Returns:
        True if successful
    """
    return update_appointment_status(
        db=db,
        appointment_id=appointment_id,
        new_status=AppointmentStatus.CANCELLED,
        cancellation_reason=reason
    )


def reschedule_appointment(
    db,
    appointment_id: str,
    new_date: str,
    new_time: str,
    new_professional_id: Optional[str] = None
) -> bool:
    """
    Reschedule an appointment to a new date/time.

    Returns:
        True if successful
    """
    try:
        update_data = {
            "date": new_date,
            "time": new_time,
            "status": AppointmentStatus.PENDING.value,
            "reminder24hSent": False,
            "reminder2hSent": False,
            "updatedAt": datetime.now().isoformat()
        }

        if new_professional_id:
            update_data["professionalId"] = new_professional_id

        db.update_appointment(appointment_id, update_data)

        logger.info(f"✅ Appointment {appointment_id} rescheduled to {new_date} {new_time}")
        return True

    except Exception as e:
        logger.error(f"Error rescheduling appointment: {e}")
        return False


def get_appointment_by_id(db, appointment_id: str) -> Optional[Appointment]:
    """Get a single appointment by ID"""
    try:
        return db.get_appointment(appointment_id)
    except Exception as e:
        logger.error(f"Error getting appointment {appointment_id}: {e}")
        return None


