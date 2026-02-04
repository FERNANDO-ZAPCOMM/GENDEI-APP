"""
Gendei WhatsApp Agent Service
Clinic appointment scheduling via WhatsApp
"""

import os
import logging
import json
import asyncio
from typing import Any, Dict, Optional, List
from datetime import datetime, timedelta
from contextlib import asynccontextmanager
from contextvars import ContextVar

# Context variable to store current clinic_id for message logging
_current_clinic_id: ContextVar[Optional[str]] = ContextVar('current_clinic_id', default=None)
_current_phone_number_id: ContextVar[Optional[str]] = ContextVar('current_phone_number_id', default=None)

from fastapi import FastAPI, Request, BackgroundTasks, HTTPException  # type: ignore
from fastapi.responses import Response, HTMLResponse  # type: ignore
import httpx  # type: ignore

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Import Gendei modules
try:
    from src.database.firestore import GendeiDatabase
    from src.scheduler.models import Appointment, AppointmentStatus
    from src.scheduler.appointments import (
        get_appointments_by_phone,
        create_appointment,
        cancel_appointment,
        reschedule_appointment,
        update_appointment_status,
    )
    from src.scheduler.availability import (
        get_available_slots,
        get_professional_availability,
        format_slots_for_display,
    )
    from src.scheduler.reminders import (
        format_reminder_message,
        mark_reminder_sent,
    )
    from src.flows.handler import FlowsHandler, CLINICA_MEDICA_SPECIALTIES
    from src.flows.manager import send_whatsapp_flow, send_booking_flow, generate_flow_token
    from src.flows.crypto import handle_encrypted_flow_request, prepare_flow_response, is_encryption_configured
    logger.info("✅ Gendei modules imported successfully")
    if is_encryption_configured():
        logger.info("🔐 WhatsApp Flows encryption is configured")
    else:
        logger.info("⚠️ WhatsApp Flows encryption NOT configured (FLOWS_PRIVATE_KEY not set)")
except Exception as e:
    logger.error(f"❌ Failed to import Gendei modules: {e}")
    raise

# Environment variables
WHATSAPP_TOKEN = os.getenv("META_BISU_ACCESS_TOKEN", "")
VERIFY_TOKEN = os.getenv("META_WEBHOOK_VERIFY_TOKEN", "gendei_verify_token")
META_API_VERSION = os.getenv("META_API_VERSION", "v24.0")
DOMAIN = os.getenv("GENDEI_DOMAIN", "https://gendei.com")

# WhatsApp Flows - Two flows for complete scheduling experience
# Flow 1: Patient Info (ESPECIALIDADE → TIPO_ATENDIMENTO → INFO_CONVENIO → DADOS_PACIENTE)
# Flow 2: Booking (BOOKING - date picker + time dropdown)
CLINICA_MEDICA_FORMULARIO_FLOW_ID = os.getenv("CLINICA_MEDICA_FORMULARIO_FLOW_ID", "")  # Flow 1: Patient info
CLINICA_MEDICA_AGENDAMENTO_FLOW_ID = os.getenv("CLINICA_MEDICA_AGENDAMENTO_FLOW_ID", "")  # Flow 2: Booking

# Booking settings
DEFAULT_MIN_BOOKING_LEAD_TIME_HOURS = 2  # Minimum hours before a slot can be booked
UPCOMING_APPOINTMENT_CHECK_DAYS = 14  # Days ahead to check for existing appointments

# Database instance
db: Optional[GendeiDatabase] = None

# Flows handler instance
flows_handler: Optional[FlowsHandler] = None

# Note: Message deduplication and conversation state are now Firestore-backed
# See db.is_message_processed() and db.load_conversation_state()


# ============================================
# MESSAGE BUFFERING (like Zapcomm)
# Combines rapid sequential messages before processing
# ============================================
DEFAULT_MESSAGE_BUFFER_SECONDS = 2.0
SHORT_MESSAGE_BUFFER_SECONDS = 3.5
GREETING_MESSAGE_BUFFER_SECONDS = 5.0

# Buffers keyed by clinic+phone
message_buffer: Dict[str, List[Dict[str, Any]]] = {}
message_buffer_timers: Dict[str, datetime] = {}
message_buffer_deadlines: Dict[str, datetime] = {}
message_buffer_locks: Dict[str, bool] = {}


def _looks_like_greeting_only(text: str) -> bool:
    """Check if message is just a greeting (likely more to follow)."""
    t = (text or "").strip().lower()
    if not t:
        return False
    if "?" in t:
        return False
    if any(k in t for k in ("quero", "preciso", "valor", "preço", "agendar", "marcar", "consulta")):
        return False
    return any(
        t.startswith(prefix)
        for prefix in ("oi", "olá", "ola", "bom dia", "boa tarde", "boa noite", "tudo bem")
    ) and len(t) <= 25


def _adaptive_buffer_seconds(first_message_text: str) -> float:
    """Choose buffer window based on first message."""
    t = (first_message_text or "").strip()
    if not t:
        return DEFAULT_MESSAGE_BUFFER_SECONDS
    if _looks_like_greeting_only(t):
        return GREETING_MESSAGE_BUFFER_SECONDS
    if len(t) <= 8 and "?" not in t:
        return SHORT_MESSAGE_BUFFER_SECONDS
    return DEFAULT_MESSAGE_BUFFER_SECONDS


def add_to_message_buffer(key: str, message_data: Dict[str, Any]) -> bool:
    """Add message to buffer. Returns True if first message (starts timer)."""
    is_first = key not in message_buffer or len(message_buffer.get(key, [])) == 0
    if key not in message_buffer:
        message_buffer[key] = []
    message_buffer[key].append(message_data)
    if is_first:
        message_buffer_timers[key] = datetime.now()
        seconds = _adaptive_buffer_seconds(message_data.get("text", ""))
        message_buffer_deadlines[key] = message_buffer_timers[key] + timedelta(seconds=seconds)
    return is_first


def get_buffered_messages(key: str) -> List[Dict[str, Any]]:
    """Get and clear all buffered messages for this key."""
    messages = message_buffer.get(key, [])
    message_buffer[key] = []
    if key in message_buffer_timers:
        del message_buffer_timers[key]
    if key in message_buffer_deadlines:
        del message_buffer_deadlines[key]
    return messages


def should_process_buffer(key: str) -> bool:
    """Check if enough time has passed to process the buffer."""
    if key not in message_buffer_deadlines:
        return True
    return datetime.now() >= message_buffer_deadlines[key]


def is_buffer_locked(key: str) -> bool:
    """Check if buffer is being processed."""
    return message_buffer_locks.get(key, False)


def lock_buffer(key: str) -> None:
    """Lock buffer for processing."""
    message_buffer_locks[key] = True


def unlock_buffer(key: str) -> None:
    """Unlock buffer after processing."""
    message_buffer_locks[key] = False


def combine_messages(messages: List[Dict[str, Any]]) -> str:
    """Combine multiple messages into single context string."""
    if not messages:
        return ""
    if len(messages) == 1:
        return messages[0].get('text', '')
    combined_parts = []
    for msg in messages:
        text = msg.get('text', '')
        if text:
            combined_parts.append(text)
    return " ".join(combined_parts)


# ============================================
# AI CHAT (Simple OpenAI Integration)
# ============================================
async def get_ai_response(
    clinic_id: str,
    phone: str,
    message: str,
    clinic_context: Optional[Dict[str, Any]] = None
) -> Optional[str]:
    """
    Get AI response using OpenAI Chat Completions.
    Simple and reliable approach.
    """
    import openai  # type: ignore

    try:
        client = openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

        # Build clinic context
        clinic_info = ""
        if clinic_context:
            clinic = clinic_context.get("clinic", {})
            if clinic.get("name"):
                clinic_info += f"Nome da clínica: {clinic['name']}\n"
            if clinic.get("address"):
                clinic_info += f"Endereço: {clinic['address']}\n"
            if clinic.get("opening_hours"):
                clinic_info += f"Horário de funcionamento: {clinic['opening_hours']}\n"
            if clinic.get("phone"):
                clinic_info += f"Telefone: {clinic['phone']}\n"

            # Professionals
            professionals = clinic_context.get("professionals", [])
            if professionals:
                clinic_info += "\nProfissionais:\n"
                for p in professionals:
                    name = p.get('full_name') or p.get('name', '')
                    specialty = p.get('specialty', '')
                    clinic_info += f"- {name}"
                    if specialty:
                        clinic_info += f" ({specialty})"
                    clinic_info += "\n"

            # Services
            services = clinic_context.get("services", [])
            if services:
                clinic_info += "\nServiços:\n"
                for s in services:
                    name = s.get('name', '')
                    duration = s.get('duration', 30)
                    price = s.get('price', 0)
                    clinic_info += f"- {name} ({duration} min)"
                    if price and price > 0:
                        clinic_info += f" - R$ {price:.2f}".replace('.', ',')
                    clinic_info += "\n"

        system_prompt = f"""Você é o assistente virtual amigável de uma clínica médica.

INFORMAÇÕES DA CLÍNICA:
{clinic_info if clinic_info else "Informações não disponíveis no momento."}

SUAS RESPONSABILIDADES:
1. Responder perguntas sobre a clínica (endereço, horário, profissionais, serviços)
2. Ajudar pacientes a agendar consultas
3. Informar sobre consultas existentes
4. Ser educado, prestativo e conciso

REGRAS IMPORTANTES:
- Responda SEMPRE em português brasileiro
- Seja breve e direto (máximo 2-3 frases por resposta)
- Use formatação WhatsApp (*negrito*, _itálico_)
- Se não souber uma informação específica, sugira que o paciente entre em contato por telefone
- Para agendar, pergunte: qual profissional, qual data/horário preferido
- Nunca invente informações que não estão no contexto

EXEMPLOS:
- Pergunta sobre endereço → Responda com o endereço da clínica
- Saudação simples → Boas-vindas e pergunte como pode ajudar
- Quer agendar → Pergunte com qual profissional e sugira verificar horários disponíveis"""

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": message}
            ],
            max_tokens=300,
            temperature=0.7
        )

        ai_response = response.choices[0].message.content
        logger.info(f"🤖 AI response: {ai_response[:100]}...")
        return ai_response

    except Exception as e:
        logger.error(f"❌ AI error: {e}")
        return None


def load_clinic_context(clinic_id: str) -> Dict[str, Any]:
    """Load clinic context for AI prompts."""
    context: Dict[str, Any] = {}

    if not db:
        return context

    try:
        clinic = db.get_clinic(clinic_id)
        if clinic:
            context["clinic"] = {
                "name": clinic.name,
                "address": getattr(clinic, 'address', ''),
                "phone": getattr(clinic, 'phone', ''),
                "opening_hours": getattr(clinic, 'opening_hours', ''),
                "description": getattr(clinic, 'description', ''),
                "greeting_summary": getattr(clinic, 'greeting_summary', ''),
            }

        professionals = db.get_clinic_professionals(clinic_id)
        if professionals:
            context["professionals"] = [
                {
                    "id": p.id,
                    "name": p.name,
                    "full_name": getattr(p, 'full_name', p.name),
                    "specialty": getattr(p, 'specialty', ''),
                }
                for p in professionals
            ]

        services = db.get_clinic_services(clinic_id)
        if services:
            context["services"] = services

    except Exception as e:
        logger.error(f"Error loading clinic context: {e}")

    return context


def get_clinic_min_lead_time(clinic_id: str) -> int:
    """Get minimum booking lead time in hours for a clinic."""
    if not db:
        return DEFAULT_MIN_BOOKING_LEAD_TIME_HOURS

    try:
        clinic = db.get_clinic(clinic_id)
        if clinic:
            # Check if clinic has custom setting
            settings = getattr(clinic, 'booking_settings', None) or {}
            return settings.get('minLeadTimeHours', DEFAULT_MIN_BOOKING_LEAD_TIME_HOURS)
    except Exception as e:
        logger.error(f"Error getting clinic lead time: {e}")

    return DEFAULT_MIN_BOOKING_LEAD_TIME_HOURS


def filter_slots_by_lead_time(slots: List[Any], min_lead_hours: int) -> List[Any]:
    """Filter out slots that are too close to current time.

    Handles both TimeSlot objects and dict representations.
    """
    if not slots:
        return []

    now = datetime.now()
    min_booking_time = now + timedelta(hours=min_lead_hours)

    filtered = []
    for slot in slots:
        try:
            # Handle both TimeSlot objects and dicts
            if hasattr(slot, 'date'):
                slot_date = slot.date
                slot_time = slot.time
            else:
                slot_date = slot.get('date', '')
                slot_time = slot.get('time', '')

            slot_dt = datetime.strptime(f"{slot_date} {slot_time}", "%Y-%m-%d %H:%M")

            if slot_dt >= min_booking_time:
                filtered.append(slot)
        except (ValueError, AttributeError):
            continue

    return filtered


def get_patient_upcoming_appointments(clinic_id: str, phone: str) -> List[Appointment]:
    """Get upcoming appointments for a patient within the configured window."""
    if not db:
        return []

    try:
        appointments = get_appointments_by_phone(db, phone, clinic_id, include_past=False)

        # Filter to appointments within the check window
        today = datetime.now().date()
        max_date = today + timedelta(days=UPCOMING_APPOINTMENT_CHECK_DAYS)

        upcoming = [
            apt for apt in appointments
            if datetime.strptime(apt.date, "%Y-%m-%d").date() <= max_date
        ]

        return upcoming
    except Exception as e:
        logger.error(f"Error getting patient upcoming appointments: {e}")
        return []


