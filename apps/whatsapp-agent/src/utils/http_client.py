"""Shared async HTTP client with retries/backoff."""

from __future__ import annotations

import asyncio
import logging
import os
import random
from typing import Optional

import httpx  # type: ignore

logger = logging.getLogger(__name__)

_HTTP_RETRY_ATTEMPTS = max(1, int(os.getenv("GENDEI_HTTP_RETRY_ATTEMPTS", "3")))
_HTTP_RETRY_BASE_SECONDS = float(os.getenv("GENDEI_HTTP_RETRY_BASE_SECONDS", "0.35"))
_HTTP_RETRY_MAX_SECONDS = float(os.getenv("GENDEI_HTTP_RETRY_MAX_SECONDS", "4.0"))
_HTTP_RETRY_STATUS_CODES = {408, 409, 425, 429, 500, 502, 503, 504}

_HTTP_CLIENT: Optional[httpx.AsyncClient] = None
_HTTP_CLIENT_LOCK: Optional[asyncio.Lock] = None


def _get_client_lock() -> asyncio.Lock:
    global _HTTP_CLIENT_LOCK
    if _HTTP_CLIENT_LOCK is None:
        _HTTP_CLIENT_LOCK = asyncio.Lock()
    return _HTTP_CLIENT_LOCK


async def get_shared_http_client() -> httpx.AsyncClient:
    """Return singleton AsyncClient for outbound requests."""
    global _HTTP_CLIENT
    if _HTTP_CLIENT is None:
        async with _get_client_lock():
            if _HTTP_CLIENT is None:
                timeout = httpx.Timeout(connect=10.0, read=30.0, write=30.0, pool=10.0)
                _HTTP_CLIENT = httpx.AsyncClient(timeout=timeout)
    return _HTTP_CLIENT


async def close_shared_http_client() -> None:
    """Close singleton AsyncClient during shutdown."""
    global _HTTP_CLIENT
    if _HTTP_CLIENT is None:
        return
    async with _get_client_lock():
        if _HTTP_CLIENT is not None:
            await _HTTP_CLIENT.aclose()
            _HTTP_CLIENT = None


def _compute_backoff_seconds(attempt: int) -> float:
    base = _HTTP_RETRY_BASE_SECONDS * (2 ** attempt)
    jitter = random.uniform(0.0, base * 0.2)
    return min(_HTTP_RETRY_MAX_SECONDS, base + jitter)


async def request_with_retries(method: str, url: str, **kwargs) -> httpx.Response:
    """Issue HTTP request with retry/backoff on transient failures."""
    last_exception: Optional[Exception] = None

    for attempt in range(_HTTP_RETRY_ATTEMPTS):
        try:
            client = await get_shared_http_client()
            response = await client.request(method, url, **kwargs)

            if response.status_code not in _HTTP_RETRY_STATUS_CODES:
                return response

            if attempt == _HTTP_RETRY_ATTEMPTS - 1:
                return response

            delay = _compute_backoff_seconds(attempt)
            logger.warning(
                "Retrying HTTP %s %s after status %s (attempt %d/%d, sleep %.2fs)",
                method,
                url,
                response.status_code,
                attempt + 1,
                _HTTP_RETRY_ATTEMPTS,
                delay,
            )
            await asyncio.sleep(delay)
        except httpx.RequestError as exc:
            last_exception = exc
            if attempt == _HTTP_RETRY_ATTEMPTS - 1:
                raise

            delay = _compute_backoff_seconds(attempt)
            logger.warning(
                "Retrying HTTP %s %s after network error %s (attempt %d/%d, sleep %.2fs)",
                method,
                url,
                exc.__class__.__name__,
                attempt + 1,
                _HTTP_RETRY_ATTEMPTS,
                delay,
            )
            await asyncio.sleep(delay)

    if last_exception is not None:
        raise last_exception
    raise RuntimeError("HTTP request retries exhausted")


async def http_post(url: str, **kwargs) -> httpx.Response:
    return await request_with_retries("POST", url, **kwargs)


async def http_get(url: str, **kwargs) -> httpx.Response:
    return await request_with_retries("GET", url, **kwargs)
