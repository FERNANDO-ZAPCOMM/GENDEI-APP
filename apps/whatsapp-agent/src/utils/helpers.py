# apps/whatsapp-agent/src/utils/helpers.py

"""
common helper functions for WhatsApp agent service
"""

import logging
import re
from typing import Tuple

logger = logging.getLogger(__name__)


def ensure_phone_has_plus(phone: str) -> str:
    """
    ensures that a phone number has the + prefix required by WhatsApp API
    """
    if not phone:
        return phone

    if not phone.startswith("+"):
        return "+" + phone

    return phone


def is_valid_phone(phone: str) -> bool:
    """
    check if a phone number is valid for WhatsApp
    """
    if not phone:
        return False

    return phone.startswith("+") and len(re.sub(r'[^\d]', '', phone)) >= 10


def validate_and_format_phone(phone: str) -> Tuple[str, bool, str]:
    """
    enhanced phone validation - returns (formatted_phone, is_valid, error_message)
    """
    if not phone:
        return "", False, "Phone number cannot be empty"

    formatted = ensure_phone_has_plus(phone)
    if not is_valid_phone(formatted):
        return "", False, f"Invalid phone number format: {phone}"

    return formatted, True, ""


def format_payment_amount(amount_in_cents: int) -> str:
    """
    formats payment amount from cents to Brazilian Real format: R$ XX,XX
    """
    reais = amount_in_cents // 100
    centavos = amount_in_cents % 100
    return f"R$ {reais},{centavos:02d}"
