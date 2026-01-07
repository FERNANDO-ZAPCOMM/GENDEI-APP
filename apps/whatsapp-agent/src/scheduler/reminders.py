# Gendei Reminders Module
# Handles appointment reminder scheduling and sending

import logging
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from .models import Appointment, AppointmentStatus

logger = logging.getLogger(__name__)

# Reminder types
REMINDER_24H = "reminder_24h"
REMINDER_2H = "reminder_2h"


def get_appointments_needing_reminder(
    db,
    reminder_type: str,
    clinic_id: Optional[str] = None
) -> List[Appointment]:
    """
    Get appointments that need a specific reminder sent.

    Args:
        db: Database instance
        reminder_type: REMINDER_24H or REMINDER_2H
        clinic_id: Optional filter by clinic

    Returns:
        List of appointments needing reminders
    """
    try:
        now = datetime.now()

        if reminder_type == REMINDER_24H:
            # Get appointments 23-25 hours from now
            window_start = now + timedelta(hours=23)
            window_end = now + timedelta(hours=25)
            reminder_field = "reminder24hSent"
        elif reminder_type == REMINDER_2H:
            # Get appointments 1.5-2.5 hours from now
            window_start = now + timedelta(hours=1, minutes=30)
            window_end = now + timedelta(hours=2, minutes=30)
            reminder_field = "reminder2hSent"
        else:
            logger.error(f"Unknown reminder type: {reminder_type}")
            return []

        # Query appointments in the window
        start_date = window_start.date().isoformat()
        end_date = window_end.date().isoformat()

        if clinic_id:
            appointments = db.get_clinic_appointments(
                clinic_id=clinic_id,
                start_date=start_date,
                end_date=end_date
            )
        else:
            appointments = db.get_all_appointments_in_range(
                start_date=start_date,
                end_date=end_date
            )

        # Filter to confirmed appointments that haven't received this reminder
        needs_reminder = []
        for apt in appointments:
            # Check status
            if apt.status.value not in ["confirmed", "confirmed_presence"]:
                continue

            # Check if already sent
            if reminder_type == REMINDER_24H and apt.reminder_24h_sent:
                continue
            if reminder_type == REMINDER_2H and apt.reminder_2h_sent:
                continue

            # Check if in time window
            apt_dt = datetime.strptime(f"{apt.date} {apt.time}", "%Y-%m-%d %H:%M")
            if window_start <= apt_dt <= window_end:
                needs_reminder.append(apt)

        logger.info(f"Found {len(needs_reminder)} appointments needing {reminder_type}")
        return needs_reminder

    except Exception as e:
        logger.error(f"Error getting appointments needing reminder: {e}")
        return []


def schedule_reminder(
    db,
    appointment_id: str,
    reminder_type: str,
    scheduled_for: datetime
) -> bool:
    """
    Schedule a reminder for an appointment.
    In production, this would create a Cloud Scheduler job.

    Returns:
        True if successful
    """
    try:
        # Create reminder record
        reminder_data = {
            "appointmentId": appointment_id,
            "type": reminder_type,
            "scheduledFor": scheduled_for.isoformat(),
            "sent": False,
            "createdAt": datetime.now().isoformat()
        }

        db.create_reminder(reminder_data)

        logger.info(f"✅ Reminder {reminder_type} scheduled for appointment {appointment_id} at {scheduled_for}")
        return True

    except Exception as e:
        logger.error(f"Error scheduling reminder: {e}")
        return False


