"""
Utility helper functions for Gendei WhatsApp Agent.
"""

import re
from typing import Optional


def ensure_phone_has_plus(phone: str) -> str:
    """
    Ensure phone number starts with '+'.

    Args:
        phone: Phone number string

    Returns:
        Phone number with '+' prefix
    """
    if not phone:
        return phone
    phone = phone.strip()
    if not phone.startswith('+'):
        return f'+{phone}'
    return phone


def format_phone_for_display(phone: str) -> str:
    """
    Format phone number for display.
    Converts +5511999999999 to (11) 99999-9999

    Args:
        phone: Phone number in E.164 format

    Returns:
        Formatted phone number for display
    """
    if not phone:
        return phone

    # Remove + and country code (assuming Brazil +55)
    cleaned = re.sub(r'[^\d]', '', phone)
    if cleaned.startswith('55'):
        cleaned = cleaned[2:]

    # Format as (XX) XXXXX-XXXX
    if len(cleaned) == 11:
        return f"({cleaned[:2]}) {cleaned[2:7]}-{cleaned[7:]}"
    elif len(cleaned) == 10:
        return f"({cleaned[:2]}) {cleaned[2:6]}-{cleaned[6:]}"
    else:
        return phone


def normalize_phone(phone: str) -> str:
    """
    Normalize phone number to E.164 format.

    Args:
        phone: Phone number in various formats

    Returns:
        Phone number in E.164 format (+55XXXXXXXXXXX)
    """
    # Remove all non-digit characters
    cleaned = re.sub(r'[^\d]', '', phone)

    # Add Brazil country code if not present
    if not cleaned.startswith('55'):
        cleaned = '55' + cleaned

    return f'+{cleaned}'


def is_valid_brazilian_phone(phone: str) -> bool:
    """
    Check if phone number is a valid Brazilian mobile number.

    Args:
        phone: Phone number to validate

    Returns:
        True if valid, False otherwise
    """
    cleaned = re.sub(r'[^\d]', '', phone)

    # Remove country code if present
    if cleaned.startswith('55'):
        cleaned = cleaned[2:]

    # Brazilian mobile: 2 digit DDD + 9 digit number starting with 9
    if len(cleaned) == 11:
        ddd = int(cleaned[:2])
        # Valid DDDs range from 11 to 99
        if 11 <= ddd <= 99 and cleaned[2] == '9':
            return True

    return False


def sanitize_name(name: str) -> str:
    """
    Sanitize patient name for storage.

    Args:
        name: Patient name

    Returns:
        Sanitized name
    """
    if not name:
        return name

    # Remove extra whitespace
    name = ' '.join(name.split())

    # Capitalize each word
    name = name.title()

    return name


def format_currency_brl(cents: int) -> str:
    """
    Format cents value as Brazilian Real currency.

    Args:
        cents: Value in cents

    Returns:
        Formatted currency string (e.g., "R$ 150,00")
    """
    reais = cents / 100
    return f"R$ {reais:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.')


def parse_date_pt_br(date_str: str) -> Optional[str]:
    """
    Parse Brazilian date format (DD/MM/YYYY) to ISO format (YYYY-MM-DD).

    Args:
        date_str: Date in DD/MM/YYYY format

    Returns:
        Date in YYYY-MM-DD format or None if invalid
    """
    import re
    from datetime import datetime

    # Try DD/MM/YYYY format
    match = re.match(r'(\d{1,2})/(\d{1,2})/(\d{4})', date_str)
    if match:
        day, month, year = match.groups()
        try:
            dt = datetime(int(year), int(month), int(day))
            return dt.strftime('%Y-%m-%d')
        except ValueError:
            return None

    # Try YYYY-MM-DD format (already ISO)
    match = re.match(r'(\d{4})-(\d{2})-(\d{2})', date_str)
    if match:
        return date_str

    return None
