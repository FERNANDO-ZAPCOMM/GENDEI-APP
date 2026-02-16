"""Security helpers for webhook/auth validation."""

from __future__ import annotations

import hashlib
import hmac
import logging
import os
from typing import Optional

from fastapi import HTTPException, Request  # type: ignore

logger = logging.getLogger(__name__)


def _is_truthy(value: Optional[str]) -> bool:
    return (value or "").strip().lower() in {"1", "true", "yes", "on"}


def is_production_environment() -> bool:
    env = (
        os.getenv("APP_ENV")
        or os.getenv("ENVIRONMENT")
        or os.getenv("NODE_ENV")
        or ""
    ).strip().lower()
    return env in {"prod", "production"}


def require_service_secret(request: Request, header_name: str = "X-Gendei-Service-Secret") -> None:
    """
    Require valid service-to-service secret for internal endpoints.

    In non-production, if the secret is not configured, requests are allowed with warning.
    In production, missing secret configuration fails closed unless explicitly bypassed.
    """
    expected = (os.getenv("GENDEI_SERVICE_SECRET") or "").strip()
    provided = (request.headers.get(header_name) or "").strip()

    if not expected:
        allow_insecure = _is_truthy(os.getenv("ALLOW_INSECURE_INTERNAL_ENDPOINTS"))
        if is_production_environment() and not allow_insecure:
            logger.error("GENDEI_SERVICE_SECRET is required in production")
            raise HTTPException(status_code=500, detail="Service secret not configured")
        logger.warning("GENDEI_SERVICE_SECRET not configured; allowing request (non-production)")
        return

    if not provided or not hmac.compare_digest(provided, expected):
        raise HTTPException(status_code=401, detail="Unauthorized")


def verify_hmac_sha256_signature(raw_body: bytes, signature_header: str, secret: str) -> bool:
    """Verify sha256=<hex> style signature header."""
    if not signature_header or not secret:
        return False

    received = signature_header.strip()
    if received.startswith("sha256="):
        received = received[len("sha256="):]

    expected = hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(received, expected)


def require_meta_webhook_signature(request: Request, raw_body: bytes) -> None:
    """
    Validate Meta webhook signature (X-Hub-Signature-256).
    """
    app_secret = (
        os.getenv("META_APP_SECRET")
        or os.getenv("FACEBOOK_APP_SECRET")
        or ""
    ).strip()
    signature_header = (request.headers.get("X-Hub-Signature-256") or "").strip()

    if not app_secret:
        allow_insecure = _is_truthy(os.getenv("ALLOW_INSECURE_META_WEBHOOK"))
        if is_production_environment() and not allow_insecure:
            logger.error("META_APP_SECRET is required in production for webhook validation")
            raise HTTPException(status_code=500, detail="Webhook secret not configured")
        logger.warning("META_APP_SECRET not configured; skipping webhook signature validation")
        return

    if not verify_hmac_sha256_signature(raw_body, signature_header, app_secret):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")


def require_encrypted_flow_request(is_encrypted: bool) -> None:
    """
    Enforce encrypted WhatsApp Flows requests in production.
    """
    allow_unencrypted = _is_truthy(os.getenv("ALLOW_UNENCRYPTED_FLOWS"))
    if is_production_environment() and not is_encrypted and not allow_unencrypted:
        raise HTTPException(status_code=403, detail="Encrypted flows required in production")
