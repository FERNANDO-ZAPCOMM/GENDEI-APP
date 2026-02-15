# apps/whatsapp-agent/src/utils/helpers.py

"""
common helper functions for WhatsApp agent service
"""

import logging
import re
from typing import Tuple

logger = logging.getLogger(__name__)

_UPPERCASE_LABELS = [
    "endereço",
    "endereco",
    "telefone",
    "horário",
    "horario",
    "nossa equipe",
    "profissionais",
    "serviços",
    "servicos",
    "formas de pagamento",
    "valor",
    "duração",
    "duracao",
]

_UPPERCASE_QUESTIONS = [
    "o que você deseja?",
    "o que voce deseja?",
    "o que você gostaria de saber?",
    "o que voce gostaria de saber?",
]


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


def format_button_title(title: str) -> str:
    """
    normalize a WhatsApp button title and force uppercase.
    WhatsApp quick reply titles support up to 20 chars.
    """
    cleaned = re.sub(r"\s+", " ", (title or "").strip())
    if not cleaned:
        cleaned = "OPCAO"
    return cleaned.upper()[:20]


def format_outgoing_text(text: str) -> str:
    """
    normalize outgoing WhatsApp text:
    - preserve and improve line breaks
    - uppercase key labels/questions
    """
    current = (text or "").replace("\r\n", "\n").replace("\r", "\n").strip()
    if not current:
        return current

    # Break long compact text into short paragraphs for readability.
    if "\n" not in current and len(current) > 110:
        current = re.sub(
            r"([.!?])\s+(?=[A-Za-zÀ-ÖØ-öø-ÿ])",
            r"\1\n\n",
            current,
        )

    # Keep list-like content easy to scan.
    current = re.sub(r"\s+•\s*", "\n• ", current)
    current = re.sub(r"\s+-\s+(?=[A-Za-zÀ-ÖØ-öø-ÿ])", "\n- ", current)

    # Uppercase known labels before ":".
    for label in _UPPERCASE_LABELS:
        pattern = re.compile(rf"(?i)(\*?){re.escape(label)}(\*?)\s*:")
        current = pattern.sub(
            lambda m: f"{m.group(1)}{label.upper()}{m.group(2)}:",
            current,
        )

    # Uppercase common CTA questions.
    for question in _UPPERCASE_QUESTIONS:
        pattern = re.compile(rf"(?i){re.escape(question)}")
        current = pattern.sub(question.upper(), current)

    current = re.sub(r"\n{3,}", "\n\n", current).strip()
    return current
