"""Scheduler module for appointments and availability."""
from .models import Appointment, AppointmentStatus, Clinic, Professional, Service, Patient, PaymentType
from .appointments import (
    get_appointments_by_phone,
    create_appointment,
    cancel_appointment,
    reschedule_appointment,
    update_appointment_status,
)
from .availability import (
    get_available_slots,
    get_professional_availability,
    format_slots_for_display,
)

__all__ = [
    "Appointment",
    "AppointmentStatus",
    "Clinic",
    "Professional",
    "Service",
    "Patient",
    "PaymentType",
    "get_appointments_by_phone",
    "create_appointment",
    "cancel_appointment",
    "reschedule_appointment",
    "update_appointment_status",
    "get_available_slots",
    "get_professional_availability",
    "format_slots_for_display",
]