def get_pending_reminders(db, clinic_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Get all pending reminders that should be sent now.

    Returns:
        List of reminder dicts
    """
    try:
        now = datetime.now()
        reminders = db.get_pending_reminders(clinic_id)

        # Filter to reminders that should be sent now
        pending = []
        for reminder in reminders:
            scheduled_for = datetime.fromisoformat(reminder.get("scheduledFor", ""))
            if scheduled_for <= now and not reminder.get("sent"):
                pending.append(reminder)

        return pending

    except Exception as e:
        logger.error(f"Error getting pending reminders: {e}")
        return []


def mark_reminder_sent(
    db,
    appointment_id: str,
    reminder_type: str
) -> bool:
    """
    Mark a reminder as sent on the appointment.

    Returns:
        True if successful
    """
    try:
        if reminder_type == REMINDER_24H:
            update_data = {
                "reminder24hSent": True,
                "reminder24hAt": datetime.now().isoformat()
            }
        elif reminder_type == REMINDER_2H:
            update_data = {
                "reminder2hSent": True,
                "reminder2hAt": datetime.now().isoformat()
            }
        else:
            logger.error(f"Unknown reminder type: {reminder_type}")
            return False

        update_data["updatedAt"] = datetime.now().isoformat()

        db.update_appointment(appointment_id, update_data)

        logger.info(f"✅ Reminder {reminder_type} marked as sent for {appointment_id}")
        return True

    except Exception as e:
        logger.error(f"Error marking reminder as sent: {e}")
        return False


def format_reminder_message(
    appointment: Appointment,
    reminder_type: str,
    clinic_name: str,
    clinic_address: str
) -> str:
    """
    Format reminder message for WhatsApp.

    Returns:
        Formatted reminder message
    """
    # Parse date
    dt = datetime.strptime(appointment.date, "%Y-%m-%d")
    day_names = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"]
    day_name = day_names[dt.weekday()]
    formatted_date = dt.strftime("%d/%m")

    if reminder_type == REMINDER_24H:
        message = (
            f"Oi, *{appointment.patient_name.split()[0]}*! 👋\n\n"
            f"Passando pra lembrar que sua consulta é *amanhã*:\n\n"
            f"📅 *{day_name}, {formatted_date}* às *{appointment.time}*\n"
            f"👨‍⚕️ *{appointment.professional_name}*\n"
            f"📍 *{clinic_address}*\n\n"
            f"Você confirma presença?"
        )
    else:  # REMINDER_2H
        message = (
            f"Oi, *{appointment.patient_name.split()[0]}*! 👋\n\n"
            f"Sua consulta é daqui a *2 horas*!\n\n"
            f"🕐 *Hoje às {appointment.time}*\n"
            f"👨‍⚕️ *{appointment.professional_name}*\n"
            f"📍 *{clinic_address}*\n\n"
            f"Te esperamos! Lembre-se de chegar 15 minutos antes."
        )

    return message


def format_confirmation_buttons() -> List[Dict[str, str]]:
    """
    Get button options for reminder confirmation.

    Returns:
        List of button dicts for WhatsApp
    """
    return [
        {
            "id": "confirm_yes",
            "title": "Confirmar"
        },
        {
            "id": "confirm_reschedule",
            "title": "Reagendar"
        },
        {
            "id": "confirm_cancel",
            "title": "Cancelar"
        }
    ]


def calculate_reminder_times(appointment_date: str, appointment_time: str) -> Dict[str, datetime]:
    """
    Calculate when to send reminders for an appointment.

    Returns:
        Dict with reminder type -> datetime to send
    """
    apt_dt = datetime.strptime(f"{appointment_date} {appointment_time}", "%Y-%m-%d %H:%M")

    return {
        REMINDER_24H: apt_dt - timedelta(hours=24),
        REMINDER_2H: apt_dt - timedelta(hours=2)
    }


def should_send_reminder_now(
    reminder_datetime: datetime,
    window_minutes: int = 15
) -> bool:
    """
    Check if a reminder should be sent now (within the window).

    Returns:
        True if reminder should be sent
    """
    now = datetime.now()
    window_start = reminder_datetime - timedelta(minutes=window_minutes // 2)
    window_end = reminder_datetime + timedelta(minutes=window_minutes // 2)

    return window_start <= now <= window_end
