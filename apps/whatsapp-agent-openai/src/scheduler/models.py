# Gendei Scheduler Models
# Data models for clinic appointment scheduling

from dataclasses import dataclass, field
from datetime import datetime, time, date
from typing import Optional, List, Dict, Any
from enum import Enum


class AppointmentStatus(Enum):
    """Appointment status enum"""
    PENDING = "pending"              # Waiting for payment
    CONFIRMED = "confirmed"          # Payment received, appointment confirmed
    AWAITING_CONFIRMATION = "awaiting_confirmation"  # Reminder sent, waiting for response
    CONFIRMED_PRESENCE = "confirmed_presence"  # Patient confirmed attendance
    COMPLETED = "completed"          # Appointment completed
    CANCELLED = "cancelled"          # Cancelled by patient or clinic
    NO_SHOW = "no_show"              # Patient didn't show up


class PaymentType(Enum):
    """Payment type enum"""
    PARTICULAR = "particular"        # Private/cash
    CONVENIO = "convenio"           # Health insurance


class ReminderType(Enum):
    """Reminder type enum"""
    REMINDER_24H = "reminder_24h"    # 24 hours before
    REMINDER_2H = "reminder_2h"      # 2 hours before


@dataclass
class Clinic:
    """Clinic data model"""
    id: str
    name: str
    owner_id: str                   # Firebase Auth UID
    phone: str
    email: Optional[str] = None
    address: str = ""
    city: str = ""
    state: str = ""
    zip_code: str = ""
    cnpj: Optional[str] = None
    description: str = ""           # Clinic description
    greeting_summary: str = ""      # AI-generated greeting summary

    # WhatsApp connection
    whatsapp_phone_number_id: Optional[str] = None
    whatsapp_waba_id: Optional[str] = None
    whatsapp_access_token: Optional[str] = None
    whatsapp_connected: bool = False

    # Workflow mode: 'booking' (full scheduling) or 'info' (information only)
    workflow_mode: str = "booking"

    # Payment settings
    payment_gateway: str = "pagseguro"
    pagseguro_token: Optional[str] = None
    signal_percentage: int = 15     # Default 15% deposit
    pix_key: Optional[str] = None   # PIX key for manual payments
    payment_settings: Dict[str, Any] = field(default_factory=dict)  # Full payment settings

    # WhatsApp config (includes flow IDs, templates config, etc.)
    whatsapp_config: Dict[str, Any] = field(default_factory=dict)

    # Settings
    admin_ids: List[str] = field(default_factory=list)
    timezone: str = "America/Sao_Paulo"
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "ownerId": self.owner_id,
            "phone": self.phone,
            "email": self.email,
            "address": self.address,
            "city": self.city,
            "state": self.state,
            "zipCode": self.zip_code,
            "cnpj": self.cnpj,
            "description": self.description,
            "greetingSummary": self.greeting_summary,
            "whatsappPhoneNumberId": self.whatsapp_phone_number_id,
            "whatsappWabaId": self.whatsapp_waba_id,
            "whatsappConnected": self.whatsapp_connected,
            "workflowMode": self.workflow_mode,
            "paymentGateway": self.payment_gateway,
            "signalPercentage": self.signal_percentage,
            "pixKey": self.pix_key,
            "paymentSettings": self.payment_settings,
            "whatsappConfig": self.whatsapp_config,
            "adminIds": self.admin_ids,
            "timezone": self.timezone,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "updatedAt": self.updated_at.isoformat() if self.updated_at else None
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Clinic":
        return cls(
            id=data.get("id", ""),
            name=data.get("name", ""),
            owner_id=data.get("ownerId", ""),
            phone=data.get("phone", ""),
            email=data.get("email"),
            address=data.get("address", ""),
            city=data.get("city", ""),
            state=data.get("state", ""),
            zip_code=data.get("zipCode", ""),
            cnpj=data.get("cnpj"),
            description=data.get("description", ""),
            greeting_summary=data.get("greetingSummary", ""),
            whatsapp_phone_number_id=data.get("whatsappPhoneNumberId"),
            whatsapp_waba_id=data.get("whatsappWabaId"),
            whatsapp_access_token=data.get("whatsappAccessToken"),
            whatsapp_connected=data.get("whatsappConnected", False),
            workflow_mode=data.get("workflowMode", "booking"),
            payment_gateway=data.get("paymentGateway", "pagseguro"),
            pagseguro_token=data.get("pagseguroToken"),
            signal_percentage=data.get("signalPercentage", 15),
            pix_key=data.get("pixKey"),
            payment_settings=data.get("paymentSettings", {}),
            whatsapp_config=data.get("whatsappConfig", {}),
            admin_ids=data.get("adminIds", []),
            timezone=data.get("timezone", "America/Sao_Paulo")
        )


