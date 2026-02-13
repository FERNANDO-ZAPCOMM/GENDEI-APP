"""
WhatsApp Flows module for Gendei

Two flows for appointment scheduling:
1. Patient Info Flow (ESPECIALIDADE → TIPO_ATENDIMENTO → INFO_CONVENIO → DADOS_PACIENTE)
2. Booking Flow (BOOKING - date picker + time dropdown)

Supports encrypted data exchange via AES-128-GCM + RSA key exchange.
"""

from .handler import FlowsHandler
from .manager import (
    FlowsManager,
    send_whatsapp_flow,
    send_booking_flow,
    generate_flow_token,
)
from .crypto import (
    handle_encrypted_flow_request,
    prepare_flow_response,
    is_encryption_configured,
    decrypt_request,
    encrypt_response,
)

__all__ = [
    "FlowsHandler",
    "FlowsManager",
    "send_whatsapp_flow",
    "send_booking_flow",
    "generate_flow_token",
    "handle_encrypted_flow_request",
    "prepare_flow_response",
    "is_encryption_configured",
    "decrypt_request",
    "encrypt_response",
]
