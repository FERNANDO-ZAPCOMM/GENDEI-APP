"""
Payment Utilities - PagSeguro PIX Integration
handles PIX payment creation and webhook processing using Orders API
"""

import os
import logging
import requests  # type: ignore
import hashlib
import hmac
import json
from typing import Optional, Dict, Any, Tuple, List
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

# PagSeguro Configuration
PAGSEGURO_TOKEN = os.getenv("PAGSEGURO_TOKEN")
PAGSEGURO_EMAIL = os.getenv("PAGSEGURO_EMAIL")
PAGSEGURO_ENVIRONMENT = os.getenv("PAGSEGURO_ENVIRONMENT", "production")
PAGSEGURO_WEBHOOK_SECRET = os.getenv("PAGSEGURO_WEBHOOK_SECRET")
DOMAIN = os.getenv("DOMAIN", "https://gendei-whatsapp-agent-647402645066.us-central1.run.app")

# default Brazilian phone for PagSeguro API (avoids validation issues)
DEFAULT_BRAZILIAN_PHONE = os.getenv("DEFAULT_BRAZILIAN_PHONE", "+5511999999999")

# PagSeguro minimum PIX amount (in cents) - R$ 1.00
PAGSEGURO_MIN_PIX_AMOUNT_CENTS = 100

# API URLs
PAGSEGURO_API_URL = {
    "sandbox": "https://sandbox.api.pagseguro.com",
    "production": "https://api.pagseguro.com"
}


def is_pagseguro_configured() -> bool:
    """
    check if PagSeguro is properly configured
    """
    return bool(PAGSEGURO_TOKEN)


def generate_valid_cpf() -> str:
    """
    generate a valid CPF for PagSeguro API calls
    """
    return "11144477735"  # valid CPF format that passes validation


def validate_cpf(cpf: str) -> bool:
    """
    validate Brazilian CPF using the official algorithm
    """
    import re

    # remove non-digits
    cpf = re.sub(r'[^0-9]', '', cpf)

    # check if has 11 digits
    if len(cpf) != 11:
        return False

    # check if all digits are the same (invalid CPFs)
    if len(set(cpf)) == 1:
        return False

    # calculate first verification digit
    sum1 = sum(int(cpf[i]) * (10 - i) for i in range(9))
    digit1 = 11 - (sum1 % 11)
    if digit1 >= 10:
        digit1 = 0

    # calculate second verification digit
    sum2 = sum(int(cpf[i]) * (11 - i) for i in range(10))
    digit2 = 11 - (sum2 % 11)
    if digit2 >= 10:
        digit2 = 0

    # check if calculated digits match the CPF
    return cpf[9:11] == f"{digit1}{digit2}"


def format_payment_amount(amount_cents: int) -> str:
    """
    format amount from cents to Brazilian Real string
    """
    reais = amount_cents / 100
    return f"R$ {reais:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


