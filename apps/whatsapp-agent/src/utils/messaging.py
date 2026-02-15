"""
WhatsApp Messaging Utilities
Handles all WhatsApp API communication
"""

import os
import logging
import requests  # type: ignore
from typing import Optional, Dict, Any, List
from src.utils.helpers import (
    validate_and_format_phone,
    format_button_title,
    format_outgoing_text,
)
from src.runtime.context import get_runtime_safe

logger = logging.getLogger(__name__)

WHATSAPP_TOKEN = os.getenv("WHATSAPP_TOKEN")
WHATSAPP_PHONE_NUMBER_ID = os.getenv("WHATSAPP_PHONE_NUMBER_ID")
WHATSAPP_API_VERSION = os.getenv("WHATSAPP_API_VERSION", "v22.0")
# Catalog ID is fetched from product.metaCatalog.catalogId in Firestore
# fallback to shared platform catalog ID if not set on product
DEFAULT_CATALOG_ID = "1169583811909920"  # shared Meta Catalog for all creators


def get_whatsapp_credentials() -> tuple[Optional[str], Optional[str]]:
    """
    get WhatsApp credentials from runtime context or environment variables
    returns:
        Tuple of (access_token, phone_number_id)
    """
    runtime = get_runtime_safe()

    if runtime:
        # use runtime context (multi-creator mode)
        access_token = runtime.access_token or WHATSAPP_TOKEN
        phone_number_id = runtime.phone_number_id or WHATSAPP_PHONE_NUMBER_ID
        return access_token, phone_number_id
    else:
        # fall back to environment variables
        return WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID


async def mark_message_as_read(message_id: str, show_typing: bool = False) -> bool:
    """
    mark a WhatsApp message as read
    args:
        message_id: The WhatsApp message ID to mark as read
        show_typing: If True, also shows the typing indicator (best practice when response may take a few seconds)
    returns:
        bool: True if successful, False otherwise
    """
    access_token, phone_number_id = get_whatsapp_credentials()

    if not access_token or not phone_number_id:
        logger.error("Missing WhatsApp credentials")
        return False

    url = f"https://graph.facebook.com/{WHATSAPP_API_VERSION}/{phone_number_id}/messages"
    payload: Dict[str, Any] = {
        "messaging_product": "whatsapp",
        "status": "read",
        "message_id": message_id
    }

    if show_typing:
        # Meta docs: typing indicators are sent with the "read" status payload
        payload["typing_indicator"] = {"type": "text"}

    try:
        response = requests.post(
            url,
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            },
            json=payload,
            timeout=10
        )

        if response.status_code == 200:
            logger.info(f"Message {message_id} marked as read")
            return True
        else:
            logger.warning(f"Failed to mark message as read: {response.status_code} - {response.text}")
            return False

    except Exception as e:
        logger.error(f"Error marking message as read: {e}")
        return False


async def send_typing_indicator(message_id: str) -> bool:
    """
    Show typing indicator (also marks message as read) for up to ~25s or until you respond.
    Meta docs: typing indicator is part of the "read" status request body.
    """
    return await mark_message_as_read(message_id, show_typing=True)


async def send_whatsapp_text(phone: str, text: str) -> str:
    """
    send a text message via WhatsApp
    args:
        phone: Recipient phone number
        text: Message text
    returns:
        success message or error description
    """
    phone, is_valid, error_msg = validate_and_format_phone(phone)
    if not is_valid:
        logger.error(f"Invalid phone: {error_msg}")
        return f"Error: {error_msg}"

    access_token, phone_number_id = get_whatsapp_credentials()

    if not access_token or not phone_number_id:
        logger.error("Missing WhatsApp credentials")
        return "Error: Missing WhatsApp credentials"

    # clean text formatting
    text = text.replace("**", "*")  # convert markdown bold to WhatsApp bold
    text = text.encode("utf-8").decode("utf-8")
    text = format_outgoing_text(text)

    url = f"https://graph.facebook.com/{WHATSAPP_API_VERSION}/{phone_number_id}/messages"
    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": phone,
        "type": "text",
        "text": {"body": text}
    }

    logger.info(f"Sending message to {phone}: {text[:50]}...")

    try:
        response = requests.post(
            url,
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            },
            json=payload,
            timeout=30
        )

        if response.status_code == 200:
            logger.info(f"✅ Message sent successfully to {phone}")
            return "Message sent successfully"
        else:
            error_text = response.text
            logger.error(f"Failed to send message: {response.status_code} - {error_text}")
            return f"Failed to send message: {response.status_code}"

    except Exception as e:
        logger.error(f"Error sending message: {e}")
        return f"Error sending message: {str(e)}"


