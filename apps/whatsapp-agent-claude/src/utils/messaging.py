"""
WhatsApp Messaging Utilities using Meta Cloud API.
"""

import os
import logging
import httpx
from typing import Optional, Dict, Any, List

logger = logging.getLogger(__name__)

# Environment variables
META_API_VERSION = os.getenv("META_API_VERSION", "v24.0")
WHATSAPP_TOKEN = os.getenv("META_BISU_ACCESS_TOKEN", "")

# Context variable for phone number ID (set per request)
_phone_number_id: Optional[str] = None


def set_phone_number_id(phone_number_id: str) -> None:
    """Set the phone number ID for the current request context."""
    global _phone_number_id
    _phone_number_id = phone_number_id


def get_phone_number_id() -> str:
    """Get the current phone number ID."""
    if not _phone_number_id:
        raise RuntimeError("Phone number ID not set. Call set_phone_number_id() first.")
    return _phone_number_id


async def send_whatsapp_text(
    to: str,
    text: str,
    phone_number_id: Optional[str] = None
) -> str:
    """
    Send a text message via WhatsApp Cloud API.

    Args:
        to: Recipient phone number in E.164 format
        text: Message text
        phone_number_id: Optional override for phone number ID

    Returns:
        Success message or error description
    """
    try:
        pnid = phone_number_id or get_phone_number_id()
        url = f"https://graph.facebook.com/{META_API_VERSION}/{pnid}/messages"

        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": to.replace("+", ""),  # API expects without +
            "type": "text",
            "text": {"body": text}
        }

        headers = {
            "Authorization": f"Bearer {WHATSAPP_TOKEN}",
            "Content-Type": "application/json"
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(url, json=payload, headers=headers)
            response.raise_for_status()

        logger.info(f"✅ Message sent to {to[:8]}...")
        return "Message sent successfully"

    except httpx.HTTPStatusError as e:
        logger.error(f"❌ HTTP error sending message: {e.response.text}")
        return f"Error: {e.response.text}"
    except Exception as e:
        logger.error(f"❌ Error sending message: {e}")
        return f"Error: {str(e)}"


async def send_whatsapp_buttons(
    to: str,
    text: str,
    buttons: List[Dict[str, str]],
    phone_number_id: Optional[str] = None
) -> str:
    """
    Send an interactive button message via WhatsApp Cloud API.

    Args:
        to: Recipient phone number in E.164 format
        text: Message text/body
        buttons: List of button dicts with 'id' and 'title' keys
        phone_number_id: Optional override for phone number ID

    Returns:
        Success message or error description
    """
    try:
        pnid = phone_number_id or get_phone_number_id()
        url = f"https://graph.facebook.com/{META_API_VERSION}/{pnid}/messages"

        # Format buttons for API
        formatted_buttons = [
            {
                "type": "reply",
                "reply": {
                    "id": btn["id"],
                    "title": btn["title"][:20]  # Max 20 chars
                }
            }
            for btn in buttons[:3]  # Max 3 buttons
        ]

        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": to.replace("+", ""),
            "type": "interactive",
            "interactive": {
                "type": "button",
                "body": {"text": text},
                "action": {"buttons": formatted_buttons}
            }
        }

        headers = {
            "Authorization": f"Bearer {WHATSAPP_TOKEN}",
            "Content-Type": "application/json"
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(url, json=payload, headers=headers)
            response.raise_for_status()

        logger.info(f"✅ Button message sent to {to[:8]}...")
        return "Button message sent successfully"

    except httpx.HTTPStatusError as e:
        logger.error(f"❌ HTTP error sending buttons: {e.response.text}")
        return f"Error: {e.response.text}"
    except Exception as e:
        logger.error(f"❌ Error sending buttons: {e}")
        return f"Error: {str(e)}"


async def send_whatsapp_list(
    to: str,
    header: str,
    body: str,
    button_text: str,
    sections: List[Dict[str, Any]],
    phone_number_id: Optional[str] = None
) -> str:
    """
    Send an interactive list message via WhatsApp Cloud API.

    Args:
        to: Recipient phone number in E.164 format
        header: Header text
        body: Body text
        button_text: Text for the list button
        sections: List of section dicts with 'title' and 'rows' keys
        phone_number_id: Optional override for phone number ID

    Returns:
        Success message or error description
    """
    try:
        pnid = phone_number_id or get_phone_number_id()
        url = f"https://graph.facebook.com/{META_API_VERSION}/{pnid}/messages"

        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": to.replace("+", ""),
            "type": "interactive",
            "interactive": {
                "type": "list",
                "header": {"type": "text", "text": header},
                "body": {"text": body},
                "action": {
                    "button": button_text[:20],
                    "sections": sections
                }
            }
        }

        headers = {
            "Authorization": f"Bearer {WHATSAPP_TOKEN}",
            "Content-Type": "application/json"
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(url, json=payload, headers=headers)
            response.raise_for_status()

        logger.info(f"✅ List message sent to {to[:8]}...")
        return "List message sent successfully"

    except httpx.HTTPStatusError as e:
        logger.error(f"❌ HTTP error sending list: {e.response.text}")
        return f"Error: {e.response.text}"
    except Exception as e:
        logger.error(f"❌ Error sending list: {e}")
        return f"Error: {str(e)}"


async def mark_message_as_read(
    message_id: str,
    phone_number_id: Optional[str] = None
) -> bool:
    """
    Mark a message as read.

    Args:
        message_id: WhatsApp message ID
        phone_number_id: Optional override for phone number ID

    Returns:
        True if successful, False otherwise
    """
    try:
        pnid = phone_number_id or get_phone_number_id()
        url = f"https://graph.facebook.com/{META_API_VERSION}/{pnid}/messages"

        payload = {
            "messaging_product": "whatsapp",
            "status": "read",
            "message_id": message_id
        }

        headers = {
            "Authorization": f"Bearer {WHATSAPP_TOKEN}",
            "Content-Type": "application/json"
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(url, json=payload, headers=headers)
            response.raise_for_status()

        return True

    except Exception as e:
        logger.error(f"❌ Error marking message as read: {e}")
        return False