def detect_frustrated_sentiment(message: str) -> bool:
    """Detect if user message indicates frustration or anger.

    Note: We intentionally do NOT flag ALL CAPS or excessive punctuation
    as many users type this way without being frustrated (caps lock on,
    emphasis, excitement, etc.). Only explicit angry keywords trigger escalation.
    """
    msg_lower = message.lower()

    # Frustrated/angry indicators - these are strong signals of actual frustration
    angry_keywords = [
        "absurdo", "ridículo", "ridícula", "inaceitável", "inaceitavel",
        "péssimo", "pessimo", "horrível", "horrivel", "vergonha",
        "reclamar", "reclamação", "reclamacao", "ouvidoria",
        "nunca mais", "vocês são", "voces sao", "isso é uma",
        "desrespeito", "falta de respeito", "incompetente",
        "processando", "processo", "procon", "denúncia", "denuncia",
        "não acredito", "nao acredito", "que palhaçada", "palhacada",
        "raiva", "irritado", "irritada", "revoltado", "revoltada",
        "advogado", "justiça", "justica",
    ]

    # Check for angry keywords only
    if any(kw in msg_lower for kw in angry_keywords):
        return True

    return False


def detect_human_escalation_request(message: str) -> bool:
    """Detect if user explicitly requests to speak with a human.

    Catches phrases like:
    - "quero falar com humano"
    - "recepção" / "recepcao"
    - "preciso ligar"
    - "falar com atendente"
    - etc.
    """
    msg_lower = message.lower()

    # Explicit human escalation requests
    human_keywords = [
        # Direct requests for human/person
        "falar com humano", "quero falar com humano",
        "falar com pessoa", "quero falar com pessoa",
        "falar com alguem", "falar com alguém",
        "quero falar com alguem", "quero falar com alguém",
        "atendente", "atendimento humano",
        "falar com atendente", "quero atendente",
        "pessoa real", "humano real",
        "ser atendido", "ser atendida",
        # Reception/front desk
        "recepção", "recepcao", "recepcionista",
        "falar com a recepção", "falar com a recepcao",
        "ligar pra recepção", "ligar pra recepcao",
        # Phone/call requests
        "preciso ligar", "quero ligar", "vou ligar",
        "me liga", "me ligue", "me ligam",
        "alguem me liga", "alguém me liga",
        "podem me ligar", "pode me ligar",
        "ligar pra clinica", "ligar pra clínica",
        "ligar para clinica", "ligar para clínica",
        "numero do telefone", "número do telefone",
        "qual o telefone", "qual telefone",
        # Explicit transfer requests
        "transferir", "transfira", "passar pra",
        "passar para atendente", "passar pro atendente",
        "não quero falar com robô", "nao quero falar com robo",
        "não quero falar com bot", "nao quero falar com bot",
        "esse bot", "esse robô", "esse robo",
    ]

    # Check for explicit human escalation keywords
    if any(kw in msg_lower for kw in human_keywords):
        return True

    return False


def format_appointment_date(date_str: str, time_str: str) -> str:
    """Format appointment date/time in a friendly way."""
    try:
        dt = datetime.strptime(date_str, "%Y-%m-%d")
        day_names = ["segunda", "terça", "quarta", "quinta", "sexta", "sábado", "domingo"]
        day_name = day_names[dt.weekday()]

        today = datetime.now().date()
        apt_date = dt.date()

        if apt_date == today:
            return f"hoje às {time_str}"
        elif apt_date == today + timedelta(days=1):
            return f"amanhã às {time_str}"
        else:
            return f"{day_name}, {dt.strftime('%d/%m')} às {time_str}"
    except ValueError:
        return f"{date_str} às {time_str}"


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    global db, flows_handler
    logger.info("🚀 Starting Gendei WhatsApp Agent...")
    db = GendeiDatabase()
    flows_handler = FlowsHandler(db)
    logger.info("✅ Database initialized")
    yield
    logger.info("👋 Shutting down Gendei WhatsApp Agent...")


# Initialize FastAPI app
app = FastAPI(
    title="Gendei WhatsApp Agent",
    description="Clinic appointment scheduling via WhatsApp",
    lifespan=lifespan
)


# ============================================
# HELPER FUNCTIONS
# ============================================

def ensure_phone_has_plus(phone: str) -> str:
    """Ensure phone number has + prefix."""
    if phone and not phone.startswith('+'):
        return f'+{phone}'
    return phone


def is_message_processed(message_id: str) -> bool:
    """Check if message was already processed (Firestore-backed)."""
    if not db:
        return False

    # Check Firestore
    if db.is_message_processed(message_id):
        return True

    # Mark as processed
    db.mark_message_processed(message_id)
    return False


async def send_whatsapp_message(
    phone_number_id: str,
    to: str,
    message: str,
    access_token: str,
    log_to_db: bool = True
) -> bool:
    """Send WhatsApp text message and optionally log to database."""
    url = f"https://graph.facebook.com/{META_API_VERSION}/{phone_number_id}/messages"

    # Ensure phone has + prefix for consistent storage
    to_normalized = ensure_phone_has_plus(to)

    async with httpx.AsyncClient() as client:
        response = await client.post(
            url,
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json",
                "Cache-Control": "no-cache",
            },
            json={
                "messaging_product": "whatsapp",
                "to": to,
                "type": "text",
                "text": {"body": message}
            }
        )

        if response.status_code == 200:
            logger.info(f"✅ Message sent to {to}")
            # Log outgoing message to database using context variables
            clinic_id = _current_clinic_id.get()
            if log_to_db and db and clinic_id:
                db.log_conversation_message(
                    clinic_id, to_normalized, "text", message,
                    source="ai", phone_number_id=phone_number_id
                )
            return True
        else:
            logger.error(f"❌ Failed to send message: {response.text}")
            return False


async def send_whatsapp_buttons(
    phone_number_id: str,
    to: str,
    body_text: str,
    buttons: List[Dict[str, str]],
    access_token: str
) -> bool:
    """Send WhatsApp interactive buttons message."""
    url = f"https://graph.facebook.com/{META_API_VERSION}/{phone_number_id}/messages"

    button_list = [
        {"type": "reply", "reply": {"id": btn["id"], "title": btn["title"]}}
        for btn in buttons[:3]  # Max 3 buttons
    ]

    to_normalized = ensure_phone_has_plus(to)

    async with httpx.AsyncClient() as client:
        response = await client.post(
            url,
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json",
                "Cache-Control": "no-cache",
            },
            json={
                "messaging_product": "whatsapp",
                "to": to,
                "type": "interactive",
                "interactive": {
                    "type": "button",
                    "body": {"text": body_text},
                    "action": {"buttons": button_list}
                }
            }
        )

        if response.status_code == 200:
            logger.info(f"✅ Buttons sent to {to}")
            # Log outgoing message
            clinic_id = _current_clinic_id.get()
            if db and clinic_id:
                button_titles = ", ".join([b["title"] for b in buttons[:3]])
                db.log_conversation_message(
                    clinic_id, to_normalized, "interactive",
                    f"{body_text}\n[Opções: {button_titles}]",
                    source="ai", phone_number_id=phone_number_id
                )
            return True
        else:
            logger.error(f"❌ Failed to send buttons: {response.text}")
            return False


async def send_whatsapp_list(
    phone_number_id: str,
    to: str,
    header_text: str,
    body_text: str,
    button_text: str,
    sections: List[Dict[str, Any]],
    access_token: str
) -> bool:
    """Send WhatsApp interactive list message (for more than 3 options)."""
    url = f"https://graph.facebook.com/{META_API_VERSION}/{phone_number_id}/messages"

    to_normalized = ensure_phone_has_plus(to)

    payload = {
        "messaging_product": "whatsapp",
        "to": to,
        "type": "interactive",
        "interactive": {
            "type": "list",
            "header": {"type": "text", "text": header_text},
            "body": {"text": body_text},
            "action": {
                "button": button_text,
                "sections": sections
            }
        }
    }

    async with httpx.AsyncClient() as client:
        response = await client.post(
            url,
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json",
                "Cache-Control": "no-cache",
            },
            json=payload
        )

        if response.status_code == 200:
            logger.info(f"✅ List message sent to {to}")
            # Log outgoing message
            clinic_id = _current_clinic_id.get()
            if db and clinic_id:
                db.log_conversation_message(
                    clinic_id, to_normalized, "interactive",
                    f"{header_text}\n{body_text}\n[Lista interativa]",
                    source="ai", phone_number_id=phone_number_id
                )
            return True
        else:
            logger.error(f"❌ Failed to send list: {response.text}")
            return False


async def send_pix_payment_cta(
    phone_number_id: str,
    to: str,
    payment_url: str,
    amount_formatted: str,
    description: str,
    access_token: str
) -> bool:
    """Send WhatsApp CTA URL button for PIX payment."""
    url = f"https://graph.facebook.com/{META_API_VERSION}/{phone_number_id}/messages"

    payload = {
        "messaging_product": "whatsapp",
        "to": to,
        "type": "interactive",
        "interactive": {
            "type": "cta_url",
            "header": {
                "type": "text",
                "text": "💳 Pagamento PIX"
            },
            "body": {
                "text": f"*{description}*\n\nValor: *{amount_formatted}*\n\nClique no botão abaixo para abrir a página de pagamento PIX.\n\n⏰ O pagamento expira em 24 horas."
            },
            "footer": {
                "text": "Pagamento seguro via PagSeguro"
            },
            "action": {
                "name": "cta_url",
                "parameters": {
                    "display_text": "Pagar com PIX",
                    "url": payment_url
                }
            }
        }
    }

    async with httpx.AsyncClient() as client:
        response = await client.post(
            url,
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json",
                "Cache-Control": "no-cache",
            },
            json=payload
        )

        if response.status_code == 200:
            logger.info(f"✅ PIX payment CTA sent to {to}")
            return True
        else:
            logger.error(f"❌ Failed to send PIX CTA: {response.text}")
            return False


async def send_whatsapp_contact_card(
    phone_number_id: str,
    to: str,
    contact_name: str,
    contact_phone: str,
    contact_email: Optional[str],
    organization: str,
    access_token: str
) -> bool:
    """Send WhatsApp contact card with clinic details."""
    url = f"https://graph.facebook.com/{META_API_VERSION}/{phone_number_id}/messages"

    to_normalized = ensure_phone_has_plus(to)

    # Build contact object
    contact = {
        "name": {
            "formatted_name": contact_name,
            "first_name": contact_name
        },
        "org": {
            "company": organization
        },
        "phones": [
            {
                "phone": contact_phone,
                "type": "WORK"
            }
        ]
    }

    # Add email if available
    if contact_email:
        contact["emails"] = [
            {
                "email": contact_email,
                "type": "WORK"
            }
        ]

    payload = {
        "messaging_product": "whatsapp",
        "to": to,
        "type": "contacts",
        "contacts": [contact]
    }

    async with httpx.AsyncClient() as client:
        response = await client.post(
            url,
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json",
                "Cache-Control": "no-cache",
            },
            json=payload
        )

        if response.status_code == 200:
            logger.info(f"✅ Contact card sent to {to}")
            # Log outgoing message
            clinic_id = _current_clinic_id.get()
            if db and clinic_id:
                db.log_conversation_message(
                    clinic_id, to_normalized, "contacts",
                    f"[Cartão de contato: {contact_name} - {contact_phone}]",
                    source="ai", phone_number_id=phone_number_id
                )
            return True
        else:
            logger.error(f"❌ Failed to send contact card: {response.text}")
            return False


async def mark_message_as_read(
    phone_number_id: str,
    message_id: str,
    access_token: str,
    show_typing: bool = False
) -> None:
    """Mark message as read, optionally show typing indicator."""
    url = f"https://graph.facebook.com/{META_API_VERSION}/{phone_number_id}/messages"

    payload: Dict[str, Any] = {
        "messaging_product": "whatsapp",
        "status": "read",
        "message_id": message_id
    }

    # Add typing indicator (shows typing dots for ~25s or until response)
    if show_typing:
        payload["typing_indicator"] = {"type": "text"}

    async with httpx.AsyncClient() as client:
        await client.post(
            url,
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json",
                "Cache-Control": "no-cache",
            },
            json=payload
        )


async def send_typing_indicator(
    phone_number_id: str,
    message_id: str,
    access_token: str
) -> None:
    """Show typing indicator (dots) - lasts ~25s or until bot responds."""
    await mark_message_as_read(phone_number_id, message_id, access_token, show_typing=True)


# ============================================
# MESSAGE HANDLERS
# ============================================

async def handle_reminder_response(
    clinic_id: str,
    phone: str,
    button_id: str,
    appointment: Appointment,
    phone_number_id: str,
    access_token: str
) -> None:
    """Handle reminder button response."""
    if button_id == "confirm_yes":
        # Confirm attendance
        update_appointment_status(
            db, appointment.id,
            AppointmentStatus.CONFIRMED_PRESENCE
        )
        await send_whatsapp_message(
            phone_number_id, phone,
            f"✅ Presença confirmada!\n\nTe esperamos amanhã às {appointment.time}.\n\nLembre-se de chegar 15 minutos antes.",
            access_token
        )
        logger.info(f"✅ Appointment {appointment.id} confirmed by patient")

    elif button_id == "confirm_reschedule":
        # Start rescheduling flow
        new_state = {
            "state": "rescheduling",
            "clinic_id": clinic_id,
            "appointment_id": appointment.id,
            "professional_id": appointment.professional_id,
        }
        if db:
            db.save_conversation_state(clinic_id, phone, new_state)

        # Get available slots
        slots = get_available_slots(
            db,
            clinic_id,
            professional_id=appointment.professional_id,
            days_ahead=14
        )

        if slots:
            slots_text = format_slots_for_display(slots[:20], appointment.professional_name)
            await send_whatsapp_message(
                phone_number_id, phone,
                f"Vamos reagendar sua consulta!\n\n{slots_text}\n\nResponda com a data e horário desejado (ex: '15/01 às 14:00')",
                access_token
            )
        else:
            await send_whatsapp_message(
                phone_number_id, phone,
                "No momento não há horários disponíveis. Por favor, entre em contato com a clínica.",
                access_token
            )

    elif button_id == "confirm_cancel":
        # Cancel appointment
        cancel_appointment(db, appointment.id, "Cancelado pelo paciente via WhatsApp")
        await send_whatsapp_message(
            phone_number_id, phone,
            "❌ Consulta cancelada.\n\nSe desejar agendar novamente, é só enviar uma mensagem!",
            access_token
        )
        logger.info(f"❌ Appointment {appointment.id} cancelled by patient")