async def send_whatsapp_document(
    phone: str,
    document_url: str,
    caption: Optional[str] = None,
    filename: Optional[str] = None
) -> str:
    """
    send a document via WhatsApp
    args:
        phone: Recipient phone number
        document_url: URL of the document to send
        caption: Optional caption for the document
        filename: Optional filename to display (e.g., 'ebook.pdf')
    returns:
        success message or error description
    """
    phone, is_valid, error_msg = validate_and_format_phone(phone)
    if not is_valid:
        logger.error(f"Invalid phone: {error_msg}")
        return f"Error: {error_msg}"

    access_token, phone_number_id = get_whatsapp_credentials()

    if not access_token or not phone_number_id:
        logger.error("Missing WhatsApp credentials")
        return "Error: Missing WhatsApp credentials"

    url = f"https://graph.facebook.com/{WHATSAPP_API_VERSION}/{phone_number_id}/messages"

    # build document object
    document_obj: Dict[str, Any] = {
        "link": document_url
    }

    if caption:
        document_obj["caption"] = caption

    if filename:
        document_obj["filename"] = filename
    else:
        # try to extract filename from URL
        try:
            from urllib.parse import urlparse, unquote
            parsed = urlparse(document_url)
            path = unquote(parsed.path)
            if '/' in path:
                extracted_filename = path.split('/')[-1]
                # clean up Firebase Storage filenames
                if '_' in extracted_filename:
                    # format: creatorId_timestamp_filename.ext -> filename.ext
                    parts = extracted_filename.split('_')
                    if len(parts) >= 3:
                        extracted_filename = '_'.join(parts[2:])
                document_obj["filename"] = extracted_filename
        except Exception:
            pass

    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": phone,
        "type": "document",
        "document": document_obj
    }

    logger.info(f"Sending document to {phone}: {document_url[:50]}...")

    try:
        response = requests.post(
            url,
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            },
            json=payload,
            timeout=30
        )

        if response.status_code == 200:
            logger.info(f"✅ Document sent successfully to {phone}")
            return "Document sent successfully"
        else:
            error_text = response.text
            logger.error(f"Failed to send document: {response.status_code} - {error_text}")
            return f"Failed to send document: {response.status_code}"

    except Exception as e:
        logger.error(f"Error sending document: {e}")
        return f"Error sending document: {str(e)}"


async def send_whatsapp_button(
    phone: str,
    body_text: str,
    button_text: str,
    button_id: str,
    header_text: Optional[str] = None
) -> str:
    """
    send an interactive button message
    args:
        phone: Recipient phone number
        body_text: Main message text
        button_text: Text displayed on the button
        button_id: Unique button ID for callback
        header_text: Optional header text
    returns:
        success message or error description
    """
    phone, is_valid, error_msg = validate_and_format_phone(phone)
    if not is_valid:
        logger.error(f"Invalid phone: {error_msg}")
        return f"Error: {error_msg}"

    access_token, phone_number_id = get_whatsapp_credentials()

    if not access_token or not phone_number_id:
        logger.error("Missing WhatsApp credentials")
        return "Error: Missing WhatsApp credentials"

    url = f"https://graph.facebook.com/{WHATSAPP_API_VERSION}/{phone_number_id}/messages"

    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": phone,
        "type": "interactive",
        "interactive": {
            "type": "button",
            "body": {"text": body_text},
            "action": {
                "buttons": [
                    {
                        "type": "reply",
                        "reply": {
                            "id": button_id,
                            "title": button_text
                        }
                    }
                ]
            }
        }
    }

    if header_text:
        payload["interactive"]["header"] = {
            "type": "text",
            "text": header_text
        }

    try:
        response = requests.post(
            url,
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            },
            json=payload,
            timeout=30
        )

        if response.status_code == 200:
            logger.info(f"✅ Button message sent to {phone}")
            return "Button message sent successfully"
        else:
            logger.error(f"Failed to send button: {response.status_code} - {response.text}")
            return f"Failed to send button: {response.status_code}"

    except Exception as e:
        logger.error(f"Error sending button: {e}")
        return f"Error sending button: {str(e)}"


