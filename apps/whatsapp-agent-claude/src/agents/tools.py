"""
Gendei Custom Tools - Claude Agent SDK
Tools for WhatsApp-based clinic appointment scheduling using Claude Agent SDK.
"""

import logging
from datetime import datetime
from typing import Any, Dict, Optional

from claude_agent_sdk import tool, create_sdk_mcp_server

from src.runtime.context import get_runtime
from src.utils.helpers import ensure_phone_has_plus

logger = logging.getLogger(__name__)


# ===== MESSAGING TOOLS =====

@tool(
    "send_text_message",
    "Send a text message to the patient via WhatsApp. Use for responses, questions, and any text-based communication.",
    {"phone": str, "text": str}
)
async def send_text_message(args: Dict[str, Any]) -> Dict[str, Any]:
    """Send a text message to the patient via WhatsApp."""
    try:
        phone = ensure_phone_has_plus(args["phone"])
        text = args["text"]
        runtime = get_runtime()

        # GUARD: Never send HANDOFF instructions to user
        if "[HANDOFF:" in text.upper():
            logger.info(f"⚠️ Blocking HANDOFF instruction from being sent: {text[:50]}...")
            return {
                "content": [{"type": "text", "text": "Handoff instruction blocked - not sent to user"}]
            }

        # Send message using runtime's messaging function
        from src.utils.messaging import send_whatsapp_text
        result = await send_whatsapp_text(phone, text)

        # Log interaction
        runtime.db.log_conversation_message(
            runtime.clinic_id, phone, "text", text, source="agent"
        )

        return {
            "content": [{"type": "text", "text": f"Message sent successfully to {phone}"}]
        }

    except Exception as e:
        logger.error(f"Error in send_text_message: {e}")
        return {
            "content": [{"type": "text", "text": f"Error sending message: {str(e)}"}]
        }


@tool(
    "send_whatsapp_buttons",
    "Send a WhatsApp message with interactive quick reply buttons (up to 3 buttons). Use for greetings, menu options, yes/no questions, and any choice-based interactions.",
    {
        "phone": str,
        "body_text": str,
        "buttons": list,  # List of dicts with 'id' and 'title' keys
        "header_text": str,
        "footer_text": str
    }
)
async def send_whatsapp_buttons(args: Dict[str, Any]) -> Dict[str, Any]:
    """Send an interactive button message via WhatsApp."""
    try:
        phone = ensure_phone_has_plus(args["phone"])
        body_text = args["body_text"]
        buttons = args["buttons"]  # List of {'id': 'xxx', 'title': 'Button Text'}
        header_text = args.get("header_text")
        footer_text = args.get("footer_text")
        runtime = get_runtime()

        # Validate buttons
        if not buttons or len(buttons) == 0:
            return {
                "content": [{"type": "text", "text": "Error: At least one button is required"}]
            }

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

        # Log interaction
        runtime.db.log_conversation_message(
            runtime.clinic_id, phone, "interactive_buttons", body_text, source="agent"
        )

        return {
            "content": [{"type": "text", "text": f"Button message sent successfully to {phone}"}]
        }

    except Exception as e:
        logger.error(f"Error in send_whatsapp_buttons: {e}")
        return {
            "content": [{"type": "text", "text": f"Error sending buttons: {str(e)}"}]
        }


# ===== CLINIC INFO TOOLS =====

@tool(
    "get_clinic_info",
    "Get information about the clinic including address, opening hours, phone, and payment options.",
    {}
)
async def get_clinic_info(args: Dict[str, Any]) -> Dict[str, Any]:
    """Get clinic information."""
    try:
        runtime = get_runtime()
        clinic = runtime.db.get_clinic(runtime.clinic_id)

        if not clinic:
            return {
                "content": [{"type": "text", "text": "Informações da clínica não disponíveis."}]
            }

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

        return {
            "content": [{"type": "text", "text": "\n".join(lines)}]
        }

    except Exception as e:
        logger.error(f"Error in get_clinic_info: {e}")
        return {
            "content": [{"type": "text", "text": f"Erro ao obter informações: {str(e)}"}]
        }


