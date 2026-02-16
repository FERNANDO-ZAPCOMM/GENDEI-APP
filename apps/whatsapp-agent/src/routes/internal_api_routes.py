"""Internal API routes used by Cloud Functions/schedulers."""

from __future__ import annotations

import logging
from typing import Any, Awaitable, Callable, Dict, List

from fastapi import HTTPException, Request  # type: ignore

logger = logging.getLogger(__name__)

RequireServiceSecret = Callable[[Request], None]
EnsurePhoneHasPlus = Callable[[str], str]
GetDb = Callable[[], Any]
SendWhatsAppMessage = Callable[[str, str, str, str], Awaitable[bool]]
SendWhatsAppButtons = Callable[[str, str, str, List[Dict[str, str]], str], Awaitable[bool]]
FormatReminderMessage = Callable[[Any, str, str, str], str]
MarkReminderSent = Callable[[Any, str, str], Any]


def register_internal_api_routes(
    app: Any,
    *,
    get_db: GetDb,
    require_service_secret: RequireServiceSecret,
    ensure_phone_has_plus: EnsurePhoneHasPlus,
    send_whatsapp_message: SendWhatsAppMessage,
    send_whatsapp_buttons: SendWhatsAppButtons,
    format_reminder_message: FormatReminderMessage,
    mark_reminder_sent: MarkReminderSent,
) -> None:
    """Register internal API endpoints."""

    @app.post("/api/send-reminder")
    async def send_reminder(request: Request):
        try:
            require_service_secret(request)
            body = await request.json()

            clinic_id = body.get("clinicId")
            phone_number_id = body.get("phoneNumberId")
            access_token = body.get("accessToken")
            patient_phone = body.get("patientPhone")
            message = body.get("message")
            reminder_type = body.get("reminderType")
            appointment_id = body.get("appointmentId")

            if not all([clinic_id, phone_number_id, access_token, patient_phone, message]):
                raise HTTPException(status_code=400, detail="Missing required fields")

            patient_phone = ensure_phone_has_plus(patient_phone)

            if reminder_type == "24h":
                buttons = [
                    {"id": "confirm_yes", "title": "Confirmar"},
                    {"id": "confirm_reschedule", "title": "Reagendar"},
                    {"id": "confirm_cancel", "title": "Cancelar"},
                ]
                success = await send_whatsapp_buttons(
                    phone_number_id, patient_phone, message, buttons, access_token
                )
            else:
                success = await send_whatsapp_message(
                    phone_number_id, patient_phone, message, access_token
                )

            return {"success": success, "appointmentId": appointment_id}
        except HTTPException:
            raise
        except Exception as exc:
            logger.error("❌ Error sending reminder: %s", exc)
            raise HTTPException(status_code=500, detail=str(exc))

    @app.post("/api/send-confirmation")
    async def send_confirmation(request: Request):
        try:
            require_service_secret(request)
            body = await request.json()

            phone_number_id = body.get("phoneNumberId")
            access_token = body.get("accessToken")
            patient_phone = body.get("patientPhone")
            message = body.get("message")

            if not all([phone_number_id, access_token, patient_phone, message]):
                raise HTTPException(status_code=400, detail="Missing required fields")

            patient_phone = ensure_phone_has_plus(patient_phone)
            success = await send_whatsapp_message(
                phone_number_id, patient_phone, message, access_token
            )
            return {"success": success}
        except HTTPException:
            raise
        except Exception as exc:
            logger.error("❌ Error sending confirmation: %s", exc)
            raise HTTPException(status_code=500, detail=str(exc))

    @app.post("/api/process-reminders")
    async def process_reminders(request: Request):
        try:
            require_service_secret(request)
            body = await request.json() if request.headers.get("content-type") == "application/json" else {}
            clinic_id = body.get("clinicId")

            logger.info("⏰ Processing reminders for clinic: %s", clinic_id or "all")

            db = get_db()
            if not db:
                raise HTTPException(status_code=500, detail="Database not initialized")

            results = {
                "reminder_24h": {"sent": 0, "failed": 0},
                "reminder_2h": {"sent": 0, "failed": 0},
            }

            for reminder_type in ["reminder_24h", "reminder_2h"]:
                appointments = db.get_appointments_needing_reminder(reminder_type, clinic_id)

                for apt in appointments:
                    try:
                        clinic = db.get_clinic(apt.clinic_id)
                        if not clinic:
                            continue

                        access_token = db.get_clinic_access_token(apt.clinic_id)
                        if not access_token:
                            logger.warning("No access token for clinic %s", apt.clinic_id)
                            continue

                        phone_number_id = clinic.whatsapp_phone_number_id
                        if not phone_number_id:
                            logger.warning("No phone_number_id for clinic %s", apt.clinic_id)
                            continue

                        message = format_reminder_message(
                            apt, reminder_type, clinic.name, clinic.address or ""
                        )
                        patient_phone = ensure_phone_has_plus(apt.patient_phone)

                        if reminder_type == "reminder_24h":
                            buttons = [
                                {"id": "confirm_yes", "title": "Confirmar"},
                                {"id": "confirm_reschedule", "title": "Reagendar"},
                                {"id": "confirm_cancel", "title": "Cancelar"},
                            ]
                            success = await send_whatsapp_buttons(
                                phone_number_id, patient_phone, message, buttons, access_token
                            )
                        else:
                            success = await send_whatsapp_message(
                                phone_number_id, patient_phone, message, access_token
                            )

                        if success:
                            mark_reminder_sent(db, apt.id, reminder_type)
                            results[reminder_type]["sent"] += 1
                            logger.info("✅ Sent %s reminder for appointment %s", reminder_type, apt.id)
                        else:
                            results[reminder_type]["failed"] += 1
                            logger.error("❌ Failed to send %s for %s", reminder_type, apt.id)
                    except Exception as exc:
                        results[reminder_type]["failed"] += 1
                        logger.error("❌ Error processing reminder for %s: %s", getattr(apt, "id", "?"), exc)

            logger.info("📊 Reminder processing complete: %s", results)
            return {"success": True, "results": results}
        except HTTPException:
            raise
        except Exception as exc:
            logger.error("❌ Error processing reminders: %s", exc)
            raise HTTPException(status_code=500, detail=str(exc))

    @app.post("/api/set-human-takeover")
    async def set_human_takeover_endpoint(request: Request):
        try:
            require_service_secret(request)
            body = await request.json()
            clinic_id = body.get("clinicId")
            phone = body.get("phone")
            enabled = body.get("enabled", True)
            reason = body.get("reason")

            if not clinic_id or not phone:
                raise HTTPException(status_code=400, detail="clinicId and phone are required")

            db = get_db()
            if not db:
                raise HTTPException(status_code=500, detail="Database not initialized")

            phone = ensure_phone_has_plus(phone)
            success = db.set_human_takeover(clinic_id, phone, enabled, reason)
            return {"success": success}
        except HTTPException:
            raise
        except Exception as exc:
            logger.error("❌ Error setting human takeover: %s", exc)
            raise HTTPException(status_code=500, detail=str(exc))