async def send_initial_greeting(
    clinic_id: str,
    phone: str,
    phone_number_id: str,
    access_token: str,
    contact_name: Optional[str] = None
) -> None:
    """Send smart greeting - checks for existing appointments first."""
    clinic = db.get_clinic(clinic_id) if db else None
    clinic_name = clinic.name if clinic else "nossa clínica"

    # Check for upcoming appointments
    upcoming_appointments = get_patient_upcoming_appointments(clinic_id, phone)

    if upcoming_appointments:
        # User has upcoming appointment(s) - show personalized greeting
        apt = upcoming_appointments[0]  # Get the next one
        apt_date_formatted = format_appointment_date(apt.date, apt.time)

        # Use patient name from appointment or contact name
        patient_name = apt.patient_name or contact_name or ""
        greeting_name = patient_name.split()[0] if patient_name else ""  # First name only

        # Save state with appointment context
        if db:
            state = db.load_conversation_state(clinic_id, phone)
            state["state"] = "awaiting_appointment_action"
            state["clinic_id"] = clinic_id
            state["current_appointment_id"] = apt.id
            state["current_appointment_date"] = apt.date
            state["current_appointment_time"] = apt.time
            state["current_appointment_professional"] = apt.professional_name
            state["current_appointment_professional_id"] = apt.professional_id
            db.save_conversation_state(clinic_id, phone, state)

        # Build personalized greeting
        greeting = f"👋 *Olá{', ' + greeting_name if greeting_name else ''}!*\n\n"
        greeting += f"Vi que você tem uma consulta agendada:\n\n"
        greeting += f"📅 *{apt_date_formatted}*\n"
        greeting += f"👨‍⚕️ *{apt.professional_name}*\n\n"
        greeting += f"Como posso ajudar?"

        buttons = [
            {"id": "apt_reagendar", "title": "Reagendar"},
            {"id": "apt_cancelar", "title": "Cancelar"},
            {"id": "apt_duvida", "title": "Outra dúvida"},
        ]

        await send_whatsapp_buttons(
            phone_number_id, phone,
            greeting,
            buttons,
            access_token
        )
        logger.info(f"👋 Sent appointment-aware greeting to {phone} (apt: {apt.id})")

    else:
        # No upcoming appointments - personalized greeting with clinic context
        if db:
            state = db.load_conversation_state(clinic_id, phone)
            state["state"] = "awaiting_greeting_response"
            state["clinic_id"] = clinic_id
            db.save_conversation_state(clinic_id, phone, state)

        # Check workflow mode (default to 'booking' for backward compatibility)
        workflow_mode = getattr(clinic, 'workflow_mode', 'booking') if clinic else 'booking'

        # Build personalized greeting with clinic context
        greeting_message = f"👋 *Bem-vindo(a) a {clinic_name}!*\n\n"

        # Add greeting summary if available
        greeting_summary = getattr(clinic, 'greeting_summary', '') if clinic else ''
        if greeting_summary:
            greeting_message += f"{greeting_summary}\n\n"

        # Add professionals/specialties if available
        if db:
            professionals = db.get_clinic_professionals(clinic_id)
            if professionals:
                # Group by specialty
                specialties = {}
                for p in professionals:
                    spec = getattr(p, 'specialty', '') or 'Geral'
                    if spec not in specialties:
                        specialties[spec] = []
                    specialties[spec].append(p.name)

                if len(specialties) > 0:
                    # Show specialties available
                    spec_list = list(specialties.keys())[:3]  # Max 3 specialties
                    if len(spec_list) == 1:
                        greeting_message += f"👨‍⚕️ Atendemos em *{spec_list[0]}*\n\n"
                    else:
                        greeting_message += f"👨‍⚕️ Especialidades: *{', '.join(spec_list)}*\n\n"

        greeting_message += "Como posso ajudar?"

        # Configure buttons based on workflow mode
        if workflow_mode == 'info':
            # Info mode: no scheduling, only information
            buttons = [
                {"id": "greeting_nao", "title": "Informações"},
                {"id": "greeting_contato", "title": "Falar com atendente"},
            ]
            logger.info(f"📋 Clinic {clinic_id} is in INFO mode - no scheduling")
        else:
            # Booking mode: full scheduling capability
            buttons = [
                {"id": "greeting_sim", "title": "Agendar"},
                {"id": "greeting_nao", "title": "Dúvida"},
            ]

        await send_whatsapp_buttons(
            phone_number_id, phone,
            greeting_message,
            buttons,
            access_token
        )
        logger.info(f"👋 Sent standard greeting to {phone} (mode: {workflow_mode})")


async def handle_greeting_response_duvida(
    clinic_id: str,
    phone: str,
    phone_number_id: str,
    access_token: str
) -> None:
    """Handle when user clicks 'Dúvida' - show clinic info with professionals and ask what they need."""
    clinic = db.get_clinic(clinic_id) if db else None

    # Update state to general chat
    if db:
        state = db.load_conversation_state(clinic_id, phone)
        state["state"] = "general_chat"
        db.save_conversation_state(clinic_id, phone, state)

    # Build comprehensive info message
    info_parts = ["Claro! Vou te ajudar. 😊\n"]

    if clinic:
        clinic_name = getattr(clinic, 'name', None) or "Clínica"
        info_parts.append(f"Aqui estão algumas informações da *{clinic_name}*:\n")

        if hasattr(clinic, 'address') and clinic.address:
            info_parts.append(f"📍 *Endereço:* {clinic.address}")

        if hasattr(clinic, 'opening_hours') and clinic.opening_hours:
            info_parts.append(f"🕐 *Horário:* {clinic.opening_hours}")

        if hasattr(clinic, 'phone') and clinic.phone:
            info_parts.append(f"📞 *Telefone:* {clinic.phone}")

        # Add professionals/specialties
        if db:
            professionals = db.get_clinic_professionals(clinic_id)
            if professionals:
                info_parts.append("")
                info_parts.append("👨‍⚕️ *Nossa equipe:*")
                for p in professionals[:5]:  # Max 5 professionals
                    name = p.name
                    specialty = getattr(p, 'specialty', '')
                    if specialty:
                        info_parts.append(f"• {name} - {specialty}")
                    else:
                        info_parts.append(f"• {name}")

    info_parts.append("\n\nO que você gostaria de saber?")

    await send_whatsapp_message(
        phone_number_id, phone,
        "\n".join(info_parts),
        access_token
    )

    # Send contact card if clinic has phone
    if clinic:
        clinic_name = getattr(clinic, 'name', None) or "Clínica"
        clinic_phone = getattr(clinic, 'phone', None)
        clinic_email = getattr(clinic, 'email', None)

        if clinic_phone:
            await send_whatsapp_contact_card(
                phone_number_id, phone,
                contact_name=clinic_name,
                contact_phone=clinic_phone,
                contact_email=clinic_email,
                organization=clinic_name,
                access_token=access_token
            )


async def escalate_to_human(
    clinic_id: str,
    phone: str,
    phone_number_id: str,
    access_token: str,
    reason: str,
    auto_takeover: bool = False
) -> None:
    """Escalate conversation to human - send contact card and enable human takeover."""
    clinic = db.get_clinic(clinic_id) if db else None

    # Update conversation state first
    if db:
        state = db.load_conversation_state(clinic_id, phone)
        state["state"] = "escalated"
        state["escalation_reason"] = reason

        if auto_takeover:
            state["isHumanTakeover"] = True
            state["aiPaused"] = True

        db.save_conversation_state(clinic_id, phone, state)

    # Send escalation message
    await send_whatsapp_message(
        phone_number_id, phone,
        "Entendo! Vou encaminhar seu caso para nossa equipe. 🙋‍♀️\n\n"
        "Um de nossos atendentes entrará em contato em breve.\n\n"
        "Se preferir, você pode entrar em contato diretamente:",
        access_token
    )

    # Send contact card if clinic has phone
    if clinic:
        clinic_name = getattr(clinic, 'name', None) or "Clínica"
        clinic_phone = getattr(clinic, 'phone', None)
        clinic_email = getattr(clinic, 'email', None)

        if clinic_phone:
            await send_whatsapp_contact_card(
                phone_number_id, phone,
                contact_name=clinic_name,
                contact_phone=clinic_phone,
                contact_email=clinic_email,
                organization=clinic_name,
                access_token=access_token
            )

    logger.info(f"🚨 Escalated conversation for {phone}. Reason: {reason}, Auto-takeover: {auto_takeover}")


async def handle_appointment_reschedule(
    clinic_id: str,
    phone: str,
    phone_number_id: str,
    access_token: str,
    state: Dict[str, Any]
) -> None:
    """Handle request to reschedule existing appointment - start scheduling flow."""
    current_apt_id = state.get("current_appointment_id")
    current_professional_id = state.get("current_appointment_professional_id")
    current_professional_name = state.get("current_appointment_professional")
    current_date = state.get("current_appointment_date")
    current_time = state.get("current_appointment_time")

    # Update state to indicate we're rescheduling
    state["state"] = "rescheduling"
    state["rescheduling_appointment_id"] = current_apt_id
    state["selected_professional_id"] = current_professional_id
    state["selected_professional_name"] = current_professional_name
    if db:
        db.save_conversation_state(clinic_id, phone, state)

    # Inform user and show available slots for the same professional
    await send_whatsapp_message(
        phone_number_id, phone,
        f"Vamos remarcar sua consulta! 📅\n\n"
        f"Consulta atual: *{format_appointment_date(current_date, current_time)}* com *{current_professional_name}*\n\n"
        f"Buscando novos horários disponíveis...",
        access_token
    )

    # Show available slots for the same professional
    await show_professional_slots(
        clinic_id, phone,
        current_professional_id,
        current_professional_name,
        "",  # specialty not needed
        phone_number_id, access_token
    )


async def handle_appointment_cancel_request(
    clinic_id: str,
    phone: str,
    phone_number_id: str,
    access_token: str,
    state: Dict[str, Any]
) -> None:
    """Handle cancellation request - escalate to human for refund verification."""
    current_apt_id = state.get("current_appointment_id")
    current_date = state.get("current_appointment_date")
    current_time = state.get("current_appointment_time")
    current_professional = state.get("current_appointment_professional")

    # Update state with cancellation request
    state["state"] = "cancellation_requested"
    state["cancellation_appointment_id"] = current_apt_id
    if db:
        db.save_conversation_state(clinic_id, phone, state)

    # Escalate to human (cancel requires refund verification)
    await send_whatsapp_message(
        phone_number_id, phone,
        f"Entendi que você deseja cancelar sua consulta de *{format_appointment_date(current_date, current_time)}* com *{current_professional}*.\n\n"
        f"⚠️ Para cancelamentos, nossa equipe precisa verificar as políticas de reembolso.\n\n"
        f"Um atendente entrará em contato em breve para finalizar o cancelamento.",
        access_token
    )

    # Enable human takeover for cancellation handling
    await escalate_to_human(
        clinic_id, phone,
        phone_number_id, access_token,
        reason=f"Solicitação de cancelamento - Consulta {current_apt_id} ({current_date} {current_time})",
        auto_takeover=True
    )


async def handle_appointment_question(
    clinic_id: str,
    phone: str,
    phone_number_id: str,
    access_token: str,
    state: Dict[str, Any]
) -> None:
    """Handle 'other question' about appointment - offer help options."""
    # Update state to general chat
    state["state"] = "general_chat"
    if db:
        db.save_conversation_state(clinic_id, phone, state)

    # Send helpful message
    await send_whatsapp_message(
        phone_number_id, phone,
        "Claro! Como posso ajudar? 🤔\n\n"
        "Você pode perguntar sobre:\n"
        "• Horário de funcionamento\n"
        "• Endereço e como chegar\n"
        "• Formas de pagamento\n"
        "• Informações sobre profissionais\n"
        "• Serviços oferecidos\n\n"
        "Ou digite sua dúvida!",
        access_token
    )