@tool(
    "get_professionals",
    "Get list of professionals at the clinic. Can filter by service if specified.",
    {"service_id": str}  # Optional parameter
)
async def get_professionals(args: Dict[str, Any]) -> Dict[str, Any]:
    """Get list of professionals at the clinic."""
    try:
        runtime = get_runtime()
        service_id = args.get("service_id")
        professionals = runtime.db.get_clinic_professionals(runtime.clinic_id)

        if not professionals:
            return {
                "content": [{"type": "text", "text": "Não há profissionais cadastrados no momento."}]
            }

        # Filter by service if specified
        if service_id:
            professionals = [
                p for p in professionals
                if hasattr(p, 'services') and service_id in (p.services or [])
            ]
            if not professionals:
                return {
                    "content": [{"type": "text", "text": "Não há profissionais disponíveis para este serviço."}]
                }

        lines = ["👨‍⚕️ *Nossos Profissionais:*\n"]

        for prof in professionals:
            name = prof.full_name if hasattr(prof, 'full_name') else prof.name
            specialty = getattr(prof, 'specialty', '')
            prof_id = prof.id
            line = f"• *{name}* (ID: {prof_id})"
            if specialty:
                line += f" - {specialty}"
            lines.append(line)

        return {
            "content": [{"type": "text", "text": "\n".join(lines)}]
        }

    except Exception as e:
        logger.error(f"Error in get_professionals: {e}")
        return {
            "content": [{"type": "text", "text": f"Erro ao obter profissionais: {str(e)}"}]
        }


@tool(
    "get_services",
    "Get list of services offered by the clinic with duration and price.",
    {}
)
async def get_services(args: Dict[str, Any]) -> Dict[str, Any]:
    """Get list of services offered by the clinic."""
    try:
        runtime = get_runtime()
        services = runtime.db.get_clinic_services(runtime.clinic_id)

        if not services:
            return {
                "content": [{"type": "text", "text": "Não há serviços cadastrados no momento."}]
            }

        lines = ["🩺 *Serviços Disponíveis:*\n"]

        for service in services:
            name = service.get('name', 'Serviço')
            service_id = service.get('id', '')
            duration = service.get('duration', 30)
            price = service.get('price', 0)

            line = f"• *{name}* (ID: {service_id})"
            if duration:
                line += f" - {duration} min"
            if price and price > 0:
                price_formatted = f"R$ {price:.2f}".replace('.', ',')
                line += f" - {price_formatted}"
            lines.append(line)

        return {
            "content": [{"type": "text", "text": "\n".join(lines)}]
        }

    except Exception as e:
        logger.error(f"Error in get_services: {e}")
        return {
            "content": [{"type": "text", "text": f"Erro ao obter serviços: {str(e)}"}]
        }


# ===== SCHEDULING TOOLS =====

@tool(
    "get_available_slots",
    "Get available appointment slots for a professional. Returns time slots for the next 7 days by default.",
    {"professional_id": str, "date": str, "days_ahead": int}
)
async def get_available_slots(args: Dict[str, Any]) -> Dict[str, Any]:
    """Get available appointment slots for a professional."""
    try:
        runtime = get_runtime()
        professional_id = args["professional_id"]
        days_ahead = args.get("days_ahead", 7)

        from src.scheduler.availability import get_available_slots as fetch_slots, format_slots_for_display

        # Get professional name
        professional = runtime.db.get_professional(runtime.clinic_id, professional_id)
        prof_name = professional.full_name if professional else "Profissional"

        # Get available slots
        slots = fetch_slots(
            runtime.db,
            runtime.clinic_id,
            professional_id=professional_id,
            days_ahead=days_ahead
        )

        if not slots:
            return {
                "content": [{
                    "type": "text",
                    "text": f"Não há horários disponíveis para {prof_name} nos próximos {days_ahead} dias."
                }]
            }

        # Format slots for display
        formatted = format_slots_for_display(slots[:20], prof_name)
        return {
            "content": [{"type": "text", "text": formatted}]
        }

    except Exception as e:
        logger.error(f"Error in get_available_slots: {e}")
        return {
            "content": [{"type": "text", "text": f"Erro ao obter horários: {str(e)}"}]
        }


