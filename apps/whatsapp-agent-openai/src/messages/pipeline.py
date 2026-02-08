"""Message buffering and voice pipeline extracted from main.py."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Awaitable, Callable, Dict, Optional

logger = logging.getLogger(__name__)


@dataclass
class MessagePipelineDeps:
    message_buffer_deadlines: Dict[str, datetime]
    default_message_buffer_seconds: float
    is_buffer_locked: Callable[[str], bool]
    lock_buffer: Callable[[str], None]
    unlock_buffer: Callable[[str], None]
    get_buffered_messages: Callable[[str], Any]
    combine_messages: Callable[[Any], str]
    process_message: Callable[..., Awaitable[None]]
    send_whatsapp_message: Callable[[str, str, str, str], Awaitable[Any]]


async def process_buffered_messages(
    deps: MessagePipelineDeps,
    clinic_id: str,
    phone: str,
    phone_number_id: str,
    access_token: str,
    buffer_key: str,
    sleep_func: Callable[[float], Awaitable[Any]],
) -> None:
    """Process buffered messages after wait period."""
    try:
        deadline = deps.message_buffer_deadlines.get(buffer_key)
        wait_seconds = (
            max(0.0, (deadline - datetime.now()).total_seconds())
            if deadline
            else deps.default_message_buffer_seconds
        )
        await sleep_func(wait_seconds)

        if deps.is_buffer_locked(buffer_key):
            logger.info(f"🔒 Buffer already being processed for {phone}, skipping")
            return

        deps.lock_buffer(buffer_key)
        try:
            buffered_messages = deps.get_buffered_messages(buffer_key)
            if not buffered_messages:
                logger.info(f"📭 No buffered messages for {phone}")
                return

            combined_text = deps.combine_messages(buffered_messages)
            first_msg = buffered_messages[0]
            message_id = first_msg.get("message_id", "")
            contact_name = first_msg.get("contact_name")
            button_payload = first_msg.get("button_payload")

            logger.info(
                f"📬 Processing {len(buffered_messages)} buffered message(s) for {phone}: {combined_text[:50]}..."
            )

            await deps.process_message(
                clinic_id,
                phone,
                combined_text,
                message_id,
                phone_number_id,
                access_token,
                button_payload,
                contact_name,
            )
        finally:
            deps.unlock_buffer(buffer_key)

    except Exception as exc:
        logger.error(f"❌ Error processing buffered messages: {exc}")
        deps.unlock_buffer(buffer_key)


async def handle_voice_message(
    deps: MessagePipelineDeps,
    clinic_id: str,
    phone: str,
    media_id: str,
    message_id: str,
    phone_number_id: str,
    access_token: str,
    contact_name: Optional[str] = None,
) -> None:
    """Handle voice message: download, transcribe, and process."""
    try:
        from src.utils.messaging import download_whatsapp_media
        from src.utils.transcription import transcribe_audio

        logger.info(f"🎤 Processing voice message from {phone}")

        download_result = await download_whatsapp_media(media_id)
        if not download_result:
            await deps.send_whatsapp_message(
                phone_number_id,
                phone,
                "Desculpe, não consegui processar seu áudio. Pode tentar enviar novamente ou digitar sua mensagem? 🙏",
                access_token,
            )
            return

        file_path, mime_type = download_result
        logger.info(f"📥 Audio downloaded: {file_path}")

        transcription = await transcribe_audio(file_path, mime_type)

        try:
            import os as os_module

            os_module.remove(file_path)
        except Exception:
            pass

        if transcription:
            logger.info(f"📝 Transcription: {transcription[:100]}...")
            await deps.process_message(
                clinic_id,
                phone,
                transcription,
                message_id,
                phone_number_id,
                access_token,
                None,
                contact_name,
            )
        else:
            await deps.send_whatsapp_message(
                phone_number_id,
                phone,
                "Desculpe, não consegui entender seu áudio. Pode tentar enviar novamente ou digitar sua mensagem? 🙏",
                access_token,
            )

    except Exception as exc:
        logger.error(f"❌ Voice message error: {exc}")
        await deps.send_whatsapp_message(
            phone_number_id,
            phone,
            "Desculpe, ocorreu um erro ao processar seu áudio. Pode digitar sua mensagem?",
            access_token,
        )