async def handle_flow_completion(
    clinic_id: str,
    phone: str,
    flow_response: Dict[str, Any],
    phone_number_id: str,
    access_token: str,
    contact_name: str = ""
) -> None:
    """
    Handle WhatsApp Flow completion response.

    Flow 1 completion (Patient Info) → Send Flow 2 (Booking)
    Flow 2 completion (Booking) → Create appointment
    """
    logger.info(f"🔄 Processing flow completion for {phone}: {flow_response}")

    # Check if this is Flow 1 completion (has patient info, no date/time)
    # Flow 1 returns: professional_id, professional_name, specialty_name, tipo_pagamento,
    #                 convenio_nome, nome, email
    has_patient_info = "nome" in flow_response and "email" in flow_response
    has_booking = "date" in flow_response and "time" in flow_response

    if has_patient_info and not has_booking:
        # Flow 1 completed - send Flow 2 (Booking)
        logger.info(f"📋 Flow 1 completed, sending Booking flow...")

        # Get clinic-specific booking flow ID from Firestore
        booking_flow_id = None
        if db:
            clinic = db.get_clinic(clinic_id)
            if clinic:
                whatsapp_config = getattr(clinic, 'whatsapp_config', {}) or {}
                booking_flow_id = whatsapp_config.get('bookingFlowId', '')
                logger.info(f"📱 Using clinic-specific booking flow ID: {booking_flow_id}")

        # Fallback to environment variable if not in clinic config
        if not booking_flow_id:
            booking_flow_id = CLINICA_MEDICA_AGENDAMENTO_FLOW_ID

        if not booking_flow_id:
            # Fallback: create appointment with just the collected info
            logger.warning("⚠️ No booking flow ID configured (not in clinic config or env var)")
            await send_whatsapp_message(
                phone_number_id, phone,
                f"Obrigado {flow_response.get('nome', '')}! 📋\n\n"
                "Seus dados foram recebidos. Um atendente entrará em contato para "
                "confirmar data e horário da sua consulta.\n\n"
                f"Profissional: {flow_response.get('professional_name', '')}\n"
                f"Especialidade: {flow_response.get('specialty_name', '')}",
                access_token
            )
            return

        # Get professional info and available times
        professional_id = flow_response.get("professional_id", "")
        professional_name = flow_response.get("professional_name", "")
        specialty_name = flow_response.get("specialty_name", "")
        patient_name = flow_response.get("nome", "")
        patient_email = flow_response.get("email", "")

        # Get available times for the professional
        available_times = []
        if db and professional_id:
            professional = db.get_professional(clinic_id, professional_id)
            if professional:
                # Professional is a dataclass, use attribute access
                working_hours = getattr(professional, 'working_hours', {}) or {}
                duration = getattr(professional, 'appointment_duration', 30) or 30

                # Generate time slots from working hours
                time_slots = set()
                for day_key, day_hours in working_hours.items():
                    for period in day_hours:
                        start_str = period.get("start", "09:00")
                        end_str = period.get("end", "18:00")

                        try:
                            start_time = datetime.strptime(start_str, "%H:%M")
                            end_time = datetime.strptime(end_str, "%H:%M")

                            current = start_time
                            while current < end_time:
                                time_slots.add(current.strftime("%H:%M"))
                                current += timedelta(minutes=duration)
                        except ValueError:
                            continue

                available_times = [{"id": t, "title": t} for t in sorted(time_slots)][:20]

        if not available_times:
            available_times = [
                {"id": "08:00", "title": "08:00"},
                {"id": "09:00", "title": "09:00"},
                {"id": "10:00", "title": "10:00"},
                {"id": "11:00", "title": "11:00"},
                {"id": "14:00", "title": "14:00"},
                {"id": "15:00", "title": "15:00"},
                {"id": "16:00", "title": "16:00"},
                {"id": "17:00", "title": "17:00"},
            ]

        # Calculate date range
        today = datetime.now()
        min_date = (today + timedelta(days=1)).strftime("%Y-%m-%d")
        max_date = (today + timedelta(days=30)).strftime("%Y-%m-%d")

        # Generate new flow token with patient data
        flow_token = generate_flow_token(clinic_id, phone)

        # Send Booking Flow (Flow 2)
        success = await send_booking_flow(
            phone_number_id=phone_number_id,
            to=phone,
            flow_id=booking_flow_id,
            flow_token=flow_token,
            access_token=access_token,
            professional_id=professional_id,
            professional_name=professional_name,
            specialty_name=specialty_name,
            patient_name=patient_name,
            patient_email=patient_email,
            available_times=available_times,
            min_date=min_date,
            max_date=max_date,
        )

        if success:
            logger.info(f"✅ Booking flow sent to {phone}")
            # Update conversation state - include payment info from Flow 1
            tipo_pagamento = flow_response.get("tipo_pagamento", "particular")
            convenio_nome = flow_response.get("convenio_nome", "")
            if db:
                db.save_conversation_state(clinic_id, phone, {
                    "state": "in_booking_flow",
                    "professional_id": professional_id,
                    "professional_name": professional_name,
                    "patient_name": patient_name,
                    "patient_email": patient_email,
                    "tipo_pagamento": tipo_pagamento,
                    "convenio_nome": convenio_nome,
                })
        else:
            logger.error(f"❌ Failed to send booking flow to {phone}")
            await send_whatsapp_message(
                phone_number_id, phone,
                "Desculpe, ocorreu um erro ao carregar os horários. "
                "Por favor, tente novamente.",
                access_token
            )

    elif has_booking:
        # Flow 2 completed - create appointment
        logger.info(f"📅 Flow 2 completed, creating appointment...")

        professional_id = flow_response.get("professional_id", "")
        professional_name = flow_response.get("doctor_name", "")
        patient_name = flow_response.get("patient_name", "")
        patient_email = flow_response.get("patient_email", "")
        selected_date = flow_response.get("date", "")
        selected_time = flow_response.get("time", "")

        # Retrieve payment info from conversation state (saved in Flow 1)
        tipo_pagamento = "particular"
        convenio_nome = ""
        if db:
            conv_state = db.get_conversation_state(clinic_id, phone)
            if conv_state:
                tipo_pagamento = conv_state.get("tipo_pagamento", "particular")
                convenio_nome = conv_state.get("convenio_nome", "")

        logger.info(f"💳 Payment type: {tipo_pagamento}, Convenio: {convenio_nome}")

        # Get clinic settings for signal percentage and default price
        clinic = db.get_clinic(clinic_id) if db else None
        signal_percentage = 15  # Default 15%
        default_price_cents = 20000  # Default R$ 200.00 for consultation

        if clinic:
            signal_percentage = getattr(clinic, 'signal_percentage', 15) or 15
            # Check payment_settings for default consultation price
            payment_settings = getattr(clinic, 'payment_settings', {}) or {}
            default_price_cents = payment_settings.get('defaultConsultationPrice', 20000)

        # Format date for display
        try:
            dt = datetime.strptime(selected_date, "%Y-%m-%d")
            formatted_date = dt.strftime("%d/%m/%Y")
            weekday_names = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"]
            weekday = weekday_names[dt.weekday()]
        except ValueError:
            formatted_date = selected_date
            weekday = ""

        # Create the appointment
        try:
            appointment = create_appointment(
                db=db,
                clinic_id=clinic_id,
                patient_phone=phone,
                professional_id=professional_id,
                date_str=selected_date,
                time_str=selected_time,
                patient_name=patient_name,
                professional_name=professional_name,
                duration_minutes=30,
                payment_type=tipo_pagamento,
                total_cents=default_price_cents if tipo_pagamento == "particular" else 0,
                signal_percentage=signal_percentage,
                convenio_name=convenio_nome if tipo_pagamento == "convenio" else None,
            )

            logger.info(f"✅ Appointment created: {appointment.id if appointment else 'N/A'}")

            # Check if payment signal is required (particular with signal > 0)
            needs_payment = (
                tipo_pagamento == "particular" and
                appointment and
                appointment.signal_cents > 0
            )

            if needs_payment:
                # Import payment utilities
                from src.utils.payment import (
                    create_pagseguro_pix_order,
                    send_pix_payment_to_customer,
                    format_payment_amount,
                    is_pagseguro_configured,
                    PAGSEGURO_MIN_PIX_AMOUNT_CENTS
                )

                logger.info(f"💰 Signal required: {format_payment_amount(appointment.signal_cents)}")

                # Check if signal meets minimum PIX amount
                if appointment.signal_cents >= PAGSEGURO_MIN_PIX_AMOUNT_CENTS and is_pagseguro_configured():
                    # Create PIX payment order
                    payment_info = await create_pagseguro_pix_order(
                        order_id=appointment.id,
                        amount=appointment.signal_cents,
                        customer_name=patient_name,
                        customer_phone=phone,
                        product_name=f"Sinal - Consulta {professional_name}"
                    )

                    if payment_info:
                        # Save payment ID to appointment
                        if db:
                            db.update_appointment(appointment.id, {
                                "signalPaymentId": payment_info.get("payment_id")
                            })

                        # Send confirmation message with payment pending
                        confirmation_msg = (
                            f"📋 *Agendamento Registrado!*\n\n"
                            f"📅 {weekday}, {formatted_date} às {selected_time}\n"
                            f"👨‍⚕️ {professional_name}\n"
                            f"👤 {patient_name}\n\n"
                            f"💳 *Sinal necessário:* {format_payment_amount(appointment.signal_cents)}\n\n"
                            "Seu agendamento será confirmado após o pagamento do sinal. "
                            "Vou te enviar o PIX em seguida! 👇"
                        )
                        await send_whatsapp_message(phone_number_id, phone, confirmation_msg, access_token)

                        # Send PIX payment
                        await send_pix_payment_to_customer(
                            phone=phone,
                            payment_info=payment_info,
                            amount=appointment.signal_cents,
                            product_name="a confirmação da sua consulta",
                            order_id=appointment.id
                        )

                        logger.info(f"💳 PIX payment sent to {phone}")
                    else:
                        # PagSeguro failed - send manual instructions
                        logger.warning("⚠️ PagSeguro failed, sending confirmation without payment")
                        confirmation_msg = (
                            f"📋 *Agendamento Registrado!*\n\n"
                            f"📅 {weekday}, {formatted_date} às {selected_time}\n"
                            f"👨‍⚕️ {professional_name}\n"
                            f"👤 {patient_name}\n\n"
                            f"💳 *Sinal:* {format_payment_amount(appointment.signal_cents)}\n\n"
                            "Entre em contato com a clínica para efetuar o pagamento do sinal e confirmar sua consulta."
                        )
                        await send_whatsapp_message(phone_number_id, phone, confirmation_msg, access_token)
                else:
                    # Signal too low or PagSeguro not configured
                    logger.info(f"⚠️ Signal {appointment.signal_cents} cents below minimum or PagSeguro not configured")
                    confirmation_msg = (
                        f"✅ *Agendamento Confirmado!*\n\n"
                        f"📅 {weekday}, {formatted_date} às {selected_time}\n"
                        f"👨‍⚕️ {professional_name}\n"
                        f"👤 {patient_name}\n\n"
                        "Você receberá um lembrete 24h antes da consulta.\n\n"
                        "Para cancelar ou reagendar, basta enviar uma mensagem!"
                    )
                    await send_whatsapp_message(phone_number_id, phone, confirmation_msg, access_token)
            else:
                # Convenio or no signal required - appointment confirmed directly
                confirmation_msg = (
                    f"✅ *Agendamento Confirmado!*\n\n"
                    f"📅 {weekday}, {formatted_date} às {selected_time}\n"
                    f"👨‍⚕️ {professional_name}\n"
                    f"👤 {patient_name}\n"
                )
                if tipo_pagamento == "convenio" and convenio_nome:
                    confirmation_msg += f"📋 Convênio: {convenio_nome}\n"
                confirmation_msg += (
                    "\nVocê receberá um lembrete 24h antes da consulta.\n\n"
                    "Para cancelar ou reagendar, basta enviar uma mensagem!"
                )
                await send_whatsapp_message(phone_number_id, phone, confirmation_msg, access_token)

            # Reset conversation state
            if db:
                db.save_conversation_state(clinic_id, phone, {"state": "idle"})

        except Exception as e:
            logger.error(f"❌ Failed to create appointment: {e}")
            await send_whatsapp_message(
                phone_number_id, phone,
                "Desculpe, ocorreu um erro ao confirmar o agendamento. "
                "Por favor, tente novamente ou entre em contato conosco.",
                access_token
            )

    else:
        # Unknown flow response
        logger.warning(f"⚠️ Unknown flow response format: {flow_response}")


