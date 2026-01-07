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
    release_time_slot,
    generate_weekly_slots
)
from .appointments import (
    create_appointment,
    update_appointment_status,
    get_appointments_by_phone,
    get_appointments_by_clinic,
    get_upcoming_appointments,
    cancel_appointment
)
from .reminders import (
    schedule_reminder,
    get_pending_reminders,
    mark_reminder_sent,
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
    'release_time_slot',
    'generate_weekly_slots',
    # Appointments
    'create_appointment',
    'update_appointment_status',
    'get_appointments_by_phone',
    'get_appointments_by_clinic',
    'get_upcoming_appointments',
    'cancel_appointment',
    # Reminders
    'schedule_reminder',
    'get_pending_reminders',
    'mark_reminder_sent',
    'REMINDER_24H',
    'REMINDER_2H'
]
