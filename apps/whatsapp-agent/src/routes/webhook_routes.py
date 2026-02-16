"""Webhook and health routes."""

from __future__ import annotations

import json
import logging
from datetime import datetime
from typing import Any, Awaitable, Callable, Dict

from fastapi import BackgroundTasks, HTTPException, Request  # type: ignore
from fastapi.responses import Response  # type: ignore

logger = logging.getLogger(__name__)

WebhookBodyHandler = Callable[[Dict[str, Any], BackgroundTasks], Awaitable[Any]]
WebhookSignatureValidator = Callable[[Request, bytes], None]


def register_webhook_routes(
    app: Any,
    *,
    verify_token: str,
    process_webhook_body: WebhookBodyHandler,
    require_meta_webhook_signature: WebhookSignatureValidator,
) -> None:
    """Register root/health + webhook endpoints."""

    @app.get("/")
    async def root():
        return {"status": "ok", "service": "Gendei WhatsApp Agent"}

    @app.get("/health")
    async def health():
        return {
            "status": "healthy",
            "service": "Gendei WhatsApp Agent",
            "timestamp": datetime.now().isoformat(),
        }

    @app.get("/webhook")
    async def verify_webhook(request: Request):
        mode = request.query_params.get("hub.mode")
        token = request.query_params.get("hub.verify_token")
        challenge = request.query_params.get("hub.challenge")

        logger.info("Webhook verification: mode=%s, token=%s", mode, token)

        if mode == "subscribe" and token == verify_token:
            logger.info("✅ Webhook verified successfully")
            return Response(content=challenge, media_type="text/plain")

        logger.warning("❌ Webhook verification failed")
        raise HTTPException(status_code=403, detail="Verification failed")

    @app.get("/whatsapp")
    async def verify_webhook_alias(request: Request):
        return await verify_webhook(request)

    @app.post("/whatsapp")
    async def receive_webhook_alias(request: Request, background_tasks: BackgroundTasks):
        return await receive_webhook(request, background_tasks)

    @app.post("/webhook")
    async def receive_webhook(request: Request, background_tasks: BackgroundTasks):
        try:
            raw_body = await request.body()
            require_meta_webhook_signature(request, raw_body)
            body = json.loads(raw_body.decode("utf-8"))
            return await process_webhook_body(body, background_tasks)
        except HTTPException:
            raise
        except json.JSONDecodeError as exc:
            logger.error("❌ Invalid webhook JSON: %s", exc)
            return {"status": "error", "message": "invalid_json"}
        except Exception as exc:
            logger.error("❌ Error processing webhook: %s", exc)
            return {"status": "error", "message": str(exc)}