async def send_whatsapp_buttons(
    phone: str,
    body_text: str,
    buttons: list[dict],
    header_text: Optional[str] = None,
    footer_text: Optional[str] = None
) -> str:
    """
    send an interactive message with multiple quick reply buttons (up to 3).
    args:
        phone: Recipient phone number
        body_text: Main message text
        buttons: List of button dicts with 'id' and 'title' keys
                 Example: [{'id': 'yes', 'title': 'Sim!'}, {'id': 'no', 'title': 'Não'}]
        header_text: Optional header text
        footer_text: Optional footer text
    returns:
        success message or error description
    """
    phone, is_valid, error_msg = validate_and_format_phone(phone)
    if not is_valid:
        logger.error(f"Invalid phone: {error_msg}")
        return f"Error: {error_msg}"

    access_token, phone_number_id = get_whatsapp_credentials()

    if not access_token or not phone_number_id:
        logger.error("Missing WhatsApp credentials")
        return "Error: Missing WhatsApp credentials"

    body_text = format_outgoing_text(body_text)

    # WhatsApp allows max 3 buttons
    if len(buttons) > 3:
        buttons = buttons[:3]

    url = f"https://graph.facebook.com/{WHATSAPP_API_VERSION}/{phone_number_id}/messages"

    # build button action
    button_list = []
    for btn in buttons:
        button_list.append({
            "type": "reply",
            "reply": {
                "id": btn.get('id', f"btn_{len(button_list)}"),
                "title": format_button_title(btn.get('title', 'Button'))  # Max 20 chars
            }
        })

    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": phone,
        "type": "interactive",
        "interactive": {
            "type": "button",
            "body": {"text": body_text},
            "action": {
                "buttons": button_list
            }
        }
    }

    if header_text:
        payload["interactive"]["header"] = {
            "type": "text",
            "text": format_outgoing_text(header_text)
        }

    if footer_text:
        payload["interactive"]["footer"] = {
            "text": format_outgoing_text(footer_text)
        }

    try:
        response = requests.post(
            url,
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            },
            json=payload,
            timeout=30
        )

        if response.status_code == 200:
            logger.info(f"✅ Multi-button message sent to {phone}")
            return "Button message sent successfully"
        else:
            logger.error(f"Failed to send buttons: {response.status_code} - {response.text}")
            return f"Failed to send buttons: {response.status_code}"

    except Exception as e:
        logger.error(f"Error sending buttons: {e}")
        return f"Error sending buttons: {str(e)}"


async def send_whatsapp_location_request(
    phone: str,
    body_text: str = "Por favor, compartilhe sua localização atual."
) -> str:
    """
    send a WhatsApp location_request_message (interactive).
    """
    phone, is_valid, error_msg = validate_and_format_phone(phone)
    if not is_valid:
        logger.error(f"Invalid phone: {error_msg}")
        return f"Error: {error_msg}"

    access_token, phone_number_id = get_whatsapp_credentials()
    if not access_token or not phone_number_id:
        logger.error("Missing WhatsApp credentials")
        return "Error: Missing WhatsApp credentials"

    url = f"https://graph.facebook.com/{WHATSAPP_API_VERSION}/{phone_number_id}/messages"

    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": phone,
        "type": "interactive",
        "interactive": {
            "type": "location_request_message",
            "body": {"text": body_text},
            "action": {"name": "send_location"},
        },
    }

    try:
        response = requests.post(
            url,
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=30,
        )
        if response.status_code == 200:
            logger.info(f"✅ Location request sent to {phone}")
            return "Location request sent successfully"
        logger.error(f"Failed to send location request: {response.status_code} - {response.text}")
        return f"Failed to send location request: {response.status_code}"
    except Exception as e:
        logger.error(f"Error sending location request: {e}")
        return f"Error sending location request: {str(e)}"


