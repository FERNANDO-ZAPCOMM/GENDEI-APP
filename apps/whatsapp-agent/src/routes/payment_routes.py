"""Payment and PIX-related routes."""

from __future__ import annotations

import json
import logging
import os
import urllib.parse
from datetime import datetime
from typing import Any, Awaitable, Callable

from fastapi import BackgroundTasks, HTTPException, Request  # type: ignore
from fastapi.responses import HTMLResponse  # type: ignore

logger = logging.getLogger(__name__)

GetDb = Callable[[], Any]
RequireServiceSecret = Callable[[Request], None]
SendWhatsAppMessage = Callable[[str, str, str, str], Awaitable[bool]]


def register_payment_routes(
    app: Any,
    *,
    get_db: GetDb,
    require_service_secret: RequireServiceSecret,
    send_whatsapp_message: SendWhatsAppMessage,
) -> None:
    """Register payment webhook/callback/PIX page routes."""

    @app.post("/pagseguro-webhook")
    async def pagseguro_webhook(request: Request, background_tasks: BackgroundTasks):
        try:
            body = await request.body()
            signature = request.headers.get("X-PagSeguro-Signature", "")
            logger.info("📨 PagSeguro webhook received: %s", body.decode()[:500])
            data = json.loads(body.decode())

            from src.utils.payment import (
                parse_pagseguro_webhook,
                process_payment_confirmation,
                verify_pagseguro_webhook_signature,
            )

            if not verify_pagseguro_webhook_signature(body.decode(), signature):
                logger.warning("Invalid PagSeguro webhook signature")
                raise HTTPException(status_code=401, detail="Invalid webhook signature")

            reference_id, payment_status, transaction_id = parse_pagseguro_webhook(data)
            if not reference_id or not payment_status:
                logger.warning("Invalid webhook payload - missing reference_id or status")
                return {"status": "ignored", "reason": "missing_data"}

            logger.info(
                "💳 Payment webhook: ref=%s, status=%s, txn=%s",
                reference_id,
                payment_status,
                transaction_id,
            )

            background_tasks.add_task(
                process_payment_confirmation,
                reference_id,
                payment_status,
                transaction_id,
                get_db(),
            )
            return {"status": "ok", "reference_id": reference_id}
        except HTTPException:
            raise
        except json.JSONDecodeError as exc:
            logger.error("❌ Invalid JSON in webhook: %s", exc)
            return {"status": "error", "message": "Invalid JSON"}
        except Exception as exc:
            logger.error("Error processing PagSeguro webhook: %s", exc)
            return {"status": "error", "message": str(exc)}

    @app.post("/stripe-payment-callback")
    async def stripe_payment_callback(request: Request):
        require_service_secret(request)

        data = await request.json()
        clinic_id = data.get("clinicId")
        appointment_id = data.get("appointmentId")
        patient_phone = data.get("patientPhone")
        payment_status = data.get("paymentStatus")

        if payment_status != "completed" or not patient_phone or not clinic_id:
            return {"status": "ignored"}

        db = get_db()
        if not db:
            return {"status": "error", "message": "Database not initialized"}

        try:
            clinic = db.get_clinic(clinic_id)
            if not clinic or not clinic.whatsapp_phone_number_id:
                logger.warning(
                    "Stripe callback: clinic %s not found or no WhatsApp configured",
                    clinic_id,
                )
                return {"status": "error", "message": "Clinic not configured"}

            access_token = db.get_access_token(clinic_id)
            if not access_token:
                logger.warning("Stripe callback: no access token for clinic %s", clinic_id)
                return {"status": "error", "message": "No access token"}

            appointment = db.get_appointment(appointment_id, clinic_id=clinic_id) if appointment_id else None

            if appointment:
                dt = datetime.strptime(appointment.date, "%Y-%m-%d")
                formatted_date = dt.strftime("%d/%m/%Y")
                message = (
                    "*Pagamento confirmado*\n\n"
                    "Seu pagamento com cartao foi aprovado.\n\n"
                    f"Data: *{formatted_date}*\n"
                    f"Hora: *{appointment.time}*\n"
                    f"Profissional: *{appointment.professional_name}*\n\n"
                    "Sua consulta esta *confirmada*.\n"
                    "Chegue com 15 minutos de antecedencia."
                )
            else:
                message = (
                    "*Pagamento confirmado*\n\n"
                    "Seu pagamento com cartao foi aprovado.\n\n"
                    "Sua consulta esta *confirmada*.\n"
                    "Chegue com 15 minutos de antecedencia."
                )

            phone_clean = patient_phone.replace("+", "")
            await send_whatsapp_message(
                clinic.whatsapp_phone_number_id,
                phone_clean,
                message,
                access_token,
            )

            logger.info(
                "Stripe payment confirmation sent to %s for clinic %s",
                patient_phone,
                clinic_id,
            )
            return {"status": "ok"}
        except Exception as exc:
            logger.error("Error in stripe payment callback: %s", exc, exc_info=True)
            return {"status": "error", "message": str(exc)}

    @app.get("/pix/{phone}/{order_id}")
    async def pix_payment_page(phone: str, order_id: str):
        try:
            from jinja2 import Environment, FileSystemLoader  # type: ignore

            phone = urllib.parse.unquote(phone)
            logger.info("📱 PIX page requested: phone=%s, order=%s", phone, order_id)

            db = get_db()
            order = db.get_order(order_id) if db else None

            if not order:
                from google.cloud import firestore as gcloud_firestore

                firestore_client = gcloud_firestore.Client()
                orders_ref = firestore_client.collection_group("orders")
                for order_doc in orders_ref.order_by(
                    "createdAt",
                    direction=gcloud_firestore.Query.DESCENDING,
                ).limit(100).stream():
                    if order_doc.id == order_id or order_doc.id.startswith(order_id[:12]):
                        order = order_doc.to_dict()
                        order["id"] = order_doc.id
                        break

            if not order:
                return HTMLResponse(
                    content="""
                <!DOCTYPE html>
                <html lang="pt-BR">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>PIX não encontrado</title>
                    <style>
                        body { font-family: sans-serif; padding: 40px 20px; text-align: center; }
                        h1 { color: #dc2626; }
                        p { color: #666; }
                    </style>
                </head>
                <body>
                    <h1>❌ PIX não encontrado</h1>
                    <p>Este código PIX expirou ou não foi encontrado.</p>
                    <p>Volte ao WhatsApp e solicite um novo link de pagamento.</p>
                </body>
                </html>
            """,
                    status_code=404,
                )

            pix_code = order.get("pixCopiaCola") or order.get("qr_code_text")
            qr_code_url = order.get("qrCodeUrl") or order.get("qr_code")
            amount_cents = order.get("amountCents") or order.get("amount", 0)
            description = order.get("description", "Sinal de Consulta")

            if not pix_code:
                return HTMLResponse(
                    content="""
                <!DOCTYPE html>
                <html lang="pt-BR">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>PIX não disponível</title>
                    <style>
                        body { font-family: sans-serif; padding: 40px 20px; text-align: center; }
                        h1 { color: #dc2626; }
                        p { color: #666; }
                    </style>
                </head>
                <body>
                    <h1>❌ PIX não disponível</h1>
                    <p>O código PIX deste pedido expirou.</p>
                    <p>Volte ao WhatsApp e solicite um novo link de pagamento.</p>
                </body>
                </html>
            """,
                    status_code=410,
                )

            from src.utils.payment import format_payment_amount

            amount_formatted = format_payment_amount(amount_cents)
            template_dir = os.path.join(os.path.dirname(__file__), "..", "templates")
            template_dir = os.path.normpath(template_dir)
            jinja_env = Environment(loader=FileSystemLoader(template_dir))

            try:
                template = jinja_env.get_template("pix_payment.html")
                html_content = template.render(
                    product_name=description,
                    qr_code_url=qr_code_url,
                    pix_code=pix_code,
                    pix_code_preview=pix_code[:40] if len(pix_code) > 40 else pix_code,
                    amount_formatted=amount_formatted,
                )
                return HTMLResponse(content=html_content)
            except Exception as template_error:
                logger.error("Template error: %s", template_error)
                return HTMLResponse(
                    content=f"""
                <!DOCTYPE html>
                <html lang="pt-BR">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>PIX - {amount_formatted}</title>
                    <style>
                        body {{ font-family: sans-serif; padding: 20px; }}
                        .amount {{ font-size: 24px; font-weight: bold; }}
                        .code {{ background: #f0f0f0; padding: 10px; word-break: break-all; font-family: monospace; }}
                        button {{ background: #00a650; color: white; padding: 15px 30px; border: none; font-size: 16px; cursor: pointer; }}
                    </style>
                </head>
                <body>
                    <h2>{description}</h2>
                    <p class="amount">{amount_formatted}</p>
                    <p>Copie o código PIX abaixo:</p>
                    <div class="code" id="pixCode">{pix_code}</div>
                    <br>
                    <button onclick="navigator.clipboard.writeText(document.getElementById('pixCode').textContent).then(() => this.textContent = 'Copiado!')">
                        Copiar código
                    </button>
                </body>
                </html>
            """,
                )
        except Exception as exc:
            logger.error("❌ Error rendering PIX page: %s", exc)
            return HTMLResponse(
                content="""
            <!DOCTYPE html>
            <html lang="pt-BR">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Erro</title>
                <style>
                    body { font-family: sans-serif; padding: 40px 20px; text-align: center; }
                    h1 { color: #dc2626; }
                </style>
            </head>
            <body>
                <h1>❌ Erro</h1>
                <p>Ocorreu um erro ao carregar a página de pagamento.</p>
                <p>Por favor, tente novamente pelo WhatsApp.</p>
            </body>
            </html>
        """,
                status_code=500,
            )
