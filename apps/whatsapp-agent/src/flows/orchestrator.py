"""Flow orchestration layer extracted from main.py.

Keeps WhatsApp Flow scheduling logic outside transport/webhook code.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any, Awaitable, Callable, Dict, Optional

from src.vertical_config import ALL_SPECIALTIES

logger = logging.getLogger(__name__)


@dataclass
class FlowOrchestrationDeps:
    db: Any
    send_whatsapp_message: Callable[[str, str, str, str], Awaitable[Any]]
    send_whatsapp_buttons: Callable[[str, str, str, Any, str], Awaitable[Any]]
    send_whatsapp_flow: Callable[..., Awaitable[bool]]
    send_booking_flow: Callable[..., Awaitable[bool]]
    generate_flow_token: Callable[[str, str], str]
    send_whatsapp_contact_card: Callable[..., Awaitable[Any]]
    run_agent_response: Callable[..., Awaitable[Any]]
    get_available_slots: Callable[..., Any]
    get_clinic_min_lead_time: Callable[[str], int]
    filter_slots_by_lead_time: Callable[[Any, int], Any]
    create_appointment: Callable[..., Any]
    set_runtime: Callable[[Any], Any]
    reset_runtime: Callable[[Any], None]
    runtime_cls: Any
    resolve_consultation_pricing: Callable[[str, Any, str], Dict[str, int]]


async def handle_flow_completion(
    deps: FlowOrchestrationDeps,
    clinic_id: str,
    phone: str,
    flow_response: Dict[str, Any],
    phone_number_id: str,
    access_token: str,
    contact_name: str = "",
) -> None:
    """Handle WhatsApp Flow completion response.

    Flow 1 completion (Patient Info) -> Send Flow 2 (Booking)
    Flow 2 completion (Booking) -> Create appointment
    """
    logger.info(f"🔄 Processing flow completion for {phone}: {flow_response}")

    has_patient_info = "nome" in flow_response and "email" in flow_response
    has_booking = "date" in flow_response and "time" in flow_response

    if has_patient_info and not has_booking:
        logger.info("📋 Flow 1 completed, sending Booking flow...")

        booking_flow_id = None
        if deps.db:
            clinic = deps.db.get_clinic(clinic_id)
            if clinic:
                whatsapp_config = getattr(clinic, "whatsapp_config", {}) or {}
                booking_flow_id = whatsapp_config.get("bookingFlowId", "")
                logger.info(f"📱 Using clinic-specific booking flow ID: {booking_flow_id}")

        if not booking_flow_id:
            logger.warning("⚠️ No booking flow ID configured (not in clinic config or env var)")
            await deps.send_whatsapp_message(
                phone_number_id,
                phone,
                f"Obrigado {flow_response.get('nome', '')}! 📋\n\n"
                "Seus dados foram recebidos. Um atendente entrará em contato para "
                "confirmar data e horário da sua consulta.\n\n"
                f"Profissional: {flow_response.get('professional_name', '')}\n"
                f"Especialidade: {flow_response.get('specialty_name', '')}",
                access_token,
            )
            return

        professional_id = flow_response.get("professional_id", "")
        professional_name = flow_response.get("professional_name", "")
        specialty_name = flow_response.get("specialty_name", "")
        patient_name = flow_response.get("nome", "")
        patient_email = flow_response.get("email", "")

        available_times = []
        if deps.db and professional_id:
            today = datetime.now()
            min_date = (today + timedelta(days=1)).strftime("%Y-%m-%d")
            max_date = (today + timedelta(days=30)).strftime("%Y-%m-%d")

            slots = deps.get_available_slots(
                deps.db,
                clinic_id,
                professional_id=professional_id,
                start_date=min_date,
                end_date=max_date,
            )

            min_lead_hours = deps.get_clinic_min_lead_time(clinic_id)
            if slots and min_lead_hours > 0:
                slots = deps.filter_slots_by_lead_time(slots, min_lead_hours)

            time_set = set()
            for slot in slots:
                time_str = slot.time if hasattr(slot, "time") else slot.get("time", "")
                if time_str:
                    time_set.add(time_str)

            available_times = [{"id": t, "title": t} for t in sorted(time_set)][:20]

        if not available_times:
            if deps.db and professional_id:
                await deps.send_whatsapp_message(
                    phone_number_id,
                    phone,
                    "No momento não há horários disponíveis para esse profissional. "
                    "Posso verificar outra data ou outro profissional?",
                    access_token,
                )
                return
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

        today = datetime.now()
        min_date = (today + timedelta(days=1)).strftime("%Y-%m-%d")
        max_date = (today + timedelta(days=30)).strftime("%Y-%m-%d")

        flow_token = deps.generate_flow_token(clinic_id, phone)

        await deps.send_whatsapp_message(
            phone_number_id,
            phone,
            "Agora escolha o melhor dia e horário para sua consulta.",
            access_token,
        )

        success = await deps.send_booking_flow(
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
            tipo_pagamento = flow_response.get("tipo_pagamento", "particular")
            convenio_nome = flow_response.get("convenio_nome", "")
            if deps.db:
                deps.db.save_conversation_state(
                    clinic_id,
                    phone,
                    {
                        "state": "in_booking_flow",
                        "professional_id": professional_id,
                        "professional_name": professional_name,
                        "patient_name": patient_name,
                        "patient_email": patient_email,
                        "tipo_pagamento": tipo_pagamento,
                        "convenio_nome": convenio_nome,
                    },
                )
        else:
            logger.error(f"❌ Failed to send booking flow to {phone}")
            await deps.send_whatsapp_message(
                phone_number_id,
                phone,
                "Desculpe, ocorreu um erro ao carregar os horários. "
                "Por favor, tente novamente.",
                access_token,
            )
        return

    if has_booking:
        logger.info("📅 Flow 2 completed, creating appointment...")

        professional_id = flow_response.get("professional_id", "")
        professional_name = flow_response.get("doctor_name", "")
        patient_name = flow_response.get("patient_name", "")
        patient_email = flow_response.get("patient_email", "")
        selected_date = flow_response.get("date", "")
        selected_time = flow_response.get("time", "")

        tipo_pagamento = "particular"
        convenio_nome = ""
        if deps.db:
            conv_state = deps.db.get_conversation_state(clinic_id, phone)
            if conv_state:
                tipo_pagamento = conv_state.get("tipo_pagamento", "particular")
                convenio_nome = conv_state.get("convenio_nome", "")

        logger.info(f"💳 Payment type: {tipo_pagamento}, Convenio: {convenio_nome}")

        clinic = deps.db.get_clinic(clinic_id) if deps.db else None
        signal_percentage = 15
        default_price_cents = 20000
        if clinic:
            pricing = deps.resolve_consultation_pricing(clinic_id, clinic, professional_id=professional_id)
            signal_percentage = pricing["signal_percentage"]
            default_price_cents = pricing["default_price_cents"]
            logger.info(
                f"💰 Pricing resolved: price={default_price_cents} cents, signal={signal_percentage}%"
            )

        try:
            dt = datetime.strptime(selected_date, "%Y-%m-%d")
            formatted_date = dt.strftime("%d/%m/%Y")
            weekday_names = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"]
            weekday = weekday_names[dt.weekday()]
        except ValueError:
            formatted_date = selected_date
            weekday = ""

        try:
            appointment = deps.create_appointment(
                db=deps.db,
                clinic_id=clinic_id,
                patient_phone=phone,
                professional_id=professional_id,
                date_str=selected_date,
                time_str=selected_time,
                patient_name=patient_name,
                patient_email=patient_email,
                professional_name=professional_name,
                duration_minutes=30,
                payment_type=tipo_pagamento,
                total_cents=default_price_cents if tipo_pagamento == "particular" else 0,
                signal_percentage=signal_percentage,
                convenio_name=convenio_nome if tipo_pagamento == "convenio" else None,
            )

            if not appointment:
                await deps.send_whatsapp_message(
                    phone_number_id,
                    phone,
                    "Desculpe, esse horário acabou de ficar indisponível. "
                    "Posso verificar outro horário para você?",
                    access_token,
                )
                return

            logger.info(f"✅ Appointment created: {appointment.id}")

            needs_payment = (
                tipo_pagamento == "particular"
                and appointment
                and appointment.signal_cents > 0
            )

            if needs_payment:
                from src.utils.payment import format_payment_amount

                logger.info(f"💰 Signal required: {format_payment_amount(appointment.signal_cents)}")
                confirmation_msg = (
                    f"*Agendamento registrado*\n\n"
                    f"{weekday}, {formatted_date} às {selected_time}\n"
                    f"{professional_name}\n"
                    f"Paciente: {patient_name}\n\n"
                    f"*Sinal necessário:* {format_payment_amount(appointment.signal_cents)}\n\n"
                    "Escolha como deseja pagar o sinal para confirmar sua consulta.\n"
                    "A reserva deste horário fica ativa por 15 minutos."
                )
                await deps.send_whatsapp_message(phone_number_id, phone, confirmation_msg, access_token)

                if deps.db:
                    current_state = deps.db.load_conversation_state(clinic_id, phone)
                    current_state["state"] = "awaiting_payment_method"
                    current_state["clinic_id"] = clinic_id
                    current_state["current_appointment_id"] = appointment.id
                    current_state["current_appointment_date"] = appointment.date
                    current_state["current_appointment_time"] = appointment.time
                    current_state["current_appointment_professional"] = appointment.professional_name
                    current_state["current_appointment_professional_id"] = appointment.professional_id
                    deps.db.save_conversation_state(clinic_id, phone, current_state)

                from src.utils.payment import get_payment_method_buttons, is_only_card
                if is_only_card():
                    from src.main import handle_payment_method_selection
                    await handle_payment_method_selection(
                        clinic_id=clinic_id,
                        phone=phone,
                        payment_method="card",
                        phone_number_id=phone_number_id,
                        access_token=access_token,
                        state=current_state if deps.db else {},
                    )
                else:
                    await deps.send_whatsapp_buttons(
                        phone_number_id,
                        phone,
                        "Escolha o método de pagamento do sinal:",
                        get_payment_method_buttons(),
                        access_token,
                    )
            else:
                confirmation_msg = (
                    f"*Agendamento confirmado*\n\n"
                    f"{weekday}, {formatted_date} às {selected_time}\n"
                    f"{professional_name}\n"
                    f"Paciente: {patient_name}\n"
                )
                if tipo_pagamento == "convenio" and convenio_nome:
                    confirmation_msg += f"Convênio: {convenio_nome}\n"
                confirmation_msg += (
                    "\nVocê receberá um lembrete 24h antes da consulta.\n\n"
                    "Para cancelar ou reagendar, basta enviar uma mensagem!"
                )
                await deps.send_whatsapp_message(phone_number_id, phone, confirmation_msg, access_token)

            if deps.db:
                deps.db.save_conversation_state(clinic_id, phone, {"state": "idle"})

        except Exception as e:
            logger.error(f"❌ Failed to create appointment: {e}")
            await deps.send_whatsapp_message(
                phone_number_id,
                phone,
                "Desculpe, ocorreu um erro ao confirmar o agendamento. "
                "Por favor, tente novamente ou entre em contato conosco.",
                access_token,
            )
        return

    logger.warning(f"⚠️ Unknown flow response format: {flow_response}")


async def handle_payment_type_selection(
    deps: FlowOrchestrationDeps,
    clinic_id: str,
    phone: str,
    button_payload: str,
    state: Dict[str, Any],
    phone_number_id: str,
    access_token: str,
) -> None:
    """Handle payment type selection and send the appropriate WhatsApp Flow."""

    if state.get("state") != "awaiting_payment_type":
        logger.warning(f"⚠️ Unexpected payment type selection, state: {state.get('state')}")
        await deps.send_whatsapp_message(
            phone_number_id,
            phone,
            "Por favor, inicie o agendamento novamente.",
            access_token,
        )
        return

    convenio_flow_id = state.get("convenio_flow_id", "")
    particular_flow_id = state.get("particular_flow_id", "")
    especialidades = state.get("especialidades", [])

    if button_payload == "payment_convenio":
        flow_id_to_use = convenio_flow_id
        payment_type = "convenio"
    else:
        flow_id_to_use = particular_flow_id
        payment_type = "particular"

    if not flow_id_to_use:
        logger.error(f"❌ No flow ID configured for {payment_type}")
        await deps.send_whatsapp_message(
            phone_number_id,
            phone,
            "Desculpe, o sistema de agendamento não está configurado corretamente. Por favor, entre em contato conosco.",
            access_token,
        )
        return

    logger.info(f"📱 Sending {payment_type} flow (ID: {flow_id_to_use}) to {phone}")

    flow_token = deps.generate_flow_token(clinic_id, phone)

    initial_data = {
        "especialidades": especialidades,
        "error_message": "",
    }

    clinic = deps.db.get_clinic(clinic_id) if deps.db else None
    clinic_name = clinic.name if clinic else "a clínica"

    await deps.send_whatsapp_message(
        phone_number_id,
        phone,
        "Vamos iniciar seu agendamento.\nEscolha o profissional e, quando aplicável, o tipo de atendimento.",
        access_token,
    )

    success = await deps.send_whatsapp_flow(
        phone_number_id=phone_number_id,
        to=phone,
        flow_id=flow_id_to_use,
        flow_token=flow_token,
        flow_cta="Agendar Consulta",
        header_text="Seus Dados",
        body_text=f"Preencha seus dados para agendar sua consulta na *{clinic_name}*",
        access_token=access_token,
        flow_action="navigate",
        initial_screen="ESPECIALIDADE",
        initial_data=initial_data,
    )

    if success:
        new_state = {
            "state": "in_patient_info_flow",
            "flow_token": flow_token,
            "clinic_id": clinic_id,
            "payment_type": payment_type,
        }
        if deps.db:
            deps.db.save_conversation_state(clinic_id, phone, new_state)
        logger.info(f"✅ {payment_type.capitalize()} flow sent to {phone}")
    else:
        logger.error(f"❌ Failed to send {payment_type} flow to {phone}")
        await deps.send_whatsapp_message(
            phone_number_id,
            phone,
            "Desculpe, ocorreu um erro ao iniciar o agendamento. Por favor, tente novamente.",
            access_token,
        )


async def handle_scheduling_intent(
    deps: FlowOrchestrationDeps,
    clinic_id: str,
    phone: str,
    message: str,
    phone_number_id: str,
    access_token: str,
    contact_name: Optional[str] = None,
) -> None:
    """Handle appointment scheduling intent with interactive WhatsApp flows."""
    clinic = deps.db.get_clinic(clinic_id)
    if not clinic:
        await deps.send_whatsapp_message(
            phone_number_id,
            phone,
            "Desculpe, não consegui encontrar as informações da clínica.",
            access_token,
        )
        return

    workflow_mode = getattr(clinic, "workflow_mode", "booking")
    if workflow_mode == "info":
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

        await deps.send_whatsapp_message(
            phone_number_id,
            phone,
            info_message,
            access_token,
        )

        if clinic_phone:
            await deps.send_whatsapp_contact_card(
                phone_number_id,
                phone,
                contact_name=clinic_name,
                contact_phone=clinic_phone,
                contact_email=getattr(clinic, "email", None),
                organization=clinic_name,
                access_token=access_token,
            )
        return

    professionals = deps.db.get_clinic_professionals(clinic_id)

    whatsapp_config = clinic.whatsapp_config or {}
    convenio_flow_id = whatsapp_config.get("patientInfoConvenioFlowId", "")
    particular_flow_id = whatsapp_config.get("patientInfoParticularFlowId", "")
    legacy_patient_info_flow_id = whatsapp_config.get("patientInfoFlowId", "")
    booking_flow_id = whatsapp_config.get("bookingFlowId", "")

    has_legacy_flow = bool(legacy_patient_info_flow_id)

    payment_settings = getattr(clinic, "payment_settings", {}) or {}
    accepts_particular = bool(payment_settings.get("acceptsParticular", True))
    accepts_convenio = bool(payment_settings.get("acceptsConvenio", False))

    requires_particular_flow = accepts_particular
    requires_convenio_flow = accepts_convenio
    has_required_new_flows = (
        (not requires_particular_flow or bool(particular_flow_id))
        and (not requires_convenio_flow or bool(convenio_flow_id))
    )

    has_new_flows = has_required_new_flows

    logger.info(
        f"🔍 Flow IDs for clinic {clinic_id}: "
        f"convenio={convenio_flow_id or 'N/A'}, "
        f"particular={particular_flow_id or 'N/A'}, "
        f"legacy={legacy_patient_info_flow_id or 'N/A'}, "
        f"booking={booking_flow_id or 'N/A'}"
    )
    logger.info(
        f"🔍 Payment settings: acceptsParticular={accepts_particular}, "
        f"acceptsConvenio={accepts_convenio}, has_required_new_flows={has_required_new_flows}"
    )
    logger.info(f"🔍 Clinic whatsapp_config: {whatsapp_config}")

    if has_new_flows and professionals:
        logger.info("📱 Using WhatsApp Flows for scheduling")

        especialidades = []
        for prof in professionals:
            specialties = getattr(prof, "specialties", []) or []
            specialty = specialties[0] if specialties else (getattr(prof, "specialty", "") or "")
            specialty_name = ALL_SPECIALTIES.get(specialty, specialty) if specialty else "Especialista"
            prof_name = (prof.full_name or prof.name or "")[:72]
            especialidades.append(
                {
                    "id": prof.id,
                    "title": specialty_name[:24],
                    "description": prof_name,
                }
            )

        new_state = {
            "state": "awaiting_payment_type",
            "clinic_id": clinic_id,
            "especialidades": especialidades[:10],
            "convenio_flow_id": convenio_flow_id,
            "particular_flow_id": particular_flow_id,
        }
        if deps.db:
            deps.db.save_conversation_state(clinic_id, phone, new_state)

        if accepts_particular and not accepts_convenio:
            logger.info("💳 Clinic is PARTICULAR-only. Sending particular flow directly.")
            await handle_payment_type_selection(
                deps,
                clinic_id,
                phone,
                "payment_particular",
                new_state,
                phone_number_id,
                access_token,
            )
            return

        if accepts_convenio and not accepts_particular:
            logger.info("💳 Clinic is CONVENIO-only. Sending convenio flow directly.")
            await handle_payment_type_selection(
                deps,
                clinic_id,
                phone,
                "payment_convenio",
                new_state,
                phone_number_id,
                access_token,
            )
            return

        if not accepts_particular and not accepts_convenio:
            logger.warning("⚠️ No payment mode enabled in clinic settings; asking user payment type as fallback.")

        buttons = [
            {"id": "payment_convenio", "title": "Convênio"},
            {"id": "payment_particular", "title": "Particular"},
        ]

        await deps.send_whatsapp_buttons(
            phone_number_id,
            phone,
            f"Como você prefere pagar sua consulta na *{clinic.name}*?",
            buttons,
            access_token,
        )
        logger.info(f"✅ Payment type buttons sent to {phone}")
        return

    if has_legacy_flow and professionals:
        logger.info(f"📱 Using legacy patient info flow for scheduling (ID: {legacy_patient_info_flow_id})")

        especialidades = []
        for prof in professionals:
            specialties = getattr(prof, "specialties", []) or []
            specialty = specialties[0] if specialties else (getattr(prof, "specialty", "") or "")
            specialty_name = ALL_SPECIALTIES.get(specialty, specialty) if specialty else "Especialista"
            prof_name = (prof.full_name or prof.name or "")[:72]
            especialidades.append(
                {
                    "id": prof.id,
                    "title": specialty_name[:24],
                    "description": prof_name,
                }
            )

        flow_token = deps.generate_flow_token(clinic_id, phone)
        initial_data = {
            "especialidades": especialidades[:10],
            "error_message": "",
        }

        success = await deps.send_whatsapp_flow(
            phone_number_id=phone_number_id,
            to=phone,
            flow_id=legacy_patient_info_flow_id,
            flow_token=flow_token,
            flow_cta="Agendar Consulta",
            header_text="Seus Dados",
            body_text=f"Preencha seus dados para agendar sua consulta na *{clinic.name}*",
            access_token=access_token,
            flow_action="navigate",
            initial_screen="ESPECIALIDADE",
            initial_data=initial_data,
        )

        if success and deps.db:
            deps.db.save_conversation_state(
                clinic_id,
                phone,
                {
                    "state": "in_patient_info_flow",
                    "flow_token": flow_token,
                    "clinic_id": clinic_id,
                },
            )
            logger.info(f"✅ Legacy patient info flow sent to {phone}")
            return

        logger.warning("⚠️ Legacy flow send failed, falling back to agent scheduling")

    if not professionals:
        await deps.send_whatsapp_message(
            phone_number_id,
            phone,
            "Desculpe, não há profissionais disponíveis no momento.",
            access_token,
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
