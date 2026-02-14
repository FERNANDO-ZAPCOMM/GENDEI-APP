"""
Gendei Function Tools - Clinic Scheduling Agent Tools
Tools for WhatsApp-based clinic appointment scheduling
"""

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from agents import function_tool, RunContextWrapper  # type: ignore

from src.runtime.context import Runtime, get_runtime
from src.vertical_config import get_vertical_config
from src.utils.helpers import ensure_phone_has_plus

logger = logging.getLogger(__name__)

# Anti-spam tracker
_message_tracker: Dict[str, datetime] = {}
GREETING_COOLDOWN_SECONDS = 1800  # 30 minutes


def _mark_message_sent(phone: str, runtime: Optional['Runtime'] = None) -> None:
    """Track that a message was sent to prevent spam."""
    if runtime is None:
        runtime = get_runtime()
    key = f"{runtime.clinic_id}:{phone}"
    _message_tracker[key] = datetime.now()


# ===== MESSAGING TOOLS =====

async def _send_text_message_impl(phone: str, text: str, runtime: Optional['Runtime'] = None) -> str:
    """Send a text message to the patient via WhatsApp."""
    try:
        if runtime is None:
            runtime = get_runtime()
        phone = ensure_phone_has_plus(phone)

        # GUARD: Never send HANDOFF instructions to user
        if "[HANDOFF:" in text.upper():
            logger.info(f"⚠️ Blocking HANDOFF instruction from being sent: {text[:50]}...")
            return "Handoff instruction blocked - not sent to user"

        # Send message using runtime's messaging function
        from src.utils.messaging import send_whatsapp_text
        result = await send_whatsapp_text(phone, text)
        _mark_message_sent(phone, runtime=runtime)

        # Log interaction
        runtime.db.log_conversation_message(
            runtime.clinic_id, phone, "text", text, source="agent"
        )

        return result

    except Exception as e:
        logger.error(f"Error in send_text_message: {e}")
        return f"Error: {str(e)}"


@function_tool
async def send_text_message(ctx: RunContextWrapper[Runtime], phone: str, text: str) -> str:
    """
    Send a text message to the patient via WhatsApp.

    This is the primary tool for communicating with patients.
    Use for responses, questions, and any text-based communication.

    Args:
        phone: Patient phone number in E.164 format (e.g., +5511999999999).
        text: Message text to send. Supports WhatsApp formatting (*bold*, _italic_).

    Returns:
        Success or error message.
    """
    return await _send_text_message_impl(phone, text, runtime=ctx.context)


async def _send_whatsapp_buttons_impl(
    phone: str,
    body_text: str,
    buttons: List[Dict[str, str]],
    header_text: Optional[str] = None,
    footer_text: Optional[str] = None,
    runtime: Optional['Runtime'] = None
) -> str:
    """Send an interactive button message via WhatsApp."""
    try:
        phone = ensure_phone_has_plus(phone)
        if runtime is None:
            runtime = get_runtime()

        # Validate buttons
        if not buttons or len(buttons) == 0:
            return "Error: At least one button is required"

        if len(buttons) > 3:
            buttons = buttons[:3]  # WhatsApp max 3 buttons

        # Send interactive button message
        from src.utils.messaging import send_whatsapp_buttons as send_buttons
        result = await send_buttons(
            phone=phone,
            body_text=body_text,
            buttons=buttons,
            header_text=header_text,
            footer_text=footer_text
        )
        _mark_message_sent(phone, runtime=runtime)

        # Log interaction
        runtime.db.log_conversation_message(
            runtime.clinic_id, phone, "interactive_buttons", body_text, source="agent"
        )

        return result

    except Exception as e:
        logger.error(f"Error in send_whatsapp_buttons: {e}")
        return f"Error: {str(e)}"


async def send_whatsapp_buttons(
    phone: str,
    body_text: str,
    buttons: List[Dict[str, str]],
    header_text: Optional[str] = None,
    footer_text: Optional[str] = None
) -> str:
    """
    Send a WhatsApp message with interactive quick reply buttons (up to 3 buttons).

    Note: This function is not exposed as an Agents SDK tool to avoid strict schema
    issues with complex object parameters. Use in non-agent flows only.
    """
    return await _send_whatsapp_buttons_impl(phone, body_text, buttons, header_text, footer_text)