async def send_payment_button(
    phone: str,
    payment_url: str,
    amount_cents: int,
    product_name: str = "Produto",
    button_text: str = "Pagar",
    header_text: str = "Pagamento",
    body_suffix: str = "Clique no botão abaixo para abrir a página de pagamento.",
    footer_text: str = "Pagamento seguro",
    expires_minutes: int = 30,
) -> str:
    """
    send a payment CTA button that opens the PagSeguro checkout page.
    args:
        phone: Recipient phone number
        payment_url: The PagSeguro checkout URL
        amount_cents: Amount in cents (for display)
        product_name: Product name for the message
        button_text: Text displayed on the button
        header_text: Header shown in WhatsApp card
        body_suffix: Instructional text in body
        footer_text: Footer text
        expires_minutes: Payment expiration hint (display only)
    returns:
        success message or error description
    """
    phone, is_valid, error_msg = validate_and_format_phone(phone)
    if not is_valid:
        logger.error(f"Invalid phone: {error_msg}")
        return f"Error: {error_msg}"

    access_token, phone_number_id = get_whatsapp_credentials()

    if not access_token or not phone_number_id:
        logger.error("Missing WhatsApp credentials")
        return "Error: Missing WhatsApp credentials"

    # format amount for display
    amount_reais = amount_cents / 100
    amount_formatted = f"R$ {amount_reais:.2f}".replace(".", ",")

    url = f"https://graph.facebook.com/{WHATSAPP_API_VERSION}/{phone_number_id}/messages"

    # CTA URL button payload - opens the payment page directly
    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": phone,
        "type": "interactive",
        "interactive": {
            "type": "cta_url",
            "header": {
                "type": "text",
                "text": header_text
            },
            "body": {
                "text": (
                    f"*{product_name}*\n\n"
                    f"Valor: *{amount_formatted}*\n\n"
                    f"{body_suffix}\n\n"
                    f"O pagamento expira em {expires_minutes} minutos."
                )
            },
            "footer": {
                "text": footer_text
            },
            "action": {
                "name": "cta_url",
                "parameters": {
                    "display_text": button_text,
                    "url": payment_url
                }
            }
        }
    }

    try:
        response = requests.post(
            url,
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            },
            json=payload,
            timeout=30
        )

        if response.status_code == 200:
            logger.info(f"✅ Payment button sent to {phone} - URL: {payment_url[:50]}...")
            return "Payment button sent successfully"
        else:
            logger.error(f"Failed to send payment button: {response.status_code} - {response.text}")
            return f"Failed to send payment button: {response.status_code}"

    except Exception as e:
        logger.error(f"Error sending payment button: {e}")
        return f"Error sending payment button: {str(e)}"


async def send_product_list(phone: str, products: List[Dict[str, Any]]) -> str:
    """
    send a formatted product list message
    args:
        phone: Recipient phone number
        products: List of product dictionaries
    returns:
        success message or error description
    """
    phone, is_valid, error_msg = validate_and_format_phone(phone)
    if not is_valid:
        return f"Error: {error_msg}"

    if not products:
        return await send_whatsapp_text(phone, "Nenhum produto disponível no momento.")

    # format products as text (WhatsApp Catalog integration requires Business Manager setup)
    message_lines = ["📦 **Nossos Produtos:**\n"]

    for i, product in enumerate(products, 1):
        title = product.get('title', 'Produto')
        price = product.get('price', {}).get('formatted', 'Consulte')
        description = product.get('description', '')

        message_lines.append(f"{i}. *{title}*")
        message_lines.append(f"   💳 {price}")

        if description:
            # limit description to 100 chars
            short_desc = description[:100] + "..." if len(description) > 100 else description
            message_lines.append(f"   {short_desc}")

        message_lines.append("")

    message_lines.append("Digite o número do produto para saber mais!")

    message_text = "\n".join(message_lines)
    return await send_whatsapp_text(phone, message_text)


