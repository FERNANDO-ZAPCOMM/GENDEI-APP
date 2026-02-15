"""
Gendei WhatsApp Agent Service
Clinic appointment scheduling via WhatsApp
"""

import os
import logging
import json
import asyncio
import re
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
    from src.scheduler.payment_holds import (
        DEFAULT_PAYMENT_HOLD_MINUTES,
        is_unpaid_hold_expired,
        release_expired_unpaid_holds,
    )
    from src.scheduler.reminders import (
        format_reminder_message,
        mark_reminder_sent,
    )
    from src.flows.handler import FlowsHandler
    from src.flows.orchestrator import (
        FlowOrchestrationDeps,
        handle_flow_completion as orchestrated_handle_flow_completion,
        handle_payment_type_selection as orchestrated_handle_payment_type_selection,
        handle_scheduling_intent as orchestrated_handle_scheduling_intent,
    )
    from src.vertical_config import get_vertical_config, get_specialty_name, ALL_SPECIALTIES
    from src.flows.manager import send_whatsapp_flow, send_booking_flow, generate_flow_token
    from src.flows.crypto import handle_encrypted_flow_request, prepare_flow_response, is_encryption_configured
    from src.agents.orchestrator import get_orchestrator
    from src.runtime.context import Runtime, set_runtime, reset_runtime
    from src.payments.pricing import resolve_consultation_pricing
    from src.providers.tools.base import register_tool_implementations
    from src.webhook.processor import (
        WebhookProcessorDeps,
        process_webhook_body as orchestrated_process_webhook_body,
    )
    from src.messages.processor import (
        MessageProcessorDeps,
        process_incoming_message as orchestrated_process_incoming_message,
    )
    from src.messages.pipeline import (
        MessagePipelineDeps,
        process_buffered_messages as orchestrated_process_buffered_messages,
        handle_voice_message as orchestrated_handle_voice_message,
    )
    from src.utils.helpers import format_outgoing_text, format_button_title
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
ENABLE_WHATSAPP_CONTACT_CARDS = os.getenv("ENABLE_WHATSAPP_CONTACT_CARDS", "false").strip().lower() in {
    "1", "true", "yes", "on"
}

# WhatsApp Flows - Firestore-driven per clinic/phone
# Flow 1: Patient Info (ESPECIALIDADE → TIPO_ATENDIMENTO → INFO_CONVENIO → DADOS_PACIENTE)
# Flow 2: Booking (BOOKING - date picker + time dropdown)

# Booking settings
DEFAULT_MIN_BOOKING_LEAD_TIME_HOURS = 2  # Minimum hours before a slot can be booked
UPCOMING_APPOINTMENT_CHECK_DAYS = 14  # Days ahead to check for existing appointments
PAYMENT_HOLD_MINUTES = int(os.getenv("PAYMENT_HOLD_MINUTES", str(DEFAULT_PAYMENT_HOLD_MINUTES)))

# Database instance
db: Optional[GendeiDatabase] = None

# Flows handler instance
flows_handler: Optional[FlowsHandler] = None

# Note: Message deduplication and conversation state are now Firestore-backed
# See db.is_message_processed() and db.load_conversation_state()

_GREETING_BUTTONS: List[Dict[str, str]] = [
    {"id": "greeting_sim", "title": "AGENDAR"},
    {"id": "greeting_nao", "title": "TIRAR DÚVIDAS"},
    {"id": "greeting_contato", "title": "FALAR COM ATENDENTE"},
]


def _get_greeting_buttons() -> List[Dict[str, str]]:
    """Return a fresh copy of the canonical greeting buttons."""
    return [dict(button) for button in _GREETING_BUTTONS]


async def run_agent_response(
    clinic_id: str,
    phone: str,
    message: str,
    phone_number_id: str,
    access_token: str,
    contact_name: Optional[str] = None
) -> None:
    """Run OpenAI Agents SDK orchestration and send response if needed."""
    if not db:
        return

    # Get vertical slug from clinic data
    clinic_obj = db.get_clinic(clinic_id)
    v_slug = getattr(clinic_obj, 'vertical', '') if clinic_obj else ''

    runtime = Runtime(
        clinic_id=clinic_id,
        db=db,
        phone_number_id=phone_number_id,
        access_token=access_token,
        vertical_slug=v_slug or None,
    )
    # Keep contextvars for backward compatibility with non-SDK code paths
    token = set_runtime(runtime)
    try:
        orchestrator = get_orchestrator(clinic_id, db)
        result = await orchestrator.process_message(
            phone=phone,
            message=message,
            contact_name=contact_name,
            runtime=runtime  # Pass Runtime for SDK RunContextWrapper injection
        )
    finally:
        reset_runtime(token)

    # If agent didn't send a WhatsApp message via tools, send response directly
    # Note: handoffs (triage→greeter) appear as tool_calls but don't send messages,
    # so we check specifically for send_text_message rather than any tool call
    message_sent = any(
        tc.get("name") == "send_text_message" for tc in (result.tool_calls or [])
    )
    if result and result.success and result.response and not message_sent:
        # Avoid sending SDK debug dumps to users
        if result.response.strip().startswith("RunResult"):
            return
        await send_whatsapp_message(
            phone_number_id, phone,
            result.response,
            access_token
        )


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


def is_simple_greeting(text: str) -> bool:
    """Deterministic greeting detection (no intent)."""
    import re

    t = (text or "").strip().lower()
    if not t:
        return False
    # If it includes scheduling/intent keywords, it's not a pure greeting.
    if any(k in t for k in ("agendar", "marcar", "consulta", "horário", "horarios", "disponibilidade")):
        return False
    # Strip punctuation for robust matching
    cleaned = re.sub(r"[^\w\s]", "", t).strip()
    if _looks_like_greeting_only(cleaned):
        return True
    # Extra safety for common greetings
    if cleaned in ("oi", "ola", "olá", "oi tudo bem", "tudo bem", "bom dia", "boa tarde", "boa noite"):
        return True
    return False


def build_deterministic_greeting(clinic_id: str) -> str:
    """Build deterministic greeting using clinic description/summary when available."""
    summary = ""
    clinic_name = ""
    if db:
        clinic = db.get_clinic(clinic_id)
        if clinic:
            clinic_name = getattr(clinic, "name", "") or ""
            summary = getattr(clinic, "greeting_summary", "") or ""
            if not summary:
                description = (getattr(clinic, "description", "") or "").strip()
                if description:
                    summary = description.split(".")[0].strip() or description[:180].strip()

    if summary and clinic_name:
        return (
            f"👋 Olá! Tudo bem?\n\n"
            f"{summary}\n\n"
            "O que você deseja?"
        )

    if clinic_name:
        return (
            f"👋 Olá! Tudo bem?\n\n"
            f"Seja bem-vindo(a) à {clinic_name}. "
            f"Estou aqui para ajudá-lo(a) com informações e agendamentos.\n\n"
            "O que você deseja?"
        )

    return "👋 Olá! Tudo bem?\n\nO que você deseja?"


def _clinic_greeting_blurb(clinic: Any) -> str:
    """Build a short, natural greeting context prioritizing clinic description."""
    if not clinic:
        return ""

    description = (getattr(clinic, "description", "") or "").strip()
    if description:
        compact = " ".join(description.split())
        sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", compact) if s.strip()]
        for sentence in sentences:
            # Avoid trivial fragments such as "Dr."
            if len(sentence) < 12:
                continue
            if sentence.lower() in {"dr.", "dra.", "dr", "dra"}:
                continue
            return sentence[:220].rstrip()
        return compact[:220].rstrip()

    summary = (getattr(clinic, "greeting_summary", "") or "").strip()
    if summary:
        return summary[:220].rstrip()

    return ""


def _format_faq_topics_for_greeting(clinic: Any, limit: int = 3) -> str:
    """Return short FAQ topics text for greeting."""
    if not clinic:
        return ""

    workflow_faqs = getattr(clinic, "workflow_faqs", []) or []
    topics: List[str] = []
    for item in workflow_faqs:
        if not isinstance(item, dict):
            continue
        question = (item.get("question") or "").strip()
        if question:
            topics.append(question)
        if len(topics) >= limit:
            break

    if not topics:
        return ""

    return "Posso te ajudar com: " + "; ".join(topics) + "."