async def handle_scheduling_intent(
    clinic_id: str,
    phone: str,
    message: str,
    phone_number_id: str,
    access_token: str
) -> None:
    """Handle appointment scheduling intent with interactive WhatsApp flows."""
    clinic = db.get_clinic(clinic_id)
    if not clinic:
        await send_whatsapp_message(
            phone_number_id, phone,
            "Desculpe, não consegui encontrar as informações da clínica.",
            access_token
        )
        return

    # Check workflow mode - if info mode, redirect to contact
    workflow_mode = getattr(clinic, 'workflow_mode', 'booking')
    if workflow_mode == 'info':
        logger.info(f"📋 Clinic {clinic_id} is in INFO mode - redirecting scheduling request")
        clinic_name = clinic.name or "a clínica"
        clinic_phone = clinic.phone or ""

        info_message = (
            f"Para agendar uma consulta na *{clinic_name}*, "
            "entre em contato diretamente com nossa equipe.\n\n"
        )

        if clinic_phone:
            info_message += f"📞 *Telefone:* {clinic_phone}\n\n"

        info_message += "Posso ajudar com alguma informação sobre a clínica?"

        await send_whatsapp_message(
            phone_number_id, phone,
            info_message,
            access_token
        )

        # Send contact card if clinic has phone
        if clinic_phone:
            await send_whatsapp_contact_card(
                phone_number_id, phone,
                contact_name=clinic_name,
                contact_phone=clinic_phone,
                contact_email=getattr(clinic, 'email', None),
                organization=clinic_name,
                access_token=access_token
            )
        return

    # Get professionals
    professionals = db.get_clinic_professionals(clinic_id)

    # =============================================
    # USE WHATSAPP FLOWS IF CONFIGURED
    # Flow 1: Patient Info (ESPECIALIDADE → TIPO_ATENDIMENTO → INFO_CONVENIO → DADOS_PACIENTE → CONFIRMACAO)
    # Flow 2: Booking (BOOKING - date picker + time dropdown)
    # =============================================
    # Get clinic-specific flow ID from Firestore (created during Embedded Signup)
    # Falls back to environment variable for backward compatibility
    whatsapp_config = clinic.whatsapp_config or {}
    flow_id_to_use = whatsapp_config.get('patientInfoFlowId', '') or CLINICA_MEDICA_FORMULARIO_FLOW_ID

    logger.info(f"🔍 Flow ID for clinic {clinic_id}: {flow_id_to_use or 'NOT CONFIGURED'}")
    logger.info(f"🔍 Clinic whatsapp_config: {whatsapp_config}")

    if flow_id_to_use and professionals:
        logger.info(f"📱 Using WhatsApp Flow for scheduling (flow_id: {flow_id_to_use})")

        # Build especialidades list (each professional = one specialty option)
        especialidades = []
        for prof in professionals:
            specialty = getattr(prof, 'specialty', '') or ''
            specialty_name = CLINICA_MEDICA_SPECIALTIES.get(specialty, specialty) if specialty else "Especialista"
            prof_name = (prof.full_name or prof.name or "")[:72]
            especialidades.append({
                "id": prof.id,
                "title": specialty_name[:24],
                "description": prof_name
            })

        # Generate flow token (clinic_id:phone:timestamp)
        flow_token = generate_flow_token(clinic_id, phone)

        # Initial data for the ESPECIALIDADE screen
        initial_data = {
            "especialidades": especialidades[:10],  # Max 10 for RadioButtonsGroup
            "error_message": "",
        }

        # Send Flow 1 (Patient Info)
        # Use "navigate" for client-side flows (no server endpoint)
        success = await send_whatsapp_flow(
            phone_number_id=phone_number_id,
            to=phone,
            flow_id=flow_id_to_use,
            flow_token=flow_token,
            flow_cta="Agendar Consulta",
            header_text="Seus Dados 👇",
            body_text=f"Preencha seus dados para agendar sua consulta na *{clinic.name}*",
            access_token=access_token,
            flow_action="navigate",  # "navigate" for client-side flows
            initial_screen="ESPECIALIDADE",
            initial_data=initial_data,
        )

        if success:
            # Save state for flow tracking
            new_state = {
                "state": "in_patient_info_flow",
                "flow_token": flow_token,
                "clinic_id": clinic_id,
            }
            if db:
                db.save_conversation_state(clinic_id, phone, new_state)
            logger.info(f"✅ Patient Info Flow sent to {phone}")
            return
        else:
            logger.warning(f"⚠️ Failed to send flow, falling back to list messages")
            # Fall through to regular flow below

    if not professionals:
        await send_whatsapp_message(
            phone_number_id, phone,
            "Desculpe, não há profissionais disponíveis no momento.",
            access_token
        )
        return

    # If only one professional, show time slots directly with buttons
    if len(professionals) == 1:
        prof = professionals[0]
        await show_professional_slots(
            clinic_id, phone, prof.id, prof.full_name or prof.name,
            getattr(prof, 'specialty', ''),
            phone_number_id, access_token
        )
    elif len(professionals) <= 3:
        # 2-3 professionals: use buttons
        buttons = [
            {"id": f"prof_{p.id}", "title": (p.full_name or p.name)[:20]}
            for p in professionals[:3]
        ]
        # Save state
        prof_map = {f"prof_{p.id}": {"id": p.id, "name": p.full_name or p.name, "specialty": getattr(p, 'specialty', '')} for p in professionals}
        new_state = {
            "state": "selecting_professional",
            "clinic_id": clinic_id,
            "professionals_map": prof_map,
        }
        if db:
            db.save_conversation_state(clinic_id, phone, new_state)

        await send_whatsapp_buttons(
            phone_number_id, phone,
            f"👋 Olá! Vamos agendar sua consulta.\n\n*{clinic.name}*\n\nSelecione o profissional:",
            buttons,
            access_token
        )
    else:
        # More than 3 professionals: use list
        rows = [
            {
                "id": f"prof_{p.id}",
                "title": (p.full_name or p.name)[:24],
                "description": getattr(p, 'specialty', '')[:72] or "Profissional"
            }
            for p in professionals[:10]
        ]
        sections = [{"title": "Profissionais", "rows": rows}]

        # Save state
        prof_map = {f"prof_{p.id}": {"id": p.id, "name": p.full_name or p.name, "specialty": getattr(p, 'specialty', '')} for p in professionals}
        new_state = {
            "state": "selecting_professional",
            "clinic_id": clinic_id,
            "professionals_map": prof_map,
        }
        if db:
            db.save_conversation_state(clinic_id, phone, new_state)

        await send_whatsapp_list(
            phone_number_id, phone,
            "Agendar Consulta",
            f"👋 Olá! Vamos agendar sua consulta na *{clinic.name}*.\n\nSelecione o profissional desejado:",
            "Ver profissionais",
            sections,
            access_token
        )


async def show_professional_slots(
    clinic_id: str,
    phone: str,
    professional_id: str,
    professional_name: str,
    specialty: str,
    phone_number_id: str,
    access_token: str
) -> None:
    """Show available time slots for a professional using WhatsApp list."""
    slots = get_available_slots(db, clinic_id, professional_id=professional_id, days_ahead=7)

    # Filter by minimum booking lead time
    min_lead_hours = get_clinic_min_lead_time(clinic_id)
    if slots and min_lead_hours > 0:
        slots = filter_slots_by_lead_time(slots, min_lead_hours)
        logger.info(f"🕐 Filtered slots with {min_lead_hours}h lead time: {len(slots)} remaining")

    if not slots:
        await send_whatsapp_message(
            phone_number_id, phone,
            f"Desculpe, não há horários disponíveis para *{professional_name}* nos próximos dias.\n\nPor favor, entre em contato com a clínica.",
            access_token
        )
        return

    # Group slots by date (handle both TimeSlot objects and dicts)
    slots_by_date: Dict[str, List[Any]] = {}
    for slot in slots[:30]:  # Limit to 30 slots for processing
        date_str = slot.date if hasattr(slot, 'date') else slot.get('date', '')
        if date_str not in slots_by_date:
            slots_by_date[date_str] = []
        slots_by_date[date_str].append(slot)

    # Build sections for WhatsApp list (one section per date)
    # IMPORTANT: WhatsApp allows max 10 total rows across all sections
    sections = []
    slot_map = {}  # Map slot IDs to slot data
    total_rows = 0
    MAX_TOTAL_ROWS = 10  # WhatsApp limit

    for date_str, date_slots in list(slots_by_date.items())[:5]:  # Max 5 dates
        if total_rows >= MAX_TOTAL_ROWS:
            break

        try:
            dt = datetime.strptime(date_str, "%Y-%m-%d")
            day_names = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"]
            day_name = day_names[dt.weekday()]
            formatted_date = dt.strftime("%d/%m")
            section_title = f"{day_name}, {formatted_date}"
        except ValueError:
            section_title = date_str

        rows = []
        for slot in date_slots:
            if total_rows >= MAX_TOTAL_ROWS:
                break
            time_str = slot.time if hasattr(slot, 'time') else slot.get('time', '')
            slot_id = f"slot_{date_str}_{time_str.replace(':', '')}"
            slot_map[slot_id] = {"date": date_str, "time": time_str}
            rows.append({
                "id": slot_id,
                "title": time_str,
                "description": f"{professional_name}"[:72]
            })
            total_rows += 1

        if rows:
            sections.append({"title": section_title, "rows": rows})

    if not sections:
        await send_whatsapp_message(
            phone_number_id, phone,
            f"Desculpe, não há horários disponíveis para *{professional_name}*.",
            access_token
        )
        return

    # Save state
    new_state = {
        "state": "selecting_slot",
        "clinic_id": clinic_id,
        "professional_id": professional_id,
        "professional_name": professional_name,
        "slot_map": slot_map,
    }
    if db:
        db.save_conversation_state(clinic_id, phone, new_state)

    specialty_text = f" ({specialty})" if specialty else ""
    await send_whatsapp_list(
        phone_number_id, phone,
        "Horários Disponíveis",
        f"📅 *{professional_name}*{specialty_text}\n\nSelecione um horário disponível:",
        "Ver horários",
        sections,
        access_token
    )