@tool(
    "create_appointment",
    "Create a new appointment. Requires professional_id, date (YYYY-MM-DD), time (HH:MM), and patient_name.",
    {
        "phone": str,
        "professional_id": str,
        "date": str,
        "time": str,
        "patient_name": str,
        "service_id": str,
        "payment_type": str,
        "convenio_name": str,
        "convenio_number": str
    }
)
async def create_appointment(args: Dict[str, Any]) -> Dict[str, Any]:
    """Create a new appointment."""
    try:
        runtime = get_runtime()
        phone = ensure_phone_has_plus(args["phone"])
        professional_id = args["professional_id"]
        date = args["date"]
        time = args["time"]
        patient_name = args["patient_name"]
        service_id = args.get("service_id")
        payment_type = args.get("payment_type", "particular")
        convenio_name = args.get("convenio_name")
        convenio_number = args.get("convenio_number")

        from src.scheduler.appointments import create_appointment as create_apt
        from src.scheduler.availability import get_professional_availability

        # Validate time slot is available
        available = get_professional_availability(
            runtime.db, runtime.clinic_id, professional_id, date
        )
        if time not in available:
            return {
                "content": [{
                    "type": "text",
                    "text": f"❌ O horário {time} não está mais disponível em {date}. Por favor, escolha outro horário."
                }]
            }

        # Get professional name
        professional = runtime.db.get_professional(runtime.clinic_id, professional_id)
        prof_name = professional.full_name if professional else "Profissional"

        # Get service price if specified
        total_cents = 0
        if service_id:
            services = runtime.db.get_clinic_services(runtime.clinic_id)
            service = next((s for s in services if s.get('id') == service_id), None)
            if service:
                total_cents = int(service.get('price', 0) * 100)

        # Get clinic's deposit percentage
        clinic = runtime.db.get_clinic(runtime.clinic_id)
        signal_percentage = clinic.signal_percentage if clinic else 0

        # Create the appointment
        appointment = create_apt(
            runtime.db,
            clinic_id=runtime.clinic_id,
            patient_phone=phone,
            professional_id=professional_id,
            date_str=date,
            time_str=time,
            patient_name=patient_name,
            professional_name=prof_name,
            service_id=service_id,
            payment_type=payment_type,
            convenio_name=convenio_name,
            convenio_number=convenio_number,
            total_cents=total_cents,
            signal_percentage=signal_percentage,
        )

        if appointment:
            # Format date for display
            dt = datetime.strptime(date, "%Y-%m-%d")
            day_names = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"]
            day_name = day_names[dt.weekday()]
            formatted_date = dt.strftime("%d/%m/%Y")

            return {
                "content": [{
                    "type": "text",
                    "text": (
                        f"✅ *Consulta agendada com sucesso!*\n\n"
                        f"📅 *{day_name}, {formatted_date}*\n"
                        f"🕐 *{time}*\n"
                        f"👨‍⚕️ *{prof_name}*\n"
                        f"👤 *Paciente:* {patient_name}\n\n"
                        f"Você receberá um lembrete antes da consulta."
                    )
                }]
            }
        else:
            return {
                "content": [{
                    "type": "text",
                    "text": "❌ Erro ao criar agendamento. Por favor, tente novamente."
                }]
            }

    except Exception as e:
        logger.error(f"Error in create_appointment: {e}")
        return {
            "content": [{"type": "text", "text": f"Erro ao criar agendamento: {str(e)}"}]
        }