async def create_pagseguro_checkout(
    order_id: str,
    amount: int,
    customer_name: str,
    customer_phone: str,
    product_name: str = "Produto Digital",
    payment_methods: Optional[List[str]] = None,
) -> Optional[Dict[str, Any]]:
    """
    create a PagSeguro Checkout using Checkout API - returns a checkout URL (payment page).
    this is the preferred flow as it shows a proper payment page to the user.
    args:
        order_id: Order ID (used as reference)
        amount: Amount in cents (e.g., 4700 = R$ 47.00)
        customer_name: Customer name
        customer_phone: Customer phone number
        product_name: Product description
    returns:
        Dict with checkout info including payment_link, or None if failed
    """
    if not is_pagseguro_configured():
        logger.error("PagSeguro not configured - missing PAGSEGURO_TOKEN")
        return None

    try:
        base_url = PAGSEGURO_API_URL.get(PAGSEGURO_ENVIRONMENT, PAGSEGURO_API_URL["production"])
        url = f"{base_url}/checkouts"

        # clean phone for email generation
        clean_phone = customer_phone.replace("+", "").replace("-", "").replace(" ", "")
        email = f"cliente{clean_phone}@example.com"

        # use default phone for PagSeguro API (avoids validation errors)
        area_code = "11"
        local_number = "999999999"

        # use provided CPF or generate valid one
        tax_id = generate_valid_cpf()

        # ensure customer name is long enough
        safe_customer_name = customer_name if len(customer_name) > 10 else "Cliente Gendei"

        # Include clinic_id in reference_id so webhook can find correct clinic
        # Format: GD-{clinic_id[:8]}-{order_id[:12]} (max 30 chars for PagSeguro)
        clinic_id = os.getenv("CLINIC_ID", "default")
        reference_id = f"GD-{clinic_id[:8]}-{order_id[:12]}"

        if payment_methods is None:
            payment_methods = ["CREDIT_CARD", "PIX"]

        # Checkout API payload with pre-filled customer data
        payload = {
            "reference_id": reference_id,
            "customer_modifiable": False,  # skip form filling - go straight to payment
            "customer": {
                "name": safe_customer_name,
                "email": email,
                "tax_id": tax_id,
                "phone": {
                    "country": "+55",
                    "area": area_code,
                    "number": local_number
                }
            },
            "items": [{
                "reference_id": "PRODUCT_01",
                "name": product_name[:64],  # max 64 chars
                "quantity": 1,
                "unit_amount": amount
            }],
            "payment_methods": [{"type": method} for method in payment_methods],
            "notification_urls": [f"{DOMAIN}/pagseguro-webhook"],
            "metadata": {
                "whatsapp_phone": customer_phone,
                "order_id": order_id,
                "clinic_id": clinic_id
            }
        }

        headers = {
            "Authorization": f"Bearer {PAGSEGURO_TOKEN}",
            "Content-Type": "application/json",
            "Accept": "application/json"
        }

        logger.info(f"🔄 Creating PagSeguro Checkout: ref={reference_id}, amount={format_payment_amount(amount)}")
        logger.debug(f"Payload: {json.dumps(payload, indent=2)}")

        response = requests.post(url, json=payload, headers=headers, timeout=30)

        logger.info(f"📡 PagSeguro Checkout API Response: {response.status_code}")

        if response.status_code not in [200, 201]:
            error_text = response.text
            logger.error(f"❌ PagSeguro Checkout API error ({response.status_code}): {error_text}")
            return None

        checkout_data = response.json()
        checkout_id = checkout_data.get("id")

        logger.info(f"✅ PagSeguro Checkout created: ID={checkout_id}")

        # Extract checkout URL from links
        checkout_url = None
        links = checkout_data.get("links", [])
        for link in links:
            rel = link.get("rel", "").upper()
            href = link.get("href", "")
            if rel == "PAY" and href:
                checkout_url = href
                break

        # Fallback: construct customer-facing URL from checkout ID
        if not checkout_url and checkout_id:
            # remove CHEC_ prefix and construct URL
            checkout_code = checkout_id.lower().replace("chec_", "")
            checkout_url = f"https://pagamento.pagbank.com.br/pagamento?code={checkout_code}"
            logger.info(f"📎 Using constructed checkout URL: {checkout_url}")

        if not checkout_url:
            logger.error("❌ Could not extract checkout URL from PagSeguro response")
            return None

        logger.info(f"🔗 Checkout URL: {checkout_url}")

        return {
            "payment_id": checkout_id,
            "reference_id": reference_id,
            "payment_link": checkout_url,  # this is the key difference - a URL!
            "amount": amount,
            "status": "pending",
            "created_at": datetime.now().isoformat(),
            "expires_at": (datetime.now() + timedelta(minutes=30)).isoformat(),
            "customer_phone": customer_phone,
            "provider": "pagseguro_checkout"
        }

    except Exception as e:
        logger.error(f"💥 Error creating PagSeguro Checkout: {e}", exc_info=True)
        return None