async def process_message(
    clinic_id: str,
    phone: str,
    message: str,
    message_id: str,
    phone_number_id: str,
    access_token: str,
    button_payload: Optional[str] = None,
    contact_name: Optional[str] = None
) -> None:
    """Process incoming WhatsApp message."""
    phone = ensure_phone_has_plus(phone)

    # Set context variables for message logging
    _current_clinic_id.set(clinic_id)
    _current_phone_number_id.set(phone_number_id)

    # Mark as read
    await mark_message_as_read(phone_number_id, message_id, access_token)

    # Upsert contact (like Zapcomm)
    if db:
        db.upsert_contact(clinic_id, phone, name=contact_name)

    # Log incoming message (always log for conversation history)
    if db:
        db.log_conversation_message(
            clinic_id, phone, "text", message,
            source="patient", phone_number_id=phone_number_id
        )

    # Check human takeover - skip AI processing if human has taken over
    if db and db.is_human_takeover_enabled(clinic_id, phone):
        logger.info(f"🙋 Human takeover active for {phone}, skipping AI processing")
        # Message already logged above, just skip AI processing
        return

    # Check for button response (reminder confirmation)
    if button_payload:
        # Find pending appointment for this patient
        appointments = get_appointments_by_phone(db, phone, clinic_id, include_past=False)
        pending_apt = next(
            (a for a in appointments if a.status.value in ['confirmed', 'awaiting_confirmation']),
            None
        )

        if pending_apt:
            await handle_reminder_response(
                clinic_id, phone, button_payload, pending_apt,
                phone_number_id, access_token
            )
            return

    # Check conversation state (Firestore-backed)
    state = db.load_conversation_state(clinic_id, phone) if db else {}
    current_state = state.get("state")

    # Update conversation with contact info if available (like Zapcomm)
    if db and contact_name and contact_name != state.get("waUserName"):
        state["waUserName"] = contact_name
        state["waUserPhone"] = phone
        state["waUserId"] = phone  # For frontend compatibility
        db.save_conversation_state(clinic_id, phone, state)
        logger.info(f"👤 Updated conversation with contact name: {contact_name}")

    msg_lower = message.lower().strip()

    # =============================================
    # DETECT GREETING AND RESET STATE IF NEEDED
    # If user sends a greeting while in middle of flow, reset and start fresh
    # =============================================
    greeting_patterns = [
        "oi", "olá", "ola", "oie", "oii", "oiii",
        "bom dia", "boa tarde", "boa noite",
        "tudo bem", "td bem", "tudo bom", "td bom",
        "e ai", "e aí", "eai", "eaí",
        "hey", "hello", "hi",
        "opa", "fala", "salve",
    ]

    # Check if message is primarily a greeting (not button, short message)
    if not button_payload and len(msg_lower) < 30:
        is_greeting = any(
            msg_lower == g or
            msg_lower.startswith(g + " ") or
            msg_lower.startswith(g + ",") or
            msg_lower.startswith(g + "!") or
            msg_lower.startswith(g + "?")
            for g in greeting_patterns
        )

        # If it's a greeting and user is in a mid-flow state, reset and greet
        if is_greeting and current_state not in (None, "new", "novo", "", "awaiting_greeting_response", "general_chat"):
            logger.info(f"👋 Greeting detected while in state '{current_state}', resetting conversation for {phone}")
            # Clear the old state
            if db:
                db.save_conversation_state(clinic_id, phone, {"state": None, "waUserName": contact_name, "waUserPhone": phone})
            # Send fresh greeting
            await send_initial_greeting(
                clinic_id, phone, phone_number_id, access_token,
                contact_name=contact_name
            )
            return

    # =============================================
    # HANDLE INTERACTIVE BUTTON/LIST RESPONSES
    # =============================================
    if button_payload:
        # Handle greeting response buttons
        if button_payload == "greeting_sim":
            logger.info(f"📅 User {phone} wants to schedule (greeting button)")
            await handle_scheduling_intent(
                clinic_id, phone, "quero agendar",
                phone_number_id, access_token
            )
            return

        if button_payload == "greeting_nao":
            logger.info(f"❓ User {phone} has a question (greeting button)")
            await handle_greeting_response_duvida(
                clinic_id, phone,
                phone_number_id, access_token
            )
            return

        if button_payload == "greeting_contato":
            logger.info(f"📞 User {phone} wants to talk to attendant (info mode)")
            await escalate_to_human(
                clinic_id, phone,
                phone_number_id, access_token,
                reason="user_requested_contact_info_mode",
                auto_takeover=True
            )
            return

        # Handle appointment action buttons (when user has existing appointment)
        if button_payload == "apt_reagendar":
            logger.info(f"📅 User {phone} wants to reschedule appointment")
            await handle_appointment_reschedule(
                clinic_id, phone,
                phone_number_id, access_token, state
            )
            return

        if button_payload == "apt_cancelar":
            logger.info(f"❌ User {phone} wants to cancel appointment - escalating")
            await handle_appointment_cancel_request(
                clinic_id, phone,
                phone_number_id, access_token, state
            )
            return

        if button_payload == "apt_duvida":
            logger.info(f"❓ User {phone} has other question about appointment")
            await handle_appointment_question(
                clinic_id, phone,
                phone_number_id, access_token, state
            )
            return

        # Professional selection from buttons/list
        if button_payload.startswith("prof_"):
            prof_map = state.get("professionals_map", {})
            prof_data = prof_map.get(button_payload)
            if prof_data:
                await show_professional_slots(
                    clinic_id, phone,
                    prof_data["id"],
                    prof_data["name"],
                    prof_data.get("specialty", ""),
                    phone_number_id, access_token
                )
                return

        # Slot selection from list
        if button_payload.startswith("slot_"):
            slot_map = state.get("slot_map", {})
            slot_data = slot_map.get(button_payload)
            if slot_data:
                # Move to collecting name
                new_state = {
                    "state": "collecting_name",
                    "clinic_id": clinic_id,
                    "professional_id": state.get("professional_id"),
                    "professional_name": state.get("professional_name"),
                    "date": slot_data["date"],
                    "time": slot_data["time"],
                }
                if db:
                    db.save_conversation_state(clinic_id, phone, new_state)

                # Parse date for display
                try:
                    dt = datetime.strptime(slot_data["date"], "%Y-%m-%d")
                    day_names = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"]
                    day_name = day_names[dt.weekday()]
                    formatted_date = dt.strftime("%d/%m")
                except ValueError:
                    day_name = ""
                    formatted_date = slot_data["date"]

                await send_whatsapp_message(
                    phone_number_id, phone,
                    f"✅ Horário selecionado!\n\n"
                    f"📅 *{day_name}, {formatted_date}*\n"
                    f"🕐 *{slot_data['time']}*\n"
                    f"👨‍⚕️ *{state.get('professional_name')}*\n\n"
                    f"Por favor, me diga seu *nome completo* para finalizar o agendamento:",
                    access_token
                )
                return

    # =============================================
    # DETECT SCHEDULING INTENT (before AI chat)
    # =============================================
    scheduling_keywords = [
        "agendar", "marcar", "consulta", "agendamento",
        "quero agendar", "preciso agendar", "quero marcar",
        "horário", "horarios", "disponibilidade",
        "qual profissional", "quais profissionais",
        "quais opções", "quais opcoes", "qual opção",
    ]

    # Check if this is a NEW conversation (first message)
    # Send initial greeting with scheduling option
    if current_state in (None, "new", "novo") or not current_state:
        # If they explicitly mention scheduling, skip greeting and go straight to flow
        if any(kw in msg_lower for kw in scheduling_keywords):
            logger.info(f"📅 Scheduling intent detected: {message[:50]}...")
            await handle_scheduling_intent(
                clinic_id, phone, message,
                phone_number_id, access_token
            )
            return

        # Otherwise, send the welcome greeting with buttons
        logger.info(f"👋 New conversation from {phone}, sending initial greeting")
        await send_initial_greeting(
            clinic_id, phone, phone_number_id, access_token,
            contact_name=contact_name
        )
        return

    # Handle user waiting for greeting response who types text instead of clicking button
    if current_state == "awaiting_greeting_response":
        # Check if they want to schedule based on text
        positive_responses = ["sim", "quero", "yes", "agendar", "marcar", "consulta"]
        question_responses = ["duvida", "dúvida", "pergunta", "informação", "informacao", "nao", "não", "no", "depois", "agora não", "obrigado"]

        if any(resp in msg_lower for resp in positive_responses):
            logger.info(f"📅 User {phone} wants to schedule (text response)")
            await handle_scheduling_intent(
                clinic_id, phone, message,
                phone_number_id, access_token
            )
            return

        if any(resp in msg_lower for resp in question_responses):
            logger.info(f"❓ User {phone} has a question (text response)")
            await handle_greeting_response_duvida(
                clinic_id, phone, phone_number_id, access_token
            )
            return

        # If unclear response, re-send the greeting buttons
        await send_initial_greeting(
            clinic_id, phone, phone_number_id, access_token
        )
        return

    # Handle general chat state - user previously declined but might want to schedule now
    if current_state == "general_chat":
        # Check if they now want to schedule
        if any(kw in msg_lower for kw in scheduling_keywords):
            logger.info(f"📅 User {phone} now wants to schedule from general chat")
            await handle_scheduling_intent(
                clinic_id, phone, message,
                phone_number_id, access_token
            )
            return
        # Otherwise, continue to AI chat below

    # Handle ongoing conversation flows
    if current_state == "selecting_professional":
        # User is selecting a professional (text fallback - buttons handled above)
        prof_map = state.get("professionals_map", {})

        # Try to match by name in text
        selected = None
        for prof_data in prof_map.values():
            prof_name_lower = prof_data.get("name", "").lower()
            if prof_name_lower and prof_name_lower in msg_lower:
                selected = prof_data
                break

        if selected:
            await show_professional_slots(
                clinic_id, phone,
                selected["id"],
                selected["name"],
                selected.get("specialty", ""),
                phone_number_id, access_token
            )
        else:
            # Re-show the professional selection
            await send_whatsapp_message(
                phone_number_id, phone,
                "Por favor, selecione um profissional usando os botões acima ☝️",
                access_token
            )
        return

    elif current_state == "selecting_slot":
        # User should select from the list (button handled above)
        # If they type text, guide them to use the list
        await send_whatsapp_message(
            phone_number_id, phone,
            "Por favor, selecione um horário usando a lista acima ☝️\n\nClique em *'Ver horários'* para ver as opções disponíveis.",
            access_token
        )
        return

    elif current_state == "rescheduling":
        # Rescheduling flow - parse date/time from message
        import re

        # Try to find date pattern
        date_match = re.search(r'(\d{1,2})/(\d{1,2})', message)
        time_match = re.search(r'(\d{1,2}):(\d{2})', message)

        if date_match and time_match:
            day = int(date_match.group(1))
            month = int(date_match.group(2))
            hour = int(time_match.group(1))
            minute = int(time_match.group(2))

            year = datetime.now().year
            if month < datetime.now().month:
                year += 1

            try:
                date_str = f"{year}-{month:02d}-{day:02d}"
                time_str = f"{hour:02d}:{minute:02d}"

                # Check if slot is available
                available = get_professional_availability(
                    db, clinic_id, state["professional_id"], date_str
                )

                if time_str in available:
                    # Reschedule existing appointment
                    reschedule_appointment(db, state["appointment_id"], date_str, time_str)
                    await send_whatsapp_message(
                        phone_number_id, phone,
                        f"✅ Consulta reagendada com sucesso!\n\n📅 {day:02d}/{month:02d} às {time_str}\n👨‍⚕️ {state['professional_name']}\n\nTe esperamos!",
                        access_token
                    )
                    # Clear conversation state
                    if db:
                        db.save_conversation_state(clinic_id, phone, {"state": "new", "context": {}})
                else:
                    await send_whatsapp_message(
                        phone_number_id, phone,
                        f"Desculpe, o horário {time_str} não está disponível em {day:02d}/{month:02d}. Por favor, escolha outro horário.",
                        access_token
                    )
            except ValueError:
                await send_whatsapp_message(
                    phone_number_id, phone,
                    "Data inválida. Por favor, informe no formato DD/MM às HH:MM (ex: 15/01 às 14:00)",
                    access_token
                )
        else:
            await send_whatsapp_message(
                phone_number_id, phone,
                "Por favor, informe a data e horário no formato: DD/MM às HH:MM (ex: 15/01 às 14:00)",
                access_token
            )
        return

    elif current_state == "collecting_name":
        # User is providing their name
        patient_name = message.strip()
        if len(patient_name) < 3:
            await send_whatsapp_message(
                phone_number_id, phone,
                "Por favor, informe seu nome completo.",
                access_token
            )
            return

        # Get clinic and professional info
        clinic = db.get_clinic(clinic_id)

        # Get service price if available (for signal calculation)
        professional = db.get_professional(clinic_id, state["professional_id"])
        service_price_cents = 0
        if professional and hasattr(professional, 'default_price_cents'):
            service_price_cents = professional.default_price_cents or 0

        # Get deposit percentage from clinic payment settings
        deposit_percentage = clinic.signal_percentage if clinic else 0

        # Check if clinic requires deposit via payment settings
        requires_deposit = False
        if clinic:
            # Check paymentSettings if available
            payment_settings = getattr(clinic, 'payment_settings', None)
            if payment_settings:
                requires_deposit = payment_settings.get('requiresDeposit', False)
                deposit_percentage = payment_settings.get('depositPercentage', deposit_percentage)
            elif deposit_percentage > 0:
                requires_deposit = True

        # Calculate signal amount
        signal_cents = int(service_price_cents * deposit_percentage / 100) if requires_deposit else 0

        # Create the appointment
        appointment = create_appointment(
            db,
            clinic_id=clinic_id,
            patient_phone=phone,
            professional_id=state["professional_id"],
            date_str=state["date"],
            time_str=state["time"],
            patient_name=patient_name,
            professional_name=state["professional_name"],
            payment_type="particular",
            total_cents=service_price_cents,
            signal_percentage=deposit_percentage,
        )

        if appointment:
            # Parse date for display
            dt = datetime.strptime(state["date"], "%Y-%m-%d")
            day_names = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"]
            day_name = day_names[dt.weekday()]
            formatted_date = dt.strftime("%d/%m/%Y")

            # Check if we need to send PIX payment
            if requires_deposit and signal_cents >= 100:  # Minimum R$ 1.00
                # Generate PIX payment
                import uuid
                import urllib.parse
                from src.utils.payment import (
                    create_pagseguro_pix_order,
                    format_payment_amount,
                    is_pagseguro_configured,
                    DOMAIN
                )

                if is_pagseguro_configured():
                    order_id = str(uuid.uuid4())[:12]

                    # Create PIX order
                    payment_info = await create_pagseguro_pix_order(
                        order_id=order_id,
                        amount=signal_cents,
                        customer_name=patient_name,
                        customer_phone=phone,
                        product_name=f"Sinal - Consulta {state['professional_name']}"
                    )

                    if payment_info:
                        # Save order to database
                        db.create_order(order_id, {
                            "clinicId": clinic_id,
                            "appointmentId": appointment.id,
                            "patientPhone": phone,
                            "patientName": patient_name,
                            "description": f"Sinal - Consulta {state['professional_name']}",
                            "amountCents": signal_cents,
                            "paymentStatus": "pending",
                            "status": "pending",
                            "paymentId": payment_info.get("payment_id"),
                            "pixCopiaCola": payment_info.get("qr_code_text"),
                            "qrCodeUrl": payment_info.get("qr_code"),
                            "professionalId": state["professional_id"],
                            "professionalName": state["professional_name"],
                            "appointmentDate": state["date"],
                            "appointmentTime": state["time"],
                        })

                        # Send appointment info first
                        await send_whatsapp_message(
                            phone_number_id, phone,
                            f"📋 *Consulta pré-agendada!*\n\n"
                            f"📅 *{day_name}, {formatted_date}*\n"
                            f"🕐 *{state['time']}*\n"
                            f"👨‍⚕️ *{state['professional_name']}*\n"
                            f"📍 *{clinic.address if clinic else ''}*\n\n"
                            f"⚠️ Para confirmar, é necessário pagar o *sinal* de *{format_payment_amount(signal_cents)}*.",
                            access_token
                        )

                        # Send PIX payment button
                        phone_encoded = urllib.parse.quote(phone, safe='')
                        pix_page_url = f"{DOMAIN}/pix/{phone_encoded}/{order_id}"

                        await send_pix_payment_cta(
                            phone_number_id,
                            phone.replace("+", ""),
                            pix_page_url,
                            format_payment_amount(signal_cents),
                            f"Sinal - Consulta {state['professional_name']}",
                            access_token
                        )

                        logger.info(f"✅ PIX payment sent for appointment {appointment.id}")
                    else:
                        # PIX creation failed, but appointment is created
                        logger.error("Failed to create PIX payment")
                        await send_whatsapp_message(
                            phone_number_id, phone,
                            f"✅ *Consulta agendada!*\n\n"
                            f"📅 *{day_name}, {formatted_date}*\n"
                            f"🕐 *{state['time']}*\n"
                            f"👨‍⚕️ *{state['professional_name']}*\n\n"
                            f"⚠️ O pagamento do sinal será solicitado em breve.",
                            access_token
                        )
                else:
                    # PagSeguro not configured - check if clinic has PIX key for manual payment
                    pix_key = None
                    if clinic:
                        payment_settings = getattr(clinic, 'payment_settings', None)
                        if payment_settings:
                            pix_key = payment_settings.get('pixKey')
                        if not pix_key:
                            pix_key = getattr(clinic, 'pix_key', None)

                    if pix_key:
                        from src.utils.payment import format_payment_amount
                        await send_whatsapp_message(
                            phone_number_id, phone,
                            f"📋 *Consulta pré-agendada!*\n\n"
                            f"📅 *{day_name}, {formatted_date}*\n"
                            f"🕐 *{state['time']}*\n"
                            f"👨‍⚕️ *{state['professional_name']}*\n\n"
                            f"💳 *Para confirmar, pague o sinal via PIX:*\n"
                            f"Valor: *{format_payment_amount(signal_cents)}*\n"
                            f"Chave PIX: `{pix_key}`\n\n"
                            f"Envie o comprovante aqui após o pagamento!",
                            access_token
                        )
                    else:
                        # No PIX key configured - just confirm
                        await send_whatsapp_message(
                            phone_number_id, phone,
                            f"✅ *Consulta agendada com sucesso!*\n\n"
                            f"📅 *{day_name}, {formatted_date}*\n"
                            f"🕐 *{state['time']}*\n"
                            f"👨‍⚕️ *{state['professional_name']}*\n"
                            f"📍 *{clinic.address if clinic else ''}*\n\n"
                            f"Você receberá um lembrete 24h e 2h antes da consulta.\n"
                            f"Chegue 15 minutos antes do horário marcado!",
                            access_token
                        )
            else:
                # No deposit required or amount too low - just confirm
                await send_whatsapp_message(
                    phone_number_id, phone,
                    f"✅ *Consulta agendada com sucesso!*\n\n"
                    f"📅 *{day_name}, {formatted_date}*\n"
                    f"🕐 *{state['time']}*\n"
                    f"👨‍⚕️ *{state['professional_name']}*\n"
                    f"📍 *{clinic.address if clinic else ''}*\n\n"
                    f"Você receberá um lembrete 24h e 2h antes da consulta.\n"
                    f"Chegue 15 minutos antes do horário marcado!",
                    access_token
                )

            # Clear conversation state
            if db:
                db.save_conversation_state(clinic_id, phone, {"state": "new", "context": {}})
        else:
            await send_whatsapp_message(
                phone_number_id, phone,
                "Desculpe, ocorreu um erro ao agendar. Por favor, tente novamente.",
                access_token
            )
        return

    # ===========================================
    # SENTIMENT DETECTION - Auto-escalate frustrated users
    # ===========================================
    if detect_frustrated_sentiment(message):
        logger.warning(f"😤 Frustrated sentiment detected from {phone}: {message[:50]}...")
        await escalate_to_human(
            clinic_id, phone,
            phone_number_id, access_token,
            reason=f"Usuário frustrado/irritado - Mensagem: {message[:100]}",
            auto_takeover=True
        )
        return

    # ===========================================
    # EXPLICIT HUMAN ESCALATION REQUEST
    # ===========================================
    # Detect when user explicitly asks to speak with a human, reception, etc.
    if detect_human_escalation_request(message):
        logger.info(f"🙋 User {phone} requested human escalation: {message[:50]}...")
        await escalate_to_human(
            clinic_id, phone,
            phone_number_id, access_token,
            reason=f"Solicitação de atendimento humano - Mensagem: {message[:100]}",
            auto_takeover=True
        )
        return

    # ===========================================
    # AI CHAT PROCESSING (Simple OpenAI Integration)
    # ===========================================
    try:
        # Load clinic context for AI
        clinic_context = load_clinic_context(clinic_id)

        # Get AI response
        ai_response = await get_ai_response(
            clinic_id=clinic_id,
            phone=phone,
            message=message,
            clinic_context=clinic_context
        )

        if ai_response:
            await send_whatsapp_message(
                phone_number_id, phone,
                ai_response,
                access_token
            )
            logger.info(f"✅ AI responded successfully")
            return

    except Exception as e:
        logger.error(f"❌ AI error: {e}")

    # Default fallback response
    await send_whatsapp_message(
        phone_number_id, phone,
        "Olá! 👋\n\nSou o assistente virtual da clínica.\n\nPosso ajudar você a:\n"
        "• *Agendar* uma consulta\n"
        "• Ver *suas consultas* agendadas\n\n"
        "Como posso ajudar?",
        access_token
    )