# ===== CLINIC INFO TOOLS =====

def _get_clinic_info_impl(runtime: Optional['Runtime'] = None) -> str:
    """Get clinic information."""
    try:
        if runtime is None:
            runtime = get_runtime()
        clinic = runtime.db.get_clinic(runtime.clinic_id)

        if not clinic:
            return "Informações da clínica não disponíveis."

        lines = [f"📍 *{clinic.name}*"]

        if clinic.address:
            lines.append(f"\n🗺️ *Endereço:* {clinic.address}")

        if hasattr(clinic, 'opening_hours') and clinic.opening_hours:
            lines.append(f"\n🕐 *Horário:* {clinic.opening_hours}")

        if hasattr(clinic, 'phone') and clinic.phone:
            lines.append(f"\n📞 *Telefone:* {clinic.phone}")

        # Payment info
        payment_settings = getattr(clinic, 'payment_settings', None)
        if payment_settings:
            accepts = []
            if payment_settings.get('acceptsParticular', True):
                accepts.append("Particular")
            if payment_settings.get('acceptsConvenio'):
                convenios = payment_settings.get('convenios', [])
                if convenios:
                    accepts.append(f"Convênios ({', '.join(convenios)})")
            if accepts:
                lines.append(f"\n💳 *Formas de pagamento:* {', '.join(accepts)}")

        return "\n".join(lines)

    except Exception as e:
        logger.error(f"Error in get_clinic_info: {e}")
        return f"Erro ao obter informações: {str(e)}"


@function_tool
async def get_clinic_info(ctx: RunContextWrapper[Runtime]) -> str:
    """
    Get information about the clinic.

    Returns clinic details including address, opening hours, phone, and payment options.

    Returns:
        Formatted clinic information.
    """
    return _get_clinic_info_impl(runtime=ctx.context)


def _get_professionals_impl(service_id: Optional[str] = None, runtime: Optional['Runtime'] = None) -> str:
    """Get list of professionals at the clinic."""
    try:
        if runtime is None:
            runtime = get_runtime()
        professionals = runtime.db.get_clinic_professionals(runtime.clinic_id)

        if not professionals:
            return "Não há profissionais cadastrados no momento."

        # Filter by service if specified (service links stored on Service.professional_ids)
        if service_id:
            services = runtime.db.get_clinic_services(runtime.clinic_id)
            service = next((s for s in services if getattr(s, "id", "") == service_id), None)
            prof_ids = getattr(service, "professional_ids", []) if service else []
            if prof_ids:
                professionals = [p for p in professionals if p.id in prof_ids]
            if not professionals:
                return "Não há profissionais disponíveis para este serviço."

        vc = get_vertical_config(getattr(runtime, 'vertical_slug', None))
        lines = [f"{vc.terminology.professional_emoji} *Nossos Profissionais:*\n"]

        for prof in professionals:
            name = prof.full_name if hasattr(prof, 'full_name') else prof.name
            specialties = getattr(prof, 'specialties', []) or []
            specialty = ", ".join(specialties) if specialties else getattr(prof, 'specialty', '')
            line = f"• *{name}*"
            if specialty:
                line += f" - {specialty}"
            lines.append(line)

        return "\n".join(lines)

    except Exception as e:
        logger.error(f"Error in get_professionals: {e}")
        return f"Erro ao obter profissionais: {str(e)}"


@function_tool
async def get_professionals(ctx: RunContextWrapper[Runtime], service_id: Optional[str] = None) -> str:
    """
    Get list of professionals at the clinic.

    Can filter by service if specified.

    Args:
        service_id: Optional service ID to filter professionals.

    Returns:
        Formatted list of professionals with their specialties.
    """
    return _get_professionals_impl(service_id, runtime=ctx.context)


