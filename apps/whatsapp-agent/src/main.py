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
    logger.info("✅ Gendei modules imported successfully")
except Exception as e:
    logger.error(f"❌ Failed to import Gendei modules: {e}")
    raise

# Environment variables
WHATSAPP_TOKEN = os.getenv("META_BISU_ACCESS_TOKEN", "")
VERIFY_TOKEN = os.getenv("META_WEBHOOK_VERIFY_TOKEN", "gendei_verify_token")
META_API_VERSION = os.getenv("META_API_VERSION", "v24.0")
DOMAIN = os.getenv("GENDEI_DOMAIN", "https://gendei.com")

# Database instance
db: Optional[GendeiDatabase] = None

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


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    global db
    logger.info("🚀 Starting Gendei WhatsApp Agent...")
    db = GendeiDatabase()
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
    access_token: str
) -> bool:
    """Send WhatsApp text message."""
    url = f"https://graph.facebook.com/{META_API_VERSION}/{phone_number_id}/messages"

    async with httpx.AsyncClient() as client:
        response = await client.post(
            url,
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json",
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

    async with httpx.AsyncClient() as client:
        response = await client.post(
            url,
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json",
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
            return True
        else:
            logger.error(f"❌ Failed to send buttons: {response.text}")
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
            },
            json=payload
        )

        if response.status_code == 200:
            logger.info(f"✅ PIX payment CTA sent to {to}")
            return True
        else:
            logger.error(f"❌ Failed to send PIX CTA: {response.text}")
            return False


async def mark_message_as_read(
    phone_number_id: str,
    message_id: str,
    access_token: str
) -> None:
    """Mark message as read."""
    url = f"https://graph.facebook.com/{META_API_VERSION}/{phone_number_id}/messages"

    async with httpx.AsyncClient() as client:
        await client.post(
            url,
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json",
            },
            json={
                "messaging_product": "whatsapp",
                "status": "read",
                "message_id": message_id
            }
        )


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