@tool(
    "send_appointment_confirmation",
    "Send appointment confirmation message to the patient.",
    {"appointment_id": str}
)
async def send_appointment_confirmation(args: Dict[str, Any]) -> Dict[str, Any]:
    """Send appointment confirmation message to patient."""
    try:
        runtime = get_runtime()
        appointment_id = args["appointment_id"]

        # Get appointment details
        appointment = runtime.db.get_appointment(runtime.clinic_id, appointment_id)
        if not appointment:
            return {
                "content": [{"type": "text", "text": "Agendamento não encontrado."}]
            }

        # Get clinic info
        clinic = runtime.db.get_clinic(runtime.clinic_id)

        # Format confirmation message
        dt = datetime.strptime(appointment.date, "%Y-%m-%d")
        day_names = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"]
        day_name = day_names[dt.weekday()]
        formatted_date = dt.strftime("%d/%m/%Y")

        message = (
            f"📋 *Confirmação de Consulta*\n\n"
            f"📅 *{day_name}, {formatted_date}*\n"
            f"🕐 *{appointment.time}*\n"
            f"👨‍⚕️ *{appointment.professional_name}*\n"
        )

        if clinic and clinic.address:
            message += f"📍 *{clinic.address}*\n"

        message += "\n✅ Chegue 15 minutos antes do horário marcado."

        # Send the message
        from src.utils.messaging import send_whatsapp_text
        await send_whatsapp_text(appointment.patient_phone, message)

        return {
            "content": [{"type": "text", "text": "Confirmação enviada com sucesso."}]
        }

    except Exception as e:
        logger.error(f"Error in send_appointment_confirmation: {e}")
        return {
            "content": [{"type": "text", "text": f"Erro ao enviar confirmação: {str(e)}"}]
        }


# ===== APPOINTMENT MANAGEMENT TOOLS =====

@tool(
    "get_patient_appointments",
    "Get patient's upcoming appointments.",
    {"phone": str}
)
async def get_patient_appointments(args: Dict[str, Any]) -> Dict[str, Any]:
    """Get patient's upcoming appointments."""
    try:
        runtime = get_runtime()
        phone = ensure_phone_has_plus(args["phone"])

        from src.scheduler.appointments import get_appointments_by_phone

        appointments = get_appointments_by_phone(
            runtime.db, phone, runtime.clinic_id, include_past=False
        )

        if not appointments:
            return {
                "content": [{
                    "type": "text",
                    "text": "Você não tem consultas agendadas.\n\nDigite 'agendar' para marcar uma consulta!"
                }]
            }

        lines = ["📋 *Suas Consultas:*\n"]

        for apt in appointments[:5]:
            dt = datetime.strptime(apt.date, "%Y-%m-%d")
            formatted_date = dt.strftime("%d/%m")
            status_emoji = "✅" if apt.status.value in ['confirmed', 'confirmed_presence'] else "⏳"
            lines.append(f"{status_emoji} *{formatted_date} às {apt.time}* - {apt.professional_name} (ID: {apt.id})")

        return {
            "content": [{"type": "text", "text": "\n".join(lines)}]
        }

    except Exception as e:
        logger.error(f"Error in get_patient_appointments: {e}")
        return {
            "content": [{"type": "text", "text": f"Erro ao obter consultas: {str(e)}"}]
        }


@tool(
    "cancel_appointment",
    "Cancel an appointment.",
    {"appointment_id": str, "reason": str}
)
async def cancel_appointment(args: Dict[str, Any]) -> Dict[str, Any]:
    """Cancel an appointment."""
    try:
        runtime = get_runtime()
        appointment_id = args["appointment_id"]
        reason = args.get("reason", "Cancelado pelo paciente via WhatsApp")

        from src.scheduler.appointments import cancel_appointment as cancel_apt

        cancel_apt(runtime.db, appointment_id, reason)

        return {
            "content": [{
                "type": "text",
                "text": "❌ Consulta cancelada com sucesso.\n\nSe desejar agendar novamente, é só enviar uma mensagem!"
            }]
        }

    except Exception as e:
        logger.error(f"Error in cancel_appointment: {e}")
        return {
            "content": [{"type": "text", "text": f"Erro ao cancelar: {str(e)}"}]
        }