@dataclass
class Professional:
    """Professional/Doctor data model"""
    id: str
    clinic_id: str
    name: str
    specialty: str                  # e.g., "dermatologia", "pediatria"
    title: str = ""                 # e.g., "Dr.", "Dra."
    crm: Optional[str] = None       # Medical license number
    email: Optional[str] = None
    phone: Optional[str] = None

    # Working hours (per day of week: 0=Monday, 6=Sunday)
    working_hours: Dict[int, List[Dict[str, str]]] = field(default_factory=dict)
    # Example: {0: [{"start": "09:00", "end": "12:00"}, {"start": "14:00", "end": "18:00"}]}

    # Appointment settings
    appointment_duration: int = 30  # minutes
    buffer_time: int = 0            # minutes between appointments

    # Services this professional offers
    service_ids: List[str] = field(default_factory=list)

    active: bool = True
    created_at: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "clinicId": self.clinic_id,
            "name": self.name,
            "specialty": self.specialty,
            "title": self.title,
            "crm": self.crm,
            "email": self.email,
            "phone": self.phone,
            "workingHours": self.working_hours,
            "appointmentDuration": self.appointment_duration,
            "bufferTime": self.buffer_time,
            "serviceIds": self.service_ids,
            "active": self.active,
            "createdAt": self.created_at.isoformat() if self.created_at else None
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Professional":
        return cls(
            id=data.get("id", ""),
            clinic_id=data.get("clinicId", ""),
            name=data.get("name", ""),
            specialty=data.get("specialty", ""),
            title=data.get("title", ""),
            crm=data.get("crm"),
            email=data.get("email"),
            phone=data.get("phone"),
            working_hours=data.get("workingHours", {}),
            appointment_duration=data.get("appointmentDuration", 30),
            buffer_time=data.get("bufferTime", 0),
            service_ids=data.get("serviceIds", []),
            active=data.get("active", True)
        )

    @property
    def full_name(self) -> str:
        """Returns full name with title"""
        if self.title:
            return f"{self.title} {self.name}"
        return self.name


@dataclass
class Service:
    """Service/Procedure data model"""
    id: str
    clinic_id: str
    name: str
    description: str = ""

    # Pricing
    price_cents: int = 0            # Price in cents
    signal_percentage: Optional[int] = None  # Override clinic default

    # Duration
    duration_minutes: int = 30

    # Which professionals offer this service
    professional_ids: List[str] = field(default_factory=list)

    # Payment types accepted
    accepts_particular: bool = True
    accepts_convenio: bool = True
    convenios: List[str] = field(default_factory=list)  # List of accepted insurance

    active: bool = True
    created_at: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "clinicId": self.clinic_id,
            "name": self.name,
            "description": self.description,
            "priceCents": self.price_cents,
            "signalPercentage": self.signal_percentage,
            "durationMinutes": self.duration_minutes,
            "professionalIds": self.professional_ids,
            "acceptsParticular": self.accepts_particular,
            "acceptsConvenio": self.accepts_convenio,
            "convenios": self.convenios,
            "active": self.active,
            "createdAt": self.created_at.isoformat() if self.created_at else None
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Service":
        return cls(
            id=data.get("id", ""),
            clinic_id=data.get("clinicId", ""),
            name=data.get("name", ""),
            description=data.get("description", ""),
            price_cents=data.get("priceCents", 0),
            signal_percentage=data.get("signalPercentage"),
            duration_minutes=data.get("durationMinutes", 30),
            professional_ids=data.get("professionalIds", []),
            accepts_particular=data.get("acceptsParticular", True),
            accepts_convenio=data.get("acceptsConvenio", True),
            convenios=data.get("convenios", []),
            active=data.get("active", True)
        )

    @property
    def price_reais(self) -> float:
        """Returns price in BRL"""
        return self.price_cents / 100


@dataclass
class TimeSlot:
    """Available time slot"""
    date: str                       # YYYY-MM-DD
    time: str                       # HH:MM
    professional_id: str
    clinic_id: str
    service_id: Optional[str] = None

    # Status
    available: bool = True
    appointment_id: Optional[str] = None  # If booked

    def to_dict(self) -> Dict[str, Any]:
        return {
            "date": self.date,
            "time": self.time,
            "professionalId": self.professional_id,
            "clinicId": self.clinic_id,
            "serviceId": self.service_id,
            "available": self.available,
            "appointmentId": self.appointment_id
        }

    @property
    def datetime_str(self) -> str:
        """Returns formatted datetime string"""
        return f"{self.date} às {self.time}"

    @property
    def slot_id(self) -> str:
        """Unique slot identifier"""
        return f"{self.date}_{self.time.replace(':', '')}_{self.professional_id}"


