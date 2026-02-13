"""Pricing and deposit policy helpers for scheduling flows."""

from __future__ import annotations

from typing import Any, Dict


def normalize_price_to_cents(value: Any) -> int:
    """
    Normalize price values that may come in BRL or cents.
    Heuristics:
    - float -> BRL (e.g. 300.0 => 30000)
    - int >= 1000 -> cents (e.g. 30000 => 30000)
    - int < 1000 -> BRL (e.g. 300 => 30000)
    """
    if value is None:
        return 0
    try:
        if isinstance(value, float):
            return int(round(value * 100))
        if isinstance(value, int):
            return value if value >= 1000 else value * 100
        if isinstance(value, str):
            cleaned = value.strip().replace("R$", "").replace(".", "").replace(",", ".")
            if not cleaned:
                return 0
            parsed = float(cleaned)
            return int(round(parsed * 100))
    except Exception:
        return 0
    return 0


def resolve_consultation_pricing(
    db: Any,
    clinic_id: str,
    clinic: Any,
    professional_id: str = "",
) -> Dict[str, int]:
    """
    Resolve deposit percentage and consultation price with robust fallbacks.
    Priority for price:
    1) Professional-linked services (first active with price)
    2) Any clinic service with price
    3) paymentSettings.defaultConsultationPrice
    4) system default R$ 200,00
    """
    signal_percentage = 15
    default_price_cents = 20000

    payment_settings = getattr(clinic, "payment_settings", {}) or {}
    clinic_signal_percentage = getattr(clinic, "signal_percentage", 15) or 15
    signal_percentage = int(payment_settings.get("depositPercentage", clinic_signal_percentage) or 15)

    # Try services first (more accurate than generic default consultation price).
    chosen_price_cents = 0
    services = db.get_clinic_services(clinic_id) if db else []
    services_by_id = {s.id: s for s in services}

    if professional_id and db:
        professional = db.get_professional(clinic_id, professional_id)
        if professional:
            for sid in getattr(professional, "service_ids", []) or []:
                service = services_by_id.get(sid) or db.get_service(clinic_id, sid)
                if service and getattr(service, "price_cents", 0):
                    chosen_price_cents = int(getattr(service, "price_cents", 0) or 0)
                    break

    if chosen_price_cents <= 0:
        for service in services:
            candidate = int(getattr(service, "price_cents", 0) or 0)
            if candidate > 0:
                chosen_price_cents = candidate
                break

    if chosen_price_cents <= 0:
        chosen_price_cents = normalize_price_to_cents(payment_settings.get("defaultConsultationPrice"))

    if chosen_price_cents <= 0:
        chosen_price_cents = default_price_cents

    return {
        "signal_percentage": signal_percentage,
        "default_price_cents": chosen_price_cents,
    }