async def handle_scheduling_intent(
    clinic_id: str,
    phone: str,
    message: str,
    phone_number_id: str,
    access_token: str
) -> None:
    """Handle appointment scheduling intent."""
    clinic = db.get_clinic(clinic_id)
    if not clinic:
        await send_whatsapp_message(
            phone_number_id, phone,
            "Desculpe, não consegui encontrar as informações da clínica.",
            access_token
        )
        return

    # Get professionals
    professionals = db.get_clinic_professionals(clinic_id)

    if not professionals:
        await send_whatsapp_message(
            phone_number_id, phone,
            "Desculpe, não há profissionais disponíveis no momento.",
            access_token
        )
        return

    # If only one professional, show their availability directly
    if len(professionals) == 1:
        prof = professionals[0]
        slots = get_available_slots(db, clinic_id, professional_id=prof.id, days_ahead=7)

        if slots:
            slots_text = format_slots_for_display(slots[:15], prof.full_name)
            new_state = {
                "state": "selecting_slot",
                "clinic_id": clinic_id,
                "professional_id": prof.id,
                "professional_name": prof.full_name,
            }
            if db:
                db.save_conversation_state(clinic_id, phone, new_state)
            await send_whatsapp_message(
                phone_number_id, phone,
                f"Olá! Aqui está a agenda de {prof.full_name}:\n\n{slots_text}\n\nQual horário você prefere? (ex: '15/01 às 14:00')",
                access_token
            )
        else:
            await send_whatsapp_message(
                phone_number_id, phone,
                f"Desculpe, não há horários disponíveis para {prof.full_name} nos próximos dias.",
                access_token
            )
    else:
        # Multiple professionals - ask which one
        prof_list = "\n".join([f"• {p.full_name} - {p.specialty}" for p in professionals])
        new_state = {
            "state": "selecting_professional",
            "clinic_id": clinic_id,
            "professionals": {p.name.lower(): p for p in professionals},
        }
        if db:
            db.save_conversation_state(clinic_id, phone, new_state)
        await send_whatsapp_message(
            phone_number_id, phone,
            f"Olá! Temos os seguintes profissionais disponíveis:\n\n{prof_list}\n\nCom qual você gostaria de agendar?",
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

    # Mark as read
    await mark_message_as_read(phone_number_id, message_id, access_token)

    # Upsert contact (like Zapcomm)
    if db:
        db.upsert_contact(clinic_id, phone, name=contact_name)

    # Check human takeover - skip AI processing if human has taken over
    if db and db.is_human_takeover_enabled(clinic_id, phone):
        logger.info(f"🙋 Human takeover active for {phone}, skipping AI processing")
        # Log message but don't respond
        db.log_conversation_message(clinic_id, phone, "text", message, source="patient")
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

    msg_lower = message.lower().strip()

    # Handle ongoing conversation flows
    if current_state == "selecting_professional":
        # User is selecting a professional
        professionals = state.get("professionals", {})
        selected = None

        for name, prof in professionals.items():
            if name in msg_lower or prof.name.lower() in msg_lower:
                selected = prof
                break

        if selected:
            slots = get_available_slots(db, clinic_id, professional_id=selected.id, days_ahead=7)
            if slots:
                slots_text = format_slots_for_display(slots[:15], selected.full_name)
                new_state = {
                    "state": "selecting_slot",
                    "clinic_id": clinic_id,
                    "professional_id": selected.id,
                    "professional_name": selected.full_name,
                }
                if db:
                    db.save_conversation_state(clinic_id, phone, new_state)
                await send_whatsapp_message(
                    phone_number_id, phone,
                    f"Ótimo! Aqui está a agenda de {selected.full_name}:\n\n{slots_text}\n\nQual horário você prefere?",
                    access_token
                )
            else:
                await send_whatsapp_message(
                    phone_number_id, phone,
                    f"Desculpe, {selected.full_name} não tem horários disponíveis nos próximos dias.",
                    access_token
                )
        else:
            await send_whatsapp_message(
                phone_number_id, phone,
                "Não entendi. Por favor, digite o nome do profissional desejado.",
                access_token
            )
        return

    elif current_state in ("selecting_slot", "rescheduling"):
        # User is selecting a time slot - parse date/time from message
        # Simple parsing for formats like "15/01 às 14:00" or "amanhã às 10:00"
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
                    if current_state == "rescheduling":
                        # Reschedule existing appointment
                        reschedule_appointment(db, state["appointment_id"], date_str, time_str)
                        await send_whatsapp_message(
                            phone_number_id, phone,
                            f"✅ Consulta reagendada com sucesso!\n\n📅 {day:02d}/{month:02d} às {time_str}\n👨‍⚕️ {state['professional_name']}\n\nTe esperamos!",
                            access_token
                        )
                    else:
                        # Create new appointment
                        new_state = {
                            "state": "collecting_name",
                            "clinic_id": clinic_id,
                            "professional_id": state["professional_id"],
                            "professional_name": state["professional_name"],
                            "date": date_str,
                            "time": time_str,
                        }
                        if db:
                            db.save_conversation_state(clinic_id, phone, new_state)
                        await send_whatsapp_message(
                            phone_number_id, phone,
                            f"Perfeito! Horário {day:02d}/{month:02d} às {time_str} selecionado.\n\nPor favor, me diga seu *nome completo*:",
                            access_token
                        )

                    if current_state == "rescheduling":
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
                        if interactive.get("type") == "button_reply":
                            button_payload = interactive.get("button_reply", {}).get("id")
                            text = interactive.get("button_reply", {}).get("title", "")
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
# RUN SERVER
# ============================================

if __name__ == "__main__":
    import uvicorn  # type: ignore
    port = int(os.getenv("PORT", "8080"))
    uvicorn.run(app, host="0.0.0.0", port=port)
