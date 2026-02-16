"""WhatsApp Flows package exports."""

from __future__ import annotations

from importlib import import_module
from typing import Any

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


def __getattr__(name: str) -> Any:
    if name == "FlowsHandler":
        return import_module("src.flows.handler").FlowsHandler
    if name in {"FlowsManager", "send_whatsapp_flow", "send_booking_flow", "generate_flow_token"}:
        module = import_module("src.flows.manager")
        return getattr(module, name)
    if name in {
        "handle_encrypted_flow_request",
        "prepare_flow_response",
        "is_encryption_configured",
        "decrypt_request",
        "encrypt_response",
    }:
        module = import_module("src.flows.crypto")
        return getattr(module, name)
    raise AttributeError(f"module 'src.flows' has no attribute '{name}'")
