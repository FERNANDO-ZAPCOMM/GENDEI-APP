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

from fastapi import FastAPI, Request, BackgroundTasks, HTTPException
from fastapi.responses import Response, HTMLResponse
import httpx

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

# Message deduplication
processed_messages: Dict[str, datetime] = {}
MESSAGE_CACHE_TTL_SECONDS = 3600

# Conversation state per phone number
conversation_state: Dict[str, Dict[str, Any]] = {}


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
    """Check if message was already processed."""
    if message_id in processed_messages:
        return True

    # Cleanup old entries
    cutoff = datetime.now() - timedelta(seconds=MESSAGE_CACHE_TTL_SECONDS)
    to_remove = [mid for mid, ts in processed_messages.items() if ts < cutoff]
    for mid in to_remove:
        del processed_messages[mid]

    processed_messages[message_id] = datetime.now()
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
        conversation_state[phone] = {
            "state": "rescheduling",
            "clinic_id": clinic_id,
            "appointment_id": appointment.id,
            "professional_id": appointment.professional_id,
        }

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
            conversation_state[phone] = {
                "state": "selecting_slot",
                "clinic_id": clinic_id,
                "professional_id": prof.id,
                "professional_name": prof.full_name,
            }
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
        conversation_state[phone] = {
            "state": "selecting_professional",
            "clinic_id": clinic_id,
            "professionals": {p.name.lower(): p for p in professionals},
        }
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
    button_payload: Optional[str] = None
) -> None:
    """Process incoming WhatsApp message."""
    phone = ensure_phone_has_plus(phone)

    # Mark as read
    await mark_message_as_read(phone_number_id, message_id, access_token)

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

    # Check conversation state
    state = conversation_state.get(phone, {})
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
                conversation_state[phone] = {
                    "state": "selecting_slot",
                    "clinic_id": clinic_id,
                    "professional_id": selected.id,
                    "professional_name": selected.full_name,
                }
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
                        conversation_state[phone] = {
                            "state": "collecting_name",
                            "clinic_id": clinic_id,
                            "professional_id": state["professional_id"],
                            "professional_name": state["professional_name"],
                            "date": date_str,
                            "time": time_str,
                        }
                        await send_whatsapp_message(
                            phone_number_id, phone,
                            f"Perfeito! Horário {day:02d}/{month:02d} às {time_str} selecionado.\n\nPor favor, me diga seu *nome completo*:",
                            access_token
                        )

                    if current_state == "rescheduling":
                        del conversation_state[phone]
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
            total_cents=0,
            signal_percentage=clinic.signal_percentage if clinic else 15,
        )

        if appointment:
            # Parse date for display
            dt = datetime.strptime(state["date"], "%Y-%m-%d")
            day_names = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"]
            day_name = day_names[dt.weekday()]
            formatted_date = dt.strftime("%d/%m/%Y")

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
            del conversation_state[phone]
        else:
            await send_whatsapp_message(
                phone_number_id, phone,
                "Desculpe, ocorreu um erro ao agendar. Por favor, tente novamente.",
                access_token
            )
        return

    # Check for scheduling intent
    scheduling_keywords = [
        "agendar", "marcar", "consulta", "horário", "horarios",
        "disponibilidade", "agenda", "atendimento"
    ]

    if any(kw in msg_lower for kw in scheduling_keywords):
        await handle_scheduling_intent(clinic_id, phone, message, phone_number_id, access_token)
        return

    # Check for my appointments query
    if any(phrase in msg_lower for phrase in ["minha consulta", "minhas consultas", "meus agendamentos"]):
        appointments = get_appointments_by_phone(db, phone, clinic_id, include_past=False)

        if appointments:
            apt_list = []
            for apt in appointments[:5]:
                dt = datetime.strptime(apt.date, "%Y-%m-%d")
                formatted_date = dt.strftime("%d/%m")
                status_emoji = "✅" if apt.status.value in ['confirmed', 'confirmed_presence'] else "⏳"
                apt_list.append(f"{status_emoji} {formatted_date} às {apt.time} - {apt.professional_name}")

            await send_whatsapp_message(
                phone_number_id, phone,
                f"📋 *Suas consultas:*\n\n" + "\n".join(apt_list),
                access_token
            )
        else:
            await send_whatsapp_message(
                phone_number_id, phone,
                "Você não tem consultas agendadas.\n\nDigite 'agendar' para marcar uma consulta!",
                access_token
            )
        return

    # Default response - offer to help with scheduling
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

                # Get phone number ID (identifies which WABA phone number received this)
                metadata = value.get("metadata", {})
                phone_number_id = metadata.get("phone_number_id")

                if not phone_number_id:
                    continue

                # Look up clinic by phone number ID
                clinic = db.get_clinic_by_phone_number_id(phone_number_id) if db else None
                if not clinic:
                    logger.warning(f"No clinic found for phone_number_id: {phone_number_id}")
                    continue

                clinic_id = clinic.id

                # Get access token for this clinic
                access_token = db.get_clinic_access_token(clinic_id) if db else WHATSAPP_TOKEN
                if not access_token:
                    access_token = WHATSAPP_TOKEN

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

                    # Extract message content
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
                        # Process in background
                        background_tasks.add_task(
                            process_message,
                            clinic_id,
                            sender,
                            text,
                            message_id,
                            phone_number_id,
                            access_token,
                            button_payload
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


# ============================================
# RUN SERVER
# ============================================

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8080"))
    uvicorn.run(app, host="0.0.0.0", port=port)