def _get_professional_specialties_display(prof: Any, vertical_slug: Optional[str]) -> str:
    """Map specialty ids to human-friendly names."""
    specialties = getattr(prof, "specialties", []) or []
    if not specialties:
        legacy_specialty = getattr(prof, "specialty", "") or ""
        specialties = [legacy_specialty] if legacy_specialty else []
    display = [get_specialty_name(vertical_slug, s) for s in specialties if s]
    return ", ".join(dict.fromkeys(display))


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
                    # Handle both old (specialty) and new (specialties) format
                    specialties = p.get('specialties', [])
                    specialty = p.get('specialty', '')
                    specialty_display = ", ".join(specialties) if specialties else specialty
                    clinic_info += f"- {name}"
                    if specialty_display:
                        clinic_info += f" ({specialty_display})"
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

        # Get vertical-aware terminology
        vertical_info = clinic_context.get("vertical", {}) if clinic_context else {}
        apt_term = vertical_info.get("appointment_term", "consulta")
        apt_plural = vertical_info.get("appointment_plural", "consultas")
        client_t = vertical_info.get("client_term", "paciente")

        system_prompt = f"""Você é o assistente virtual amigável de uma clínica.

INFORMAÇÕES DA CLÍNICA:
{clinic_info if clinic_info else "Informações não disponíveis no momento."}

SUAS RESPONSABILIDADES:
1. Responder perguntas sobre a clínica (endereço, horário, profissionais, serviços)
2. Ajudar {client_t}s a agendar {apt_plural}
3. Informar sobre {apt_plural} existentes
4. Ser educado, prestativo e conciso

REGRAS IMPORTANTES:
- Responda SEMPRE em português brasileiro
- Seja breve e direto (máximo 2-3 frases por resposta)
- Use formatação WhatsApp (*negrito*, _itálico_)
- Se não souber uma informação específica, sugira que o {client_t} entre em contato por telefone
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
    vertical_slug = ""

    if not db:
        return context

    try:
        clinic = db.get_clinic(clinic_id)
        if clinic:
            vertical_slug = getattr(clinic, 'vertical', '') or ''
            context["clinic"] = {
                "name": clinic.name,
                "address": getattr(clinic, 'address', ''),
                "phone": getattr(clinic, 'phone', ''),
                "opening_hours": getattr(clinic, 'opening_hours', ''),
                "description": getattr(clinic, 'description', ''),
                "greeting_summary": getattr(clinic, 'greeting_summary', ''),
                "vertical": vertical_slug,
                "workflow_mode": getattr(clinic, 'workflow_mode', 'booking'),
                "workflow_welcome_message": getattr(clinic, 'workflow_welcome_message', ''),
                "workflow_cta": getattr(clinic, 'workflow_cta', ''),
                "workflow_faqs": getattr(clinic, 'workflow_faqs', []) or [],
            }
            # Add vertical config for prompt formatting
            vc = get_vertical_config(vertical_slug)
            context["vertical"] = {
                "slug": vc.slug,
                "appointment_term": vc.terminology.appointment_term,
                "appointment_plural": vc.terminology.appointment_term_plural,
                "client_term": vc.terminology.client_term,
                "professional_term": vc.terminology.professional_term,
                "professional_emoji": vc.terminology.professional_emoji,
                "has_convenio": vc.features.has_convenio,
                "has_deposit": vc.features.has_deposit,
            }

        professionals = db.get_clinic_professionals(clinic_id)
        if professionals:
            context["professionals"] = [
                {
                    "id": p.id,
                    "name": p.name,
                    "full_name": getattr(p, 'full_name', p.name),
                    "specialty": _get_professional_specialties_display(p, vertical_slug),
                    "specialties": [
                        get_specialty_name(vertical_slug, s)
                        for s in ((getattr(p, 'specialties', []) or []) or [getattr(p, 'specialty', '')])
                        if s
                    ],
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
        release_expired_unpaid_holds(db, appointments, hold_minutes=PAYMENT_HOLD_MINUTES)

        # Filter to appointments within the check window
        today = datetime.now().date()
        max_date = today + timedelta(days=UPCOMING_APPOINTMENT_CHECK_DAYS)

        upcoming = [
            apt for apt in appointments
            if datetime.strptime(apt.date, "%Y-%m-%d").date() <= max_date
            and not is_unpaid_hold_expired(apt, hold_minutes=PAYMENT_HOLD_MINUTES)
            and apt.status.value not in ["cancelled", "completed", "no_show"]
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


def parse_requested_date(message: str) -> Optional[str]:
    """Parse a requested date from user message and return YYYY-MM-DD if found."""
    import re

    msg = (message or "").lower()
    today = datetime.now().date()

    if "amanhã" in msg or "amanha" in msg:
        return (today + timedelta(days=1)).isoformat()
    if "hoje" in msg:
        return today.isoformat()

    # Match DD/MM or DD/MM/YYYY
    m = re.search(r'(\d{1,2})/(\d{1,2})(?:/(\d{2,4}))?', msg)
    if m:
        day = int(m.group(1))
        month = int(m.group(2))
        year_str = m.group(3)
        if year_str:
            year = int(year_str)
            if year < 100:
                year += 2000
        else:
            year = today.year
            if month < today.month or (month == today.month and day < today.day):
                year += 1
        try:
            return datetime(year, month, day).date().isoformat()
        except ValueError:
            return None

    return None


def parse_period(message: str) -> Optional[str]:
    """Parse preferred period from message: morning/afternoon/any."""
    msg = (message or "").lower()
    if any(k in msg for k in ["qualquer", "tanto faz", "indiferente"]):
        return "any"
    if any(k in msg for k in ["manha", "manhã", "cedo"]):
        return "morning"
    if any(k in msg for k in ["tarde", "depois do almoço", "depois do almoco"]):
        return "afternoon"
    return None


def parse_weekday(message: str) -> Optional[int]:
    """Parse weekday from message. Returns 0=Monday..6=Sunday, or None for any."""
    msg = (message or "").lower()
    if any(k in msg for k in ["qualquer", "tanto faz", "indiferente"]):
        return None

    mapping = {
        "segunda": 0,
        "terca": 1,
        "terça": 1,
        "quarta": 2,
        "quinta": 3,
        "sexta": 4,
        "sabado": 5,
        "sábado": 5,
        "domingo": 6,
    }
    for key, val in mapping.items():
        if key in msg:
            return val
    return None


def parse_yes_no(message: str) -> Optional[bool]:
    """Parse yes/no intent from message."""
    msg = (message or "").lower().strip()
    if msg in ("sim", "s", "claro", "confirmo", "ok", "pode", "isso"):
        return True
    if msg in ("nao", "não", "n", "negativo", "melhor nao", "melhor não"):
        return False
    if any(k in msg for k in ["sim", "pode", "confirmo", "claro"]):
        return True
    if any(k in msg for k in ["nao", "não", "negativo", "não quero", "melhor não"]):
        return False
    return None


def parse_choice_number(message: str, max_choice: int) -> Optional[int]:
    """Parse a number choice from message (1..max_choice)."""
    import re

    msg = (message or "").strip()
    m = re.search(r'(\d+)', msg)
    if not m:
        return None
    val = int(m.group(1))
    if 1 <= val <= max_choice:
        return val
    return None


def parse_time_from_message(message: str, default_period: Optional[str] = None) -> Optional[str]:
    """Parse time from message, returns HH:MM."""
    import re

    msg = (message or "").lower()
    m = re.search(r'(\d{1,2})(?:[:h](\d{2}))?', msg)
    if not m:
        return None

    hour = int(m.group(1))
    minute = int(m.group(2)) if m.group(2) else 0

    if hour > 23 or minute > 59:
        return None

    # If period is afternoon and hour is ambiguous, shift to 12+.
    if default_period == "afternoon" and hour < 12:
        hour += 12

    return f"{hour:02d}:{minute:02d}"


def parse_date_range_from_message(message: str) -> Optional[Dict[str, str]]:
    """Parse a date range (start/end) from message if possible."""
    msg = (message or "").lower()
    today = datetime.now().date()

    if "semana que vem" in msg:
        # Next week Monday..Sunday
        days_ahead = (7 - today.weekday()) % 7
        if days_ahead == 0:
            days_ahead = 7
        start = today + timedelta(days=days_ahead)
        end = start + timedelta(days=6)
        return {"start": start.isoformat(), "end": end.isoformat()}

    if "essa semana" in msg:
        start = today
        end = today + timedelta(days=(6 - today.weekday()))
        return {"start": start.isoformat(), "end": end.isoformat()}

    return None


def get_clinic_payment_options(clinic, service=None) -> Dict[str, Any]:
    """Determine payment options based on clinic and service."""
    payment_settings = getattr(clinic, 'payment_settings', {}) or {}
    clinic_accepts_particular = payment_settings.get("acceptsParticular", True)
    clinic_accepts_convenio = payment_settings.get("acceptsConvenio", False)
    clinic_convenios = payment_settings.get("convenioList", []) or payment_settings.get("convenios", [])

    service_accepts_particular = True
    service_accepts_convenio = True
    service_convenios = []
    if service:
        service_accepts_particular = getattr(service, "accepts_particular", True)
        service_accepts_convenio = getattr(service, "accepts_convenio", True)
        service_convenios = getattr(service, "convenios", []) or []

    accepts_particular = clinic_accepts_particular and service_accepts_particular
    accepts_convenio = clinic_accepts_convenio and service_accepts_convenio
    convenios = service_convenios if service_convenios else clinic_convenios

    if not accepts_particular and not accepts_convenio:
        accepts_particular = True

    return {
        "accepts_particular": accepts_particular,
        "accepts_convenio": accepts_convenio,
        "convenios": convenios,
    }


def get_services_for_professional(services: List[Any], professional_id: Optional[str]) -> List[Any]:
    """Filter services by professional if possible."""
    if not professional_id:
        return services
    filtered = []
    for s in services:
        prof_ids = getattr(s, "professional_ids", []) or []
        if not prof_ids or professional_id in prof_ids:
            filtered.append(s)
    return filtered


def summarize_availability_for_professional(
    clinic_id: str,
    professional_id: str,
    start_date: str,
    end_date: str
) -> List[str]:
    """Return up to 2 summary strings like 'Qui manhã' or 'Sex tarde'."""
    slots = get_available_slots(
        db,
        clinic_id,
        professional_id=professional_id,
        start_date=start_date,
        end_date=end_date
    )

    min_lead_hours = get_clinic_min_lead_time(clinic_id)
    if slots and min_lead_hours > 0:
        slots = filter_slots_by_lead_time(slots, min_lead_hours)

    if not slots:
        return []

    summaries = []
    seen = set()
    for slot in slots:
        s_date = slot.date if hasattr(slot, 'date') else slot.get('date', '')
        s_time = slot.time if hasattr(slot, 'time') else slot.get('time', '')
        if not s_date or not s_time:
            continue

        try:
            dt = datetime.strptime(s_date, "%Y-%m-%d")
            day_names = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"]
            day_label = day_names[dt.weekday()]
        except ValueError:
            day_label = s_date

        hour = int(s_time.split(":")[0])
        period = "manhã" if hour < 12 else "tarde"
        key = f"{day_label}-{period}"
        if key in seen:
            continue
        seen.add(key)
        summaries.append(f"{day_label} {period}")
        if len(summaries) >= 2:
            break

    return summaries


def pick_best_slot(
    clinic_id: str,
    professional_id: Optional[str],
    service_id: Optional[str],
    requested_date: Optional[str],
    weekday: Optional[int],
    period: Optional[str]
) -> Optional[Any]:
    """Pick the earliest slot that matches preferences."""
    if not db:
        return None

    today = datetime.now().date()
    start_date = requested_date or (today + timedelta(days=1)).isoformat()
    end_date = requested_date or (today + timedelta(days=14)).isoformat()

    slots = get_available_slots(
        db,
        clinic_id,
        professional_id=professional_id,
        service_id=service_id,
        start_date=start_date,
        end_date=end_date
    )

    # Apply lead time
    min_lead_hours = get_clinic_min_lead_time(clinic_id)
    if slots and min_lead_hours > 0:
        slots = filter_slots_by_lead_time(slots, min_lead_hours)

    def slot_matches(s):
        s_date = s.date if hasattr(s, 'date') else s.get('date', '')
        s_time = s.time if hasattr(s, 'time') else s.get('time', '')
        if weekday is not None:
            try:
                dt = datetime.strptime(s_date, "%Y-%m-%d")
                if dt.weekday() != weekday:
                    return False
            except ValueError:
                return False
        if period == "morning":
            try:
                hour = int(s_time.split(":")[0])
                if hour >= 12:
                    return False
            except Exception:
                return False
        if period == "afternoon":
            try:
                hour = int(s_time.split(":")[0])
                if hour < 12:
                    return False
            except Exception:
                return False
        return True

    for slot in slots:
        if slot_matches(slot):
            return slot

    return None


def _get_webhook_processor_deps() -> WebhookProcessorDeps:
    return WebhookProcessorDeps(
        db=db,
        whatsapp_token=WHATSAPP_TOKEN,
        is_message_processed=is_message_processed,
        ensure_phone_has_plus=ensure_phone_has_plus,
        process_message=process_message,
        process_buffered_messages=process_buffered_messages,
        handle_voice_message=handle_voice_message,
        handle_flow_completion=handle_flow_completion,
        add_to_message_buffer=add_to_message_buffer,
    )


def _get_message_processor_deps() -> MessageProcessorDeps:
    return MessageProcessorDeps(
        db=db,
        ensure_phone_has_plus=ensure_phone_has_plus,
        set_current_clinic_id=_current_clinic_id.set,
        set_current_phone_number_id=_current_phone_number_id.set,
        mark_message_as_read=mark_message_as_read,
        get_appointments_by_phone=get_appointments_by_phone,
        handle_reminder_response=handle_reminder_response,
        handle_appointment_reschedule=handle_appointment_reschedule,
        handle_appointment_cancel_request=handle_appointment_cancel_request,
        handle_appointment_question=handle_appointment_question,
        handle_pending_payment_followup=handle_pending_payment_followup,
        handle_payment_method_selection=handle_payment_method_selection,
        handle_scheduling_intent=handle_scheduling_intent,
        handle_greeting_response_duvida=handle_greeting_response_duvida,
        handle_payment_type_selection=handle_payment_type_selection,
        escalate_to_human=escalate_to_human,
        detect_frustrated_sentiment=detect_frustrated_sentiment,
        detect_human_escalation_request=detect_human_escalation_request,
        send_whatsapp_location_request=send_whatsapp_location_request,
        send_clinic_location_message=send_clinic_location_message,
        send_whatsapp_message=send_whatsapp_message,
        is_simple_greeting=is_simple_greeting,
        send_initial_greeting=send_initial_greeting,
        run_agent_response=run_agent_response,
    )


def _get_message_pipeline_deps() -> MessagePipelineDeps:
    return MessagePipelineDeps(
        message_buffer_deadlines=message_buffer_deadlines,
        default_message_buffer_seconds=DEFAULT_MESSAGE_BUFFER_SECONDS,
        is_buffer_locked=is_buffer_locked,
        lock_buffer=lock_buffer,
        unlock_buffer=unlock_buffer,
        get_buffered_messages=get_buffered_messages,
        combine_messages=combine_messages,
        process_message=process_message,
        send_whatsapp_message=send_whatsapp_message,
    )


def format_date_short(date_str: str) -> str:
    """Format YYYY-MM-DD as DD/MM."""
    try:
        dt = datetime.strptime(date_str, "%Y-%m-%d")
        return dt.strftime("%d/%m")
    except ValueError:
        return date_str


def find_professional_in_message(message: str, professionals: List[Any]) -> Optional[Any]:
    """Try to find a professional mentioned by name in the message."""
    msg = (message or "").lower()
    for prof in professionals:
        name = (prof.full_name or prof.name or "").lower()
        if name and name in msg:
            return prof
        # Try first name match for longer names
        first = name.split(" ")[0] if name else ""
        if first and len(first) >= 3 and first in msg:
            return prof
    return None


async def show_professional_slots_for_date(
    clinic_id: str,
    phone: str,
    professional_id: str,
    professional_name: str,
    specialty: str,
    date_str: str,
    phone_number_id: str,
    access_token: str
) -> None:
    """Show available slots for a professional on a specific date."""
    slots = get_available_slots(
        db,
        clinic_id,
        professional_id=professional_id,
        start_date=date_str,
        end_date=date_str
    )

    # Filter by minimum booking lead time
    min_lead_hours = get_clinic_min_lead_time(clinic_id)
    if slots and min_lead_hours > 0:
        slots = filter_slots_by_lead_time(slots, min_lead_hours)

    if not slots:
        await send_whatsapp_message(
            phone_number_id, phone,
            f"Não encontrei horários para *{professional_name}* em {format_date_short(date_str)}. "
            "Posso verificar outra data?",
            access_token
        )
        return

    # Build list for a single date
    rows = []
    slot_map = {}
    for slot in slots[:10]:  # WhatsApp list limit
        time_str = slot.time if hasattr(slot, 'time') else slot.get('time', '')
        slot_id = f"slot_{date_str}_{time_str.replace(':', '')}"
        slot_map[slot_id] = {"date": date_str, "time": time_str}
        rows.append({
            "id": slot_id,
            "title": time_str,
            "description": professional_name[:72]
        })

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
        f"📅 *{professional_name}*{specialty_text}\n\nHorários para {format_date_short(date_str)}:",
        "Ver horários",
        [{"title": format_date_short(date_str), "rows": rows}],
        access_token
    )


async def send_availability_by_professional(
    clinic_id: str,
    phone: str,
    requested_date: str,
    phone_number_id: str,
    access_token: str
) -> None:
    """Send availability summary per professional for a specific date."""
    if not db:
        return

    professionals = db.get_clinic_professionals(clinic_id)
    if not professionals:
        await send_whatsapp_message(
            phone_number_id, phone,
            "Desculpe, não há profissionais disponíveis no momento.",
            access_token
        )
        return

    # Fetch slots for requested date
    slots = get_available_slots(
        db,
        clinic_id,
        start_date=requested_date,
        end_date=requested_date
    )

    # Apply lead time filter
    min_lead_hours = get_clinic_min_lead_time(clinic_id)
    if slots and min_lead_hours > 0:
        slots = filter_slots_by_lead_time(slots, min_lead_hours)

    slots_by_prof: Dict[str, List[str]] = {}
    for slot in slots:
        prof_id = slot.professional_id if hasattr(slot, 'professional_id') else slot.get('professional_id')
        time_str = slot.time if hasattr(slot, 'time') else slot.get('time', '')
        if not prof_id or not time_str:
            continue
        slots_by_prof.setdefault(prof_id, []).append(time_str)

    # Build response lines
    lines = [f"📅 *Horários para {format_date_short(requested_date)}:*"]
    for prof in professionals:
        prof_name = prof.full_name or prof.name
        times = slots_by_prof.get(prof.id, [])
        if times:
            times_sorted = sorted(times)
            preview = ", ".join(times_sorted[:3])
            suffix = f" (+{len(times_sorted) - 3})" if len(times_sorted) > 3 else ""
            lines.append(f"• *{prof_name}*: {preview}{suffix}")
        else:
            # Find next available slot within 14 days
            next_slots = get_available_slots(
                db,
                clinic_id,
                professional_id=prof.id,
                start_date=requested_date,
                days_ahead=14
            )
            if next_slots and min_lead_hours > 0:
                next_slots = filter_slots_by_lead_time(next_slots, min_lead_hours)
            next_slot = None
            for s in next_slots:
                s_date = s.date if hasattr(s, 'date') else s.get('date', '')
                if s_date and s_date > requested_date:
                    next_slot = s
                    break
            if next_slot:
                next_date = next_slot.date if hasattr(next_slot, 'date') else next_slot.get('date', '')
                next_time = next_slot.time if hasattr(next_slot, 'time') else next_slot.get('time', '')
                lines.append(
                    f"• *{prof_name}*: próximo em {format_date_short(next_date)} às {next_time}"
                )
            else:
                lines.append(f"• *{prof_name}*: sem horários nos próximos dias")

    lines.append("\nQual profissional você prefere?")

    # Save state to await professional choice
    state = db.load_conversation_state(clinic_id, phone)
    state["state"] = "awaiting_professional_after_availability"
    state["requested_date"] = requested_date
    db.save_conversation_state(clinic_id, phone, state)

    await send_whatsapp_message(
        phone_number_id, phone,
        "\n".join(lines),
        access_token
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    global db, flows_handler
    logger.info("🚀 Starting Gendei WhatsApp Agent...")
    db = GendeiDatabase()
    flows_handler = FlowsHandler(db)
    register_tool_implementations()
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


def _parse_coordinate(value: Any) -> Optional[float]:
    """Parse coordinates coming from Firestore payloads."""
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _extract_clinic_location(clinic: Any) -> Optional[Dict[str, Any]]:
    """Extract clinic location payload for WhatsApp location message."""
    if not clinic:
        return None

    address_data = getattr(clinic, "address_data", {}) or {}
    latitude = _parse_coordinate(address_data.get("latitude"))
    longitude = _parse_coordinate(address_data.get("longitude"))
    if latitude is None or longitude is None:
        return None
    if not (-90 <= latitude <= 90 and -180 <= longitude <= 180):
        return None

    clinic_name = getattr(clinic, "name", "") or "Clínica"
    address = address_data.get("formatted") or getattr(clinic, "address", "") or ""
    return {
        "latitude": latitude,
        "longitude": longitude,
        "name": clinic_name[:100],
        "address": str(address)[:300] if address else "",
    }


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
    message = format_outgoing_text(message)

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
    body_text = format_outgoing_text(body_text)

    sanitized_buttons = buttons[:3]
    # Normalize greeting actions to always expose the 3 canonical options.
    if any((btn.get("id", "") or "").startswith("greeting_") for btn in sanitized_buttons):
        incoming_ids = sorted({btn.get("id", "") for btn in sanitized_buttons if btn.get("id")})
        sanitized_buttons = _get_greeting_buttons()
        logger.info(
            "Normalizing greeting buttons for %s: incoming=%s outgoing=%s",
            to,
            incoming_ids,
            [btn["id"] for btn in sanitized_buttons],
        )

    button_list = [
        {"type": "reply", "reply": {"id": btn["id"], "title": format_button_title(btn["title"])}}
        for btn in sanitized_buttons  # Max 3 buttons
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
            logger.info(
                "✅ Buttons sent to %s (count=%d, ids=%s)",
                to,
                len(sanitized_buttons),
                [btn.get("id") for btn in sanitized_buttons],
            )
            # Log outgoing message
            clinic_id = _current_clinic_id.get()
            if db and clinic_id:
                button_titles = ", ".join([b["title"] for b in sanitized_buttons])
                db.log_conversation_message(
                    clinic_id, to_normalized, "interactive",
                    f"{body_text}\n[Opções: {button_titles}]",
                    source="ai", phone_number_id=phone_number_id
                )
            return True
        else:
            logger.error(f"❌ Failed to send buttons: {response.text}")
            return False


async def send_whatsapp_location_request(
    phone_number_id: str,
    to: str,
    body_text: str,
    access_token: str
) -> bool:
    """Send WhatsApp location_request_message (interactive)."""
    url = f"https://graph.facebook.com/{META_API_VERSION}/{phone_number_id}/messages"
    to_normalized = ensure_phone_has_plus(to)

    payload = {
        "messaging_product": "whatsapp",
        "to": to,
        "type": "interactive",
        "interactive": {
            "type": "location_request_message",
            "body": {"text": body_text},
            "action": {"name": "send_location"}
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
            logger.info(f"✅ Location request sent to {to}")
            clinic_id = _current_clinic_id.get()
            if db and clinic_id:
                db.log_conversation_message(
                    clinic_id,
                    to_normalized,
                    "interactive",
                    body_text,
                    source="ai",
                    phone_number_id=phone_number_id
                )
            return True

        logger.error(f"❌ Failed to send location request: {response.text}")
    return False


async def send_whatsapp_location_message(
    phone_number_id: str,
    to: str,
    latitude: float,
    longitude: float,
    access_token: str,
    name: Optional[str] = None,
    address: Optional[str] = None,
) -> bool:
    """Send WhatsApp location pin message."""
    url = f"https://graph.facebook.com/{META_API_VERSION}/{phone_number_id}/messages"
    to_normalized = ensure_phone_has_plus(to)

    payload: Dict[str, Any] = {
        "messaging_product": "whatsapp",
        "to": to,
        "type": "location",
        "location": {
            "latitude": latitude,
            "longitude": longitude,
        },
    }
    if name:
        payload["location"]["name"] = name
    if address:
        payload["location"]["address"] = address

    async with httpx.AsyncClient() as client:
        response = await client.post(
            url,
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json",
                "Cache-Control": "no-cache",
            },
            json=payload,
        )

        if response.status_code == 200:
            logger.info(
                "📍 Location message sent to %s (lat=%s lng=%s)",
                to,
                latitude,
                longitude,
            )
            clinic_id = _current_clinic_id.get()
            if db and clinic_id:
                db.log_conversation_message(
                    clinic_id,
                    to_normalized,
                    "location",
                    f"LOCALIZAÇÃO ENVIADA: {name or ''} {address or ''}".strip(),
                    source="ai",
                    phone_number_id=phone_number_id,
                )
            return True

        logger.error(f"❌ Failed to send location message: {response.text}")
        return False


async def send_clinic_location_message(
    clinic_id: str,
    phone_number_id: str,
    to: str,
    access_token: str,
) -> bool:
    """Send clinic location pin (and short context text) when user asks address."""
    clinic = db.get_clinic(clinic_id) if db else None
    location = _extract_clinic_location(clinic)
    if not location:
        return False

    sent = await send_whatsapp_location_message(
        phone_number_id=phone_number_id,
        to=to,
        latitude=location["latitude"],
        longitude=location["longitude"],
        access_token=access_token,
        name=location.get("name"),
        address=location.get("address"),
    )
    if not sent:
        return False

    maps_url = f"https://maps.google.com/?q={location['latitude']},{location['longitude']}"
    await send_whatsapp_message(
        phone_number_id,
        to,
        "AQUI ESTÁ NOSSA LOCALIZAÇÃO 👇",
        access_token,
    )
    await send_whatsapp_message(
        phone_number_id,
        to,
        f"MAPS\n{maps_url}",
        access_token,
    )
    return True


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
                "text": "Pagamento PIX"
            },
            "body": {
                "text": f"*{description}*\n\nValor: *{amount_formatted}*\n\nClique no botão abaixo para abrir a página de pagamento PIX.\n\nO pagamento expira em 24 horas."
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
    if not ENABLE_WHATSAPP_CONTACT_CARDS:
        logger.info("ℹ️ Contact cards are disabled by configuration; skipping send.")
        return False

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
    workflow_mode = getattr(clinic, 'workflow_mode', 'booking') if clinic else 'booking'

    # Get vertical config for terminology
    vertical_slug = getattr(clinic, 'vertical', '') if clinic else ''
    vc = get_vertical_config(vertical_slug)
    term = vc.terminology

    # INFO mode: no interactive buttons, direct Q&A only.
    if workflow_mode == 'info':
        custom_welcome = (getattr(clinic, "workflow_welcome_message", "") or "").strip() if clinic else ""
        if custom_welcome:
            greeting_message = f"👋 {custom_welcome}"
        else:
            greeting_message = f"👋 Bem-vindo(a) a *{clinic_name}*!\n\n"
            blurb = _clinic_greeting_blurb(clinic)
            if blurb:
                greeting_message += f"{blurb}\n\n"
            faq_topics = _format_faq_topics_for_greeting(clinic)
            if faq_topics:
                greeting_message += f"{faq_topics}\n\n"
            greeting_message += "Pode me perguntar qualquer dúvida sobre a clínica."

        if db:
            state = db.load_conversation_state(clinic_id, phone)
            state["clinic_id"] = clinic_id
            state["buttons_sent"] = True
            state["state"] = "general_chat"
            db.save_conversation_state(clinic_id, phone, state)

        await send_whatsapp_message(
            phone_number_id,
            phone,
            greeting_message,
            access_token
        )
        logger.info(f"👋 Sent info-mode greeting without buttons to {phone}")
        return

    # If an unpaid hold already expired, try to recover automatically:
    # reissue payment when the same slot is still free; otherwise restart scheduling.
    recent_appointments = get_appointments_by_phone(db, phone, clinic_id, include_past=False) if db else []
    expired_unpaid = next(
        (
            apt for apt in recent_appointments
            if is_unpaid_hold_expired(apt, hold_minutes=PAYMENT_HOLD_MINUTES)
        ),
        None,
    )
    if expired_unpaid:
        if db:
            db.update_appointment(
                expired_unpaid.id,
                {
                    "status": AppointmentStatus.CANCELLED.value,
                    "cancellationReason": (
                        f"Reserva expirada por falta de pagamento do sinal ({PAYMENT_HOLD_MINUTES} min)"
                    ),
                    "cancelledAt": datetime.now().isoformat(),
                },
                clinic_id=clinic_id,
            )

        available_times = get_professional_availability(
            db=db,
            clinic_id=clinic_id,
            professional_id=expired_unpaid.professional_id,
            date_str=expired_unpaid.date,
        ) if db else []
        if expired_unpaid.time in available_times:
            recreated = create_appointment(
                db=db,
                clinic_id=clinic_id,
                patient_phone=phone,
                professional_id=expired_unpaid.professional_id,
                date_str=expired_unpaid.date,
                time_str=expired_unpaid.time,
                patient_name=expired_unpaid.patient_name or contact_name or "Paciente",
                professional_name=expired_unpaid.professional_name,
                patient_email=None,
                payment_type=expired_unpaid.payment_type.value,
                total_cents=expired_unpaid.total_cents,
                signal_percentage=max(
                    1,
                    int(round((expired_unpaid.signal_cents * 100) / expired_unpaid.total_cents))
                    if expired_unpaid.total_cents
                    else 15,
                ),
                convenio_name=expired_unpaid.convenio_name,
                convenio_number=expired_unpaid.convenio_number,
                duration_minutes=expired_unpaid.duration_minutes,
            )
            if recreated:
                await send_whatsapp_message(
                    phone_number_id,
                    phone,
                    (
                        "Seu link de pagamento anterior expirou. "
                        "Como este horario ainda esta disponivel, reativei a reserva e vou enviar um novo link de pagamento."
                    ),
                    access_token,
                )
                if db:
                    state = db.load_conversation_state(clinic_id, phone)
                    state["state"] = "awaiting_appointment_action"
                    state["clinic_id"] = clinic_id
                    state["current_appointment_id"] = recreated.id
                    state["current_appointment_date"] = recreated.date
                    state["current_appointment_time"] = recreated.time
                    state["current_appointment_professional"] = recreated.professional_name
                    state["current_appointment_professional_id"] = recreated.professional_id
                    db.save_conversation_state(clinic_id, phone, state)
                await send_payment_method_options(
                    clinic_id=clinic_id,
                    phone=phone,
                    phone_number_id=phone_number_id,
                    access_token=access_token,
                    appointment=recreated,
                )
                return
        await send_whatsapp_message(
            phone_number_id,
            phone,
            (
                "Seu prazo de pagamento anterior expirou e o horário escolhido não está mais disponível. "
                "Vou abrir novamente o agendamento para você escolher nova data e horário."
            ),
            access_token,
        )
        await handle_scheduling_intent(clinic_id, phone, "quero agendar", phone_number_id, access_token)
        return

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

        has_pending_payment = (
            apt.status == AppointmentStatus.PENDING
            and not apt.signal_paid
            and apt.signal_cents > 0
            and not is_unpaid_hold_expired(apt, hold_minutes=PAYMENT_HOLD_MINUTES)
        )

        # Build personalized greeting with vertical-aware terminology
        greeting = f"👋 *Olá{', ' + greeting_name if greeting_name else ''}!*\n\n"
        if has_pending_payment:
            greeting += (
                f"Vi que sua {term.appointment_term} para *{apt_date_formatted}* com "
                f"*{apt.professional_name}* ainda está aguardando o pagamento do sinal.\n\n"
                f"A reserva fica disponível por {PAYMENT_HOLD_MINUTES} minutos. "
                "Deseja que eu envie o link de pagamento novamente?"
            )
            buttons = [
                {"id": "apt_pagar_sinal", "title": "Pagar sinal"},
                {"id": "apt_reagendar", "title": "Reagendar"},
                {"id": "apt_cancelar", "title": "Cancelar"},
            ]
        else:
            greeting += (
                f"Vi que você tem uma {term.appointment_term} agendada para "
                f"*{apt_date_formatted}* com *{apt.professional_name}*.\n\n"
            )
            greeting += f"O que você deseja?"

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
        # No upcoming appointments - send greeting with action buttons
        # Build personalized greeting with clinic context
        greeting_message = f"👋 Bem-vindo(a) a *{clinic_name}*!\n\n"

        blurb = _clinic_greeting_blurb(clinic)
        if blurb:
            greeting_message += f"{blurb}\n\n"

        professionals = db.get_clinic_professionals(clinic_id) if db else []

        # Always include at least one professional name when available.
        if professionals:
            featured_professional = professionals[0]
            featured_name = getattr(featured_professional, "full_name", None) or featured_professional.name
            featured_specialties = _get_professional_specialties_display(featured_professional, vertical_slug)
            greeting_message += f"*PROFISSIONAL:* {featured_name}"
            if featured_specialties:
                greeting_message += f" - {featured_specialties}"
            greeting_message += "\n\n"

        # Add specialty summary when no custom blurb was configured.
        if professionals and not blurb:
            if professionals:
                # Group by specialty (handles both old and new format)
                specialties = {}
                for p in professionals:
                    raw_specialties = getattr(p, 'specialties', []) or []
                    if not raw_specialties:
                        raw_specialties = [getattr(p, 'specialty', '') or 'Geral']
                    for spec in raw_specialties:
                        spec = spec or 'Geral'
                        spec = get_specialty_name(vertical_slug, spec)
                        if spec not in specialties:
                            specialties[spec] = []
                        if p.name not in specialties[spec]:
                            specialties[spec].append(p.name)

                if len(specialties) > 0:
                    # Show specialties available
                    spec_list = list(specialties.keys())[:3]  # Max 3 specialties
                    if len(spec_list) == 1:
                        greeting_message += f"Atendemos em *{spec_list[0]}*.\n\n"
                    else:
                        greeting_message += f"Atendemos em *{', '.join(spec_list)}*.\n\n"

        greeting_message += "O que você deseja?"

        buttons = _get_greeting_buttons()

        # Save state for greeting response handling
        if db:
            state = db.load_conversation_state(clinic_id, phone)
            state["clinic_id"] = clinic_id
            state["buttons_sent"] = True
            state["state"] = "awaiting_greeting_response"
            db.save_conversation_state(clinic_id, phone, state)

        await send_whatsapp_buttons(
            phone_number_id, phone,
            greeting_message,
            buttons,
            access_token
        )
        logger.info(f"👋 Sent greeting with buttons to {phone} (mode: {workflow_mode})")


async def send_followup_buttons_if_no_response(
    clinic_id: str,
    phone: str,
    phone_number_id: str,
    access_token: str,
    workflow_mode: str = 'booking',
    delay_seconds: int = 60
) -> None:
    """
    After delay, check if user responded. If not, send buttons as a gentle nudge.
    This makes the bot feel more human - waits for natural response first.
    """
    await asyncio.sleep(delay_seconds)

    if not db:
        return

    # Info mode does not use greeting buttons.
    clinic = db.get_clinic(clinic_id)
    if clinic and getattr(clinic, "workflow_mode", "booking") == "info":
        return

    # Check current state
    state = db.load_conversation_state(clinic_id, phone)
    current_state = state.get("state", "")
    buttons_sent = state.get("buttons_sent", False)

    # Only send follow-up if:
    # 1. Still in awaiting_initial_response state (user hasn't responded)
    # 2. Buttons haven't been sent yet
    if current_state == "awaiting_initial_response" and not buttons_sent:
        logger.info(f"⏰ No response from {phone} after {delay_seconds}s - sending follow-up buttons")

        # Mark buttons as sent to avoid duplicate sends
        state["buttons_sent"] = True
        state["state"] = "awaiting_greeting_response"
        db.save_conversation_state(clinic_id, phone, state)

        buttons = _get_greeting_buttons()

        # Send gentle follow-up with buttons
        followup_message = "👋 Posso te ajudar com algo?"

        await send_whatsapp_buttons(
            phone_number_id, phone,
            followup_message,
            buttons,
            access_token
        )
        logger.info(f"📤 Sent follow-up buttons to {phone}")
    else:
        logger.info(f"✅ User {phone} already responded or moved to state: {current_state} - skipping follow-up buttons")


async def handle_greeting_response_duvida(
    clinic_id: str,
    phone: str,
    phone_number_id: str,
    access_token: str
) -> None:
    """Handle when user clicks 'TIRAR DÚVIDAS' and move to open AI Q&A mode."""

    # Update state to general chat
    if db:
        state = db.load_conversation_state(clinic_id, phone)
        state["state"] = "general_chat"
        db.save_conversation_state(clinic_id, phone, state)

    await send_whatsapp_message(
        phone_number_id, phone,
        (
            "CLARO! ESTOU PRONTO PARA TE AJUDAR.\n\n"
            "VOCÊ PODE ME PERGUNTAR SOBRE:\n"
            "• SERVIÇOS\n"
            "• ESPECIALIDADES\n"
            "• PROFISSIONAIS\n"
            "• VALORES E PAGAMENTOS\n"
            "• LOCALIZAÇÃO E HORÁRIOS\n\n"
            "É SÓ ME ENVIAR SUA DÚVIDA QUE EU TE AJUDO."
        ),
        access_token
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
    escalation_message = (
        "Entendo! Vou encaminhar seu caso para nossa equipe.\n\n"
        "Um de nossos atendentes entrará em contato em breve."
    )
    if ENABLE_WHATSAPP_CONTACT_CARDS:
        escalation_message += "\n\nSe preferir, você pode entrar em contato diretamente:"

    await send_whatsapp_message(
        phone_number_id, phone,
        escalation_message,
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


async def _send_payment_link_for_appointment(
    clinic_id: str,
    phone: str,
    phone_number_id: str,
    access_token: str,
    appointment: Appointment,
    payment_method: str = "card",
) -> bool:
    """Generate and send a payment link/code for an existing appointment."""
    from src.utils.payment import (
        PAGSEGURO_MIN_PIX_AMOUNT_CENTS,
        create_pagseguro_checkout,
        create_pagseguro_pix_order,
        create_stripe_checkout_session,
        is_pagseguro_configured,
        is_stripe_configured,
        send_card_payment_to_customer,
        send_pix_payment_to_customer,
        send_stripe_checkout_to_customer,
    )

    if appointment.signal_paid or appointment.signal_cents <= 0:
        return False

    payment_method = (payment_method or "card").lower()
    if payment_method not in {"card", "pix"}:
        payment_method = "card"

    # For PIX, check PagSeguro config
    if payment_method == "pix":
        if appointment.signal_cents < PAGSEGURO_MIN_PIX_AMOUNT_CENTS or not is_pagseguro_configured():
            await send_whatsapp_message(
                phone_number_id,
                phone,
                "No momento, nao foi possivel gerar o pagamento automatico. "
                "Nossa equipe pode te ajudar com o pagamento do sinal.",
                access_token,
            )
            return False

    payment_info = None
    used_stripe = False

    if payment_method == "card":
        # Try Stripe first for card payments
        if is_stripe_configured():
            payment_info = await create_stripe_checkout_session(
                clinic_id=clinic_id,
                order_id=appointment.id,
                appointment_id=appointment.id,
                amount_cents=appointment.signal_cents,
                patient_name=appointment.patient_name or "Paciente",
                patient_phone=phone,
                description=f"Sinal - Consulta {appointment.professional_name}",
                total_cents=getattr(appointment, 'total_cents', 0) or 0,
            )
            if payment_info:
                used_stripe = True

        # Fallback to PagSeguro checkout if Stripe fails
        if not payment_info and is_pagseguro_configured():
            payment_info = await create_pagseguro_checkout(
                order_id=appointment.id,
                amount=appointment.signal_cents,
                customer_name=appointment.patient_name or "Paciente",
                customer_phone=phone,
                product_name=f"Sinal - Consulta {appointment.professional_name}",
                payment_methods=["CREDIT_CARD"],
            )
    else:
        payment_info = await create_pagseguro_pix_order(
            order_id=appointment.id,
            amount=appointment.signal_cents,
            customer_name=appointment.patient_name or "Paciente",
            customer_phone=phone,
            product_name=f"Sinal - Consulta {appointment.professional_name}",
        )

    if not payment_info:
        await send_whatsapp_message(
            phone_number_id,
            phone,
            "No momento, nao foi possivel gerar o pagamento automatico. "
            "Nossa equipe pode te ajudar com o pagamento do sinal.",
            access_token,
        )
        return False

    if db:
        db.update_appointment(
            appointment.id,
            {"signalPaymentId": payment_info.get("payment_id")},
            clinic_id=clinic_id,
        )

        order_data = {
            "id": appointment.id,
            "clinicId": clinic_id,
            "appointmentId": appointment.id,
            "patientPhone": phone,
            "patientName": appointment.patient_name or "",
            "paymentId": payment_info.get("payment_id"),
            "paymentStatus": "pending",
            "status": "pending",
            "amountCents": appointment.signal_cents,
            "description": "Sinal de consulta",
            "paymentMethod": payment_method,
            "paymentSource": payment_info.get("provider") or "pagseguro",
            "transferMode": "automatic" if payment_method == "card" else "manual",
            "checkoutUrl": payment_info.get("payment_link"),
            "expiresAt": payment_info.get("expires_at"),
        }

        if used_stripe:
            order_data["stripeSessionId"] = payment_info.get("session_id")
            order_data["stripePaymentIntentId"] = payment_info.get("payment_intent_id")
            order_data["heldForConnect"] = payment_info.get("charge_type") == "platform_hold"
        else:
            order_data["pixCopiaCola"] = payment_info.get("qr_code_text")
            order_data["qrCodeUrl"] = payment_info.get("qr_code")

        db.create_order(appointment.id, order_data, clinic_id=clinic_id)

    clinic_obj = db.get_clinic(clinic_id) if db else None
    runtime_token = set_runtime(
        Runtime(
            clinic_id=clinic_id,
            db=db,
            phone_number_id=phone_number_id,
            access_token=access_token,
            vertical_slug=getattr(clinic_obj, "vertical", "") or None,
        )
    )
    try:
        if payment_method == "card":
            if used_stripe:
                return await send_stripe_checkout_to_customer(
                    phone=phone,
                    payment_info=payment_info,
                    amount=appointment.signal_cents,
                    product_name="Confirmacao da sua consulta",
                )
            return await send_card_payment_to_customer(
                phone=phone,
                payment_info=payment_info,
                amount=appointment.signal_cents,
                product_name="Confirmacao da sua consulta",
            )
        return await send_pix_payment_to_customer(
            phone=phone,
            payment_info=payment_info,
            amount=appointment.signal_cents,
            product_name="a confirmacao da sua consulta",
            order_id=appointment.id,
        )
    finally:
        reset_runtime(runtime_token)


async def send_payment_method_options(
    clinic_id: str,
    phone: str,
    phone_number_id: str,
    access_token: str,
    appointment: Appointment,
) -> None:
    from src.utils.payment import get_payment_method_buttons, is_only_card

    state: Dict[str, Any] = {}
    if db:
        state = db.load_conversation_state(clinic_id, phone)
        state["state"] = "awaiting_payment_method"
        state["clinic_id"] = clinic_id
        state["current_appointment_id"] = appointment.id
        state["current_appointment_date"] = appointment.date
        state["current_appointment_time"] = appointment.time
        state["current_appointment_professional"] = appointment.professional_name
        state["current_appointment_professional_id"] = appointment.professional_id
        db.save_conversation_state(clinic_id, phone, state)

    if is_only_card():
        # Skip choice — go directly to card payment
        await handle_payment_method_selection(
            clinic_id=clinic_id,
            phone=phone,
            payment_method="card",
            phone_number_id=phone_number_id,
            access_token=access_token,
            state=state,
        )
    else:
        await send_whatsapp_buttons(
            phone_number_id,
            phone,
            "Escolha o método para pagar o sinal:",
            get_payment_method_buttons(),
            access_token,
        )


async def handle_payment_method_selection(
    clinic_id: str,
    phone: str,
    payment_method: str,
    phone_number_id: str,
    access_token: str,
    state: Dict[str, Any],
) -> None:
    appointment = None
    apt_id = state.get("current_appointment_id")

    if db and apt_id:
        appointment = db.get_appointment(apt_id, clinic_id=clinic_id)

    if not appointment and db:
        appointments = get_appointments_by_phone(db, phone, clinic_id, include_past=False)
        appointment = next(
            (
                a
                for a in appointments
                if a.status == AppointmentStatus.PENDING and not a.signal_paid and a.signal_cents > 0
            ),
            None,
        )

    if not appointment:
        await send_whatsapp_message(
            phone_number_id,
            phone,
            "Não encontrei uma reserva pendente. Vou abrir o agendamento novamente.",
            access_token,
        )
        await handle_scheduling_intent(clinic_id, phone, "quero agendar", phone_number_id, access_token)
        return

    sent = await _send_payment_link_for_appointment(
        clinic_id=clinic_id,
        phone=phone,
        phone_number_id=phone_number_id,
        access_token=access_token,
        appointment=appointment,
        payment_method=payment_method,
    )
    if not sent:
        await send_whatsapp_message(
            phone_number_id,
            phone,
            "Não consegui gerar o link agora. Posso abrir novos horários ou chamar um atendente.",
            access_token,
        )
        return

    if db:
        updated_state = db.load_conversation_state(clinic_id, phone)
        updated_state["state"] = "awaiting_appointment_action"
        db.save_conversation_state(clinic_id, phone, updated_state)


async def handle_pending_payment_followup(
    clinic_id: str,
    phone: str,
    phone_number_id: str,
    access_token: str,
    state: Dict[str, Any],
) -> None:
    """Handle user request to continue payment for a pending appointment."""
    appointment = None
    apt_id = state.get("current_appointment_id")
    if db and apt_id:
        appointment = db.get_appointment(apt_id, clinic_id=clinic_id)

    if not appointment and db:
        appointments = get_appointments_by_phone(db, phone, clinic_id, include_past=False)
        appointment = next(
            (
                a
                for a in appointments
                if a.status == AppointmentStatus.PENDING and not a.signal_paid and a.signal_cents > 0
            ),
            None,
        )

    if not appointment:
        await send_whatsapp_message(
            phone_number_id,
            phone,
            "Não encontrei uma reserva pendente de pagamento. Vou abrir as opções de agendamento novamente.",
            access_token,
        )
        await handle_scheduling_intent(clinic_id, phone, "quero agendar", phone_number_id, access_token)
        return

    if is_unpaid_hold_expired(appointment, hold_minutes=PAYMENT_HOLD_MINUTES):
        if db:
            db.update_appointment(
                appointment.id,
                {
                    "status": AppointmentStatus.CANCELLED.value,
                    "cancellationReason": (
                        f"Reserva expirada por falta de pagamento do sinal ({PAYMENT_HOLD_MINUTES} min)"
                    ),
                    "cancelledAt": datetime.now().isoformat(),
                },
                clinic_id=clinic_id,
            )

        available_times = get_professional_availability(
            db=db,
            clinic_id=clinic_id,
            professional_id=appointment.professional_id,
            date_str=appointment.date,
        )
        if appointment.time in available_times:
            await send_whatsapp_message(
                phone_number_id,
                phone,
                "O prazo de pagamento anterior expirou. Reativei a reserva para você.",
                access_token,
            )
            recreated = create_appointment(
                db=db,
                clinic_id=clinic_id,
                patient_phone=phone,
                professional_id=appointment.professional_id,
                date_str=appointment.date,
                time_str=appointment.time,
                patient_name=appointment.patient_name or state.get("waUserName") or "Paciente",
                professional_name=appointment.professional_name,
                patient_email=state.get("patient_email") or None,
                payment_type=appointment.payment_type.value,
                total_cents=appointment.total_cents,
                signal_percentage=max(
                    1,
                    int(round((appointment.signal_cents * 100) / appointment.total_cents))
                    if appointment.total_cents
                    else 15,
                ),
                convenio_name=appointment.convenio_name,
                convenio_number=appointment.convenio_number,
                duration_minutes=appointment.duration_minutes,
            )
            if recreated:
                await send_payment_method_options(
                    clinic_id=clinic_id,
                    phone=phone,
                    phone_number_id=phone_number_id,
                    access_token=access_token,
                    appointment=recreated,
                )
                return

        await send_whatsapp_message(
            phone_number_id,
            phone,
            "Esse horário não está mais disponível. Por favor, escolha uma nova data e horário.",
            access_token,
        )
        await handle_scheduling_intent(clinic_id, phone, "quero agendar", phone_number_id, access_token)
        return

    await send_whatsapp_message(
        phone_number_id,
        phone,
        "Seu agendamento ainda está pendente de pagamento do sinal.",
        access_token,
    )
    await send_payment_method_options(
        clinic_id=clinic_id,
        phone=phone,
        phone_number_id=phone_number_id,
        access_token=access_token,
        appointment=appointment,
    )


def _get_flow_orchestration_deps() -> FlowOrchestrationDeps:
    return FlowOrchestrationDeps(
        db=db,
        send_whatsapp_message=send_whatsapp_message,
        send_whatsapp_buttons=send_whatsapp_buttons,
        send_whatsapp_flow=send_whatsapp_flow,
        send_booking_flow=send_booking_flow,
        generate_flow_token=generate_flow_token,
        send_whatsapp_contact_card=send_whatsapp_contact_card,
        run_agent_response=run_agent_response,
        get_available_slots=get_available_slots,
        get_clinic_min_lead_time=get_clinic_min_lead_time,
        filter_slots_by_lead_time=filter_slots_by_lead_time,
        create_appointment=create_appointment,
        set_runtime=set_runtime,
        reset_runtime=reset_runtime,
        runtime_cls=Runtime,
        resolve_consultation_pricing=lambda clinic_id, clinic, professional_id="": resolve_consultation_pricing(
            db, clinic_id, clinic, professional_id
        ),
    )


async def handle_flow_completion(
    clinic_id: str,
    phone: str,
    flow_response: Dict[str, Any],
    phone_number_id: str,
    access_token: str,
    contact_name: str = ""
) -> None:
    await orchestrated_handle_flow_completion(
        _get_flow_orchestration_deps(),
        clinic_id,
        phone,
        flow_response,
        phone_number_id,
        access_token,
        contact_name=contact_name,
    )


async def handle_payment_type_selection(
    clinic_id: str,
    phone: str,
    button_payload: str,
    state: Dict[str, Any],
    phone_number_id: str,
    access_token: str
) -> None:
    await orchestrated_handle_payment_type_selection(
        _get_flow_orchestration_deps(),
        clinic_id,
        phone,
        button_payload,
        state,
        phone_number_id,
        access_token,
    )


async def handle_scheduling_intent(
    clinic_id: str,
    phone: str,
    message: str,
    phone_number_id: str,
    access_token: str,
    contact_name: Optional[str] = None
) -> None:
    await orchestrated_handle_scheduling_intent(
        _get_flow_orchestration_deps(),
        clinic_id,
        phone,
        message,
        phone_number_id,
        access_token,
        contact_name=contact_name,
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
    await orchestrated_process_incoming_message(
        _get_message_processor_deps(),
        clinic_id=clinic_id,
        phone=phone,
        message=message,
        message_id=message_id,
        phone_number_id=phone_number_id,
        access_token=access_token,
        button_payload=button_payload,
        contact_name=contact_name,
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


# Alias routes so Meta webhook configured at /whatsapp keeps working
@app.get("/whatsapp")
async def verify_webhook_alias(request: Request):
    return await verify_webhook(request)

@app.post("/whatsapp")
async def receive_webhook_alias(request: Request, background_tasks: BackgroundTasks):
    return await receive_webhook(request, background_tasks)


async def process_buffered_messages(
    clinic_id: str,
    phone: str,
    phone_number_id: str,
    access_token: str,
    buffer_key: str
):
    await orchestrated_process_buffered_messages(
        _get_message_pipeline_deps(),
        clinic_id,
        phone,
        phone_number_id,
        access_token,
        buffer_key,
        sleep_func=asyncio.sleep,
    )


async def handle_voice_message(
    clinic_id: str,
    phone: str,
    media_id: str,
    message_id: str,
    phone_number_id: str,
    access_token: str,
    contact_name: Optional[str] = None
):
    await orchestrated_handle_voice_message(
        _get_message_pipeline_deps(),
        clinic_id,
        phone,
        media_id,
        message_id,
        phone_number_id,
        access_token,
        contact_name=contact_name,
    )


@app.post("/webhook")
async def receive_webhook(request: Request, background_tasks: BackgroundTasks):
    """Receive WhatsApp webhook events."""
    try:
        body = await request.json()
        return await orchestrated_process_webhook_body(
            _get_webhook_processor_deps(),
            body,
            background_tasks,
        )

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
        logger.error(f"Error processing PagSeguro webhook: {e}")
        return {"status": "error", "message": str(e)}


@app.post("/stripe-payment-callback")
async def stripe_payment_callback(request: Request):
    """
    Callback from Firebase Functions Stripe webhook.
    Sends WhatsApp confirmation message to patient after successful Stripe payment.
    """
    service_secret = request.headers.get("X-Gendei-Service-Secret", "")
    expected_secret = os.getenv("GENDEI_SERVICE_SECRET", "")
    if not expected_secret or service_secret != expected_secret:
        raise HTTPException(status_code=401, detail="Unauthorized")

    data = await request.json()
    clinic_id = data.get("clinicId")
    appointment_id = data.get("appointmentId")
    patient_phone = data.get("patientPhone")
    payment_status = data.get("paymentStatus")

    if payment_status != "completed" or not patient_phone or not clinic_id:
        return {"status": "ignored"}

    try:
        clinic = db.get_clinic(clinic_id) if db else None
        if not clinic or not clinic.whatsapp_phone_number_id:
            logger.warning(f"Stripe callback: clinic {clinic_id} not found or no WhatsApp configured")
            return {"status": "error", "message": "Clinic not configured"}

        access_token = db.get_access_token(clinic_id) if db else None
        if not access_token:
            logger.warning(f"Stripe callback: no access token for clinic {clinic_id}")
            return {"status": "error", "message": "No access token"}

        appointment = (
            db.get_appointment(appointment_id, clinic_id=clinic_id)
            if db and appointment_id
            else None
        )

        if appointment:
            dt = datetime.strptime(appointment.date, "%Y-%m-%d")
            formatted_date = dt.strftime("%d/%m/%Y")
            message = (
                "*Pagamento confirmado*\n\n"
                "Seu pagamento com cartao foi aprovado.\n\n"
                f"Data: *{formatted_date}*\n"
                f"Hora: *{appointment.time}*\n"
                f"Profissional: *{appointment.professional_name}*\n\n"
                "Sua consulta esta *confirmada*.\n"
                "Chegue com 15 minutos de antecedencia."
            )
        else:
            message = (
                "*Pagamento confirmado*\n\n"
                "Seu pagamento com cartao foi aprovado.\n\n"
                "Sua consulta esta *confirmada*.\n"
                "Chegue com 15 minutos de antecedencia."
            )

        phone_clean = patient_phone.replace("+", "")
        await send_whatsapp_message(
            clinic.whatsapp_phone_number_id,
            phone_clean,
            message,
            access_token,
        )

        logger.info(f"Stripe payment confirmation sent to {patient_phone} for clinic {clinic_id}")
        return {"status": "ok"}

    except Exception as e:
        logger.error(f"Error in stripe payment callback: {e}", exc_info=True)
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