async def get_whatsapp_profile_picture(phone: str) -> Optional[str]:
    """
    get a contact's WhatsApp profile picture URL
    note: This uses the WhatsApp Business API to retrieve the profile picture.
    the URL is temporary and expires after some time.
    args:
        phone: WhatsApp phone number (with or without +)
    returns:
        profile picture URL if available, None otherwise
    """
    phone, is_valid, _ = validate_and_format_phone(phone)
    if not is_valid:
        return None

    access_token, phone_number_id = get_whatsapp_credentials()

    if not access_token or not phone_number_id:
        logger.error("Missing WhatsApp credentials for profile picture fetch")
        return None

    try:
        # remove + from phone for the API call
        clean_phone = phone.replace('+', '')

        # use the contacts endpoint to get profile info
        # note: this endpoint may have limited availability depending on WhatsApp Business API tier
        url = f"https://graph.facebook.com/{WHATSAPP_API_VERSION}/{phone_number_id}/contacts"

        response = requests.post(
            url,
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            },
            json={
                "contacts": [clean_phone],
                "blocking": "wait"
            },
            timeout=15
        )

        if response.status_code == 200:
            data = response.json()
            contacts = data.get('contacts', [])

            if contacts:
                contact = contacts[0]
                # check if the status indicates the contact is on WhatsApp
                if contact.get('status') == 'valid':
                    # the profile picture might be in the response
                    profile = contact.get('profile', {})
                    if profile.get('picture'):
                        logger.info(f"📸 Got profile picture for {phone}")
                        return profile.get('picture')

            logger.debug(f"No profile picture available for {phone}")
            return None
        else:
            logger.warning(f"Failed to get contact info: {response.status_code}")
            return None

    except Exception as e:
        logger.error(f"Error fetching profile picture: {e}")
        return None


async def download_whatsapp_media(media_id: str) -> Optional[tuple[str, str]]:
    """
    download media from WhatsApp
    args:
        media_id: WhatsApp media ID
    returns:
        Tuple of (file_path, mime_type) or None if failed
    """
    access_token, _ = get_whatsapp_credentials()

    if not access_token:
        logger.error("Missing WhatsApp access token")
        return None

    try:
        # STEP 1: Get media URL
        url = f"https://graph.facebook.com/{WHATSAPP_API_VERSION}/{media_id}"
        response = requests.get(
            url,
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=10
        )

        if response.status_code != 200:
            logger.error(f"Failed to get media URL: {response.status_code}")
            return None

        media_data = response.json()
        media_url = media_data.get('url')
        mime_type = media_data.get('mime_type', 'application/octet-stream')

        if not media_url:
            logger.error("No media URL in response")
            return None

        # STEP 2: Download media content
        media_response = requests.get(
            media_url,
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=30
        )

        if media_response.status_code != 200:
            logger.error(f"Failed to download media: {media_response.status_code}")
            return None

        # STEP 3: Save to temp file
        import tempfile
        import os

        extension = mime_type.split('/')[-1]
        fd, file_path = tempfile.mkstemp(suffix=f".{extension}")

        with os.fdopen(fd, 'wb') as f:
            f.write(media_response.content)

        logger.info(f"Media downloaded: {file_path}")
        return file_path, mime_type

    except Exception as e:
        logger.error(f"Error downloading media: {e}")
        return None


# ===============================
# PRODUCT MESSAGES (META CATALOG)
# ===============================

