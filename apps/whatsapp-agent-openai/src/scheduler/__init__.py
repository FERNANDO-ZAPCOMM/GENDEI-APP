# Gendei Scheduler Module
# Handles clinic appointments, professionals, availability, and reminders

from .models import (
    Clinic,
    Professional,
    Service,
    TimeSlot,
    Appointment,
    Patient,
    AppointmentStatus,
    PaymentType
)
from .availability import (
    get_available_slots,
    get_professional_availability,
    book_time_slot,
    format_slots_for_display
)
from .appointments import (
    create_appointment,
    update_appointment_status,
    get_appointments_by_phone,
    cancel_appointment,
    reschedule_appointment
)
from .reminders import (
    mark_reminder_sent,
    format_reminder_message,
    REMINDER_24H,
    REMINDER_2H
)

__all__ = [
    # Models
    'Clinic',
    'Professional',
    'Service',
    'TimeSlot',
    'Appointment',
    'Patient',
    'AppointmentStatus',
    'PaymentType',
    # Availability
    'get_available_slots',
    'get_professional_availability',
    'book_time_slot',
    'format_slots_for_display',
    # Appointments
    'create_appointment',
    'update_appointment_status',
    'get_appointments_by_phone',
    'cancel_appointment',
    'reschedule_appointment',
    # Reminders
    'mark_reminder_sent',
    'format_reminder_message',
    'REMINDER_24H',
    'REMINDER_2H'
]