# ============================================
# WEBHOOK ENDPOINTS
# ============================================

@app.get("/")
async def root():
    """Root endpoint."""
    return {"status": "ok", "service": "Gendei WhatsApp Agent"}


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "Gendei WhatsApp Agent",
        "timestamp": datetime.now().isoformat()
    }


@app.get("/webhook")
async def verify_webhook(request: Request):
    """Verify webhook for WhatsApp API."""
    mode = request.query_params.get("hub.mode")
    token = request.query_params.get("hub.verify_token")
    challenge = request.query_params.get("hub.challenge")

    logger.info(f"Webhook verification: mode={mode}, token={token}")

    if mode == "subscribe" and token == VERIFY_TOKEN:
        logger.info("✅ Webhook verified successfully")
        return Response(content=challenge, media_type="text/plain")

    logger.warning("❌ Webhook verification failed")
    raise HTTPException(status_code=403, detail="Verification failed")


async def process_buffered_messages(
    clinic_id: str,
    phone: str,
    phone_number_id: str,
    access_token: str,
    buffer_key: str
):
    """Process buffered messages after wait period."""
    try:
        # Wait for buffer deadline
        deadline = message_buffer_deadlines.get(buffer_key)
        wait_seconds = max(0.0, (deadline - datetime.now()).total_seconds()) if deadline else DEFAULT_MESSAGE_BUFFER_SECONDS
        await asyncio.sleep(wait_seconds)

        # Check if another handler is already processing
        if is_buffer_locked(buffer_key):
            logger.info(f"🔒 Buffer already being processed for {phone}, skipping")
            return

        # Lock and process
        lock_buffer(buffer_key)
        try:
            buffered_messages = get_buffered_messages(buffer_key)
            if not buffered_messages:
                logger.info(f"📭 No buffered messages for {phone}")
                return

            # Combine all messages
            combined_text = combine_messages(buffered_messages)
            first_msg = buffered_messages[0]
            message_id = first_msg.get('message_id', '')
            contact_name = first_msg.get('contact_name')
            button_payload = first_msg.get('button_payload')

            logger.info(f"📬 Processing {len(buffered_messages)} buffered message(s) for {phone}: {combined_text[:50]}...")

            # Process combined message
            await process_message(
                clinic_id,
                phone,
                combined_text,
                message_id,
                phone_number_id,
                access_token,
                button_payload,
                contact_name
            )
        finally:
            unlock_buffer(buffer_key)

    except Exception as e:
        logger.error(f"❌ Error processing buffered messages: {e}")
        unlock_buffer(buffer_key)


async def handle_voice_message(
    clinic_id: str,
    phone: str,
    media_id: str,
    message_id: str,
    phone_number_id: str,
    access_token: str,
    contact_name: Optional[str] = None
):
    """Handle voice message: download, transcribe, and process."""
    try:
        from src.utils.transcription import transcribe_audio
        from src.utils.messaging import download_whatsapp_media

        logger.info(f"🎤 Processing voice message from {phone}")

        # Download audio
        download_result = await download_whatsapp_media(media_id)
        if not download_result:
            await send_whatsapp_message(
                phone_number_id, phone,
                "Desculpe, não consegui processar seu áudio. Pode tentar enviar novamente ou digitar sua mensagem? 🙏",
                access_token
            )
            return

        file_path, mime_type = download_result
        logger.info(f"📥 Audio downloaded: {file_path}")

        # Transcribe
        transcription = await transcribe_audio(file_path, mime_type)

        # Clean up temp file
        try:
            import os as os_module
            os_module.remove(file_path)
        except Exception:
            pass

        if transcription:
            logger.info(f"📝 Transcription: {transcription[:100]}...")

            # Process transcribed text like a regular message
            await process_message(
                clinic_id,
                phone,
                transcription,
                message_id,
                phone_number_id,
                access_token,
                None,
                contact_name
            )
        else:
            await send_whatsapp_message(
                phone_number_id, phone,
                "Desculpe, não consegui entender seu áudio. Pode tentar enviar novamente ou digitar sua mensagem? 🙏",
                access_token
            )

    except Exception as e:
        logger.error(f"❌ Voice message error: {e}")
        await send_whatsapp_message(
            phone_number_id, phone,
            "Desculpe, ocorreu um erro ao processar seu áudio. Pode digitar sua mensagem?",
            access_token
        )


@app.post("/webhook")
async def receive_webhook(request: Request, background_tasks: BackgroundTasks):
    """Receive WhatsApp webhook events."""
    try:
        body = await request.json()
        logger.info(f"📨 Webhook received: {json.dumps(body)[:500]}")

        # Extract entry
        entry = body.get("entry", [])
        if not entry:
            return {"status": "ok"}

        for e in entry:
            changes = e.get("changes", [])
            for change in changes:
                value = change.get("value", {})

                # Get phone number ID
                metadata = value.get("metadata", {})
                phone_number_id = metadata.get("phone_number_id")

                if not phone_number_id:
                    continue

                # Look up clinic
                clinic = db.get_clinic_by_phone_number_id(phone_number_id) if db else None
                if not clinic:
                    logger.warning(f"No clinic found for phone_number_id: {phone_number_id}")
                    continue

                clinic_id = clinic.id
                access_token = db.get_clinic_access_token(clinic_id) if db else WHATSAPP_TOKEN
                if not access_token:
                    access_token = WHATSAPP_TOKEN

                # Get contact info
                contacts = value.get("contacts", [])
                contact_name = None
                if contacts:
                    contact_name = contacts[0].get("profile", {}).get("name")

                # Process messages
                messages = value.get("messages", [])
                for msg in messages:
                    message_id = msg.get("id")

                    # Deduplicate
                    if is_message_processed(message_id):
                        logger.info(f"⚠️ Message {message_id} already processed, skipping")
                        continue

                    sender = msg.get("from")
                    msg_type = msg.get("type")

                    # Handle voice/audio messages
                    if msg_type == "audio":
                        audio_data = msg.get("audio", {})
                        media_id = audio_data.get("id")
                        if media_id:
                            background_tasks.add_task(
                                handle_voice_message,
                                clinic_id,
                                ensure_phone_has_plus(sender),
                                media_id,
                                message_id,
                                phone_number_id,
                                access_token,
                                contact_name
                            )
                        continue

                    # Extract text message content
                    text = ""
                    button_payload = None

                    if msg_type == "text":
                        text = msg.get("text", {}).get("body", "")
                    elif msg_type == "interactive":
                        interactive = msg.get("interactive", {})
                        interactive_type = interactive.get("type", "")

                        if interactive_type == "button_reply":
                            button_payload = interactive.get("button_reply", {}).get("id")
                            text = interactive.get("button_reply", {}).get("title", "")

                        elif interactive_type == "nfm_reply":
                            # WhatsApp Flow completion response
                            nfm_reply = interactive.get("nfm_reply", {})
                            response_json_str = nfm_reply.get("response_json", "{}")

                            try:
                                flow_response = json.loads(response_json_str)
                                logger.info(f"📱 Flow completed: {flow_response}")

                                phone = ensure_phone_has_plus(sender)

                                # Handle flow completion in background
                                background_tasks.add_task(
                                    handle_flow_completion,
                                    clinic_id,
                                    phone,
                                    flow_response,
                                    phone_number_id,
                                    access_token,
                                    contact_name
                                )
                            except json.JSONDecodeError as e:
                                logger.error(f"❌ Failed to parse flow response: {e}")

                            continue  # Skip normal message processing

                    elif msg_type == "button":
                        button_payload = msg.get("button", {}).get("payload")
                        text = msg.get("button", {}).get("text", "")

                    if text or button_payload:
                        phone = ensure_phone_has_plus(sender)
                        buffer_key = f"{clinic_id}:{phone}"

                        # For button responses, process immediately (no buffering)
                        if button_payload:
                            background_tasks.add_task(
                                process_message,
                                clinic_id,
                                phone,
                                text,
                                message_id,
                                phone_number_id,
                                access_token,
                                button_payload,
                                contact_name
                            )
                        else:
                            # Add to buffer and start timer if first message
                            message_data = {
                                'text': text,
                                'message_id': message_id,
                                'contact_name': contact_name,
                                'button_payload': button_payload
                            }
                            is_first = add_to_message_buffer(buffer_key, message_data)

                            if is_first:
                                # Start buffer processing task
                                logger.info(f"⏳ Starting message buffer for {phone}")
                                background_tasks.add_task(
                                    process_buffered_messages,
                                    clinic_id,
                                    phone,
                                    phone_number_id,
                                    access_token,
                                    buffer_key
                                )

        return {"status": "ok"}

    except Exception as e:
        logger.error(f"❌ Error processing webhook: {e}")
        return {"status": "error", "message": str(e)}


# ============================================
# API ENDPOINTS (called by Cloud Functions)
# ============================================

@app.post("/api/send-reminder")
async def send_reminder(request: Request):
    """Send appointment reminder (called by Cloud Scheduler via Functions)."""
    try:
        body = await request.json()

        clinic_id = body.get("clinicId")
        phone_number_id = body.get("phoneNumberId")
        access_token = body.get("accessToken")
        patient_phone = body.get("patientPhone")
        message = body.get("message")
        reminder_type = body.get("reminderType")  # "24h" or "2h"
        appointment_id = body.get("appointmentId")

        if not all([clinic_id, phone_number_id, access_token, patient_phone, message]):
            raise HTTPException(status_code=400, detail="Missing required fields")

        patient_phone = ensure_phone_has_plus(patient_phone)

        # For 24h reminder, send with confirmation buttons
        if reminder_type == "24h":
            buttons = [
                {"id": "confirm_yes", "title": "Confirmar"},
                {"id": "confirm_reschedule", "title": "Reagendar"},
                {"id": "confirm_cancel", "title": "Cancelar"},
            ]
            success = await send_whatsapp_buttons(
                phone_number_id, patient_phone, message, buttons, access_token
            )
        else:
            # 2h reminder - just informational
            success = await send_whatsapp_message(
                phone_number_id, patient_phone, message, access_token
            )

        return {"success": success, "appointmentId": appointment_id}

    except Exception as e:
        logger.error(f"❌ Error sending reminder: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/send-confirmation")
