"""
runtime Context Manager
manages per-request context for multi-creator operations
"""

import contextvars
from typing import Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from dataclasses import dataclass
    from typing import Dict, Any
    from agents import Agent  # type: ignore

    @dataclass
    class CreatorRuntime:
        creator_id: str
        phone_number_id: Optional[str]
        access_token: Optional[str]
        data_service: Any
        db: Any
        storage: Any
        agents: Dict[str, Agent]
        creator_context: str
        product_context: str


# context variable to store current runtime
_runtime_context: contextvars.ContextVar[Optional['CreatorRuntime']] = contextvars.ContextVar(
    'runtime_context',
    default=None
)


def set_runtime(runtime: 'CreatorRuntime') -> contextvars.Token:
    """
    set the current runtime context for this request
    args:
        runtime: CreatorRuntime instance
    returns:
        token for resetting the context later
    """
    return _runtime_context.set(runtime)


def get_runtime() -> 'CreatorRuntime':
    """
    get the current runtime context
    returns:
        current CreatorRuntime instance
    raises:
        RuntimeError: If no runtime context is set
    """
    runtime = _runtime_context.get()
    if runtime is None:
        raise RuntimeError("No runtime context set. Call set_runtime() first.")
    return runtime


def reset_runtime(token: contextvars.Token) -> None:
    """
    reset the runtime context using a token
    args:
        token: Token returned from set_runtime()
    """
    _runtime_context.reset(token)


def get_runtime_safe() -> Optional['CreatorRuntime']:
    """
    get the current runtime context without raising an error
    returns:
        current CreatorRuntime instance or None if not set
    """
    return _runtime_context.get()