def _get_services_impl(runtime: Optional['Runtime'] = None) -> str:
    """Get list of services offered by the clinic."""
    try:
        if runtime is None:
            runtime = get_runtime()
        services = runtime.db.get_clinic_services(runtime.clinic_id)

        if not services:
            return "Não há serviços cadastrados no momento."

        vc = get_vertical_config(getattr(runtime, 'vertical_slug', None))
        lines = [f"{vc.terminology.service_emoji} *Serviços Disponíveis:*\n"]

        for service in services:
            name = getattr(service, "name", "Serviço")
            duration = getattr(service, "duration_minutes", 30)
            price_cents = getattr(service, "price_cents", 0)
            price = price_cents / 100 if price_cents else 0

            line = f"• *{name}*"
            if duration:
                line += f" ({duration} min)"
            if price and price > 0:
                price_formatted = f"R$ {price:.2f}".replace('.', ',')
                line += f" - {price_formatted}"
            lines.append(line)

        return "\n".join(lines)

    except Exception as e:
        logger.error(f"Error in get_services: {e}")
        return f"Erro ao obter serviços: {str(e)}"


@function_tool
async def get_services(ctx: RunContextWrapper[Runtime]) -> str:
    """
    Get list of services offered by the clinic.

    Returns all available services with duration and price.

    Returns:
        Formatted list of services.
    """
    return _get_services_impl(runtime=ctx.context)


# ===== SCHEDULING TOOLS =====

def _get_available_slots_impl(
    professional_id: str,
    date: Optional[str] = None,
    days_ahead: int = 7,
    runtime: Optional['Runtime'] = None
) -> str:
    """Get available appointment slots for a professional."""
    try:
        if runtime is None:
            runtime = get_runtime()
        from src.scheduler.availability import get_available_slots, format_slots_for_display

        # Get professional name
        professional = runtime.db.get_professional(runtime.clinic_id, professional_id)
        prof_name = professional.full_name if professional else "Profissional"

        # Get available slots
        if date:
            slots = get_available_slots(
                runtime.db,
                runtime.clinic_id,
                professional_id=professional_id,
                start_date=date,
                end_date=date
            )
        else:
            slots = get_available_slots(
                runtime.db,
                runtime.clinic_id,
                professional_id=professional_id,
                days_ahead=days_ahead
            )

        if not slots:
            return f"Não há horários disponíveis para {prof_name} nos próximos {days_ahead} dias."

        # Format slots for display
        formatted = format_slots_for_display(slots[:20], prof_name)
        return formatted

    except Exception as e:
        logger.error(f"Error in get_available_slots: {e}")
        return f"Erro ao obter horários: {str(e)}"


@function_tool
async def get_available_slots(
    ctx: RunContextWrapper[Runtime],
    professional_id: str,
    date: Optional[str] = None,
    days_ahead: int = 7
) -> str:
    """
    Get available appointment slots for a professional.

    Args:
        professional_id: ID of the professional.
        date: Optional specific date (YYYY-MM-DD format).
        days_ahead: Number of days to look ahead (default 7).

    Returns:
        Formatted list of available time slots.
    """
    return _get_available_slots_impl(professional_id, date, days_ahead, runtime=ctx.context)


