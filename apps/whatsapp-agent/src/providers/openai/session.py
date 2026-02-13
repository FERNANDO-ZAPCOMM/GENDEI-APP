"""
OpenAI session management.
Uses SQLiteSession from OpenAI Agents SDK for conversation persistence.
"""

import os
import logging
from typing import Dict, List, Any, Optional
import asyncio

from agents import SQLiteSession  # type: ignore

from ..base import BaseSession, AgentType

logger = logging.getLogger(__name__)


class OpenAISession(BaseSession):
    """
    Session implementation for OpenAI using SQLiteSession.
    Wraps the SDK's SQLiteSession for compatibility with the provider abstraction.
    """

    def __init__(self, session_id: str, sqlite_session: SQLiteSession):
        super().__init__(session_id)
        self._sqlite_session = sqlite_session
        self._current_agent: Optional[AgentType] = None
        self._lock = asyncio.Lock()

    @property
    def sqlite_session(self) -> SQLiteSession:
        """Get the underlying SQLiteSession for use with Runner."""
        return self._sqlite_session

    async def add_message(self, role: str, content: str, **kwargs) -> None:
        """
        Add a message to history.
        Note: OpenAI SDK handles this internally through Runner.run()
        This is here for compatibility with the abstraction.
        """
        # SQLiteSession manages history internally through the SDK
        pass

    async def get_history(self) -> List[Dict[str, Any]]:
        """
        Get conversation history.
        Note: SQLiteSession manages history internally.
        """
        # The SDK handles history internally
        return []

    async def clear(self) -> None:
        """Clear session history."""
        # SQLiteSession doesn't have a direct clear method
        # History is managed per session_id
        pass

    async def get_current_agent(self) -> Optional[AgentType]:
        """Get the current active agent for this session."""
        async with self._lock:
            return self._current_agent

    async def set_current_agent(self, agent_type: AgentType) -> None:
        """Set the current active agent for this session."""
        async with self._lock:
            self._current_agent = agent_type


class OpenAISessionManager:
    """Manages OpenAI sessions using SQLiteSession."""

    def __init__(self, db_path: Optional[str] = None):
        """
        Initialize the session manager.

        Args:
            db_path: Path to SQLite database. Defaults to ./sessions.db
        """
        self._db_path = db_path or os.getenv("SESSION_DB_PATH", "./sessions.db")
        self._sessions: Dict[str, OpenAISession] = {}
        self._lock = asyncio.Lock()
        logger.info(f"OpenAISessionManager initialized with db_path: {self._db_path}")

    def get_session(self, session_id: str) -> OpenAISession:
        """
        Get or create a session.

        Args:
            session_id: Unique session identifier (e.g., phone number)

        Returns:
            OpenAISession instance
        """
        if session_id not in self._sessions:
            sqlite_session = SQLiteSession(self._db_path, session_id)
            self._sessions[session_id] = OpenAISession(session_id, sqlite_session)
            logger.debug(f"Created new session for {session_id}")
        return self._sessions[session_id]

    def get_sqlite_session(self, session_id: str) -> SQLiteSession:
        """
        Get the underlying SQLiteSession for use with Runner.

        Args:
            session_id: Unique session identifier

        Returns:
            SQLiteSession instance
        """
        return self.get_session(session_id).sqlite_session

    async def clear_session(self, session_id: str) -> None:
        """Clear a session."""
        async with self._lock:
            if session_id in self._sessions:
                await self._sessions[session_id].clear()
                del self._sessions[session_id]
                logger.debug(f"Cleared session for {session_id}")

    async def clear_all(self) -> None:
        """Clear all sessions."""
        async with self._lock:
            for session in self._sessions.values():
                await session.clear()
            self._sessions.clear()
            logger.info("Cleared all sessions")
