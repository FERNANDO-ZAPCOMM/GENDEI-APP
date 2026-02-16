"""OpenAI session management with pluggable backend support."""

from __future__ import annotations

import asyncio
import importlib
import inspect
import logging
import os
from typing import Any, Callable, Dict, List, Optional

from ..base import BaseSession, AgentType

logger = logging.getLogger(__name__)

HistoryLoader = Callable[[str], List[Dict[str, Any]]]


def _is_truthy(value: Optional[str]) -> bool:
    return (value or "").strip().lower() in {"1", "true", "yes", "on"}


def _is_production_environment() -> bool:
    env = (
        os.getenv("APP_ENV")
        or os.getenv("ENVIRONMENT")
        or os.getenv("NODE_ENV")
        or ""
    ).strip().lower()
    return env in {"prod", "production"}


def _load_agents_session_class(class_name: str) -> Any:
    module = importlib.import_module("agents")
    if not hasattr(module, class_name):
        raise ImportError(f"agents.{class_name} not available")
    return getattr(module, class_name)


def _resolve_class_from_path(path: str) -> Any:
    module_name, _, class_name = path.rpartition(".")
    if not module_name or not class_name:
        raise ValueError("OPENAI_SESSION_CUSTOM_CLASS must be in module.Class format")
    module = importlib.import_module(module_name)
    if not hasattr(module, class_name):
        raise ImportError(f"{path} not found")
    return getattr(module, class_name)


def _invoke_maybe_async(result: Any) -> Any:
    if inspect.isawaitable(result):
        return result
    return None


class OpenAISession(BaseSession):
    """
    Session wrapper for OpenAI SDK session objects.
    Supports any SDK session backend object accepted by Runner.run().
    """

    def __init__(self, session_id: str, sdk_session: Any):
        super().__init__(session_id)
        self._sdk_session = sdk_session
        self._current_agent: Optional[AgentType] = None
        self._lock = asyncio.Lock()

    @property
    def sdk_session(self) -> Any:
        return self._sdk_session

    @property
    def sqlite_session(self) -> Any:
        # Backward-compatible alias used by existing runner code.
        return self._sdk_session

    async def add_message(self, role: str, content: str, **kwargs) -> None:
        # Session history is managed by OpenAI Agents SDK runner/session backend.
        return None

    async def get_history(self) -> List[Dict[str, Any]]:
        return []

    async def clear(self) -> None:
        # Most SDK backends scope by session_id and do not expose hard-clear.
        return None

    async def get_current_agent(self) -> Optional[AgentType]:
        async with self._lock:
            return self._current_agent

    async def set_current_agent(self, agent_type: AgentType) -> None:
        async with self._lock:
            self._current_agent = agent_type


