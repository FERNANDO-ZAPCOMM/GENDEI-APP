# Gendei Reminders Module
# Handles appointment reminder formatting and tracking

import logging
from datetime import datetime
from .models import Appointment

logger = logging.getLogger(__name__)

# Reminder types
REMINDER_24H = "reminder_24h"
REMINDER_2H = "reminder_2h"


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

        logger.info(f"Reminder {reminder_type} marked as sent for {appointment_id}")
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
    day_names = ["Segunda", "Terca", "Quarta", "Quinta", "Sexta", "Sabado", "Domingo"]
    day_name = day_names[dt.weekday()]
    formatted_date = dt.strftime("%d/%m")

    if reminder_type == REMINDER_24H:
        message = (
            f"Oi, *{appointment.patient_name.split()[0]}*!\n\n"
            f"Passando pra lembrar que sua consulta e *amanha*:\n\n"
            f"Data: *{day_name}, {formatted_date}* as *{appointment.time}*\n"
            f"Profissional: *{appointment.professional_name}*\n"
            f"Local: *{clinic_address}*\n\n"
            f"Voce confirma presenca?"
        )
    else:  # REMINDER_2H
        message = (
            f"Oi, *{appointment.patient_name.split()[0]}*!\n\n"
            f"Sua consulta e daqui a *2 horas*!\n\n"
            f"Horario: *Hoje as {appointment.time}*\n"
            f"Profissional: *{appointment.professional_name}*\n"
            f"Local: *{clinic_address}*\n\n"
            f"Te esperamos! Lembre-se de chegar 15 minutos antes."
        )

    return message
