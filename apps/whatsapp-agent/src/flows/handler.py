"""
WhatsApp Flows Handler for Gendei
Handles dynamic flow data endpoints for appointment scheduling

Two Flows:
1. Patient Info Flow (ESPECIALIDADE → TIPO_ATENDIMENTO → INFO_CONVENIO → complete)
   - Patient name/email collected via free-text chat after flow completion
2. Booking Flow (BOOKING - date picker + time dropdown)
"""

import logging
from typing import Any, Dict, List, Optional
from datetime import datetime, timedelta

from src.vertical_config import get_vertical_config, get_specialty_name, ALL_SPECIALTIES
from src.flows.token import parse_flow_token

logger = logging.getLogger(__name__)

# Default convenios list (used when clinic has no custom list)
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

        # Get vertical config for specialty name mapping
        clinic = self.db.get_clinic(clinic_id) if self.db else None
        vertical_slug = getattr(clinic, 'vertical', '') if clinic else ''

        # Build specialty options (each professional = one specialty option)
        especialidades = []
        for prof in professionals:
            # Professional is a dataclass, use attribute access
            specialty_id = getattr(prof, 'specialty', 'clinico_geral') or 'clinico_geral'
            specialty_display = get_specialty_name(vertical_slug, specialty_id)
            prof_name = getattr(prof, 'name', '') or getattr(prof, 'full_name', '') or ''
            especialidades.append({
                "id": getattr(prof, 'id', ''),  # Use professional ID as the specialty selection ID
                "title": specialty_display,
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
        duration = int(getattr(professional, 'appointment_duration', 30) or 30)
        if duration <= 0:
            duration = 30

        def _parse_time(raw: Any) -> Optional[datetime]:
            if raw is None:
                return None
            value = str(raw).strip()
            if not value:
                return None
            for fmt in ("%H:%M", "%H:%M:%S", "%I:%M %p", "%I:%M%p"):
                try:
                    return datetime.strptime(value, fmt)
                except ValueError:
                    continue
            return None

        # Generate slots based on working hours
        time_slots = set()
        for day_key, day_hours in working_hours.items():
            periods = day_hours if isinstance(day_hours, list) else [day_hours] if isinstance(day_hours, dict) else []
            for period in periods:
                if not isinstance(period, dict):
                    continue
                start_str = period.get("start", "09:00")
                end_str = period.get("end", "18:00")

                start_time = _parse_time(start_str)
                end_time = _parse_time(end_str)
                if not start_time or not end_time:
                    continue

                current = start_time
                while current < end_time:
                    time_slots.add(current.strftime("%H:%M"))
                    current += timedelta(minutes=duration)

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
        """User selected a specialty/professional - route to the correct next screen."""

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

        # Get clinic + vertical config
        clinic = self.db.get_clinic(clinic_id) if self.db else None
        vertical_slug = getattr(clinic, 'vertical', '') if clinic else ''
        vc = get_vertical_config(vertical_slug)

        payment_settings = getattr(clinic, 'payment_settings', {}) if clinic else {}
        accepts_particular = bool(payment_settings.get("acceptsParticular", True))
        accepts_convenio = bool(payment_settings.get("acceptsConvenio", False))

        # Professional is a dataclass, use attribute access
        specialty_id = getattr(professional, 'specialty', '') or ''
        specialty_display = get_specialty_name(vertical_slug, specialty_id)
        professional_name = getattr(professional, 'name', '') or getattr(professional, 'full_name', '') or ''

        # Payment type options - shown only when both modes are enabled.
        tipos_pagamento = [
            {"id": "particular", "title": "Particular", "description": "Pagamento direto (PIX/Cartão)"},
        ]
        if vc.features.has_convenio and accepts_convenio:
            tipos_pagamento.insert(0,
                {"id": "convenio", "title": "Convênio", "description": "Tenho plano de saúde"},
            )

        base_data = {
            "especialidade": professional_id,
            "professional_id": professional_id,
            "professional_name": professional_name,
            "specialty_name": specialty_display,
            "error_message": ""
        }

        # Match the deployed flow variant routing:
        # - particular-only: ESPECIALIDADE is terminal (complete action, no data_exchange)
        # - convenio-only:   ESPECIALIDADE -> INFO_CONVENIO
        # - both modes:      ESPECIALIDADE -> TIPO_ATENDIMENTO
        if accepts_particular and not accepts_convenio:
            # Particular-only flow: ESPECIALIDADE is terminal with complete action.
            # This handler should not be called, but return INFO_CONVENIO as fallback.
            logger.warning("⚠️ _handle_especialidade_selection called for particular-only flow (unexpected)")
            return {
                "screen": "INFO_CONVENIO",
                "data": {
                    **base_data,
                    "tipo_pagamento": "particular",
                    "convenios": [],
                    "show_convenio_fields": False,
                }
            }

        if accepts_convenio and not accepts_particular:
            convenios = await self._get_clinic_convenios(clinic_id)
            return {
                "screen": "INFO_CONVENIO",
                "data": {
                    **base_data,
                    "tipo_pagamento": "convenio",
                    "convenios": convenios,
                    "show_convenio_fields": True
                }
            }

        return {
            "screen": "TIPO_ATENDIMENTO",
            "data": {
                **base_data,
                "tipos_pagamento": tipos_pagamento
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
        """INFO_CONVENIO is now a terminal screen with complete action.

        This handler should not be called in normal flow, but is kept as a
        fallback. It acknowledges the data without routing to another screen.
        """
        logger.warning("⚠️ _handle_info_convenio called via data_exchange (unexpected — INFO_CONVENIO is terminal)")
        return {"data": {"acknowledged": True}}

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

        # Extract patient info from signed flow token (legacy tokens still accepted).
        patient_phone = ""
        if flow_token:
            try:
                token_data = parse_flow_token(flow_token)
                patient_phone = token_data.get("phone", "")
            except ValueError:
                logger.warning("⚠️ Invalid flow token when handling booking completion")

        # Get additional data passed when sending the booking flow
        professional_id = data.get("professional_id", "")
        professional_name = data.get("doctor_name", "")
        patient_name = data.get("patient_name", "")
        patient_email = data.get("patient_email", "")

        # Validate that the selected date+time is actually available
        if self.db and professional_id:
            from src.scheduler.availability import get_professional_availability

            available_times = get_professional_availability(
                db=self.db,
                clinic_id=clinic_id,
                professional_id=professional_id,
                date_str=selected_date
            )

            if not available_times:
                # Professional doesn't work on this day (e.g., weekend)
                try:
                    dt = datetime.strptime(selected_date, "%Y-%m-%d")
                    day_names = ["segunda", "terça", "quarta", "quinta", "sexta", "sábado", "domingo"]
                    day_name = day_names[dt.weekday()]
                except ValueError:
                    day_name = "este dia"

                return {
                    "screen": "BOOKING",
                    "data": {
                        **data,
                        "error_message": f"O profissional não atende na {day_name}. Por favor, escolha outro dia."
                    }
                }

            if selected_time not in available_times:
                # Time slot not available (already booked or outside working hours)
                return {
                    "screen": "BOOKING",
                    "data": {
                        **data,
                        "error_message": f"O horário {selected_time} não está disponível nesta data. Por favor, escolha outro horário."
                    }
                }

        # Create the appointment
        try:
            from src.scheduler.appointments import create_appointment

            appointment = create_appointment(
                db=self.db,
                clinic_id=clinic_id,
                patient_phone=patient_phone,
                professional_id=professional_id,
                date_str=selected_date,
                time_str=selected_time,
                patient_name=patient_name,
                patient_email=patient_email,
                professional_name=professional_name,
                duration_minutes=30,
            )

            # Format date for display
            try:
                dt = datetime.strptime(selected_date, "%Y-%m-%d")
                formatted_date = dt.strftime("%d/%m/%Y")
            except ValueError:
                formatted_date = selected_date

            logger.info(f"✅ Appointment created via flow: {appointment.id if appointment else 'N/A'}")

            # Return completion response
            return {
                "screen": "BOOKING",
                "data": {
                    "extension_message_response": {
                        "params": {
                            "flow_token": flow_token,
                            "appointment_id": appointment.id if appointment else "",
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