async def _create_appointment_impl(
    phone: str,
    professional_id: str,
    date: str,
    time: str,
    patient_name: str,
    patient_email: Optional[str] = None,
    service_id: Optional[str] = None,
    payment_type: str = "particular",
    convenio_name: Optional[str] = None,
    convenio_number: Optional[str] = None,
    runtime: Optional['Runtime'] = None
) -> str:
    """Create a new appointment."""
    try:
        if runtime is None:
            runtime = get_runtime()
        from src.scheduler.appointments import create_appointment
        from src.scheduler.availability import get_professional_availability

        phone = ensure_phone_has_plus(phone)

        # Validate time slot is available
        available = get_professional_availability(
            runtime.db, runtime.clinic_id, professional_id, date
        )
        if time not in available:
            return f"❌ O horário {time} não está mais disponível em {date}. Por favor, escolha outro horário."

        # Get professional name
        professional = runtime.db.get_professional(runtime.clinic_id, professional_id)
        prof_name = professional.full_name if professional else "Profissional"

        # Get service price if specified
        total_cents = 0
        duration_minutes = 30
        service = None
        if service_id:
            services = runtime.db.get_clinic_services(runtime.clinic_id)
            service = next((s for s in services if getattr(s, "id", "") == service_id), None)
            if service:
                total_cents = getattr(service, "price_cents", 0) or 0
                duration_minutes = getattr(service, "duration_minutes", 30) or 30

        # Get clinic's deposit percentage and payment settings
        clinic = runtime.db.get_clinic(runtime.clinic_id)
        signal_percentage = clinic.signal_percentage if clinic else 0
        payment_settings = getattr(clinic, "payment_settings", {}) if clinic else {}
        requires_deposit = payment_settings.get("requiresDeposit", False)
        if "depositPercentage" in payment_settings:
            signal_percentage = payment_settings.get("depositPercentage", signal_percentage)
        if total_cents == 0:
            total_cents = payment_settings.get("defaultConsultationPrice", 20000)

        # Create the appointment
        appointment = create_appointment(
            runtime.db,
            clinic_id=runtime.clinic_id,
            patient_phone=phone,
            professional_id=professional_id,
            date_str=date,
            time_str=time,
            patient_name=patient_name,
            patient_email=patient_email,
            professional_name=prof_name,
            service_id=service_id,
            payment_type=payment_type,
            convenio_name=convenio_name,
            convenio_number=convenio_number,
            total_cents=total_cents,
            signal_percentage=signal_percentage,
            duration_minutes=duration_minutes,
        )

        if appointment:
            # Get vertical config for terminology
            vc = get_vertical_config(getattr(runtime, 'vertical_slug', None))
            term = vc.terminology

            # Format date for display
            dt = datetime.strptime(date, "%Y-%m-%d")
            day_names = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"]
            day_name = day_names[dt.weekday()]
            formatted_date = dt.strftime("%d/%m/%Y")

            apt_term_cap = term.appointment_term.capitalize()
            confirmation = (
                f"✅ *{apt_term_cap} agendada com sucesso!*\n\n"
                f"📅 *{day_name}, {formatted_date}*\n"
                f"🕐 *{time}*\n"
                f"{term.professional_emoji} *{prof_name}*\n"
                f"👤 *{term.client_term.capitalize()}:* {patient_name}\n"
            )

            # Send payment link if required
            if payment_type == "particular" and requires_deposit:
                signal_cents = int(total_cents * signal_percentage / 100)
                if signal_cents >= 100:
                    from src.utils.payment import (
                        create_pagseguro_pix_order,
                        send_pix_payment_to_customer,
                        format_payment_amount,
                        is_pagseguro_configured,
                        PAGSEGURO_MIN_PIX_AMOUNT_CENTS
                    )

                    if signal_cents >= PAGSEGURO_MIN_PIX_AMOUNT_CENTS and is_pagseguro_configured():
                        payment_info = await create_pagseguro_pix_order(
                            order_id=appointment.id,
                            amount=signal_cents,
                            customer_name=patient_name,
                            customer_phone=phone,
                            product_name=f"Sinal - {apt_term_cap} {prof_name}"
                        )
                        if payment_info:
                            runtime.db.update_appointment(appointment.id, {
                                "signalPaymentId": payment_info.get("payment_id")
                            })
                            await send_pix_payment_to_customer(
                                phone=phone,
                                payment_info=payment_info,
                                amount=signal_cents,
                                product_name=f"a confirmação da sua {term.appointment_term}",
                                order_id=appointment.id
                            )
                            confirmation += (
                                f"\n💳 *Sinal necessário:* {format_payment_amount(signal_cents)}\n"
                                f"Enviei o PIX para confirmar sua {term.appointment_term}. 👇"
                            )
                        else:
                            confirmation += (
                                f"\n💳 *Sinal necessário:* {format_payment_amount(signal_cents)}\n"
                                "Não consegui gerar o PIX agora. Nossa equipe entrará em contato."
                            )
                    else:
                        pix_key = payment_settings.get('pixKey') or getattr(clinic, 'pix_key', None)
                        if pix_key:
                            from src.utils.payment import format_payment_amount
                            confirmation += (
                                f"\n💳 *Sinal necessário:* {format_payment_amount(signal_cents)}\n"
                                f"Chave PIX: `{pix_key}`\n"
                                "Envie o comprovante após o pagamento."
                            )

            if vc.features.show_arrive_early_tip:
                confirmation += f"\n\nVocê receberá um lembrete antes da {term.appointment_term}."
            else:
                confirmation += f"\n\nVocê receberá um lembrete antes da sua {term.appointment_term}."
            return confirmation
        else:
            return "❌ Erro ao criar agendamento. Por favor, tente novamente."

    except Exception as e:
        logger.error(f"Error in create_appointment: {e}")
        return f"Erro ao criar agendamento: {str(e)}"


