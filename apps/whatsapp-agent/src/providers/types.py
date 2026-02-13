"""
Shared types and enums for AI providers.
"""

from enum import Enum
from typing import TypedDict, List, Optional, Any, Callable


class ProviderType(str, Enum):
    """Supported AI providers."""
    OPENAI = "openai"


class ToolParameter(TypedDict, total=False):
    """Tool parameter definition."""
    name: str
    type: str
    description: str
    required: bool
    enum: Optional[List[str]]
    default: Optional[Any]


class ToolDefinition(TypedDict, total=False):
    """Provider-agnostic tool definition."""
    name: str
    description: str
    parameters: List[ToolParameter]
    handler: Callable  # Async function that implements the tool


class HandoffDecision(TypedDict, total=False):
    """Decision to hand off to another agent."""
    should_handoff: bool
    target_agent: Optional[str]
    reason: Optional[str]


class MessageRole(str, Enum):
    """Message roles in conversation."""
    SYSTEM = "system"
    USER = "user"
    ASSISTANT = "assistant"
    TOOL = "tool"


class Message(TypedDict, total=False):
    """A message in conversation history."""
    role: str
    content: str
    name: Optional[str]
    tool_call_id: Optional[str]
    tool_calls: Optional[List[Any]]
