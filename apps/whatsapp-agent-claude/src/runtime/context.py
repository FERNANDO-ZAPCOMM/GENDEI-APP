"""
Runtime Context Manager
Manages per-request context for Gendei clinic operations
"""

import contextvars
from dataclasses import dataclass
from typing import Optional, Any


@dataclass
class Runtime:
    """
    Runtime context for Gendei clinic operations.
    Used by function tools to access clinic data and send messages.
    """
    clinic_id: str
    db: Any  # GendeiDatabase instance
    phone_number_id: Optional[str] = None
    access_token: Optional[str] = None
    patient_phone: Optional[str] = None  # Current patient's phone


# Context variable to store current runtime
_runtime_context: contextvars.ContextVar[Optional[Runtime]] = contextvars.ContextVar(
    'runtime_context',
    default=None
)


def set_runtime(runtime: Runtime) -> contextvars.Token:
    """
    Set the current runtime context for this request.

    Args:
        runtime: Runtime instance

    Returns:
        Token for resetting the context later
    """
    return _runtime_context.set(runtime)


def get_runtime() -> Runtime:
    """
    Get the current runtime context.

    Returns:
        Current Runtime instance

    Raises:
        RuntimeError: If no runtime context is set
    """
    runtime = _runtime_context.get()
    if runtime is None:
        raise RuntimeError("No runtime context set. Call set_runtime() first.")
    return runtime


def reset_runtime(token: contextvars.Token) -> None:
    """
    Reset the runtime context using a token.

    Args:
        token: Token returned from set_runtime()
    """
    _runtime_context.reset(token)


def get_runtime_safe() -> Optional[Runtime]:
    """
    Get the current runtime context without raising an error.

    Returns:
        Current Runtime instance or None if not set
    """
    return _runtime_context.get()