@function_tool
async def create_appointment(
    ctx: RunContextWrapper[Runtime],
    phone: str,
    professional_id: str,
    date: str,
    time: str,
    patient_name: str,
    patient_email: Optional[str] = None,
    service_id: Optional[str] = None,
    payment_type: str = "particular",
    convenio_name: Optional[str] = None,
    convenio_number: Optional[str] = None
) -> str:
    """
    Create a new appointment.

    Args:
        phone: Patient phone number in E.164 format.
        professional_id: ID of the professional.
        date: Appointment date in YYYY-MM-DD format.
        time: Appointment time in HH:MM format.
        patient_name: Full name of the patient.
        patient_email: Patient email if available.
        service_id: Optional ID of the service.
        payment_type: Payment type - "particular" or "convenio".
        convenio_name: Name of the health insurance (if convenio).
        convenio_number: Health insurance card number (if convenio).

    Returns:
        Success message with appointment details or error.
    """
    return await _create_appointment_impl(
        phone, professional_id, date, time, patient_name, patient_email,
        service_id, payment_type, convenio_name, convenio_number,
        runtime=ctx.context
    )


async def _send_appointment_confirmation_impl(appointment_id: str, runtime: Optional['Runtime'] = None) -> str:
    """Send appointment confirmation message to patient."""
    try:
        if runtime is None:
            runtime = get_runtime()

        # Get appointment details
        appointment = runtime.db.get_appointment(runtime.clinic_id, appointment_id)
        if not appointment:
            return "Agendamento não encontrado."

        # Get clinic info
        clinic = runtime.db.get_clinic(runtime.clinic_id)
        vc = get_vertical_config(getattr(runtime, 'vertical_slug', None))
        term = vc.terminology
        apt_term_cap = term.appointment_term.capitalize()

        # Format confirmation message
        dt = datetime.strptime(appointment.date, "%Y-%m-%d")
        day_names = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"]
        day_name = day_names[dt.weekday()]
        formatted_date = dt.strftime("%d/%m/%Y")

        message = (
            f"📋 *Confirmação de {apt_term_cap}*\n\n"
            f"📅 *{day_name}, {formatted_date}*\n"
            f"🕐 *{appointment.time}*\n"
            f"{term.professional_emoji} *{appointment.professional_name}*\n"
        )

        if clinic and clinic.address:
            message += f"📍 *{clinic.address}*\n"

        if vc.features.show_arrive_early_tip:
            message += "\n✅ Chegue 15 minutos antes do horário marcado."
        else:
            message += f"\n✅ Sua {term.appointment_term} está confirmada."

        # Send the message
        from src.utils.messaging import send_whatsapp_text
        await send_whatsapp_text(appointment.patient_phone, message)

        return "Confirmação enviada com sucesso."

    except Exception as e:
        logger.error(f"Error in send_appointment_confirmation: {e}")
        return f"Erro ao enviar confirmação: {str(e)}"


@function_tool
async def send_appointment_confirmation(ctx: RunContextWrapper[Runtime], appointment_id: str) -> str:
    """
    Send appointment confirmation message to the patient.

    Args:
        appointment_id: ID of the appointment to confirm.

    Returns:
        Success or error message.
    """
    return await _send_appointment_confirmation_impl(appointment_id, runtime=ctx.context)


# ===== APPOINTMENT MANAGEMENT TOOLS =====