async def send_single_product_message(
    phone: str,
    product_retailer_id: str,
    catalog_id: str,
    body_text: Optional[str] = None,
    footer_text: Optional[str] = None
) -> str:
    """
    send a Single Product Message (SPM) via WhatsApp
    displays a single product from the catalog in a Product Detail Page format
    args:
        phone: Recipient phone number
        product_retailer_id: Product retailer_id from catalog (format: creatorId_productId)
        catalog_id: Meta catalog ID (from product.metaCatalog.catalogId in Firestore)
        body_text: Optional body text (default: "Confira este produto!")
        footer_text: Optional footer text
    returns:
        success message or error description
    """
    phone, is_valid, error_msg = validate_and_format_phone(phone)
    if not is_valid:
        logger.error(f"Invalid phone: {error_msg}")
        return f"Error: {error_msg}"

    access_token, phone_number_id = get_whatsapp_credentials()

    if not access_token or not phone_number_id:
        logger.error("Missing WhatsApp credentials")
        return "Error: Missing WhatsApp credentials"

    if not catalog_id:
        logger.error("Catalog ID not provided")
        return "Error: Catalog ID not configured"

    url = f"https://graph.facebook.com/{WHATSAPP_API_VERSION}/{phone_number_id}/messages"

    payload: Dict[str, Any] = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": phone,
        "type": "interactive",
        "interactive": {
            "type": "product",
            "body": {
                "text": body_text or "Confira este produto! 👇"
            },
            "action": {
                "catalog_id": catalog_id,
                "product_retailer_id": product_retailer_id
            }
        }
    }

    if footer_text:
        payload["interactive"]["footer"] = {"text": footer_text}

    logger.info(f"Sending single product message to {phone}: {product_retailer_id}")

    try:
        response = requests.post(
            url,
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            },
            json=payload,
            timeout=30
        )

        if response.status_code == 200:
            logger.info(f"✅ Single product message sent to {phone}")
            return "Product message sent successfully"
        else:
            error_text = response.text
            logger.error(f"Failed to send product message: {response.status_code} - {error_text}")
            return f"Failed to send product message: {response.status_code}"

    except Exception as e:
        logger.error(f"Error sending product message: {e}")
        return f"Error sending product message: {str(e)}"


async def send_multi_product_message(
    phone: str,
    header_text: str,
    body_text: str,
    sections: List[Dict[str, Any]],
    catalog_id: str,
    footer_text: Optional[str] = None
) -> str:
    """
    send a Multi-Product Message (MPM) via WhatsApp
    displays up to 30 products from the catalog, organized in sections
    args:
        phone: Recipient phone number
        header_text: Required header text
        body_text: Required body text
        sections: List of sections, each with 'title' and 'product_retailer_ids' list
        catalog_id: Meta catalog ID (from product.metaCatalog.catalogId in Firestore)
        footer_text: Optional footer text
    returns:
        success message or error description
    example sections:
        [
            {
                "title": "E-books",
                "product_retailer_ids": ["creator1_prod1", "creator1_prod2"]
            }
        ]
    """
    phone, is_valid, error_msg = validate_and_format_phone(phone)
    if not is_valid:
        logger.error(f"Invalid phone: {error_msg}")
        return f"Error: {error_msg}"

    access_token, phone_number_id = get_whatsapp_credentials()

    if not access_token or not phone_number_id:
        logger.error("Missing WhatsApp credentials")
        return "Error: Missing WhatsApp credentials"

    if not catalog_id:
        logger.error("Catalog ID not provided")
        return "Error: Catalog ID not configured"

    # validate max 30 products
    total_products = sum(len(s.get('product_retailer_ids', [])) for s in sections)
    if total_products > 30:
        logger.error(f"Too many products: {total_products} (max 30)")
        return "Error: Maximum 30 products allowed"

    # format sections for the API
    formatted_sections = []
    for section in sections:
        formatted_sections.append({
            "title": section.get("title", "Products"),
            "product_items": [
                {"product_retailer_id": pid}
                for pid in section.get("product_retailer_ids", [])
            ]
        })

    url = f"https://graph.facebook.com/{WHATSAPP_API_VERSION}/{phone_number_id}/messages"

    payload: Dict[str, Any] = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": phone,
        "type": "interactive",
        "interactive": {
            "type": "product_list",
            "header": {
                "type": "text",
                "text": header_text
            },
            "body": {
                "text": body_text
            },
            "action": {
                "catalog_id": catalog_id,
                "sections": formatted_sections
            }
        }
    }

    if footer_text:
        payload["interactive"]["footer"] = {"text": footer_text}

    logger.info(f"Sending multi-product message to {phone}: {total_products} products")

    try:
        response = requests.post(
            url,
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            },
            json=payload,
            timeout=30
        )

        if response.status_code == 200:
            logger.info(f"✅ Multi-product message sent to {phone}")
            return "Product list sent successfully"
        else:
            error_text = response.text
            logger.error(f"Failed to send product list: {response.status_code} - {error_text}")
            return f"Failed to send product list: {response.status_code}"

    except Exception as e:
        logger.error(f"Error sending product list: {e}")
        return f"Error sending product list: {str(e)}"


