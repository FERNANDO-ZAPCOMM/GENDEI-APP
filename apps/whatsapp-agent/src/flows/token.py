"""Signed token helpers for WhatsApp Flows sessions."""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict

from src.security import is_production_environment

logger = logging.getLogger(__name__)


def _is_truthy(value: str) -> bool:
    return (value or "").strip().lower() in {"1", "true", "yes", "on"}


def _b64url_encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode("utf-8").rstrip("=")


def _b64url_decode(raw: str) -> bytes:
    padding = "=" * (-len(raw) % 4)
    return base64.urlsafe_b64decode(raw + padding)


def _get_flow_token_secret() -> str:
    return (os.getenv("FLOW_TOKEN_SECRET") or os.getenv("GENDEI_SERVICE_SECRET") or "").strip()


def generate_flow_token(clinic_id: str, phone: str, extra_data: str = "") -> str:
    """
    Generate a signed flow token.

    Format: v1.<payload_b64url>.<sig_b64url>
    """
    secret = _get_flow_token_secret()
    payload: Dict[str, Any] = {
        "v": 1,
        "clinic_id": clinic_id,
        "phone": phone,
        "ts": int(datetime.now(timezone.utc).timestamp()),
    }
    if extra_data:
        payload["extra_data"] = extra_data

    payload_json = json.dumps(payload, separators=(",", ":"), ensure_ascii=True).encode("utf-8")
    payload_encoded = _b64url_encode(payload_json)

    if not secret:
        if is_production_environment():
            raise RuntimeError("FLOW_TOKEN_SECRET (or GENDEI_SERVICE_SECRET) is required in production")
        logger.warning("FLOW_TOKEN_SECRET missing; generating legacy unsigned flow token (non-production)")
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        base_token = f"{clinic_id}:{phone}:{timestamp}"
        if extra_data:
            return f"{base_token}:{extra_data}"
        return base_token

    signature = hmac.new(secret.encode("utf-8"), payload_encoded.encode("utf-8"), hashlib.sha256).digest()
    return f"v1.{payload_encoded}.{_b64url_encode(signature)}"


def parse_flow_token(flow_token: str) -> Dict[str, Any]:
    """
    Parse and validate signed/legacy flow tokens.

    Returns:
      {
        "clinic_id": str,
        "phone": str,
        "timestamp": str|None,
        "extra_data": str,
        "is_legacy": bool
      }
    Raises:
      ValueError on invalid token.
    """
    token = (flow_token or "").strip()
    if not token:
        raise ValueError("Empty flow token")

    if token.startswith("v1."):
        parts = token.split(".", 2)
        if len(parts) != 3:
            raise ValueError("Malformed signed flow token")

        _, payload_encoded, signature_encoded = parts
        secret = _get_flow_token_secret()
        if not secret:
            raise ValueError("Flow token secret is not configured")

        expected = hmac.new(
            secret.encode("utf-8"),
            payload_encoded.encode("utf-8"),
            hashlib.sha256,
        ).digest()
        received = _b64url_decode(signature_encoded)
        if not hmac.compare_digest(received, expected):
            raise ValueError("Invalid flow token signature")

        try:
            payload = json.loads(_b64url_decode(payload_encoded).decode("utf-8"))
        except Exception as exc:
            raise ValueError("Invalid flow token payload") from exc

        clinic_id = str(payload.get("clinic_id") or "").strip()
        phone = str(payload.get("phone") or "").strip()
        if not clinic_id or not phone:
            raise ValueError("Flow token missing required fields")

        ts = payload.get("ts")
        timestamp = str(ts) if ts is not None else None
        extra_data = str(payload.get("extra_data") or "")
        return {
            "clinic_id": clinic_id,
            "phone": phone,
            "timestamp": timestamp,
            "extra_data": extra_data,
            "is_legacy": False,
        }

    # Legacy fallback: clinic_id:phone:timestamp[:extra_data]
    if is_production_environment() and not _is_truthy(os.getenv("ALLOW_LEGACY_FLOW_TOKENS", "")):
        raise ValueError("Legacy flow tokens are disabled in production")

    legacy_parts = token.split(":", 3)
    if len(legacy_parts) < 2:
        raise ValueError("Malformed legacy flow token")

    clinic_id = legacy_parts[0].strip()
    phone = legacy_parts[1].strip()
    timestamp = legacy_parts[2].strip() if len(legacy_parts) >= 3 else None
    extra_data = legacy_parts[3] if len(legacy_parts) == 4 else ""

    if not clinic_id or not phone:
        raise ValueError("Legacy flow token missing required fields")

    return {
        "clinic_id": clinic_id,
        "phone": phone,
        "timestamp": timestamp,
        "extra_data": extra_data,
        "is_legacy": True,
    }
