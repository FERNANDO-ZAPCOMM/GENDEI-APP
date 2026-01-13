# Gendei Availability Module
# Handles time slot generation, availability checking, and booking

import logging
from datetime import datetime, timedelta, date
from typing import List, Dict, Any, Optional
from .models import TimeSlot, Professional, Service

logger = logging.getLogger(__name__)


def get_available_slots(
    db,
    clinic_id: str,
    professional_id: Optional[str] = None,
    service_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    days_ahead: int = 14
) -> List[TimeSlot]:
    """
    Get available time slots for a clinic.

    Args:
        db: Database instance
        clinic_id: Clinic ID
        professional_id: Optional filter by professional
        service_id: Optional filter by service
        start_date: Start date (YYYY-MM-DD), defaults to today
        end_date: End date (YYYY-MM-DD), defaults to start_date + days_ahead
        days_ahead: Number of days to look ahead

    Returns:
        List of available TimeSlot objects
    """
    try:
        # Parse dates
        if not start_date:
            start = date.today()
        else:
            start = datetime.strptime(start_date, "%Y-%m-%d").date()

        if not end_date:
            end = start + timedelta(days=days_ahead)
        else:
            end = datetime.strptime(end_date, "%Y-%m-%d").date()

        # Get professionals for this clinic
        professionals = db.get_clinic_professionals(clinic_id)
        if professional_id:
            professionals = [p for p in professionals if p.id == professional_id]

        if not professionals:
            logger.warning(f"No professionals found for clinic {clinic_id}")
            return []

        # Get existing appointments to exclude booked slots
        existing_appointments = db.get_appointments_in_range(
            clinic_id=clinic_id,
            start_date=start.isoformat(),
            end_date=end.isoformat()
        )
        booked_slots = set()
        for apt in existing_appointments:
            if apt.status.value not in ["cancelled", "no_show"]:
                slot_key = f"{apt.date}_{apt.time}_{apt.professional_id}"
                booked_slots.add(slot_key)

        # Generate available slots
        available_slots = []
        current_date = start

        while current_date <= end:
            day_of_week = current_date.weekday()  # 0=Monday, 6=Sunday
            date_str = current_date.isoformat()

            for professional in professionals:
                # Get working hours for this day
                working_hours = professional.working_hours.get(str(day_of_week), [])

                for period in working_hours:
                    start_time = period.get("start", "09:00")
                    end_time = period.get("end", "18:00")

                    # Generate slots for this period
                    slots = _generate_slots_for_period(
                        date_str=date_str,
                        start_time=start_time,
                        end_time=end_time,
                        professional=professional,
                        clinic_id=clinic_id,
                        service_id=service_id,
                        booked_slots=booked_slots
                    )
                    available_slots.extend(slots)

            current_date += timedelta(days=1)

        # Sort by date and time
        available_slots.sort(key=lambda s: (s.date, s.time))

        logger.info(f"Found {len(available_slots)} available slots for clinic {clinic_id}")
        return available_slots

    except Exception as e:
        logger.error(f"Error getting available slots: {e}")
        return []


def _generate_slots_for_period(
    date_str: str,
    start_time: str,
    end_time: str,
    professional: Professional,
    clinic_id: str,
    service_id: Optional[str],
    booked_slots: set
) -> List[TimeSlot]:
    """Generate time slots for a working period"""
    slots = []

    try:
        start_hour, start_min = map(int, start_time.split(":"))
        end_hour, end_min = map(int, end_time.split(":"))

        current_hour = start_hour
        current_min = start_min
        duration = professional.appointment_duration
        buffer = professional.buffer_time

        while True:
            time_str = f"{current_hour:02d}:{current_min:02d}"
            slot_key = f"{date_str}_{time_str}_{professional.id}"

            # Check if slot is available
            if slot_key not in booked_slots:
                # Check if we haven't passed end time
                slot_end_min = current_min + duration + buffer
                slot_end_hour = current_hour + slot_end_min // 60
                slot_end_min = slot_end_min % 60

                if (slot_end_hour < end_hour) or (slot_end_hour == end_hour and slot_end_min <= end_min):
                    slot = TimeSlot(
                        date=date_str,
                        time=time_str,
                        professional_id=professional.id,
                        clinic_id=clinic_id,
                        service_id=service_id,
                        available=True
                    )
                    slots.append(slot)

            # Move to next slot
            current_min += duration + buffer
            if current_min >= 60:
                current_hour += current_min // 60
                current_min = current_min % 60

            # Check if we've passed end time
            if (current_hour > end_hour) or (current_hour == end_hour and current_min >= end_min):
                break

    except Exception as e:
        logger.error(f"Error generating slots: {e}")

    return slots


def get_professional_availability(
    db,
    clinic_id: str,
    professional_id: str,
    date_str: str
) -> List[str]:
    """
    Get available times for a specific professional on a specific date.

    Returns:
        List of available time strings (e.g., ["09:00", "10:00", "14:00"])
    """
    slots = get_available_slots(
        db=db,
        clinic_id=clinic_id,
        professional_id=professional_id,
        start_date=date_str,
        end_date=date_str
    )
    return [slot.time for slot in slots]


def book_time_slot(
    db,
    clinic_id: str,
    professional_id: str,
    date_str: str,
    time_str: str,
    appointment_id: str
) -> bool:
    """
    Book a time slot for an appointment.

    Returns:
        True if booking successful, False if slot is no longer available
    """
    try:
        # Check if slot is still available
        available = get_professional_availability(
            db=db,
            clinic_id=clinic_id,
            professional_id=professional_id,
            date_str=date_str
        )

        if time_str not in available:
            logger.warning(f"Slot {date_str} {time_str} for {professional_id} is no longer available")
            return False

        # Slot is available - the appointment creation will mark it as booked
        logger.info(f"Slot {date_str} {time_str} booked for appointment {appointment_id}")
        return True

    except Exception as e:
        logger.error(f"Error booking slot: {e}")
        return False


def format_slots_for_display(slots: List[TimeSlot], professional_name: str) -> str:
    """
    Format slots for WhatsApp message display.

    Returns:
        Formatted string with available slots
    """
    if not slots:
        return f"Não há horários disponíveis para {professional_name} nos próximos dias."

    # Group by date
    by_date: Dict[str, List[str]] = {}
    for slot in slots:
        if slot.date not in by_date:
            by_date[slot.date] = []
        by_date[slot.date].append(slot.time)

    # Format message
    lines = [f"*Agenda de {professional_name}*\n"]

    for date_str, times in sorted(by_date.items())[:5]:  # Limit to 5 days
        # Parse date
        dt = datetime.strptime(date_str, "%Y-%m-%d")
        day_names = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"]
        day_name = day_names[dt.weekday()]
        formatted_date = dt.strftime("%d/%m")

        # Format times
        times_str = ", ".join(times[:6])  # Limit to 6 times per day
        if len(times) > 6:
            times_str += f" (+{len(times) - 6})"

        lines.append(f"📅 *{day_name} {formatted_date}*: {times_str}")

    return "\n".join(lines)