async def send_catalog_message(
    phone: str,
    body_text: str,
    catalog_id: str,
    footer_text: Optional[str] = None,
    thumbnail_product_retailer_id: Optional[str] = None
) -> str:
    """
    send a Catalog Message via WhatsApp
    displays a button that opens the entire catalog
    args:
        phone: Recipient phone number
        body_text: Required body text
        catalog_id: Meta catalog ID (from product.metaCatalog.catalogId in Firestore)
        footer_text: Optional footer text
        thumbnail_product_retailer_id: Optional product to use as thumbnail
    returns:
        success message or error description
    """
    phone, is_valid, error_msg = validate_and_format_phone(phone)
    if not is_valid:
        logger.error(f"Invalid phone: {error_msg}")
        return f"Error: {error_msg}"

    access_token, phone_number_id = get_whatsapp_credentials()

    if not access_token or not phone_number_id:
        logger.error("Missing WhatsApp credentials")
        return "Error: Missing WhatsApp credentials"

    if not catalog_id:
        logger.error("Catalog ID not provided")
        return "Error: Catalog ID not configured"

    url = f"https://graph.facebook.com/{WHATSAPP_API_VERSION}/{phone_number_id}/messages"

    action: Dict[str, Any] = {
        "name": "catalog_message"
    }

    if thumbnail_product_retailer_id:
        action["parameters"] = {
            "thumbnail_product_retailer_id": thumbnail_product_retailer_id
        }

    payload: Dict[str, Any] = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": phone,
        "type": "interactive",
        "interactive": {
            "type": "catalog_message",
            "body": {
                "text": body_text
            },
            "action": action
        }
    }

    if footer_text:
        payload["interactive"]["footer"] = {"text": footer_text}

    logger.info(f"Sending catalog message to {phone}")

    try:
        response = requests.post(
            url,
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            },
            json=payload,
            timeout=30
        )

        if response.status_code == 200:
            logger.info(f"✅ Catalog message sent to {phone}")
            return "Catalog message sent successfully"
        else:
            error_text = response.text
            logger.error(f"Failed to send catalog message: {response.status_code} - {error_text}")
            return f"Failed to send catalog message: {response.status_code}"

    except Exception as e:
        logger.error(f"Error sending catalog message: {e}")
        return f"Error sending catalog message: {str(e)}"


# ==================================================
# PRODUCT TEMPLATE MESSAGES (SPM & Product Carousel)
# ==================================================

async def send_spm_template(
    phone: str,
    template_name: str,
    product_retailer_id: str,
    catalog_id: Optional[str] = None,
    language_code: str = "pt_BR"
) -> str:
    """
    send a Single Product Message (SPM) Template via WhatsApp
    uses a pre-approved SPM template to display a single product from the catalog
    args:
        phone: Recipient phone number
        template_name: Name of the approved SPM template (e.g. 'zapcomm_produto')
        product_retailer_id: Product retailer_id from catalog (format: creatorId_productId)
        catalog_id: Meta catalog ID (from product.metaCatalog.catalogId in Firestore)
        language_code: Template language code (default: pt_BR)
    returns:
        success message or error description
    """
    phone, is_valid, error_msg = validate_and_format_phone(phone)
    if not is_valid:
        logger.error(f"Invalid phone: {error_msg}")
        return f"Error: {error_msg}"

    access_token, phone_number_id = get_whatsapp_credentials()

    if not access_token or not phone_number_id:
        logger.error("Missing WhatsApp credentials")
        return "Error: Missing WhatsApp credentials"

    if not catalog_id:
        logger.error("Catalog ID not provided")
        return "Error: Catalog ID not configured"

    url = f"https://graph.facebook.com/{WHATSAPP_API_VERSION}/{phone_number_id}/messages"

    payload: Dict[str, Any] = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": phone,
        "type": "template",
        "template": {
            "name": template_name,
            "language": {
                "code": language_code
            },
            "components": [
                {
                    "type": "header",
                    "parameters": [
                        {
                            "type": "product",
                            "product": {
                                "product_retailer_id": product_retailer_id,
                                "catalog_id": catalog_id
                            }
                        }
                    ]
                }
            ]
        }
    }

    logger.info(f"Sending SPM template '{template_name}' to {phone}: product={product_retailer_id}")

    try:
        response = requests.post(
            url,
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            },
            json=payload,
            timeout=30
        )

        if response.status_code == 200:
            logger.info(f"✅ SPM template sent to {phone}")
            return "SPM template sent successfully"
        else:
            error_text = response.text
            logger.error(f"Failed to send SPM template: {response.status_code} - {error_text}")
            return f"Failed to send SPM template: {response.status_code} - {error_text}"

    except Exception as e:
        logger.error(f"Error sending SPM template: {e}")
        return f"Error sending SPM template: {str(e)}"