def _get_patient_appointments_impl(phone: str, runtime: Optional['Runtime'] = None) -> str:
    """Get patient's upcoming appointments."""
    try:
        if runtime is None:
            runtime = get_runtime()
        from src.scheduler.appointments import get_appointments_by_phone

        phone = ensure_phone_has_plus(phone)

        appointments = get_appointments_by_phone(
            runtime.db, phone, runtime.clinic_id, include_past=False
        )

        vc = get_vertical_config(getattr(runtime, 'vertical_slug', None))
        term = vc.terminology

        if not appointments:
            return f"Você não tem {term.appointment_term_plural} agendadas.\n\nDigite 'agendar' para marcar uma {term.appointment_term}!"

        lines = [f"📋 *Suas {term.appointment_term_plural.capitalize()}:*\n"]

        for apt in appointments[:5]:
            dt = datetime.strptime(apt.date, "%Y-%m-%d")
            formatted_date = dt.strftime("%d/%m")
            status_emoji = "✅" if apt.status.value in ['confirmed', 'confirmed_presence'] else "⏳"
            lines.append(f"{status_emoji} *{formatted_date} às {apt.time}* - {apt.professional_name}")

        return "\n".join(lines)

    except Exception as e:
        logger.error(f"Error in get_patient_appointments: {e}")
        return f"Erro ao obter consultas: {str(e)}"


@function_tool
async def get_patient_appointments(ctx: RunContextWrapper[Runtime], phone: str) -> str:
    """
    Get patient's upcoming appointments.

    Args:
        phone: Patient phone number in E.164 format.

    Returns:
        Formatted list of patient's upcoming appointments.
    """
    return _get_patient_appointments_impl(phone, runtime=ctx.context)


async def _cancel_appointment_impl(appointment_id: str, reason: str = "", runtime: Optional['Runtime'] = None) -> str:
    """Cancel an appointment."""
    try:
        if runtime is None:
            runtime = get_runtime()
        from src.scheduler.appointments import cancel_appointment

        vc = get_vertical_config(getattr(runtime, 'vertical_slug', None))
        term = vc.terminology

        cancel_appointment(
            runtime.db, appointment_id,
            reason or f"Cancelado pelo {term.client_term} via WhatsApp"
        )

        apt_term_cap = term.appointment_term.capitalize()
        return f"❌ {apt_term_cap} cancelada com sucesso.\n\nSe desejar agendar novamente, é só enviar uma mensagem!"

    except Exception as e:
        logger.error(f"Error in cancel_appointment: {e}")
        return f"Erro ao cancelar: {str(e)}"


@function_tool
async def cancel_appointment(ctx: RunContextWrapper[Runtime], appointment_id: str, reason: str = "") -> str:
    """
    Cancel an appointment.

    Args:
        appointment_id: ID of the appointment to cancel.
        reason: Optional reason for cancellation.

    Returns:
        Success or error message.
    """
    return await _cancel_appointment_impl(appointment_id, reason, runtime=ctx.context)


async def _reschedule_appointment_impl(
    appointment_id: str,
    new_date: str,
    new_time: str,
    runtime: Optional['Runtime'] = None
) -> str:
    """Reschedule an appointment to a new date/time."""
    try:
        if runtime is None:
            runtime = get_runtime()
        from src.scheduler.appointments import reschedule_appointment
        from src.scheduler.availability import get_professional_availability

        # Get the appointment to find professional ID
        appointment = runtime.db.get_appointment(runtime.clinic_id, appointment_id)
        if not appointment:
            return "Agendamento não encontrado."

        # Check new slot availability
        available = get_professional_availability(
            runtime.db, runtime.clinic_id, appointment.professional_id, new_date
        )
        if new_time not in available:
            return f"❌ O horário {new_time} não está disponível em {new_date}. Por favor, escolha outro horário."

        # Reschedule
        reschedule_appointment(runtime.db, appointment_id, new_date, new_time)

        vc = get_vertical_config(getattr(runtime, 'vertical_slug', None))
        term = vc.terminology
        apt_term_cap = term.appointment_term.capitalize()

        # Format date for display
        dt = datetime.strptime(new_date, "%Y-%m-%d")
        day_names = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"]
        day_name = day_names[dt.weekday()]
        formatted_date = dt.strftime("%d/%m/%Y")

        return (
            f"🔄 *{apt_term_cap} reagendada com sucesso!*\n\n"
            f"📅 *{day_name}, {formatted_date}*\n"
            f"🕐 *{new_time}*\n"
            f"{term.professional_emoji} *{appointment.professional_name}*\n\n"
            f"Te esperamos!"
        )

    except Exception as e:
        logger.error(f"Error in reschedule_appointment: {e}")
        return f"Erro ao reagendar: {str(e)}"