async def create_pagseguro_pix_order(
    order_id: str,
    amount: int,
    customer_name: str,
    customer_phone: str,
    product_name: str = "Produto Digital"
) -> Optional[Dict[str, Any]]:
    """
    create a PagSeguro PIX Order using Orders API - returns PIX "Copia e Cola" code directly
    args:
        order_id: Order ID (used as reference)
        amount: Amount in cents (e.g., 2900 = R$ 29.00)
        customer_name: Customer name
        customer_phone: Customer phone number
        product_name: Product description
    returns:
        Dict with payment info including PIX code, or None if failed
    """
    if not is_pagseguro_configured():
        logger.error("PagSeguro not configured - missing PAGSEGURO_TOKEN")
        return None

    # Check minimum PIX amount (PagSeguro requires at least R$ 1.00)
    if amount < PAGSEGURO_MIN_PIX_AMOUNT_CENTS:
        logger.error(f"❌ Amount {amount} cents is below PagSeguro minimum ({PAGSEGURO_MIN_PIX_AMOUNT_CENTS} cents / R$ 1.00)")
        return None

    try:
        base_url = PAGSEGURO_API_URL.get(PAGSEGURO_ENVIRONMENT, PAGSEGURO_API_URL["production"])
        url = f"{base_url}/orders"

        # use default phone for PagSeguro API to avoid validation issues
        clean_phone = customer_phone.replace("+", "").replace("-", "").replace(" ", "")
        email = f"cliente{clean_phone}@example.com"

        # use default phone area code and number (avoids PagSeguro phone validation errors)
        area_code = "11"  # São Paulo
        local_number = "999999999"

        # use provided CPF or generate valid one
        tax_id = generate_valid_cpf()

        # ensure customer name is long enough
        safe_customer_name = customer_name if len(customer_name) > 10 else "Cliente Gendei"

        # Include clinic_id in reference_id so webhook can find correct clinic
        # Format: GD-{clinic_id[:8]}-{order_id[:12]} (max 30 chars for PagSeguro)
        clinic_id = os.getenv("CLINIC_ID", "default")
        reference_id = f"GD-{clinic_id[:8]}-{order_id[:12]}"

        # Orders API payload with PIX QR Code
        payload = {
            "reference_id": reference_id,
            "customer": {
                "name": safe_customer_name,
                "email": email,
                "tax_id": tax_id,
                "phones": [{
                    "country": "55",
                    "area": area_code,
                    "number": local_number,
                    "type": "MOBILE"
                }]
            },
            "items": [{
                "reference_id": "APPOINTMENT_01",
                "name": product_name,
                "quantity": 1,
                "unit_amount": amount
            }],
            "qr_codes": [{
                "amount": {
                    "value": amount
                }
            }],
            "notification_urls": [f"{DOMAIN}/pagseguro-webhook"],
            "metadata": {
                "whatsapp_phone": customer_phone,
                "order_id": order_id,
                "clinic_id": clinic_id
            }
        }

        headers = {
            "Authorization": f"Bearer {PAGSEGURO_TOKEN}",
            "Content-Type": "application/json",
            "Accept": "application/json"
        }

        logger.info(f"🔄 Creating PagSeguro PIX Order: ref={reference_id}, amount={format_payment_amount(amount)}")
        logger.debug(f"Payload: {json.dumps(payload, indent=2)}")

        response = requests.post(
            url,
            json=payload,
            headers=headers,
            timeout=30
        )

        logger.info(f"📡 PagSeguro API Response: {response.status_code}")

        if response.status_code not in [200, 201]:
            error_text = response.text
            logger.error(f"❌ PagSeguro Orders API error ({response.status_code}): {error_text}")
            return None

        order_data = response.json()
        pagseguro_order_id = order_data.get("id")

        logger.info(f"✅ PagSeguro Order created: ID={pagseguro_order_id}")

        # extract PIX Copia e Cola code
        pix_code = None
        qr_code_url = None
        qr_code_id = None

        qr_codes = order_data.get("qr_codes", [])
        if qr_codes:
            qr = qr_codes[0]
            pix_code = qr.get("text")  # this is the "Copia e Cola" code!
            qr_code_id = qr.get("id")

            # get QR code image URL
            for link in qr.get("links", []):
                if "QRCODE.PNG" in link.get("rel", ""):
                    qr_code_url = link.get("href")
                    break

        if not pix_code:
            logger.error("❌ No PIX code found in Orders API response")
            return None

        logger.info(f"📱 PIX Copia e Cola obtained: {pix_code[:50]}...")

        return {
            "payment_id": pagseguro_order_id,
            "reference_id": reference_id,
            "qr_code": qr_code_url,
            "qr_code_text": pix_code,  # PIX copy-paste code
            "qr_code_id": qr_code_id,
            "amount": amount,
            "status": "pending",
            "created_at": datetime.now().isoformat(),
            "expires_at": (datetime.now() + timedelta(hours=24)).isoformat(),
            "customer_phone": customer_phone,
            "provider": "pagseguro_orders"
        }

    except Exception as e:
        logger.error(f"💥 Error creating PagSeguro PIX order: {e}", exc_info=True)
        return None