@dataclass
class Patient:
    """Patient data model"""
    id: str                         # Usually phone number
    phone: str
    name: str
    cpf: Optional[str] = None
    birth_date: Optional[str] = None
    email: Optional[str] = None

    # Health insurance info
    convenio_name: Optional[str] = None
    convenio_number: Optional[str] = None

    # Clinics this patient has visited
    clinic_ids: List[str] = field(default_factory=list)

    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "phone": self.phone,
            "name": self.name,
            "cpf": self.cpf,
            "birthDate": self.birth_date,
            "email": self.email,
            "convenioName": self.convenio_name,
            "convenioNumber": self.convenio_number,
            "clinicIds": self.clinic_ids,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "updatedAt": self.updated_at.isoformat() if self.updated_at else None
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Patient":
        return cls(
            id=data.get("id", ""),
            phone=data.get("phone", ""),
            name=data.get("name", ""),
            cpf=data.get("cpf"),
            birth_date=data.get("birthDate"),
            email=data.get("email"),
            convenio_name=data.get("convenioName"),
            convenio_number=data.get("convenioNumber"),
            clinic_ids=data.get("clinicIds", [])
        )


@dataclass
class Appointment:
    """Appointment data model"""
    id: str
    clinic_id: str
    patient_id: str
    professional_id: str

    # Schedule (required fields must come before optional fields with defaults)
    date: str                       # YYYY-MM-DD
    time: str                       # HH:MM

    # Optional fields
    service_id: Optional[str] = None
    duration_minutes: int = 30

    # Status
    status: AppointmentStatus = AppointmentStatus.PENDING

    # Payment
    payment_type: PaymentType = PaymentType.PARTICULAR
    total_cents: int = 0
    signal_cents: int = 0
    signal_paid: bool = False
    signal_payment_id: Optional[str] = None
    convenio_name: Optional[str] = None
    convenio_number: Optional[str] = None

    # Patient info (denormalized for easy access)
    patient_name: str = ""
    patient_phone: str = ""

    # Professional info (denormalized)
    professional_name: str = ""

    # Reminders
    reminder_24h_sent: bool = False
    reminder_24h_at: Optional[datetime] = None
    reminder_2h_sent: bool = False
    reminder_2h_at: Optional[datetime] = None

    # Timestamps
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    confirmed_at: Optional[datetime] = None
    cancelled_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    # Notes
    notes: str = ""
    cancellation_reason: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "clinicId": self.clinic_id,
            "patientId": self.patient_id,
            "professionalId": self.professional_id,
            "serviceId": self.service_id,
            "date": self.date,
            "time": self.time,
            "durationMinutes": self.duration_minutes,
            "status": self.status.value,
            "paymentType": self.payment_type.value,
            "totalCents": self.total_cents,
            "signalCents": self.signal_cents,
            "signalPaid": self.signal_paid,
            "signalPaymentId": self.signal_payment_id,
            "convenioName": self.convenio_name,
            "convenioNumber": self.convenio_number,
            "patientName": self.patient_name,
            "patientPhone": self.patient_phone,
            "professionalName": self.professional_name,
            "reminder24hSent": self.reminder_24h_sent,
            "reminder24hAt": self.reminder_24h_at.isoformat() if self.reminder_24h_at else None,
            "reminder2hSent": self.reminder_2h_sent,
            "reminder2hAt": self.reminder_2h_at.isoformat() if self.reminder_2h_at else None,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "updatedAt": self.updated_at.isoformat() if self.updated_at else None,
            "confirmedAt": self.confirmed_at.isoformat() if self.confirmed_at else None,
            "cancelledAt": self.cancelled_at.isoformat() if self.cancelled_at else None,
            "completedAt": self.completed_at.isoformat() if self.completed_at else None,
            "notes": self.notes,
            "cancellationReason": self.cancellation_reason
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Appointment":
        return cls(
            id=data.get("id", ""),
            clinic_id=data.get("clinicId", ""),
            patient_id=data.get("patientId", ""),
            professional_id=data.get("professionalId", ""),
            service_id=data.get("serviceId"),
            date=data.get("date", ""),
            time=data.get("time", ""),
            duration_minutes=data.get("durationMinutes", 30),
            status=AppointmentStatus(data.get("status", "pending")),
            payment_type=PaymentType(data.get("paymentType", "particular")),
            total_cents=data.get("totalCents", 0),
            signal_cents=data.get("signalCents", 0),
            signal_paid=data.get("signalPaid", False),
            signal_payment_id=data.get("signalPaymentId"),
            convenio_name=data.get("convenioName"),
            convenio_number=data.get("convenioNumber"),
            patient_name=data.get("patientName", ""),
            patient_phone=data.get("patientPhone", ""),
            professional_name=data.get("professionalName", ""),
            reminder_24h_sent=data.get("reminder24hSent", False),
            reminder_2h_sent=data.get("reminder2hSent", False),
            notes=data.get("notes", ""),
            cancellation_reason=data.get("cancellationReason")
        )

    @property
    def datetime_str(self) -> str:
        """Returns formatted datetime string"""
        return f"{self.date} às {self.time}"

    @property
    def is_paid(self) -> bool:
        """Check if payment is complete (convenio or signal paid)"""
        return self.payment_type == PaymentType.CONVENIO or self.signal_paid
