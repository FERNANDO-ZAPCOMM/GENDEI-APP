"""
WhatsApp Flows Handler for Gendei
Handles dynamic flow data endpoints for appointment scheduling

Two Flows:
1. Patient Info Flow (ESPECIALIDADE → TIPO_ATENDIMENTO → INFO_CONVENIO → DADOS_PACIENTE → CONFIRMACAO)
2. Booking Flow (BOOKING - date picker + time dropdown)
"""

import logging
from typing import Any, Dict, List, Optional
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

# Specialties mapping for clinica_medica category
CLINICA_MEDICA_SPECIALTIES = {
    "clinico_geral": "Clínico Geral",
    "cardiologia": "Cardiologia",
    "dermatologia": "Dermatologia",
    "dermatologia_clinica": "Dermatologia Clínica",
    "dermatologia_cirurgica": "Dermatologia Cirúrgica",
    "cosmiatria": "Cosmiatria",
    "dermatologia_oncologica": "Dermatologia Oncológica",
    "endocrinologia": "Endocrinologia",
    "gastroenterologia": "Gastroenterologia",
    "geriatria": "Geriatria",
    "ginecologia": "Ginecologia",
    "neurologia": "Neurologia",
    "oftalmologia": "Oftalmologia",
    "ortopedia": "Ortopedia",
    "otorrinolaringologia": "Otorrinolaringologia",
    "pediatria": "Pediatria",
    "pneumologia": "Pneumologia",
    "psiquiatria": "Psiquiatria",
    "reumatologia": "Reumatologia",
    "urologia": "Urologia",
}

# Default convenios list
DEFAULT_CONVENIOS = [
    {"id": "unimed", "title": "Unimed"},
    {"id": "bradesco_saude", "title": "Bradesco Saúde"},
    {"id": "sulamerica", "title": "SulAmérica"},
    {"id": "amil", "title": "Amil"},
    {"id": "notredame", "title": "NotreDame Intermédica"},
    {"id": "hapvida", "title": "Hapvida"},
    {"id": "porto_seguro", "title": "Porto Seguro Saúde"},
    {"id": "outro", "title": "Outro"},
]