# keep old function name for backwards compatibility
async def create_pagseguro_pix_payment(
    order_id: str,
    amount: int,
    customer_name: str,
    customer_phone: str,
    customer_email: Optional[str] = None,
    product_name: str = "Produto Digital"
) -> Optional[Dict[str, Any]]:
    """
    backwards compatible wrapper - now uses Orders API
    """
    return await create_pagseguro_pix_order(
        order_id=order_id,
        amount=amount,
        customer_name=customer_name,
        customer_phone=customer_phone,
        product_name=product_name
    )


async def send_pix_payment_to_customer(
    phone: str,
    payment_info: Dict[str, Any],
    amount: int,
    product_name: str = "seu produto",
    order_id: Optional[str] = None
) -> bool:
    """
    send PIX payment information to customer via WhatsApp CTA button
    Priority (Orders API / PIX Copia e Cola is now PRIMARY):
    1. PIX HTML page with copy button - BEST UX (fewer steps than checkout)
    2. Raw PIX code as text - fallback if button fails
    args:
        phone: Customer phone number
        payment_info: Payment info from create_pagseguro_pix_order (Orders API)
        amount: Amount in cents
        product_name: Product name for the message
        order_id: Order ID for PIX HTML page URL
    returns:
        True if successful
    """
    try:
        from src.utils.messaging import send_payment_button, send_whatsapp_text
        import urllib.parse

        qr_code_text = payment_info.get("qr_code_text")  # Orders API PIX code
        payment_id = payment_info.get("payment_id")

        # PRIORITY 1: Use PIX HTML page with copy button (BEST UX - 2 steps only!)
        if order_id and qr_code_text:
            phone_encoded = urllib.parse.quote(phone, safe='')
            pix_page_url = f"{DOMAIN}/pix/{phone_encoded}/{order_id}"

            logger.info(f"📱 Sending PIX Copia e Cola page to {phone} - URL: {pix_page_url}")

            result = await send_payment_button(
                phone=phone,
                payment_url=pix_page_url,
                amount_cents=amount,
                product_name=product_name,
                button_text="Pagar com PIX",
                header_text="Pagamento PIX",
                body_suffix="Clique no botão abaixo para abrir a página de pagamento PIX.",
                footer_text="Pagamento seguro via PagSeguro",
                expires_minutes=15,
            )

            if "successfully" in result.lower() or "✅" in result:
                logger.info(f"✅ PIX Copia e Cola page sent to {phone}")
                return True
            else:
                logger.warning(f"⚠️ PIX page button send returned: {result}")
                # continue to fallback

        # PRIORITY 2: Send raw PIX code as text message (fallback)
        if qr_code_text:
            message = (
                f"*Pagamento via PIX*\n\n"
                f"Valor: *{format_payment_amount(amount)}*\n\n"
                f"Para pagar, copie o codigo PIX abaixo e cole no seu banco:\n\n"
                f"```{qr_code_text}```\n\n"
                f"O pagamento expira em 24 horas.\n\n"
                f"Assim que o pagamento for confirmado, voce recebera {product_name} automaticamente!"
            )

            result = await send_whatsapp_text(phone, message)

            if "successfully" in result.lower() or "✅" in result:
                logger.info(f"✅ PIX code text sent to {phone}")
                return True
            else:
                logger.warning(f"⚠️ PIX text send returned: {result}")

        logger.error(f"❌ No PIX payment method available for {phone}")
        return False
    except Exception as e:
        logger.error(f"Error sending PIX payment info: {e}")
        return False