@function_tool
async def reschedule_appointment(
    ctx: RunContextWrapper[Runtime],
    appointment_id: str,
    new_date: str,
    new_time: str
) -> str:
    """
    Reschedule an appointment to a new date and time.

    Args:
        appointment_id: ID of the appointment to reschedule.
        new_date: New date in YYYY-MM-DD format.
        new_time: New time in HH:MM format.

    Returns:
        Success message with new appointment details or error.
    """
    return await _reschedule_appointment_impl(appointment_id, new_date, new_time, runtime=ctx.context)


# ===== SUPPORT TOOLS =====

async def _enable_human_takeover_impl(phone: str, reason: str, runtime: Optional['Runtime'] = None) -> str:
    """Enable human takeover for a conversation."""
    try:
        if runtime is None:
            runtime = get_runtime()
        phone = ensure_phone_has_plus(phone)

        # Enable human takeover in Firestore.
        # Compatibility: some DB adapters expose `set_human_takeover` instead.
        enabled = False
        if hasattr(runtime.db, "enable_human_takeover"):
            runtime.db.enable_human_takeover(runtime.clinic_id, phone, reason)
            enabled = True
        elif hasattr(runtime.db, "set_human_takeover"):
            enabled = bool(runtime.db.set_human_takeover(runtime.clinic_id, phone, True, reason))
        else:
            raise AttributeError("Database adapter missing human takeover methods")

        if not enabled:
            raise RuntimeError("Failed to enable human takeover state")

        # Log the handoff
        runtime.db.log_conversation_message(
            runtime.clinic_id, phone, "human_takeover",
            f"Human takeover enabled: {reason}",
            source="agent",
            metadata={"reason": reason}
        )

        # Notify the patient
        notification_message = (
            "🙋 Entendi! Vou transferir você para um atendente.\n\n"
            "Aguarde um momento que alguém da nossa equipe vai te ajudar em breve!"
        )
        from src.utils.messaging import send_whatsapp_text
        await send_whatsapp_text(phone, notification_message)
        _mark_message_sent(phone, runtime=runtime)

        logger.info(f"👋 Human takeover enabled for {phone}: {reason}")
        return f"Human takeover enabled for {phone}. Reason: {reason}"

    except Exception as e:
        logger.error(f"Error enabling human takeover: {e}")
        return f"Error enabling human takeover: {str(e)}"


@function_tool
async def enable_human_takeover(ctx: RunContextWrapper[Runtime], phone: str, reason: str) -> str:
    """
    Enable human takeover for a conversation when the AI cannot handle the request.

    Use this when:
    - Patient explicitly asks to speak with a human
    - Complex complaint or issue that requires human judgment
    - Patient is frustrated or angry
    - Medical questions that AI cannot answer
    - Payment/billing issues

    Args:
        phone: Patient phone number to enable human takeover for.
        reason: Brief description of why human takeover is needed.

    Returns:
        Success message confirming human takeover is enabled.
    """
    return await _enable_human_takeover_impl(phone, reason, runtime=ctx.context)


# ===== TOOL REGISTRY =====

def get_tools_for_agent(agent_name: str) -> List[Any]:
    """
    Get the appropriate tools for each agent type.

    Args:
        agent_name: Name of the agent (greeter, clinic_info, scheduling, etc.)

    Returns:
        List of function tools.
    """
    tool_map = {
        # Greeter - welcomes patients
        'greeter_agent': [
            send_text_message,
        ],

        # Clinic Info - answers questions about the clinic
        'clinic_info_agent': [
            send_text_message,
            get_clinic_info,
            get_professionals,
            get_services,
        ],

        # Scheduling - handles appointment booking
        'scheduling_agent': [
            send_text_message,
            get_services,
            get_professionals,
            get_available_slots,
            create_appointment,
            send_appointment_confirmation,
        ],

        # Appointment Manager - view/cancel/reschedule
        'appointment_manager_agent': [
            send_text_message,
            get_patient_appointments,
            cancel_appointment,
            reschedule_appointment,
        ],

        # Support - human escalation
        'support_agent': [
            send_text_message,
            enable_human_takeover,
        ],

        # Triage - routes to other agents (only needs send_text_message for emergencies)
        'triage_agent': [
            send_text_message,
        ],
    }

    return tool_map.get(agent_name, [send_text_message])