async def send_product_carousel_template(
    phone: str,
    template_name: str,
    products: List[Dict[str, Any]],
    catalog_id: Optional[str] = None,
    language_code: str = "pt_BR"
) -> str:
    """
    send a Product Card Carousel Template via WhatsApp
    uses a pre-approved product carousel template to display multiple products from the catalog
    args:
        phone: Recipient phone number
        template_name: Name of the approved carousel template (e.g. 'zapcomm_produtos_v2')
        products: List of product dicts, each must have:
            - retailer_id: Product retailer_id from catalog (format: creatorId_productId)
        catalog_id: Meta catalog ID (from product.metaCatalog.catalogId in Firestore)
        language_code: Template language code (default: pt_BR)
    returns:
        success message or error description
    """
    phone, is_valid, error_msg = validate_and_format_phone(phone)
    if not is_valid:
        logger.error(f"Invalid phone: {error_msg}")
        return f"Error: {error_msg}"

    access_token, phone_number_id = get_whatsapp_credentials()

    if not access_token or not phone_number_id:
        logger.error("Missing WhatsApp credentials")
        return "Error: Missing WhatsApp credentials"

    if not catalog_id:
        logger.error("Catalog ID not provided")
        return "Error: Catalog ID not configured"

    if len(products) < 2:
        logger.error(f"Too few products: {len(products)} (min 2 for carousel)")
        return "Error: Minimum 2 products required for carousel"

    if len(products) > 10:
        logger.error(f"Too many products: {len(products)} (max 10)")
        products = products[:10]

    url = f"https://graph.facebook.com/{WHATSAPP_API_VERSION}/{phone_number_id}/messages"

    # build carousel cards - each card has a product header
    carousel_cards = []
    for idx, product in enumerate(products):
        retailer_id = product.get('retailer_id', '')
        if not retailer_id:
            logger.warning(f"Product at index {idx} has no retailer_id, skipping")
            continue

        card: Dict[str, Any] = {
            "card_index": idx,
            "components": [
                {
                    "type": "header",
                    "parameters": [
                        {
                            "type": "product",
                            "product": {
                                "product_retailer_id": retailer_id,
                                "catalog_id": catalog_id
                            }
                        }
                    ]
                }
            ]
        }
        carousel_cards.append(card)

    if len(carousel_cards) < 2:
        logger.error("Not enough valid products for carousel")
        return "Error: Not enough valid products for carousel"

    payload: Dict[str, Any] = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": phone,
        "type": "template",
        "template": {
            "name": template_name,
            "language": {
                "code": language_code
            },
            "components": [
                {
                    "type": "carousel",
                    "cards": carousel_cards
                }
            ]
        }
    }

    logger.info(f"Sending product carousel template '{template_name}' to {phone}: {len(carousel_cards)} products")

    try:
        response = requests.post(
            url,
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            },
            json=payload,
            timeout=30
        )

        if response.status_code == 200:
            logger.info(f"✅ Product carousel template sent to {phone}")
            return "Product carousel sent successfully"
        else:
            error_text = response.text
            logger.error(f"Failed to send product carousel: {response.status_code} - {error_text}")
            return f"Failed to send product carousel: {response.status_code} - {error_text}"

    except Exception as e:
        logger.error(f"Error sending product carousel: {e}")
        return f"Error sending product carousel: {str(e)}"