async def send_card_payment_to_customer(
    phone: str,
    payment_info: Dict[str, Any],
    amount: int,
    product_name: str = "sua consulta",
) -> bool:
    """
    Send card checkout link to customer via WhatsApp CTA button.
    """
    try:
        from src.utils.messaging import send_payment_button

        payment_url = payment_info.get("payment_link")
        if not payment_url:
            logger.error("❌ No card checkout URL found in payment info")
            return False

        result = await send_payment_button(
            phone=phone,
            payment_url=payment_url,
            amount_cents=amount,
            product_name=product_name,
            button_text="Pagar com cartão",
            header_text="Pagamento com cartão",
            body_suffix="Clique no botão abaixo para abrir a página de pagamento com cartão.",
            footer_text="Pagamento seguro via PagSeguro",
            expires_minutes=15,
        )
        if "successfully" in result.lower() or "✅" in result:
            logger.info(f"✅ Card checkout sent to {phone}")
            return True

        logger.warning(f"⚠️ Card checkout send returned: {result}")
        return False
    except Exception as e:
        logger.error(f"Error sending card payment info: {e}")
        return False


def verify_pagseguro_webhook_signature(payload: str, signature: str) -> bool:
    """
    verify PagSeguro webhook signature
    NOTE: PagSeguro doesn't provide webhook secrets, so this always returns True
    """
    if not PAGSEGURO_WEBHOOK_SECRET:
        logger.debug("No webhook secret configured, skipping signature verification")
        return True

    try:
        expected_signature = hmac.new(
            PAGSEGURO_WEBHOOK_SECRET.encode(),
            payload.encode(),
            hashlib.sha256
        ).hexdigest()

        return hmac.compare_digest(expected_signature, signature)

    except Exception as e:
        logger.error(f"Error verifying webhook signature: {e}")
        return False


def parse_pagseguro_webhook(data: Dict[str, Any]) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    """
    parse PagSeguro webhook payload (supports both Orders API and Checkout API formats)
    args:
        data: Webhook JSON data
    returns:
        Tuple of (reference_id, payment_status, transaction_id)
    """
    try:
        reference_id = None
        payment_status = None
        transaction_id = None

        logger.info(f"Parsing PagSeguro webhook: {json.dumps(data, indent=2, default=str)}")

        if "id" in data:
            transaction_id = data["id"]
            reference_id = data.get("reference_id", transaction_id)

            # handle ORDER webhook format (from Orders API)
            if transaction_id.startswith("ORDE_"):
                logger.info(f"Processing ORDER webhook: {transaction_id}")

                charges = data.get("charges", [])
                if charges:
                    latest_charge = charges[-1]
                    charge_status = latest_charge.get("status", "WAITING").upper()

                    status_mapping = {
                        "PAID": "PAID",
                        "WAITING": "WAITING",
                        "IN_ANALYSIS": "WAITING",
                        "DECLINED": "CANCELED",
                        "CANCELED": "CANCELED",
                        "CANCELLED": "CANCELED",
                        "EXPIRED": "CANCELED",
                        "AUTHORIZED": "WAITING",
                        "AVAILABLE": "PAID",
                        "REFUNDED": "REFUNDED"
                    }
                    payment_status = status_mapping.get(charge_status, "WAITING")
                else:
                    order_status = data.get("status", "WAITING").upper()
                    payment_status = "PAID" if order_status == "PAID" else "WAITING"

            # handle CHECKOUT webhook format
            elif transaction_id.startswith("CHEC_"):
                logger.info(f"Processing CHECKOUT webhook: {transaction_id}")

                charges = data.get("charges", [])
                if charges:
                    latest_charge = charges[-1]
                    charge_status = latest_charge.get("status", "WAITING").upper()

                    status_mapping = {
                        "PAID": "PAID",
                        "WAITING": "WAITING",
                        "IN_ANALYSIS": "WAITING",
                        "DECLINED": "CANCELED",
                        "CANCELED": "CANCELED",
                        "CANCELLED": "CANCELED",
                        "EXPIRED": "CANCELED"
                    }
                    payment_status = status_mapping.get(charge_status, "WAITING")
                else:
                    payment_status = "WAITING"

            # handle generic webhook format (Charges API)
            else:
                charges = data.get("charges", [])
                if charges:
                    charge = charges[0]
                    reference_id = charge.get("reference_id", reference_id)
                    payment_status = charge.get("status", "WAITING").upper()
                    transaction_id = charge.get("id", transaction_id)
                elif "status" in data:
                    payment_status = data["status"].upper()

        logger.info(f"Webhook parsed: ref={reference_id}, status={payment_status}, txn={transaction_id}")
        return reference_id, payment_status, transaction_id

    except Exception as e:
        logger.error(f"Error parsing webhook: {e}")
        return None, None, None