async def send_confirmation(request: Request):
    """Send appointment confirmation message."""
    try:
        body = await request.json()

        phone_number_id = body.get("phoneNumberId")
        access_token = body.get("accessToken")
        patient_phone = body.get("patientPhone")
        message = body.get("message")

        if not all([phone_number_id, access_token, patient_phone, message]):
            raise HTTPException(status_code=400, detail="Missing required fields")

        patient_phone = ensure_phone_has_plus(patient_phone)

        success = await send_whatsapp_message(
            phone_number_id, patient_phone, message, access_token
        )

        return {"success": success}

    except Exception as e:
        logger.error(f"❌ Error sending confirmation: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/process-reminders")
async def process_reminders(request: Request):
    """
    Process and send appointment reminders.
    Called by Cloud Scheduler every 15 minutes.
    """
    try:
        body = await request.json() if request.headers.get("content-type") == "application/json" else {}
        clinic_id = body.get("clinicId")  # Optional - process all clinics if not specified

        logger.info(f"⏰ Processing reminders for clinic: {clinic_id or 'all'}")

        if not db:
            raise HTTPException(status_code=500, detail="Database not initialized")

        results = {
            "reminder_24h": {"sent": 0, "failed": 0},
            "reminder_2h": {"sent": 0, "failed": 0}
        }

        # Process 24h reminders
        for reminder_type in ["reminder_24h", "reminder_2h"]:
            appointments = db.get_appointments_needing_reminder(reminder_type, clinic_id)

            for apt in appointments:
                try:
                    # Get clinic info
                    clinic = db.get_clinic(apt.clinic_id)
                    if not clinic:
                        continue

                    # Get access token
                    access_token = db.get_clinic_access_token(apt.clinic_id)
                    if not access_token:
                        logger.warning(f"No access token for clinic {apt.clinic_id}")
                        continue

                    phone_number_id = clinic.whatsapp_phone_number_id
                    if not phone_number_id:
                        logger.warning(f"No phone_number_id for clinic {apt.clinic_id}")
                        continue

                    # Format reminder message
                    message = format_reminder_message(
                        apt,
                        reminder_type,
                        clinic.name,
                        clinic.address or ""
                    )

                    patient_phone = ensure_phone_has_plus(apt.patient_phone)

                    # Send reminder
                    if reminder_type == "reminder_24h":
                        buttons = [
                            {"id": "confirm_yes", "title": "Confirmar"},
                            {"id": "confirm_reschedule", "title": "Reagendar"},
                            {"id": "confirm_cancel", "title": "Cancelar"},
                        ]
                        success = await send_whatsapp_buttons(
                            phone_number_id, patient_phone, message, buttons, access_token
                        )
                    else:
                        success = await send_whatsapp_message(
                            phone_number_id, patient_phone, message, access_token
                        )

                    if success:
                        # Mark reminder as sent
                        mark_reminder_sent(db, apt.id, reminder_type)
                        results[reminder_type]["sent"] += 1
                        logger.info(f"✅ Sent {reminder_type} reminder for appointment {apt.id}")
                    else:
                        results[reminder_type]["failed"] += 1
                        logger.error(f"❌ Failed to send {reminder_type} for {apt.id}")

                except Exception as e:
                    results[reminder_type]["failed"] += 1
                    logger.error(f"❌ Error processing reminder for {apt.id}: {e}")

        logger.info(f"📊 Reminder processing complete: {results}")
        return {"success": True, "results": results}

    except Exception as e:
        logger.error(f"❌ Error processing reminders: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/set-human-takeover")
async def set_human_takeover_endpoint(request: Request):
    """Set human takeover status for a conversation."""
    try:
        body = await request.json()
        clinic_id = body.get("clinicId")
        phone = body.get("phone")
        enabled = body.get("enabled", True)
        reason = body.get("reason")

        if not clinic_id or not phone:
            raise HTTPException(status_code=400, detail="clinicId and phone are required")

        phone = ensure_phone_has_plus(phone)
        success = db.set_human_takeover(clinic_id, phone, enabled, reason)

        return {"success": success}

    except Exception as e:
        logger.error(f"❌ Error setting human takeover: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# PIX PAYMENT ENDPOINTS
# ============================================

@app.post("/pagseguro-webhook")
async def pagseguro_webhook(request: Request, background_tasks: BackgroundTasks):
    """
    PagSeguro payment webhook endpoint.
    Receives payment notifications and updates appointment status.
    """
    try:
        body = await request.body()
        signature = request.headers.get('X-PagSeguro-Signature', '')

        logger.info(f"📨 PagSeguro webhook received: {body.decode()[:500]}")

        data = json.loads(body.decode())

        # Parse webhook
        from src.utils.payment import parse_pagseguro_webhook, process_payment_confirmation

        reference_id, payment_status, transaction_id = parse_pagseguro_webhook(data)

        if not reference_id or not payment_status:
            logger.warning("Invalid webhook payload - missing reference_id or status")
            return {"status": "ignored", "reason": "missing_data"}

        logger.info(f"💳 Payment webhook: ref={reference_id}, status={payment_status}, txn={transaction_id}")

        # Process payment confirmation in background
        background_tasks.add_task(
            process_payment_confirmation,
            reference_id,
            payment_status,
            transaction_id,
            db
        )

        return {"status": "ok", "reference_id": reference_id}

    except json.JSONDecodeError as e:
        logger.error(f"❌ Invalid JSON in webhook: {e}")
        return {"status": "error", "message": "Invalid JSON"}

    except Exception as e:
        logger.error(f"❌ Error processing PagSeguro webhook: {e}")
        return {"status": "error", "message": str(e)}


@app.get("/pix/{phone}/{order_id}")
async def pix_payment_page(phone: str, order_id: str):
    """
    PIX payment HTML page with copy button.
    Renders a mobile-friendly page for PIX copia e cola.
    """
    try:
        import urllib.parse
        from jinja2 import Environment, FileSystemLoader  # type: ignore

        # Decode phone from URL
        phone = urllib.parse.unquote(phone)
        logger.info(f"📱 PIX page requested: phone={phone}, order={order_id}")

        # Find order
        order = db.get_order(order_id) if db else None

        if not order:
            # Try to find by searching recent orders
            from google.cloud import firestore as gcloud_firestore
            firestore_client = gcloud_firestore.Client()
            orders_ref = firestore_client.collection("gendei_orders")

            # Search by order ID prefix
            for order_doc in orders_ref.order_by("createdAt", direction=gcloud_firestore.Query.DESCENDING).limit(100).stream():
                if order_doc.id == order_id or order_doc.id.startswith(order_id[:12]):
                    order = order_doc.to_dict()
                    order["id"] = order_doc.id
                    break

        if not order:
            logger.warning(f"Order not found: {order_id}")
            # Return not found page
            return HTMLResponse(content="""
                <!DOCTYPE html>
                <html lang="pt-BR">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>PIX não encontrado</title>
                    <style>
                        body { font-family: sans-serif; padding: 40px 20px; text-align: center; }
                        h1 { color: #dc2626; }
                        p { color: #666; }
                    </style>
                </head>
                <body>
                    <h1>❌ PIX não encontrado</h1>
                    <p>Este código PIX expirou ou não foi encontrado.</p>
                    <p>Volte ao WhatsApp e solicite um novo link de pagamento.</p>
                </body>
                </html>
            """, status_code=404)

        # Get PIX code and QR code URL
        pix_code = order.get("pixCopiaCola") or order.get("qr_code_text")
        qr_code_url = order.get("qrCodeUrl") or order.get("qr_code")
        amount_cents = order.get("amountCents") or order.get("amount", 0)
        description = order.get("description", "Sinal de Consulta")

        if not pix_code:
            logger.warning(f"No PIX code in order: {order_id}")
            return HTMLResponse(content="""
                <!DOCTYPE html>
                <html lang="pt-BR">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>PIX não disponível</title>
                    <style>
                        body { font-family: sans-serif; padding: 40px 20px; text-align: center; }
                        h1 { color: #dc2626; }
                        p { color: #666; }
                    </style>
                </head>
                <body>
                    <h1>❌ PIX não disponível</h1>
                    <p>O código PIX deste pedido expirou.</p>
                    <p>Volte ao WhatsApp e solicite um novo link de pagamento.</p>
                </body>
                </html>
            """, status_code=410)

        # Format amount
        from src.utils.payment import format_payment_amount
        amount_formatted = format_payment_amount(amount_cents)

        # Setup Jinja2 templates
        import os
        template_dir = os.path.join(os.path.dirname(__file__), "templates")
        jinja_env = Environment(loader=FileSystemLoader(template_dir))

        try:
            template = jinja_env.get_template("pix_payment.html")
            html_content = template.render(
                product_name=description,
                qr_code_url=qr_code_url,
                pix_code=pix_code,
                pix_code_preview=pix_code[:40] if len(pix_code) > 40 else pix_code,
                amount_formatted=amount_formatted
            )
            return HTMLResponse(content=html_content)
        except Exception as template_error:
            logger.error(f"Template error: {template_error}")
            # Fallback: simple HTML page
            return HTMLResponse(content=f"""
                <!DOCTYPE html>
                <html lang="pt-BR">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>PIX - {amount_formatted}</title>
                    <style>
                        body {{ font-family: sans-serif; padding: 20px; }}
                        .amount {{ font-size: 24px; font-weight: bold; }}
                        .code {{ background: #f0f0f0; padding: 10px; word-break: break-all; font-family: monospace; }}
                        button {{ background: #00a650; color: white; padding: 15px 30px; border: none; font-size: 16px; cursor: pointer; }}
                    </style>
                </head>
                <body>
                    <h2>{description}</h2>
                    <p class="amount">{amount_formatted}</p>
                    <p>Copie o código PIX abaixo:</p>
                    <div class="code" id="pixCode">{pix_code}</div>
                    <br>
                    <button onclick="navigator.clipboard.writeText(document.getElementById('pixCode').textContent).then(() => this.textContent = 'Copiado!')">
                        Copiar código
                    </button>
                </body>
                </html>
            """)

    except Exception as e:
        logger.error(f"❌ Error rendering PIX page: {e}")
        return HTMLResponse(content="""
            <!DOCTYPE html>
            <html lang="pt-BR">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Erro</title>
                <style>
                    body { font-family: sans-serif; padding: 40px 20px; text-align: center; }
                    h1 { color: #dc2626; }
                </style>
            </head>
            <body>
                <h1>❌ Erro</h1>
                <p>Ocorreu um erro ao carregar a página de pagamento.</p>
                <p>Por favor, tente novamente pelo WhatsApp.</p>
            </body>
            </html>
        """, status_code=500)


# ============================================
# WHATSAPP FLOWS ENDPOINT
# ============================================

@app.post("/flows")
async def flows_endpoint(request: Request):
    """
    WhatsApp Flows data endpoint.
    Handles INIT, data_exchange, and BACK actions for dynamic flows.
    Supports both encrypted and unencrypted requests.
    """
    aes_key = None
    initial_vector = None
    is_encrypted = False

    try:
        # Get raw body for encryption handling
        raw_body = await request.body()

        # Handle encrypted or unencrypted request
        body, aes_key, initial_vector, is_encrypted = handle_encrypted_flow_request(raw_body)

        if "error" in body:
            error_response = {"data": {"error_message": "Erro de criptografia"}}
            return prepare_flow_response(error_response, aes_key, initial_vector, is_encrypted)

        if is_encrypted:
            logger.info(f"🔐 Encrypted flow request received and decrypted")
        else:
            logger.info(f"📱 Flow request received: {json.dumps(body)[:500]}")

        action = body.get("action", "")
        screen = body.get("screen")
        data = body.get("data", {})
        flow_token = body.get("flow_token", "")

        # Handle ping (health check)
        if action == "ping":
            response = {"data": {"status": "active"}}
            return prepare_flow_response(response, aes_key, initial_vector, is_encrypted)

        # Handle error notifications
        if action == "error":
            logger.error(f"Flow error: {data}")
            response = {"data": {"acknowledged": True}}
            return prepare_flow_response(response, aes_key, initial_vector, is_encrypted)

        # Extract clinic_id from flow_token (format: clinic_id:phone:timestamp)
        # Or from the initial data
        clinic_id = ""
        patient_phone = ""

        if flow_token:
            parts = flow_token.split(":")
            if len(parts) >= 2:
                clinic_id = parts[0]
                patient_phone = parts[1] if len(parts) > 1 else ""

        if not clinic_id:
            clinic_id = data.get("clinic_id", "")

        if not clinic_id:
            logger.error("No clinic_id in flow request")
            response = {"data": {"error_message": "Erro: clínica não identificada"}}
            return prepare_flow_response(response, aes_key, initial_vector, is_encrypted)

        # Add patient phone to data for appointment creation
        data["patient_phone"] = patient_phone

        # Process with flows handler
        if flows_handler:
            result = await flows_handler.handle_request(
                action=action,
                screen=screen,
                data=data,
                flow_token=flow_token,
                clinic_id=clinic_id,
            )
            logger.info(f"📤 Flow response: {json.dumps(result)[:500]}")
            return prepare_flow_response(result, aes_key, initial_vector, is_encrypted)
        else:
            logger.error("Flows handler not initialized")
            response = {"data": {"error_message": "Erro interno"}}
            return prepare_flow_response(response, aes_key, initial_vector, is_encrypted)

    except Exception as e:
        logger.error(f"❌ Flow endpoint error: {e}")
        response = {"data": {"error_message": "Erro ao processar solicitação"}}
        return prepare_flow_response(response, aes_key, initial_vector, is_encrypted)


# ============================================
# RUN SERVER
# ============================================

if __name__ == "__main__":
    import uvicorn  # type: ignore
    port = int(os.getenv("PORT", "8080"))
    uvicorn.run(app, host="0.0.0.0", port=port)