@tool(
    "reschedule_appointment",
    "Reschedule an appointment to a new date and time.",
    {"appointment_id": str, "new_date": str, "new_time": str}
)
async def reschedule_appointment(args: Dict[str, Any]) -> Dict[str, Any]:
    """Reschedule an appointment to a new date/time."""
    try:
        runtime = get_runtime()
        appointment_id = args["appointment_id"]
        new_date = args["new_date"]
        new_time = args["new_time"]

        from src.scheduler.appointments import reschedule_appointment as reschedule_apt
        from src.scheduler.availability import get_professional_availability

        # Get the appointment to find professional ID
        appointment = runtime.db.get_appointment(runtime.clinic_id, appointment_id)
        if not appointment:
            return {
                "content": [{"type": "text", "text": "Agendamento não encontrado."}]
            }

        # Check new slot availability
        available = get_professional_availability(
            runtime.db, runtime.clinic_id, appointment.professional_id, new_date
        )
        if new_time not in available:
            return {
                "content": [{
                    "type": "text",
                    "text": f"❌ O horário {new_time} não está disponível em {new_date}. Por favor, escolha outro horário."
                }]
            }

        # Reschedule
        reschedule_apt(runtime.db, appointment_id, new_date, new_time)

        # Format date for display
        dt = datetime.strptime(new_date, "%Y-%m-%d")
        day_names = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"]
        day_name = day_names[dt.weekday()]
        formatted_date = dt.strftime("%d/%m/%Y")

        return {
            "content": [{
                "type": "text",
                "text": (
                    f"🔄 *Consulta reagendada com sucesso!*\n\n"
                    f"📅 *{day_name}, {formatted_date}*\n"
                    f"🕐 *{new_time}*\n"
                    f"👨‍⚕️ *{appointment.professional_name}*\n\n"
                    f"Te esperamos!"
                )
            }]
        }

    except Exception as e:
        logger.error(f"Error in reschedule_appointment: {e}")
        return {
            "content": [{"type": "text", "text": f"Erro ao reagendar: {str(e)}"}]
        }


# ===== SUPPORT TOOLS =====

@tool(
    "enable_human_takeover",
    "Enable human takeover for a conversation when the AI cannot handle the request. Use for complaints, billing issues, medical questions, or when patient explicitly asks for a human.",
    {"phone": str, "reason": str}
)
async def enable_human_takeover(args: Dict[str, Any]) -> Dict[str, Any]:
    """Enable human takeover for a conversation."""
    try:
        runtime = get_runtime()
        phone = ensure_phone_has_plus(args["phone"])
        reason = args["reason"]

        # Enable human takeover in Firestore
        runtime.db.enable_human_takeover(runtime.clinic_id, phone, reason)

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

        logger.info(f"👋 Human takeover enabled for {phone}: {reason}")
        return {
            "content": [{
                "type": "text",
                "text": f"Human takeover enabled for {phone}. Reason: {reason}"
            }]
        }

    except Exception as e:
        logger.error(f"Error enabling human takeover: {e}")
        return {
            "content": [{"type": "text", "text": f"Error enabling human takeover: {str(e)}"}]
        }


# ===== MCP SERVER CREATION =====

def create_gendei_tools_server():
    """
    Create an SDK MCP server with all Gendei tools.

    Returns:
        MCP server instance with all tools configured.
    """
    return create_sdk_mcp_server(
        name="gendei-clinic-tools",
        version="1.0.0",
        tools=[
            # Messaging
            send_text_message,
            send_whatsapp_buttons,
            # Clinic info
            get_clinic_info,
            get_professionals,
            get_services,
            # Scheduling
            get_available_slots,
            create_appointment,
            send_appointment_confirmation,
            # Appointment management
            get_patient_appointments,
            cancel_appointment,
            reschedule_appointment,
            # Support
            enable_human_takeover,
        ]
    )


# List of all tool names for reference
ALL_TOOL_NAMES = [
    "mcp__gendei-clinic-tools__send_text_message",
    "mcp__gendei-clinic-tools__send_whatsapp_buttons",
    "mcp__gendei-clinic-tools__get_clinic_info",
    "mcp__gendei-clinic-tools__get_professionals",
    "mcp__gendei-clinic-tools__get_services",
    "mcp__gendei-clinic-tools__get_available_slots",
    "mcp__gendei-clinic-tools__create_appointment",
    "mcp__gendei-clinic-tools__send_appointment_confirmation",
    "mcp__gendei-clinic-tools__get_patient_appointments",
    "mcp__gendei-clinic-tools__cancel_appointment",
    "mcp__gendei-clinic-tools__reschedule_appointment",
    "mcp__gendei-clinic-tools__enable_human_takeover",
]