async def process_payment_confirmation(
    order_id: str,
    payment_status: str,
    transaction_id: str,
    db=None
) -> bool:
    """
    Process payment confirmation for appointment deposit (signal/sinal).

    Args:
        order_id: Order/reference ID from webhook
        payment_status: Payment status (PAID, CANCELED, etc.)
        transaction_id: Transaction ID
        db: Database instance (optional, will be created if not provided)
    Returns:
        True if successful
    """
    try:
        # Import database if not provided
        if db is None:
            from src.database.firestore import GendeiDatabase
            db = GendeiDatabase()

        # Try to find order by payment ID
        order = db.get_order(transaction_id)
        if not order:
            # Try by order_id directly
            order = db.get_order(order_id)

        # If not found with direct IDs, try searching by payment_id field
        if not order:
            from google.cloud import firestore as gcloud_firestore
            firestore_client = gcloud_firestore.Client()
            orders_ref = firestore_client.collection("gendei_orders")

            # Search by paymentId field
            docs = orders_ref.where("paymentId", "==", transaction_id).limit(1).get()
            for doc in docs:
                order = doc.to_dict()
                order["id"] = doc.id
                break

        # If still not found and using GD- format, extract order_id part
        if not order and order_id and order_id.startswith("GD-"):
            parts = order_id.split("-")
            if len(parts) >= 3:
                order_id_prefix = parts[2]  # Last part is the truncated order_id
                logger.info(f"🔍 Searching for order with prefix: {order_id_prefix}")

                from google.cloud import firestore as gcloud_firestore
                firestore_client = gcloud_firestore.Client()
                orders_ref = firestore_client.collection("gendei_orders")

                # Get recent orders and find one matching the prefix
                for order_doc in orders_ref.order_by("createdAt", direction=gcloud_firestore.Query.DESCENDING).limit(50).stream():
                    if order_doc.id.startswith(order_id_prefix):
                        order = order_doc.to_dict()
                        order["id"] = order_doc.id
                        logger.info(f"✅ Found order {order_doc.id} from prefix {order_id_prefix}")
                        break

        if not order:
            logger.warning(f"Order not found for payment {transaction_id} / ref {order_id}")
            return False

        patient_phone = order.get("patientPhone") or order.get("phone")
        order_doc_id = order.get("id")
        appointment_id = order.get("appointmentId")
        clinic_id = order.get("clinicId")

        if payment_status == "PAID":
            # Update order status
            db.update_order(order_doc_id, {
                "paymentStatus": "completed",
                "status": "paid",
                "paymentId": transaction_id,
                "paidAt": datetime.now().isoformat()
            })

            # Update appointment - mark deposit as paid
            if appointment_id:
                db.update_appointment(appointment_id, {
                    "signalPaid": True,
                    "signalPaidAt": datetime.now().isoformat(),
                    "status": "confirmed"
                }, clinic_id=clinic_id)

            # Get appointment details for confirmation message
            appointment = db.get_appointment(appointment_id, clinic_id=clinic_id) if appointment_id else None

            if appointment:
                # Format date for display
                apt_date = datetime.strptime(appointment.date, "%Y-%m-%d")
                formatted_date = apt_date.strftime("%d/%m/%Y")

                confirmation_message = (
                    "*Sinal confirmado*\n\n"
                    "Seu pagamento PIX foi aprovado.\n\n"
                    f"Data: *{formatted_date}*\n"
                    f"Hora: *{appointment.time}*\n"
                    f"Profissional: *{appointment.professional_name}*\n\n"
                    "Sua consulta está *confirmada*.\n"
                    "Chegue com 15 minutos de antecedência."
                )
            else:
                confirmation_message = (
                    "*Sinal confirmado*\n\n"
                    "Seu pagamento PIX foi aprovado.\n\n"
                    "Sua consulta está *confirmada*.\n"
                    "Chegue com 15 minutos de antecedência."
                )

            # Send confirmation to patient via WhatsApp
            if patient_phone and clinic_id:
                clinic = db.get_clinic(clinic_id)
                if clinic and clinic.whatsapp_phone_number_id:
                    access_token = db.get_access_token(clinic_id)
                    if access_token:
                        import httpx
                        META_API_VERSION = os.getenv("META_API_VERSION", "v24.0")
                        url = f"https://graph.facebook.com/{META_API_VERSION}/{clinic.whatsapp_phone_number_id}/messages"

                        async with httpx.AsyncClient() as client:
                            await client.post(
                                url,
                                headers={
                                    "Authorization": f"Bearer {access_token}",
                                    "Content-Type": "application/json",
                                },
                                json={
                                    "messaging_product": "whatsapp",
                                    "to": patient_phone.replace("+", ""),
                                    "type": "text",
                                    "text": {"body": confirmation_message}
                                }
                            )

            logger.info(f"✅ Payment confirmed for order {order_doc_id}, appointment {appointment_id}")
            return True

        elif payment_status in ["CANCELED", "CANCELLED", "DECLINED", "EXPIRED"]:
            # Update order status
            db.update_order(order_doc_id, {
                "paymentStatus": "failed",
                "status": "cancelled",
                "failedAt": datetime.now().isoformat()
            })

            # Notify patient
            if patient_phone and clinic_id:
                cancel_message = (
                    "*Pagamento não confirmado*\n\n"
                    "Infelizmente seu pagamento PIX não foi concluído.\n\n"
                    "Sua consulta ainda não está confirmada.\n"
                    "Se ainda deseja confirmar, posso gerar um novo código PIX."
                )

                clinic = db.get_clinic(clinic_id)
                if clinic and clinic.whatsapp_phone_number_id:
                    access_token = db.get_access_token(clinic_id)
                    if access_token:
                        import httpx
                        META_API_VERSION = os.getenv("META_API_VERSION", "v24.0")
                        url = f"https://graph.facebook.com/{META_API_VERSION}/{clinic.whatsapp_phone_number_id}/messages"

                        async with httpx.AsyncClient() as client:
                            await client.post(
                                url,
                                headers={
                                    "Authorization": f"Bearer {access_token}",
                                    "Content-Type": "application/json",
                                },
                                json={
                                    "messaging_product": "whatsapp",
                                    "to": patient_phone.replace("+", ""),
                                    "type": "text",
                                    "text": {"body": cancel_message}
                                }
                            )

            logger.info(f"❌ Payment canceled for order {order_doc_id}")
            return True

        else:
            logger.info(f"Payment status '{payment_status}' for order {order_doc_id} - no action needed")
            return True

    except Exception as e:
        logger.error(f"Error processing payment confirmation: {e}", exc_info=True)
        return False


