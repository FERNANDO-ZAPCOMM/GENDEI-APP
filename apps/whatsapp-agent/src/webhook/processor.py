"""Webhook processing orchestration extracted from main.py."""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from typing import Any, Awaitable, Callable, Dict, Optional

logger = logging.getLogger(__name__)


@dataclass
class WebhookProcessorDeps:
    db: Any
    whatsapp_token: str
    is_message_processed: Callable[[str], bool]
    ensure_phone_has_plus: Callable[[str], str]
    process_message: Callable[..., Awaitable[None]]
    process_buffered_messages: Callable[..., Awaitable[None]]
    handle_voice_message: Callable[..., Awaitable[None]]
    handle_flow_completion: Callable[..., Awaitable[None]]
    add_to_message_buffer: Callable[[str, Dict[str, Any]], bool]


async def process_webhook_body(
    deps: WebhookProcessorDeps,
    body: Dict[str, Any],
    background_tasks: Any,
) -> Dict[str, Any]:
    """Process WhatsApp webhook payload and enqueue background work."""
    logger.info(f"📨 Webhook received: {json.dumps(body)[:500]}")

    entry = body.get("entry", [])
    if not entry:
        return {"status": "ok"}

    for e in entry:
        changes = e.get("changes", [])
        for change in changes:
            value = change.get("value", {})

            metadata = value.get("metadata", {})
            phone_number_id = metadata.get("phone_number_id")
            if not phone_number_id:
                continue

            clinic = deps.db.get_clinic_by_phone_number_id(phone_number_id) if deps.db else None
            if not clinic:
                logger.warning(f"No clinic found for phone_number_id: {phone_number_id}")
                continue

            clinic_id = clinic.id
            access_token = deps.db.get_clinic_access_token(clinic_id) if deps.db else deps.whatsapp_token
            if not access_token:
                access_token = deps.whatsapp_token

            contacts = value.get("contacts", [])
            contact_name = None
            if contacts:
                contact_name = contacts[0].get("profile", {}).get("name")

            messages = value.get("messages", [])
            for msg in messages:
                message_id = msg.get("id")

                if deps.is_message_processed(message_id):
                    logger.info(f"⚠️ Message {message_id} already processed, skipping")
                    continue

                sender = msg.get("from")
                msg_type = msg.get("type")

                if msg_type == "audio":
                    audio_data = msg.get("audio", {})
                    media_id = audio_data.get("id")
                    if media_id:
                        background_tasks.add_task(
                            deps.handle_voice_message,
                            clinic_id,
                            deps.ensure_phone_has_plus(sender),
                            media_id,
                            message_id,
                            phone_number_id,
                            access_token,
                            contact_name,
                        )
                    continue

                text = ""
                button_payload = None

                if msg_type == "text":
                    text = msg.get("text", {}).get("body", "")
                elif msg_type == "interactive":
                    interactive = msg.get("interactive", {})
                    interactive_type = interactive.get("type", "")

                    if interactive_type == "button_reply":
                        button_payload = interactive.get("button_reply", {}).get("id")
                        text = interactive.get("button_reply", {}).get("title", "")

                    elif interactive_type == "nfm_reply":
                        nfm_reply = interactive.get("nfm_reply", {})
                        response_json_str = nfm_reply.get("response_json", "{}")

                        try:
                            flow_response = json.loads(response_json_str)
                            logger.info(f"📱 Flow completed: {flow_response}")

                            phone = deps.ensure_phone_has_plus(sender)
                            background_tasks.add_task(
                                deps.handle_flow_completion,
                                clinic_id,
                                phone,
                                flow_response,
                                phone_number_id,
                                access_token,
                                contact_name,
                            )
                        except json.JSONDecodeError as exc:
                            logger.error(f"❌ Failed to parse flow response: {exc}")

                        continue

                elif msg_type == "location":
                    location = msg.get("location", {})
                    lat = location.get("latitude")
                    lng = location.get("longitude")
                    location_name = location.get("name")
                    address = location.get("address")
                    parts = []
                    if location_name:
                        parts.append(f"nome: {location_name}")
                    if address:
                        parts.append(f"endereço: {address}")
                    if lat is not None and lng is not None:
                        parts.append(f"lat: {lat}, lng: {lng}")
                    text = "Localização compartilhada"
                    if parts:
                        text += " (" + " | ".join(parts) + ")"

                elif msg_type == "button":
                    button_payload = msg.get("button", {}).get("payload")
                    text = msg.get("button", {}).get("text", "")

                if text or button_payload:
                    phone = deps.ensure_phone_has_plus(sender)
                    buffer_key = f"{clinic_id}:{phone}"

                    if button_payload:
                        background_tasks.add_task(
                            deps.process_message,
                            clinic_id,
                            phone,
                            text,
                            message_id,
                            phone_number_id,
                            access_token,
                            button_payload,
                            contact_name,
                        )
                    else:
                        message_data = {
                            "text": text,
                            "message_id": message_id,
                            "contact_name": contact_name,
                            "button_payload": button_payload,
                        }
                        is_first = deps.add_to_message_buffer(buffer_key, message_data)

                        if is_first:
                            logger.info(f"⏳ Starting message buffer for {phone}")
                            background_tasks.add_task(
                                deps.process_buffered_messages,
                                clinic_id,
                                phone,
                                phone_number_id,
                                access_token,
                                buffer_key,
                            )

    return {"status": "ok"}
