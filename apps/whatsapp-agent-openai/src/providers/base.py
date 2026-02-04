"""
Abstract base classes for AI provider implementations.
All providers must implement these interfaces.
"""

from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional
from dataclasses import dataclass, field
from enum import Enum


class AgentType(str, Enum):
    """Enumeration of all agent types in the system."""
    GREETER = "greeter"
    NOTIFICATION_OPTIN = "notification_optin"
    PRODUCT_INFO = "product_info"
    FREE_PRODUCT = "free_product"
    OBJECTION_HANDLER = "objection_handler"
    SALES_CLOSER = "sales_closer"
    PAYMENT = "payment"
    SUPPORT = "support"
    MENTORSHIP_BOOKING = "mentorship_booking"
    TRIAGE = "triage"


@dataclass
class ModelConfig:
    """OpenAI model configuration."""
    # Model complexity tier
    tier: str  # "fast" or "complex"

    # OpenAI model name
    openai_model: str = "gpt-4o-mini"

    # Generation settings
    max_tokens: int = 150
    temperature: float = 0.7

    # Tool settings
    tool_choice: str = "auto"  # "auto", "required", "none"


@dataclass
class AgentDefinition:
    """Provider-agnostic agent definition."""
    agent_type: AgentType
    name: str
    description: str
    system_prompt: str
    model_config: ModelConfig
    tools: List[str]  # List of tool names
    handoffs: List[AgentType] = field(default_factory=list)  # Agents this agent can hand off to


@dataclass
class ExecutionResult:
    """Result of agent execution."""
    success: bool
    response: Optional[str] = None
    tool_calls: List[Dict[str, Any]] = field(default_factory=list)
    handoff_to: Optional[AgentType] = None
    error: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


class BaseAgent(ABC):
    """Abstract base class for agents."""

    def __init__(
        self,
        definition: AgentDefinition,
        tools: List[Any],
        context: Dict[str, Any]
    ):
        self.definition = definition
        self.tools = tools
        self.context = context

    @property
    def name(self) -> str:
        return self.definition.name

    @property
    def agent_type(self) -> AgentType:
        return self.definition.agent_type

    @property
    def handoffs(self) -> List[AgentType]:
        return self.definition.handoffs


class BaseRunner(ABC):
    """Abstract base class for agent runners."""

    @abstractmethod
    async def run(
        self,
        agent: BaseAgent,
        message: str,
        session_id: str,
        context: Dict[str, Any]
    ) -> ExecutionResult:
        """
        Execute an agent with a message.

        Args:
            agent: The agent to execute
            message: User message
            session_id: Unique session identifier
            context: Additional context (user info, products, etc.)

        Returns:
            ExecutionResult with response and metadata
        """
        pass

    @abstractmethod
    async def handle_handoff(
        self,
        from_agent: BaseAgent,
        to_agent_type: AgentType,
        message: str,
        session_id: str,
        context: Dict[str, Any]
    ) -> ExecutionResult:
        """Handle agent-to-agent handoff."""
        pass


class BaseSession(ABC):
    """Abstract base class for conversation session management."""

    def __init__(self, session_id: str):
        self.session_id = session_id

    @abstractmethod
    async def add_message(self, role: str, content: str, **kwargs) -> None:
        """Add a message to the session history."""
        pass

    @abstractmethod
    async def get_history(self) -> List[Dict[str, Any]]:
        """Get conversation history."""
        pass

    @abstractmethod
    async def clear(self) -> None:
        """Clear session history."""
        pass

    @abstractmethod
    async def get_current_agent(self) -> Optional[AgentType]:
        """Get the current active agent for this session."""
        pass

    @abstractmethod
    async def set_current_agent(self, agent_type: AgentType) -> None:
        """Set the current active agent for this session."""
        pass


class BaseAgentFactory(ABC):
    """Abstract factory for creating agents."""

    @abstractmethod
    def create_agent(
        self,
        definition: AgentDefinition,
        context: Dict[str, Any]
    ) -> BaseAgent:
        """Create an agent from a definition."""
        pass

    @abstractmethod
    def create_all_agents(
        self,
        definitions: List[AgentDefinition],
        context: Dict[str, Any]
    ) -> Dict[AgentType, BaseAgent]:
        """Create all agents for a creator."""
        pass

    @abstractmethod
    def get_runner(self) -> BaseRunner:
        """Get the runner for this provider."""
        pass


class BaseToolConverter(ABC):
    """Abstract base class for converting tools to provider format."""

    @abstractmethod
    def convert(self, tool_definition: Dict[str, Any], context: Dict[str, Any]) -> Any:
        """Convert a tool definition to provider-specific format."""
        pass

    @abstractmethod
    def convert_all(self, tool_definitions: List[Dict[str, Any]], context: Dict[str, Any]) -> List[Any]:
        """Convert all tool definitions."""
        pass