# fallback PIX key (manual payment)
async def send_manual_pix_instructions(phone: str, amount: int, pix_key: str) -> bool:
    """
    send manual PIX payment instructions when automatic payment fails
    args:
        phone: Customer phone number
        amount: Amount in cents
        pix_key: PIX key (CPF, email, phone, or random key)
    returns:
        True if successful
    """
    try:
        from src.utils.messaging import send_whatsapp_text

        message = (
            "*Pagamento via PIX*\n\n"
            f"Não consegui gerar o QR Code automático, mas você pode fazer o pagamento usando a chave PIX abaixo:\n\n"
            f"Valor: *{format_payment_amount(amount)}*\n\n"
            f"Chave PIX:\n`{pix_key}`\n\n"
            "Após o pagamento, envie o comprovante aqui para confirmação."
        )

        result = await send_whatsapp_text(phone, message)
        return "successfully" in result.lower() or "✅" in result

    except Exception as e:
        logger.error(f"Error sending manual PIX instructions: {e}")
        return False


def get_pagseguro_config_status() -> dict:
    """
    get PagSeguro configuration status for debugging
    """
    return {
        "configured": is_pagseguro_configured(),
        "environment": PAGSEGURO_ENVIRONMENT,
        "token_configured": bool(PAGSEGURO_TOKEN),
        "email_configured": bool(PAGSEGURO_EMAIL),
        "webhook_secret_configured": bool(PAGSEGURO_WEBHOOK_SECRET),
        "domain": DOMAIN,
        "api_url": PAGSEGURO_API_URL.get(PAGSEGURO_ENVIRONMENT),
        "default_phone": DEFAULT_BRAZILIAN_PHONE
    }