class OpenAISessionManager:
    """
    Manages OpenAI sessions with configurable backend.

    Backends:
      - sqlite (default fallback)
      - sqlalchemy (OPENAI_SESSION_DATABASE_URL)
      - redis (OPENAI_SESSION_REDIS_URL)
      - custom (OPENAI_SESSION_CUSTOM_CLASS=module.Class)
    """

    def __init__(
        self,
        db_path: Optional[str] = None,
        history_loader: Optional[HistoryLoader] = None,
    ):
        self._db_path = db_path or os.getenv("SESSION_DB_PATH", "./sessions.db")
        self._session_backend = self._resolve_backend()
        self._sessions: Dict[str, OpenAISession] = {}
        self._lock = asyncio.Lock()
        self._history_loader = history_loader
        self._hydrate_from_firestore = _is_truthy(os.getenv("OPENAI_SESSION_HYDRATE_FROM_FIRESTORE"))
        self._hydrated_sessions: set[str] = set()
        fallback_default = "false" if _is_production_environment() else "true"
        self._allow_sqlite_fallback = _is_truthy(
            os.getenv("OPENAI_SESSION_BACKEND_FALLBACK_TO_SQLITE", fallback_default)
        )

        logger.info(
            "OpenAISessionManager initialized backend=%s sqlite_db_path=%s hydrate_from_firestore=%s",
            self._session_backend,
            self._db_path,
            self._hydrate_from_firestore,
        )

    def _resolve_backend(self) -> str:
        configured = (os.getenv("OPENAI_SESSION_BACKEND") or "").strip().lower()
        if configured:
            return configured
        if os.getenv("OPENAI_SESSION_DATABASE_URL"):
            return "sqlalchemy"
        if os.getenv("OPENAI_SESSION_REDIS_URL"):
            return "redis"
        return "sqlite"

    def _build_session_with_kwargs(
        self,
        session_cls: Any,
        session_id: str,
        kwargs: Dict[str, Any],
    ) -> Any:
        kwargs = {k: v for k, v in kwargs.items() if v is not None}
        try:
            signature = inspect.signature(session_cls)
            parameters = signature.parameters
            accepts_var_kwargs = any(
                p.kind == inspect.Parameter.VAR_KEYWORD for p in parameters.values()
            )
        except (TypeError, ValueError):
            parameters = {}
            accepts_var_kwargs = True

        def _filtered(raw: Dict[str, Any]) -> Dict[str, Any]:
            if accepts_var_kwargs:
                return raw
            return {k: v for k, v in raw.items() if k in parameters}

        candidate_kwargs = [
            {"session_id": session_id, **kwargs},
            {"id": session_id, **kwargs},
            {"name": session_id, **kwargs},
            {"conversation_id": session_id, **kwargs},
            {"key": session_id, **kwargs},
            {"session": session_id, **kwargs},
            kwargs,
        ]

        last_error: Optional[Exception] = None
        for candidate in candidate_kwargs:
            filtered = _filtered(candidate)
            if not filtered:
                continue
            try:
                return session_cls(**filtered)
            except Exception as exc:
                last_error = exc

        # Positional fallback for older constructors.
        connection = (
            kwargs.get("db_path")
            or kwargs.get("database_url")
            or kwargs.get("connection_string")
            or kwargs.get("url")
            or kwargs.get("redis_url")
        )
        positional_candidates: List[tuple[Any, ...]] = [
            (session_id,),
            (session_id, connection) if connection else tuple(),
            (connection, session_id) if connection else tuple(),
            (connection,) if connection else tuple(),
            tuple(),
        ]

        for args in positional_candidates:
            if args == tuple() and connection is None:
                # Keep no-args fallback once, at end.
                pass
            try:
                return session_cls(*args)
            except Exception as exc:
                last_error = exc

        if last_error is not None:
            raise last_error
        raise RuntimeError(f"Unable to instantiate session backend {session_cls}")

    def _create_sqlite_session(self, session_id: str) -> Any:
        sqlite_cls = _load_agents_session_class("SQLiteSession")
        # OpenAI Agents SDK SQLiteSession signature: SQLiteSession(db_path, session_id)
        return sqlite_cls(self._db_path, session_id)

    def _create_sqlalchemy_session(self, session_id: str) -> Any:
        db_url = (os.getenv("OPENAI_SESSION_DATABASE_URL") or "").strip()
        if not db_url:
            raise ValueError("OPENAI_SESSION_DATABASE_URL is required for sqlalchemy backend")
        session_cls = _load_agents_session_class("SQLAlchemySession")
        return self._build_session_with_kwargs(
            session_cls,
            session_id,
            {
                "database_url": db_url,
                "connection_string": db_url,
                "url": db_url,
                "dsn": db_url,
            },
        )

    def _create_redis_session(self, session_id: str) -> Any:
        redis_url = (os.getenv("OPENAI_SESSION_REDIS_URL") or "").strip()
        if not redis_url:
            raise ValueError("OPENAI_SESSION_REDIS_URL is required for redis backend")
        session_cls = _load_agents_session_class("RedisSession")
        return self._build_session_with_kwargs(
            session_cls,
            session_id,
            {
                "redis_url": redis_url,
                "url": redis_url,
                "dsn": redis_url,
                "key_prefix": os.getenv("OPENAI_SESSION_REDIS_PREFIX", "gendei:sessions"),
            },
        )

    def _create_custom_session(self, session_id: str) -> Any:
        class_path = (os.getenv("OPENAI_SESSION_CUSTOM_CLASS") or "").strip()
        if not class_path:
            raise ValueError("OPENAI_SESSION_CUSTOM_CLASS is required for custom backend")
        session_cls = _resolve_class_from_path(class_path)
        return self._build_session_with_kwargs(
            session_cls,
            session_id,
            {
                "database_url": os.getenv("OPENAI_SESSION_DATABASE_URL"),
                "redis_url": os.getenv("OPENAI_SESSION_REDIS_URL"),
                "db_path": self._db_path,
            },
        )

    def _create_sdk_session(self, session_id: str) -> Any:
        try:
            if self._session_backend == "sqlalchemy":
                return self._create_sqlalchemy_session(session_id)
            if self._session_backend == "redis":
                return self._create_redis_session(session_id)
            if self._session_backend == "custom":
                return self._create_custom_session(session_id)
            return self._create_sqlite_session(session_id)
        except Exception as exc:
            if self._session_backend != "sqlite" and self._allow_sqlite_fallback:
                logger.warning(
                    "Session backend '%s' unavailable (%s). Falling back to sqlite.",
                    self._session_backend,
                    exc,
                )
                return self._create_sqlite_session(session_id)
            raise

    def _normalize_firestore_history(self, history: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        normalized: List[Dict[str, Any]] = []
        for msg in history:
            body = str(msg.get("body") or msg.get("content") or "").strip()
            if not body:
                continue
            direction = str(msg.get("direction") or msg.get("role") or "").strip().lower()
            role = "assistant" if direction in {"out", "assistant", "ai", "system"} else "user"
            normalized.append({"role": role, "content": body})
        return normalized

    async def _hydrate_session_if_enabled(self, session_id: str, sdk_session: Any) -> None:
        if not self._hydrate_from_firestore or not self._history_loader:
            return
        if session_id in self._hydrated_sessions:
            return

        try:
            raw_history = self._history_loader(session_id) or []
            if not raw_history:
                self._hydrated_sessions.add(session_id)
                return
            history = self._normalize_firestore_history(raw_history)
            if not history:
                self._hydrated_sessions.add(session_id)
                return

            # Best-effort adapters for common session APIs.
            if hasattr(sdk_session, "add_messages"):
                result = sdk_session.add_messages(history)
                awaited = _invoke_maybe_async(result)
                if awaited is not None:
                    await awaited
                self._hydrated_sessions.add(session_id)
                logger.info("Hydrated session %s via add_messages (%d messages)", session_id, len(history))
                return

            if hasattr(sdk_session, "add_items"):
                result = sdk_session.add_items(history)
                awaited = _invoke_maybe_async(result)
                if awaited is not None:
                    await awaited
                self._hydrated_sessions.add(session_id)
                logger.info("Hydrated session %s via add_items (%d messages)", session_id, len(history))
                return

            if hasattr(sdk_session, "append_message"):
                for item in history:
                    result = sdk_session.append_message(item["role"], item["content"])
                    awaited = _invoke_maybe_async(result)
                    if awaited is not None:
                        await awaited
                self._hydrated_sessions.add(session_id)
                logger.info("Hydrated session %s via append_message (%d messages)", session_id, len(history))
                return

            logger.warning(
                "Session backend for %s does not expose a known hydration API; skipping Firestore hydration",
                session_id,
            )
            self._hydrated_sessions.add(session_id)
        except Exception as exc:
            logger.warning("Failed to hydrate session %s from Firestore: %s", session_id, exc)

    def get_session(self, session_id: str) -> OpenAISession:
        """
        Get or create a wrapped session.

        Args:
            session_id: Unique session identifier (e.g., clinic_id:phone)

        Returns:
            OpenAISession instance
        """
        if session_id not in self._sessions:
            sdk_session = self._create_sdk_session(session_id)
            wrapped = OpenAISession(session_id, sdk_session)
            self._sessions[session_id] = wrapped
            logger.debug("Created new OpenAI session for %s (backend=%s)", session_id, self._session_backend)

        session = self._sessions[session_id]
        # Hydration is optional and best-effort, so run in background to avoid blocking first reply.
        if self._hydrate_from_firestore and self._history_loader and session_id not in self._hydrated_sessions:
            try:
                loop = asyncio.get_running_loop()
                loop.create_task(self._hydrate_session_if_enabled(session_id, session.sdk_session))
            except RuntimeError:
                # No running loop available; skip background hydration here.
                logger.debug("No running loop; skipping background hydration for %s", session_id)
        return session

    def get_sdk_session(self, session_id: str) -> Any:
        """
        Get underlying SDK session object for Runner.run().
        """
        return self.get_session(session_id).sdk_session

    def get_sqlite_session(self, session_id: str) -> Any:
        """
        Backward-compatible alias used by existing caller code.
        """
        return self.get_sdk_session(session_id)

    async def clear_session(self, session_id: str) -> None:
        """Clear one cached session wrapper."""
        async with self._lock:
            if session_id in self._sessions:
                await self._sessions[session_id].clear()
                del self._sessions[session_id]
                self._hydrated_sessions.discard(session_id)
                logger.debug("Cleared session for %s", session_id)

    async def clear_all(self) -> None:
        """Clear all cached session wrappers."""
        async with self._lock:
            for session in self._sessions.values():
                await session.clear()
            self._sessions.clear()
            self._hydrated_sessions.clear()
            logger.info("Cleared all sessions")
