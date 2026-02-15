"""Incoming WhatsApp message processing extracted from main.py."""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from typing import Any, Awaitable, Callable, Dict, Optional

logger = logging.getLogger(__name__)


@dataclass
class MessageProcessorDeps:
    db: Any
    ensure_phone_has_plus: Callable[[str], str]
    set_current_clinic_id: Callable[[str], None]
    set_current_phone_number_id: Callable[[str], None]
    mark_message_as_read: Callable[[str, str, str], Awaitable[Any]]
    get_appointments_by_phone: Callable[..., Any]
    handle_reminder_response: Callable[..., Awaitable[Any]]
    handle_appointment_reschedule: Callable[..., Awaitable[Any]]
    handle_appointment_cancel_request: Callable[..., Awaitable[Any]]
    handle_appointment_question: Callable[..., Awaitable[Any]]
    handle_pending_payment_followup: Callable[..., Awaitable[Any]]
    handle_payment_method_selection: Callable[..., Awaitable[Any]]
    handle_scheduling_intent: Callable[..., Awaitable[Any]]
    handle_greeting_response_duvida: Callable[..., Awaitable[Any]]
    handle_payment_type_selection: Callable[..., Awaitable[Any]]
    escalate_to_human: Callable[..., Awaitable[Any]]
    detect_frustrated_sentiment: Callable[[str], bool]
    detect_human_escalation_request: Callable[[str], bool]
    send_whatsapp_location_request: Callable[..., Awaitable[bool]]
    send_clinic_location_message: Callable[..., Awaitable[bool]]
    send_whatsapp_message: Callable[[str, str, str, str], Awaitable[Any]]
    is_simple_greeting: Callable[[str], bool]
    send_initial_greeting: Callable[..., Awaitable[Any]]
    run_agent_response: Callable[..., Awaitable[Any]]