class FlowsHandler:
    """Handles WhatsApp Flows data exchange requests."""

    def __init__(self, db):
        self.db = db

    async def handle_request(
        self,
        action: str,
        screen: Optional[str],
        data: Dict[str, Any],
        flow_token: str,
        clinic_id: str,
    ) -> Dict[str, Any]:
        """
        Main entry point for flow requests.

        Args:
            action: INIT, data_exchange, or BACK
            screen: Current screen ID
            data: User submitted data
            flow_token: Session token
            clinic_id: The clinic ID

        Returns:
            Response dict with screen and data
        """
        logger.info(f"Flow request: action={action}, screen={screen}, clinic={clinic_id}")
        logger.info(f"Flow data: {data}")

        if action == "ping":
            return {"data": {"status": "active"}}

        if action == "INIT":
            return await self._handle_init(clinic_id, flow_token, data)

        if action == "data_exchange":
            return await self._handle_data_exchange(clinic_id, screen, data, flow_token)

        if action == "BACK":
            return await self._handle_back(screen, data)

        # Unknown action
        logger.warning(f"Unknown flow action: {action}")
        return {"data": {"acknowledged": True}}

    async def _handle_init(
        self,
        clinic_id: str,
        flow_token: str,
        initial_data: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Handle INIT action - return initial screen with dynamic data."""

        # Check which flow this is based on initial_data
        flow_type = initial_data.get("flow_type", "patient_info")

        if flow_type == "booking":
            return await self._init_booking_flow(clinic_id, initial_data)
        else:
            return await self._init_patient_info_flow(clinic_id, initial_data)

    async def _init_patient_info_flow(
        self,
        clinic_id: str,
        initial_data: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Initialize the Patient Info flow - show specialties/professionals."""

        # Get clinic professionals
        professionals = await self._get_clinic_professionals(clinic_id)

        if not professionals:
            return {
                "screen": "ESPECIALIDADE",
                "data": {
                    "especialidades": [
                        {"id": "none", "title": "Sem profissionais", "description": "Nenhum disponível"}
                    ],
                    "error_message": "Nenhum profissional disponível no momento."
                }
            }

        # Build specialty options (each professional = one specialty option)
        # Group by specialty or show individual professionals
        especialidades = []
        for prof in professionals:
            # Professional is a dataclass, use attribute access
            specialty_id = getattr(prof, 'specialty', 'clinico_geral') or 'clinico_geral'
            specialty_name = CLINICA_MEDICA_SPECIALTIES.get(specialty_id, specialty_id)
            prof_name = getattr(prof, 'name', '') or getattr(prof, 'full_name', '') or ''
            especialidades.append({
                "id": getattr(prof, 'id', ''),  # Use professional ID as the specialty selection ID
                "title": specialty_name,
                "description": prof_name
            })

        logger.info(f"📋 Returning {len(especialidades)} especialidades for clinic {clinic_id}")

        return {
            "screen": "ESPECIALIDADE",
            "data": {
                "especialidades": especialidades[:10],  # Max 10 options for RadioButtonsGroup
                "error_message": ""
            }
        }

    async def _init_booking_flow(
        self,
        clinic_id: str,
        initial_data: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Initialize the Booking flow - show date picker and times."""

        professional_id = initial_data.get("professional_id")
        professional_name = initial_data.get("professional_name", "")
        specialty_name = initial_data.get("specialty_name", "")

        # Get available times for the professional
        available_times = await self._get_available_times(clinic_id, professional_id)

        # Calculate date range
        today = datetime.now()
        min_date = (today + timedelta(days=1)).strftime("%Y-%m-%d")
        max_date = (today + timedelta(days=30)).strftime("%Y-%m-%d")

        return {
            "screen": "BOOKING",
            "data": {
                "doctor_name": professional_name,
                "specialty_name": specialty_name,
                "available_times": available_times,
                "min_date": min_date,
                "max_date": max_date,
                "error_message": ""
            }
        }

    async def _handle_data_exchange(
        self,
        clinic_id: str,
        screen: str,
        data: Dict[str, Any],
        flow_token: str,
    ) -> Dict[str, Any]:
        """Handle data_exchange action - process user selection and return next screen."""

        # Flow 1: Patient Info Flow screens
        if screen == "ESPECIALIDADE":
            return await self._handle_especialidade_selection(clinic_id, data)

        if screen == "TIPO_ATENDIMENTO":
            return await self._handle_tipo_atendimento(clinic_id, data)

        if screen == "INFO_CONVENIO":
            return await self._handle_info_convenio(clinic_id, data)

        if screen == "DADOS_PACIENTE":
            return await self._handle_dados_paciente(clinic_id, data)

        # Flow 2: Booking Flow
        if screen == "BOOKING":
            return await self._handle_booking(clinic_id, data, flow_token)

        logger.warning(f"Unknown screen: {screen}")
        return {"data": {"acknowledged": True}}

    async def _handle_back(
        self,
        screen: str,
        data: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Handle BACK action - return previous screen."""

        # Flow 1 screen order
        flow1_screens = [
            "ESPECIALIDADE",
            "TIPO_ATENDIMENTO",
            "INFO_CONVENIO",
            "DADOS_PACIENTE",
            "CONFIRMACAO"
        ]

        try:
            current_idx = flow1_screens.index(screen)
            if current_idx > 0:
                prev_screen = flow1_screens[current_idx - 1]
                return {
                    "screen": prev_screen,
                    "data": data
                }
        except ValueError:
            pass

        return {
            "screen": "ESPECIALIDADE",
            "data": data
        }

    async def _get_clinic_professionals(self, clinic_id: str) -> List[Dict[str, Any]]:
        """Get active professionals for a clinic."""
        if not self.db:
            return []

        professionals = self.db.get_professionals(clinic_id)
        # Filter active professionals with working hours (Professional is a dataclass)
        return [
            p for p in professionals
            if getattr(p, 'active', True) and getattr(p, 'working_hours', None)
        ]

    async def _get_clinic_convenios(self, clinic_id: str) -> List[Dict[str, str]]:
        """Get accepted convenios for a clinic."""
        if not self.db:
            return DEFAULT_CONVENIOS

        clinic = self.db.get_clinic(clinic_id)
        if not clinic:
            return DEFAULT_CONVENIOS

        # Check if clinic has payment settings with convenio list (Clinic is a dataclass)
        payment_settings = getattr(clinic, 'payment_settings', {}) or {}
        convenio_list = payment_settings.get("convenioList", [])

        if convenio_list:
            return [{"id": c, "title": c} for c in convenio_list]

        return DEFAULT_CONVENIOS

    async def _get_available_times(
        self,
        clinic_id: str,
        professional_id: str,
    ) -> List[Dict[str, str]]:
        """Get available time slots for a professional."""

        if not self.db or not professional_id:
            # Return default times if no professional
            return [
                {"id": "08:00", "title": "08:00"},
                {"id": "09:00", "title": "09:00"},
                {"id": "10:00", "title": "10:00"},
                {"id": "11:00", "title": "11:00"},
                {"id": "14:00", "title": "14:00"},
                {"id": "15:00", "title": "15:00"},
                {"id": "16:00", "title": "16:00"},
                {"id": "17:00", "title": "17:00"},
            ]

        professional = self.db.get_professional(clinic_id, professional_id)
        if not professional:
            return []

        # Get working hours and generate time slots (professional is a dataclass)
        working_hours = getattr(professional, 'working_hours', {}) or {}
        duration = getattr(professional, 'appointment_duration', 30) or 30

        # Generate slots based on working hours
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

        # Sort and format
        sorted_times = sorted(list(time_slots))
        return [{"id": t, "title": t} for t in sorted_times[:20]]  # Max 20 times

    # ============================================
    # FLOW 1: Patient Info Flow Handlers
    # ============================================

    async def _handle_especialidade_selection(
        self,
        clinic_id: str,
        data: Dict[str, Any],
    ) -> Dict[str, Any]:
        """User selected a specialty/professional - show payment type options."""

        professional_id = data.get("especialidade")
        if not professional_id:
            return {
                "screen": "ESPECIALIDADE",
                "data": {
                    **data,
                    "error_message": "Por favor, selecione uma especialidade."
                }
            }

        # Get professional info
        professional = self.db.get_professional(clinic_id, professional_id) if self.db else None
        if not professional:
            return {
                "screen": "ESPECIALIDADE",
                "data": {
                    **data,
                    "error_message": "Profissional não encontrado."
                }
            }

        # Professional is a dataclass, use attribute access
        specialty_id = getattr(professional, 'specialty', '') or ''
        specialty_name = CLINICA_MEDICA_SPECIALTIES.get(specialty_id, specialty_id)
        professional_name = getattr(professional, 'name', '') or getattr(professional, 'full_name', '') or ''

        # Payment type options
        tipos_pagamento = [
            {"id": "convenio", "title": "Convênio", "description": "Tenho plano de saúde"},
            {"id": "particular", "title": "Particular", "description": "Pagamento direto (PIX/Cartão)"},
        ]

        return {
            "screen": "TIPO_ATENDIMENTO",
            "data": {
                "especialidade": professional_id,
                "professional_id": professional_id,
                "professional_name": professional_name,
                "specialty_name": specialty_name,
                "tipos_pagamento": tipos_pagamento,
                "error_message": ""
            }
        }

    async def _handle_tipo_atendimento(
        self,
        clinic_id: str,
        data: Dict[str, Any],
    ) -> Dict[str, Any]:
        """User selected payment type - show convenio info form."""

        tipo_pagamento = data.get("tipo_pagamento")
        if not tipo_pagamento:
            return {
                "screen": "TIPO_ATENDIMENTO",
                "data": {
                    **data,
                    "error_message": "Por favor, selecione o tipo de atendimento."
                }
            }

        # Get clinic's accepted convenios
        convenios = await self._get_clinic_convenios(clinic_id)

        # Determine if we should show convenio fields
        show_convenio_fields = tipo_pagamento == "convenio"

        return {
            "screen": "INFO_CONVENIO",
            "data": {
                "especialidade": data.get("especialidade"),
                "professional_id": data.get("professional_id"),
                "professional_name": data.get("professional_name"),
                "specialty_name": data.get("specialty_name"),
                "tipo_pagamento": tipo_pagamento,
                "convenios": convenios,
                "show_convenio_fields": show_convenio_fields,
                "error_message": ""
            }
        }

    async def _handle_info_convenio(
        self,
        clinic_id: str,
        data: Dict[str, Any],
    ) -> Dict[str, Any]:
        """User provided convenio info - show patient data form."""

        return {
            "screen": "DADOS_PACIENTE",
            "data": {
                "especialidade": data.get("especialidade"),
                "professional_id": data.get("professional_id"),
                "professional_name": data.get("professional_name"),
                "specialty_name": data.get("specialty_name"),
                "tipo_pagamento": data.get("tipo_pagamento"),
                "convenio_nome": data.get("convenio_nome", ""),
                "convenio_numero": data.get("convenio_numero", ""),
                "error_message": ""
            }
        }

    async def _handle_dados_paciente(
        self,
        clinic_id: str,
        data: Dict[str, Any],
    ) -> Dict[str, Any]:
        """User provided patient data - show confirmation screen.

        Note: This returns to CONFIRMACAO which is a terminal screen with 'complete' action.
        The flow will end here and return all data to the WhatsApp agent.
        """

        nome = data.get("nome", "").strip()
        cpf = data.get("cpf", "").strip()

        if not nome:
            return {
                "screen": "DADOS_PACIENTE",
                "data": {
                    **data,
                    "error_message": "Por favor, informe seu nome."
                }
            }

        if not cpf:
            return {
                "screen": "DADOS_PACIENTE",
                "data": {
                    **data,
                    "error_message": "Por favor, informe seu CPF."
                }
            }

        # CONFIRMACAO is a terminal screen - we just pass all data
        # The flow will complete when user clicks "Ver Horários"
        return {
            "screen": "CONFIRMACAO",
            "data": {
                "especialidade": data.get("especialidade"),
                "professional_id": data.get("professional_id"),
                "professional_name": data.get("professional_name"),
                "specialty_name": data.get("specialty_name"),
                "tipo_pagamento": data.get("tipo_pagamento"),
                "convenio_nome": data.get("convenio_nome", ""),
                "convenio_numero": data.get("convenio_numero", ""),
                "nome": nome,
                "cpf": cpf,
                "data_nascimento": data.get("data_nascimento", ""),
                "error_message": ""
            }
        }

    # ============================================
    # FLOW 2: Booking Flow Handler
    # ============================================

    async def _handle_booking(
        self,
        clinic_id: str,
        data: Dict[str, Any],
        flow_token: str,
    ) -> Dict[str, Any]:
        """User selected date and time - create appointment.

        Note: BOOKING is a terminal screen. When this handler is called,
        we create the appointment and return the completion response.
        """

        selected_date = data.get("date")
        selected_time = data.get("time")

        if not selected_date:
            return {
                "screen": "BOOKING",
                "data": {
                    **data,
                    "error_message": "Por favor, selecione uma data."
                }
            }

        if not selected_time:
            return {
                "screen": "BOOKING",
                "data": {
                    **data,
                    "error_message": "Por favor, selecione um horário."
                }
            }

        # Extract patient info from flow_token context
        # flow_token format: clinic_id:phone:timestamp:patient_data_json
        parts = flow_token.split(":", 3)
        patient_phone = parts[1] if len(parts) > 1 else ""

        # Get additional data passed when sending the booking flow
        professional_id = data.get("professional_id", "")
        professional_name = data.get("doctor_name", "")
        patient_name = data.get("patient_name", "")
        patient_cpf = data.get("patient_cpf", "")

        # Create the appointment
        try:
            from src.scheduler.appointments import create_appointment

            appointment = await create_appointment(
                db=self.db,
                clinic_id=clinic_id,
                professional_id=professional_id,
                professional_name=professional_name,
                patient_name=patient_name,
                patient_phone=patient_phone,
                date=selected_date,
                time=selected_time,
                duration=30,
                notes=f"CPF: {patient_cpf}" if patient_cpf else "Agendado via WhatsApp Flow",
            )

            # Format date for display
            try:
                dt = datetime.strptime(selected_date, "%Y-%m-%d")
                formatted_date = dt.strftime("%d/%m/%Y")
            except ValueError:
                formatted_date = selected_date

            logger.info(f"✅ Appointment created via flow: {appointment.get('id') if appointment else 'N/A'}")

            # Return completion response
            return {
                "screen": "BOOKING",
                "data": {
                    "extension_message_response": {
                        "params": {
                            "flow_token": flow_token,
                            "appointment_id": appointment.get("id") if appointment else "",
                            "professional_name": professional_name,
                            "date": formatted_date,
                            "time": selected_time,
                            "status": "confirmed"
                        }
                    }
                }
            }
        except Exception as e:
            logger.error(f"Failed to create appointment: {e}")
            return {
                "screen": "BOOKING",
                "data": {
                    **data,
                    "error_message": "Erro ao confirmar agendamento. Tente novamente."
                }
            }
