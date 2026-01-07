"""
Anthropic session management.
Maintains conversation history for each session.
"""

from typing import Dict, List, Any, Optional
import asyncio
import logging

from ..base import BaseSession, AgentType

logger = logging.getLogger(__name__)


class AnthropicSession(BaseSession):
    """Session implementation for Anthropic."""

    def __init__(self, session_id: str):
        super().__init__(session_id)
        self._history: List[Dict[str, Any]] = []
        self._current_agent: Optional[AgentType] = None
        self._lock = asyncio.Lock()

    async def add_message(self, role: str, content: Any, **kwargs) -> None:
        """
        Add a message to history.

        Args:
            role: Message role ('user', 'assistant')
            content: Message content (string or list of content blocks)
            **kwargs: Additional message properties (tool_use_id, etc.)
        """
        async with self._lock:
            message = {"role": role, "content": content}
            message.update(kwargs)
            self._history.append(message)

    async def get_history(self) -> List[Dict[str, Any]]:
        """Get conversation history."""
        async with self._lock:
            return self._history.copy()

    async def clear(self) -> None:
        """Clear session history."""
        async with self._lock:
            self._history.clear()
            self._current_agent = None

    async def get_current_agent(self) -> Optional[AgentType]:
        """Get the current active agent for this session."""
        async with self._lock:
            return self._current_agent

    async def set_current_agent(self, agent_type: AgentType) -> None:
        """Set the current active agent for this session."""
        async with self._lock:
            self._current_agent = agent_type

    async def add_tool_result(self, tool_use_id: str, content: str) -> None:
        """
        Add a tool result to history.

        Args:
            tool_use_id: The ID of the tool use block this result corresponds to
            content: The tool result content
        """
        async with self._lock:
            self._history.append({
                "role": "user",
                "content": [{
                    "type": "tool_result",
                    "tool_use_id": tool_use_id,
                    "content": content
                }]
            })

    async def get_message_count(self) -> int:
        """Get the number of messages in history."""
        async with self._lock:
            return len(self._history)


class AnthropicSessionManager:
    """Manages Anthropic sessions."""

    def __init__(self):
        self._sessions: Dict[str, AnthropicSession] = {}
        self._lock = asyncio.Lock()
        logger.info("AnthropicSessionManager initialized")

    def get_session(self, session_id: str) -> AnthropicSession:
        """Get or create a session."""
        if session_id not in self._sessions:
            self._sessions[session_id] = AnthropicSession(session_id)
            logger.debug(f"Created new Anthropic session for {session_id}")
        return self._sessions[session_id]

    async def clear_session(self, session_id: str) -> None:
        """Clear a session."""
        async with self._lock:
            if session_id in self._sessions:
                await self._sessions[session_id].clear()
                del self._sessions[session_id]
                logger.debug(f"Cleared Anthropic session for {session_id}")

    async def clear_all(self) -> None:
        """Clear all sessions."""
        async with self._lock:
            for session in self._sessions.values():
                await session.clear()
            self._sessions.clear()
            logger.info("Cleared all Anthropic sessions")

    def session_exists(self, session_id: str) -> bool:
        """Check if a session exists."""
        return session_id in self._sessions