async def process_incoming_message(
    deps: MessageProcessorDeps,
    clinic_id: str,
    phone: str,
    message: str,
    message_id: str,
    phone_number_id: str,
    access_token: str,
    button_payload: Optional[str] = None,
    contact_name: Optional[str] = None,
) -> None:
    """Process one incoming WhatsApp message."""
    phone = deps.ensure_phone_has_plus(phone)

    deps.set_current_clinic_id(clinic_id)
    deps.set_current_phone_number_id(phone_number_id)

    await deps.mark_message_as_read(phone_number_id, message_id, access_token)

    if deps.db:
        deps.db.upsert_contact(clinic_id, phone, name=contact_name)
        deps.db.log_conversation_message(
            clinic_id,
            phone,
            "text",
            message,
            source="patient",
            phone_number_id=phone_number_id,
        )

    if deps.db and deps.db.is_human_takeover_enabled(clinic_id, phone):
        logger.info(f"🙋 Human takeover active for {phone}, skipping AI processing")
        return

    if button_payload:
        reminder_buttons = {"confirm_yes", "confirm_reschedule", "confirm_cancel"}
        if button_payload in reminder_buttons:
            appointments = deps.get_appointments_by_phone(deps.db, phone, clinic_id, include_past=False)
            pending_apt = next(
                (a for a in appointments if a.status.value in ["confirmed", "awaiting_confirmation"]),
                None,
            )
            if pending_apt:
                await deps.handle_reminder_response(
                    clinic_id,
                    phone,
                    button_payload,
                    pending_apt,
                    phone_number_id,
                    access_token,
                )
                return

    state = deps.db.load_conversation_state(clinic_id, phone) if deps.db else {}
    current_state = state.get("state")

    if deps.db and contact_name and contact_name != state.get("waUserName"):
        state["waUserName"] = contact_name
        state["waUserPhone"] = phone
        state["waUserId"] = phone
        deps.db.save_conversation_state(clinic_id, phone, state)
        logger.info(f"👤 Updated conversation with contact name: {contact_name}")

    msg_lower = message.lower().strip()

    if button_payload in ("greeting_sim", "greeting_nao", "greeting_contato"):
        if button_payload == "greeting_sim":
            logger.info(f"📅 User {phone} wants to schedule (greeting button)")
            await deps.handle_scheduling_intent(
                clinic_id,
                phone,
                "quero agendar",
                phone_number_id,
                access_token,
                contact_name,
            )
            return

        if button_payload == "greeting_nao":
            logger.info(f"❓ User {phone} has a question (greeting button)")
            await deps.handle_greeting_response_duvida(
                clinic_id,
                phone,
                phone_number_id,
                access_token,
            )
            return

        logger.info(f"📞 User {phone} wants human support (greeting button)")
        await deps.escalate_to_human(
            clinic_id,
            phone,
            phone_number_id,
            access_token,
            reason="user_requested_contact_info_mode",
            auto_takeover=True,
        )
        return

    if button_payload in ("apt_reagendar", "apt_cancelar", "apt_duvida", "apt_pagar_sinal"):
        if button_payload == "apt_reagendar":
            await deps.handle_appointment_reschedule(
                clinic_id,
                phone,
                phone_number_id,
                access_token,
                state,
            )
            return
        if button_payload == "apt_cancelar":
            await deps.handle_appointment_cancel_request(
                clinic_id,
                phone,
                phone_number_id,
                access_token,
                state,
            )
            return
        if button_payload == "apt_duvida":
            await deps.handle_appointment_question(
                clinic_id,
                phone,
                phone_number_id,
                access_token,
                state,
            )
            return
        await deps.handle_pending_payment_followup(
            clinic_id,
            phone,
            phone_number_id,
            access_token,
            state,
        )
        return

    if button_payload in ("payment_method_card", "payment_method_pix"):
        method = "card" if button_payload == "payment_method_card" else "pix"
        await deps.handle_payment_method_selection(
            clinic_id,
            phone,
            method,
            phone_number_id,
            access_token,
            state,
        )
        return

    if button_payload in ("payment_convenio", "payment_particular"):
        logger.info(f"💳 User {phone} selected payment type (button): {button_payload}")
        await deps.handle_payment_type_selection(
            clinic_id,
            phone,
            button_payload,
            state,
            phone_number_id,
            access_token,
        )
        return

    if current_state == "awaiting_payment_type" and not button_payload:
        if "particular" in msg_lower:
            logger.info(f"💳 User {phone} typed payment type: particular")
            await deps.handle_payment_type_selection(
                clinic_id,
                phone,
                "payment_particular",
                state,
                phone_number_id,
                access_token,
            )
            return

    if current_state == "awaiting_payment_method" and not button_payload:
        if "cart" in msg_lower or "credito" in msg_lower or "crédito" in msg_lower:
            await deps.handle_payment_method_selection(
                clinic_id,
                phone,
                "card",
                phone_number_id,
                access_token,
                state,
            )
            return
        if "pix" in msg_lower:
            await deps.handle_payment_method_selection(
                clinic_id,
                phone,
                "pix",
                phone_number_id,
                access_token,
                state,
            )
            return
        if "convenio" in msg_lower or "convênio" in msg_lower:
            logger.info(f"💳 User {phone} typed payment type: convenio")
            await deps.handle_payment_type_selection(
                clinic_id,
                phone,
                "payment_convenio",
                state,
                phone_number_id,
                access_token,
            )
            return

    if deps.detect_frustrated_sentiment(message):
        logger.warning(f"😤 Frustrated sentiment detected from {phone}: {message[:50]}...")
        await deps.escalate_to_human(
            clinic_id,
            phone,
            phone_number_id,
            access_token,
            reason=f"Usuário frustrado/irritado - Mensagem: {message[:100]}",
            auto_takeover=True,
        )
        return

    if deps.detect_human_escalation_request(message):
        logger.info(f"🙋 User {phone} requested human escalation: {message[:50]}...")
        await deps.escalate_to_human(
            clinic_id,
            phone,
            phone_number_id,
            access_token,
            reason=f"Solicitação de atendimento humano - Mensagem: {message[:100]}",
            auto_takeover=True,
        )
        return

    location_keywords = [
        "compartilhar localização",
        "compartilhar localizacao",
        "enviar localização",
        "enviar localizacao",
        "mandar localização",
        "mandar localizacao",
    ]
    if any(kw in msg_lower for kw in location_keywords):
        sent = await deps.send_whatsapp_location_request(
            phone_number_id,
            phone,
            "Perfeito. Toque no botão abaixo para compartilhar sua localização atual.",
            access_token,
        )
        if not sent:
            await deps.send_whatsapp_message(
                phone_number_id,
                phone,
                "Não consegui abrir o pedido automático de localização agora. "
                "Você pode compartilhar manualmente pelo clipe 📎 > Localização.",
                access_token,
            )
        return

    address_keywords = [
        "onde fica",
        "onde vocês ficam",
        "onde voces ficam",
        "onde vocês estão",
        "onde voces estao",
        "onde estão",
        "onde estao",
        "qual o endereço",
        "qual endereco",
        "qual é o endereço",
        "qual e o endereco",
        "endereço",
        "endereco",
        "localização",
        "localizacao",
        "como chegar",
        "mapa",
    ]
    address_patterns = [
        r"\bonde\b.*\bfic",
        r"\bonde\b.*\best[aá]o\b",
        r"\best[aá] localizado",
        r"\blocaliza[çc][aã]o\b",
        r"\bendere[cç]o\b",
        r"\bcomo chegar\b",
        r"\bmapa\b",
    ]
    has_address_intent = any(kw in msg_lower for kw in address_keywords) or any(
        re.search(pattern, msg_lower) for pattern in address_patterns
    )
    if has_address_intent:
        sent = await deps.send_clinic_location_message(
            clinic_id,
            phone_number_id,
            phone,
            access_token,
        )
        if sent:
            return

    if deps.is_simple_greeting(message):
        logger.info(f"Greeting detected, sending greeting buttons for {phone}")
        await deps.send_initial_greeting(
            clinic_id,
            phone,
            phone_number_id,
            access_token,
            contact_name=contact_name,
        )
        return

    appointment_keywords = [
        "minha consulta",
        "minhas consultas",
        "meu agendamento",
        "cancelar",
        "desmarcar",
        "remarcar",
        "reagendar",
    ]
    if any(kw in msg_lower for kw in appointment_keywords):
        await deps.run_agent_response(
            clinic_id,
            phone,
            message,
            phone_number_id,
            access_token,
            contact_name=contact_name,
        )
        return

    scheduling_keywords = [
        "agendar",
        "marcar",
        "agendamento",
        "quero agendar",
        "preciso agendar",
        "quero marcar",
        "horário",
        "horarios",
        "disponibilidade",
        "tem horario",
        "tem horário",
        "qual profissional",
        "quais profissionais",
        "quais opções",
        "quais opcoes",
        "qual opção",
    ]

    if any(kw in msg_lower for kw in scheduling_keywords):
        logger.info(f"📅 Scheduling intent detected: {message[:50]}...")
        await deps.handle_scheduling_intent(
            clinic_id,
            phone,
            message,
            phone_number_id,
            access_token,
            contact_name,
        )
        return

    await deps.run_agent_response(
        clinic_id,
        phone,
        message,
        phone_number_id,
        access_token,
        contact_name=contact_name,
    )
