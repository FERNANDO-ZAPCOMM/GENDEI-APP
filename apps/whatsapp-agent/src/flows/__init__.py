"""
WhatsApp Flows module for Gendei

Two flows for appointment scheduling:
1. CLINICA_MEDICA_FORMULARIO (ESPECIALIDADE → TIPO_ATENDIMENTO → INFO_CONVENIO → DADOS_PACIENTE)
2. CLINICA_MEDICA_AGENDAMENTO (BOOKING - date picker + time dropdown)
"""

from .handler import FlowsHandler, CLINICA_MEDICA_SPECIALTIES
from .manager import (
    FlowsManager,
    send_whatsapp_flow,
    send_booking_flow,
    generate_flow_token,
)

__all__ = [
    "FlowsHandler",
    "CLINICA_MEDICA_SPECIALTIES",
    "FlowsManager",
    "send_whatsapp_flow",
    "send_booking_flow",
    "generate_flow_token",
]
