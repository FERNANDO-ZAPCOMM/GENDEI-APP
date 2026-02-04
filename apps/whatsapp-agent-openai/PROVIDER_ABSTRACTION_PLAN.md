# Provider Abstraction Implementation Plan

## Overview

This document outlines the implementation plan to add multi-provider support (OpenAI and Anthropic) to the WhatsApp Agent system. The goal is to enable switching between providers via the `AI_PROVIDER` environment variable while maintaining all existing functionality.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Directory Structure](#2-directory-structure)
3. [Phase 1: Abstract Base Classes](#3-phase-1-abstract-base-classes)
4. [Phase 2: Tool Abstraction](#4-phase-2-tool-abstraction)
5. [Phase 3: OpenAI Implementation](#5-phase-3-openai-implementation)
6. [Phase 4: Anthropic Implementation](#6-phase-4-anthropic-implementation)
7. [Phase 5: Provider Factory](#7-phase-5-provider-factory)
8. [Phase 6: Runtime Integration](#8-phase-6-runtime-integration)
9. [Phase 7: Testing Strategy](#9-phase-7-testing-strategy)
10. [Migration Checklist](#10-migration-checklist)
11. [Environment Variables](#11-environment-variables)
12. [Estimated Timeline](#12-estimated-timeline)

---

## 1. Architecture Overview

### Current Architecture (OpenAI-only)
```
main.py → creator_runtime.py → openai_factory.py → OpenAI Agents SDK
                                      ↓
                              function_tools.py (tools)
```

### Target Architecture (Multi-provider)
```
main.py → creator_runtime.py → provider_factory.py
                                      ↓
                    ┌─────────────────┴─────────────────┐
                    ↓                                   ↓
            openai/factory.py                  anthropic/factory.py
                    ↓                                   ↓
            openai/runner.py                   anthropic/runner.py
                    ↓                                   ↓
              OpenAI SDK                         Anthropic SDK
                    ↑                                   ↑
                    └─────────────────┬─────────────────┘
                                      ↓
                          providers/tools/base.py
                          (Provider-agnostic tool definitions)
```

### Key Design Principles

1. **Interface Segregation**: Each provider implements the same abstract interface
2. **Dependency Inversion**: High-level modules depend on abstractions, not concretions
3. **Factory Pattern**: Provider selection happens at runtime via factory
4. **Strategy Pattern**: Different providers are interchangeable strategies

---

## 2. Directory Structure

```
src/
├── providers/
│   ├── __init__.py
│   ├── base.py                    # Abstract base classes
│   ├── factory.py                 # Provider factory (selects provider)
│   ├── types.py                   # Shared types and enums
│   ├── tools/
│   │   ├── __init__.py
│   │   ├── base.py                # Tool registry & conversion
│   │   ├── definitions.py         # Provider-agnostic tool definitions
│   │   └── implementations.py     # Tool implementations (moved from function_tools.py)
│   ├── openai/
│   │   ├── __init__.py
│   │   ├── factory.py             # OpenAI agent factory
│   │   ├── runner.py              # OpenAI runner wrapper
│   │   ├── session.py             # Session management
│   │   └── tools.py               # OpenAI tool format converter
│   └── anthropic/
│       ├── __init__.py
│       ├── factory.py             # Anthropic agent factory
│       ├── runner.py              # Anthropic runner (agentic loop)
│       ├── session.py             # Conversation history management
│       └── tools.py               # Anthropic tool format converter
├── agents/
│   ├── __init__.py
│   ├── definitions.py             # Agent definitions (provider-agnostic)
│   ├── prompts.py                 # System prompts for each agent
│   ├── guardrails.py              # Input/output guardrails (unchanged)
│   └── openai_factory.py          # [DEPRECATED - will be migrated]
├── runtime/
│   ├── creator_runtime.py         # Updated to use provider factory
│   └── context.py                 # Unchanged
└── ...
```

---

## 3. Phase 1: Abstract Base Classes

### File: `src/providers/base.py`

```python
"""
Abstract base classes for AI provider implementations.
All providers must implement these interfaces.
"""

from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional, Callable
from dataclasses import dataclass
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
    """Provider-agnostic model configuration."""
    # Model complexity tier
    tier: str  # "fast" or "complex"

    # Provider-specific model names (resolved at runtime)
    openai_model: str = "gpt-4o-mini"
    anthropic_model: str = "claude-3-5-sonnet-20241022"

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
    handoffs: List[AgentType]  # Agents this agent can hand off to


@dataclass
class ExecutionResult:
    """Result of agent execution."""
    success: bool
    response: Optional[str] = None
    tool_calls: List[Dict[str, Any]] = None
    handoff_to: Optional[AgentType] = None
    error: Optional[str] = None
    metadata: Dict[str, Any] = None

    def __post_init__(self):
        if self.tool_calls is None:
            self.tool_calls = []
        if self.metadata is None:
            self.metadata = {}


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
    async def add_message(self, role: str, content: str) -> None:
        """Add a message to the session history."""
        pass

    @abstractmethod
    async def get_history(self) -> List[Dict[str, str]]:
        """Get conversation history."""
        pass

    @abstractmethod
    async def clear(self) -> None:
        """Clear session history."""
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
    def convert(self, tool_definition: Dict[str, Any]) -> Any:
        """Convert a tool definition to provider-specific format."""
        pass

    @abstractmethod
    def convert_all(self, tool_definitions: List[Dict[str, Any]]) -> List[Any]:
        """Convert all tool definitions."""
        pass
```

### File: `src/providers/types.py`

```python
"""Shared types and enums for providers."""

from enum import Enum
from typing import TypedDict, List, Optional, Any

class ProviderType(str, Enum):
    """Supported AI providers."""
    OPENAI = "openai"
    ANTHROPIC = "anthropic"


class ToolParameter(TypedDict):
    """Tool parameter definition."""
    name: str
    type: str
    description: str
    required: bool
    enum: Optional[List[str]]


class ToolDefinition(TypedDict):
    """Provider-agnostic tool definition."""
    name: str
    description: str
    parameters: List[ToolParameter]
    handler: Any  # Async function


class HandoffDecision(TypedDict):
    """Decision to hand off to another agent."""
    should_handoff: bool
    target_agent: Optional[str]
    reason: Optional[str]
```

---

## 4. Phase 2: Tool Abstraction

### File: `src/providers/tools/definitions.py`

```python
"""
Provider-agnostic tool definitions.
These are converted to provider-specific formats at runtime.
"""

from typing import List, Dict, Any
from ..types import ToolDefinition, ToolParameter

# Tool definitions in a neutral format
TOOL_DEFINITIONS: Dict[str, ToolDefinition] = {
    "send_text_message": {
        "name": "send_text_message",
        "description": "Send a text message to the customer via WhatsApp",
        "parameters": [
            {
                "name": "phone",
                "type": "string",
                "description": "Customer phone number",
                "required": True,
                "enum": None
            },
            {
                "name": "text",
                "type": "string",
                "description": "Message text to send",
                "required": True,
                "enum": None
            }
        ],
        "handler": None  # Will be set from implementations.py
    },

    "get_all_products": {
        "name": "get_all_products",
        "description": "Get the complete product catalog for the creator",
        "parameters": [],
        "handler": None
    },

    "get_product_by_id": {
        "name": "get_product_by_id",
        "description": "Get detailed information about a specific product",
        "parameters": [
            {
                "name": "product_id",
                "type": "string",
                "description": "The unique product identifier",
                "required": True,
                "enum": None
            }
        ],
        "handler": None
    },

    "create_order_and_send_payment": {
        "name": "create_order_and_send_payment",
        "description": "Create an order and send payment link to customer",
        "parameters": [
            {
                "name": "phone",
                "type": "string",
                "description": "Customer phone number",
                "required": True,
                "enum": None
            },
            {
                "name": "product_id",
                "type": "string",
                "description": "Product to order",
                "required": True,
                "enum": None
            }
        ],
        "handler": None
    },

    "enable_human_takeover": {
        "name": "enable_human_takeover",
        "description": "Escalate conversation to human support",
        "parameters": [
            {
                "name": "phone",
                "type": "string",
                "description": "Customer phone number",
                "required": True,
                "enum": None
            },
            {
                "name": "reason",
                "type": "string",
                "description": "Reason for escalation",
                "required": True,
                "enum": None
            }
        ],
        "handler": None
    },

    # ... (all other tools defined similarly)
}

# Tool groups for different agent types
AGENT_TOOL_GROUPS: Dict[str, List[str]] = {
    "greeter": [
        "send_text_message",
        "send_greeting_with_products_button",
        "get_all_products",
    ],
    "product_info": [
        "send_text_message",
        "get_all_products",
        "get_product_by_id",
        "send_single_product_message",
        "send_product_list",
    ],
    "sales_closer": [
        "send_text_message",
        "get_product_by_id",
        "create_order_and_send_payment",
    ],
    "payment": [
        "send_text_message",
        "check_order_status",
        "send_pix_payment_to_customer",
    ],
    "support": [
        "send_text_message",
        "enable_human_takeover",
        "check_order_status",
    ],
    # ... other agent tool groups
}


def get_tools_for_agent(agent_type: str) -> List[str]:
    """Get tool names for an agent type."""
    return AGENT_TOOL_GROUPS.get(agent_type, [])
```

### File: `src/providers/tools/base.py`

```python
"""
Tool registry and conversion utilities.
"""

from typing import Dict, List, Any, Callable
from .definitions import TOOL_DEFINITIONS
from .implementations import TOOL_IMPLEMENTATIONS


class ToolRegistry:
    """Registry for tool definitions and implementations."""

    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
        self._definitions = TOOL_DEFINITIONS.copy()
        self._implementations = TOOL_IMPLEMENTATIONS.copy()
        self._initialized = True

    def get_definition(self, name: str) -> Dict[str, Any]:
        """Get tool definition by name."""
        if name not in self._definitions:
            raise ValueError(f"Unknown tool: {name}")
        return self._definitions[name]

    def get_implementation(self, name: str) -> Callable:
        """Get tool implementation by name."""
        if name not in self._implementations:
            raise ValueError(f"No implementation for tool: {name}")
        return self._implementations[name]

    def get_tools(self, names: List[str]) -> List[Dict[str, Any]]:
        """Get multiple tool definitions with implementations."""
        tools = []
        for name in names:
            tool = self._definitions[name].copy()
            tool["handler"] = self._implementations.get(name)
            tools.append(tool)
        return tools
```

---

## 5. Phase 3: OpenAI Implementation

### File: `src/providers/openai/factory.py`

```python
"""
OpenAI provider implementation using OpenAI Agents SDK.
"""

from typing import Dict, List, Any
from agents import Agent, ModelSettings

from ..base import (
    BaseAgent, BaseAgentFactory, BaseRunner,
    AgentDefinition, AgentType, ModelConfig
)
from ..tools.base import ToolRegistry
from .runner import OpenAIRunner
from .tools import OpenAIToolConverter


class OpenAIAgent(BaseAgent):
    """OpenAI-specific agent wrapper."""

    def __init__(
        self,
        definition: AgentDefinition,
        tools: List[Any],
        context: Dict[str, Any],
        sdk_agent: Agent
    ):
        super().__init__(definition, tools, context)
        self.sdk_agent = sdk_agent


class OpenAIAgentFactory(BaseAgentFactory):
    """Factory for creating OpenAI agents."""

    def __init__(self):
        self.tool_registry = ToolRegistry()
        self.tool_converter = OpenAIToolConverter()
        self._runner = None

    def create_agent(
        self,
        definition: AgentDefinition,
        context: Dict[str, Any]
    ) -> OpenAIAgent:
        """Create an OpenAI agent from definition."""

        # Get and convert tools
        tool_defs = self.tool_registry.get_tools(definition.tools)
        sdk_tools = self.tool_converter.convert_all(tool_defs, context)

        # Create model settings
        model_settings = ModelSettings(
            max_tokens=definition.model_config.max_tokens,
            temperature=definition.model_config.temperature,
        )

        if definition.model_config.tool_choice == "required":
            model_settings.tool_choice = "required"

        # Build system prompt with context
        system_prompt = self._build_prompt(definition, context)

        # Create SDK agent
        sdk_agent = Agent(
            name=definition.name,
            instructions=system_prompt,
            model=definition.model_config.openai_model,
            model_settings=model_settings,
            tools=sdk_tools,
        )

        return OpenAIAgent(
            definition=definition,
            tools=sdk_tools,
            context=context,
            sdk_agent=sdk_agent
        )

    def create_all_agents(
        self,
        definitions: List[AgentDefinition],
        context: Dict[str, Any]
    ) -> Dict[AgentType, OpenAIAgent]:
        """Create all agents for a creator."""
        agents = {}
        for definition in definitions:
            agents[definition.agent_type] = self.create_agent(definition, context)

        # Set up handoffs after all agents are created
        self._setup_handoffs(agents, definitions)

        return agents

    def _setup_handoffs(
        self,
        agents: Dict[AgentType, OpenAIAgent],
        definitions: List[AgentDefinition]
    ):
        """Configure agent handoffs."""
        for definition in definitions:
            agent = agents[definition.agent_type]
            handoff_agents = [
                agents[h].sdk_agent
                for h in definition.handoffs
                if h in agents
            ]
            agent.sdk_agent.handoffs = handoff_agents

    def _build_prompt(
        self,
        definition: AgentDefinition,
        context: Dict[str, Any]
    ) -> str:
        """Build system prompt with context injection."""
        prompt = definition.system_prompt

        # Inject creator context
        if "creator" in context:
            creator = context["creator"]
            prompt = prompt.replace("{creator_name}", creator.get("name", ""))
            prompt = prompt.replace("{creator_niche}", creator.get("niche", ""))
            prompt = prompt.replace("{tone}", creator.get("tone", "friendly"))

        # Inject product context
        if "products" in context:
            products_str = self._format_products(context["products"])
            prompt = prompt.replace("{products}", products_str)

        return prompt

    def _format_products(self, products: List[Dict]) -> str:
        """Format products for prompt injection."""
        if not products:
            return "No products available."

        lines = []
        for p in products:
            lines.append(f"- {p['title']}: R$ {p['price']:.2f}")
        return "\n".join(lines)

    def get_runner(self) -> BaseRunner:
        """Get the OpenAI runner."""
        if self._runner is None:
            self._runner = OpenAIRunner()
        return self._runner
```

### File: `src/providers/openai/runner.py`

```python
"""
OpenAI runner implementation using OpenAI Agents SDK.
"""

import os
from typing import Dict, Any
from agents import Runner

from ..base import (
    BaseRunner, BaseAgent, ExecutionResult, AgentType
)
from .session import OpenAISessionManager


class OpenAIRunner(BaseRunner):
    """Runner for OpenAI agents using the Agents SDK."""

    def __init__(self):
        self.session_manager = OpenAISessionManager()

    async def run(
        self,
        agent: BaseAgent,
        message: str,
        session_id: str,
        context: Dict[str, Any]
    ) -> ExecutionResult:
        """Execute an OpenAI agent."""
        try:
            # Get or create session
            session = self.session_manager.get_session(session_id)

            # Build enriched prompt
            prompt = self._build_prompt(message, context)

            # Run agent via SDK
            result = await Runner.run(
                agent.sdk_agent,
                prompt,
                session=session
            )

            # Parse result
            return self._parse_result(result)

        except Exception as e:
            return ExecutionResult(
                success=False,
                error=str(e)
            )

    async def handle_handoff(
        self,
        from_agent: BaseAgent,
        to_agent_type: AgentType,
        message: str,
        session_id: str,
        context: Dict[str, Any]
    ) -> ExecutionResult:
        """
        Handle agent handoff.
        Note: OpenAI Agents SDK handles handoffs internally via Runner.run()
        """
        # The SDK handles handoffs automatically when agent.handoffs is set
        # This method is here for explicit handoff requests
        pass

    def _build_prompt(self, message: str, context: Dict[str, Any]) -> str:
        """Build enriched prompt with user context."""
        parts = [message]

        if "user_context" in context:
            uc = context["user_context"]
            parts.append(f"\n[User: {uc.get('name', 'Unknown')}, Stage: {uc.get('stage', 'novo')}]")

        return "\n".join(parts)

    def _parse_result(self, sdk_result) -> ExecutionResult:
        """Parse SDK result into ExecutionResult."""
        # Extract response text and metadata from SDK result
        return ExecutionResult(
            success=True,
            response=str(sdk_result),
            tool_calls=[],  # Parse from sdk_result if needed
            metadata={}
        )
```

### File: `src/providers/openai/tools.py`

```python
"""
OpenAI tool format converter.
"""

from typing import Dict, List, Any, Callable
from agents import function_tool

from ..base import BaseToolConverter


class OpenAIToolConverter(BaseToolConverter):
    """Converts tool definitions to OpenAI Agents SDK format."""

    def convert(
        self,
        tool_definition: Dict[str, Any],
        context: Dict[str, Any]
    ) -> Callable:
        """
        Convert a tool definition to OpenAI @function_tool format.
        """
        handler = tool_definition["handler"]

        if handler is None:
            raise ValueError(f"No handler for tool: {tool_definition['name']}")

        # The handler should already be decorated with @function_tool
        # in the implementations file. Here we just wrap with context.

        async def contextualized_handler(*args, **kwargs):
            # Inject context into handler
            return await handler(*args, **kwargs, _context=context)

        # Copy function metadata
        contextualized_handler.__name__ = handler.__name__
        contextualized_handler.__doc__ = handler.__doc__

        return function_tool(contextualized_handler)

    def convert_all(
        self,
        tool_definitions: List[Dict[str, Any]],
        context: Dict[str, Any]
    ) -> List[Callable]:
        """Convert all tool definitions."""
        return [self.convert(td, context) for td in tool_definitions]
```

---

## 6. Phase 4: Anthropic Implementation

### File: `src/providers/anthropic/factory.py`

```python
"""
Anthropic provider implementation using Claude API.
"""

from typing import Dict, List, Any
import anthropic

from ..base import (
    BaseAgent, BaseAgentFactory, BaseRunner,
    AgentDefinition, AgentType, ModelConfig
)
from ..tools.base import ToolRegistry
from .runner import AnthropicRunner
from .tools import AnthropicToolConverter


class AnthropicAgent(BaseAgent):
    """Anthropic-specific agent wrapper."""

    def __init__(
        self,
        definition: AgentDefinition,
        tools: List[Dict[str, Any]],
        context: Dict[str, Any],
        system_prompt: str
    ):
        super().__init__(definition, tools, context)
        self.system_prompt = system_prompt


class AnthropicAgentFactory(BaseAgentFactory):
    """Factory for creating Anthropic agents."""

    def __init__(self):
        self.tool_registry = ToolRegistry()
        self.tool_converter = AnthropicToolConverter()
        self._runner = None
        self._client = anthropic.Anthropic()

    def create_agent(
        self,
        definition: AgentDefinition,
        context: Dict[str, Any]
    ) -> AnthropicAgent:
        """Create an Anthropic agent from definition."""

        # Get and convert tools
        tool_defs = self.tool_registry.get_tools(definition.tools)
        anthropic_tools = self.tool_converter.convert_all(tool_defs)

        # Build system prompt with context
        system_prompt = self._build_prompt(definition, context)

        return AnthropicAgent(
            definition=definition,
            tools=anthropic_tools,
            context=context,
            system_prompt=system_prompt
        )

    def create_all_agents(
        self,
        definitions: List[AgentDefinition],
        context: Dict[str, Any]
    ) -> Dict[AgentType, AnthropicAgent]:
        """Create all agents for a creator."""
        agents = {}
        for definition in definitions:
            agents[definition.agent_type] = self.create_agent(definition, context)
        return agents

    def _build_prompt(
        self,
        definition: AgentDefinition,
        context: Dict[str, Any]
    ) -> str:
        """Build system prompt with context injection."""
        prompt = definition.system_prompt

        # Add handoff instructions for Anthropic
        if definition.handoffs:
            handoff_names = [h.value for h in definition.handoffs]
            prompt += f"\n\nYou can request a handoff to these specialists: {', '.join(handoff_names)}. "
            prompt += "To request a handoff, respond with: [HANDOFF:agent_name] reason"

        # Inject creator context
        if "creator" in context:
            creator = context["creator"]
            prompt = prompt.replace("{creator_name}", creator.get("name", ""))
            prompt = prompt.replace("{creator_niche}", creator.get("niche", ""))
            prompt = prompt.replace("{tone}", creator.get("tone", "friendly"))

        return prompt

    def get_runner(self) -> BaseRunner:
        """Get the Anthropic runner."""
        if self._runner is None:
            self._runner = AnthropicRunner(self._client)
        return self._runner
```

### File: `src/providers/anthropic/runner.py`

```python
"""
Anthropic runner implementation with agentic loop.
"""

import re
from typing import Dict, List, Any, Optional
import anthropic

from ..base import (
    BaseRunner, BaseAgent, ExecutionResult, AgentType
)
from ..tools.base import ToolRegistry
from .session import AnthropicSessionManager


class AnthropicRunner(BaseRunner):
    """
    Runner for Anthropic agents.
    Implements an agentic loop to handle tool calls and handoffs.
    """

    HANDOFF_PATTERN = re.compile(r'\[HANDOFF:(\w+)\]\s*(.*)', re.IGNORECASE)

    def __init__(self, client: anthropic.Anthropic):
        self.client = client
        self.session_manager = AnthropicSessionManager()
        self.tool_registry = ToolRegistry()

    async def run(
        self,
        agent: BaseAgent,
        message: str,
        session_id: str,
        context: Dict[str, Any]
    ) -> ExecutionResult:
        """Execute an Anthropic agent with agentic loop."""
        try:
            # Get conversation history
            session = self.session_manager.get_session(session_id)
            history = await session.get_history()

            # Add user message
            history.append({"role": "user", "content": message})

            # Agentic loop
            max_iterations = 10
            tool_calls = []

            for _ in range(max_iterations):
                # Call Claude API
                response = self.client.messages.create(
                    model=agent.definition.model_config.anthropic_model,
                    max_tokens=agent.definition.model_config.max_tokens,
                    system=agent.system_prompt,
                    messages=history,
                    tools=agent.tools if agent.tools else None,
                )

                # Check for tool use
                if response.stop_reason == "tool_use":
                    # Process tool calls
                    for block in response.content:
                        if block.type == "tool_use":
                            tool_result = await self._execute_tool(
                                block.name,
                                block.input,
                                context
                            )
                            tool_calls.append({
                                "tool": block.name,
                                "input": block.input,
                                "output": tool_result
                            })

                            # Add to history for next iteration
                            history.append({
                                "role": "assistant",
                                "content": response.content
                            })
                            history.append({
                                "role": "user",
                                "content": [{
                                    "type": "tool_result",
                                    "tool_use_id": block.id,
                                    "content": str(tool_result)
                                }]
                            })
                    continue

                # Check for handoff request
                text_response = self._extract_text(response)
                handoff = self._detect_handoff(text_response)

                if handoff:
                    return ExecutionResult(
                        success=True,
                        response=handoff["message"],
                        tool_calls=tool_calls,
                        handoff_to=AgentType(handoff["target"]) if handoff["target"] else None
                    )

                # Normal completion
                await session.add_message("assistant", text_response)

                return ExecutionResult(
                    success=True,
                    response=text_response,
                    tool_calls=tool_calls
                )

            # Max iterations reached
            return ExecutionResult(
                success=False,
                error="Max iterations reached in agentic loop"
            )

        except Exception as e:
            return ExecutionResult(
                success=False,
                error=str(e)
            )

    async def handle_handoff(
        self,
        from_agent: BaseAgent,
        to_agent_type: AgentType,
        message: str,
        session_id: str,
        context: Dict[str, Any]
    ) -> ExecutionResult:
        """Handle explicit handoff to another agent."""
        # This is called when a handoff is detected
        # The caller should retrieve the target agent and call run() on it
        return ExecutionResult(
            success=True,
            handoff_to=to_agent_type,
            response=message
        )

    async def _execute_tool(
        self,
        tool_name: str,
        tool_input: Dict[str, Any],
        context: Dict[str, Any]
    ) -> Any:
        """Execute a tool and return result."""
        handler = self.tool_registry.get_implementation(tool_name)
        return await handler(**tool_input, _context=context)

    def _extract_text(self, response) -> str:
        """Extract text content from response."""
        for block in response.content:
            if hasattr(block, "text"):
                return block.text
        return ""

    def _detect_handoff(self, text: str) -> Optional[Dict[str, str]]:
        """Detect handoff request in response text."""
        match = self.HANDOFF_PATTERN.search(text)
        if match:
            return {
                "target": match.group(1),
                "message": match.group(2) or text
            }
        return None
```

### File: `src/providers/anthropic/tools.py`

```python
"""
Anthropic tool format converter.
"""

from typing import Dict, List, Any

from ..base import BaseToolConverter


class AnthropicToolConverter(BaseToolConverter):
    """Converts tool definitions to Anthropic API format."""

    def convert(self, tool_definition: Dict[str, Any]) -> Dict[str, Any]:
        """
        Convert a tool definition to Anthropic format.

        Anthropic format:
        {
            "name": "tool_name",
            "description": "Tool description",
            "input_schema": {
                "type": "object",
                "properties": {...},
                "required": [...]
            }
        }
        """
        properties = {}
        required = []

        for param in tool_definition.get("parameters", []):
            param_schema = {
                "type": self._convert_type(param["type"]),
                "description": param["description"]
            }

            if param.get("enum"):
                param_schema["enum"] = param["enum"]

            properties[param["name"]] = param_schema

            if param.get("required", False):
                required.append(param["name"])

        return {
            "name": tool_definition["name"],
            "description": tool_definition["description"],
            "input_schema": {
                "type": "object",
                "properties": properties,
                "required": required
            }
        }

    def convert_all(self, tool_definitions: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Convert all tool definitions."""
        return [self.convert(td) for td in tool_definitions]

    def _convert_type(self, param_type: str) -> str:
        """Convert parameter type to JSON Schema type."""
        type_map = {
            "string": "string",
            "str": "string",
            "int": "integer",
            "integer": "integer",
            "float": "number",
            "number": "number",
            "bool": "boolean",
            "boolean": "boolean",
            "list": "array",
            "array": "array",
            "dict": "object",
            "object": "object",
        }
        return type_map.get(param_type.lower(), "string")
```

### File: `src/providers/anthropic/session.py`

```python
"""
Anthropic session management.
Maintains conversation history for each session.
"""

from typing import Dict, List
import asyncio
from collections import defaultdict

from ..base import BaseSession


class AnthropicSession(BaseSession):
    """Session implementation for Anthropic."""

    def __init__(self, session_id: str):
        super().__init__(session_id)
        self._history: List[Dict[str, str]] = []
        self._lock = asyncio.Lock()

    async def add_message(self, role: str, content: str) -> None:
        """Add a message to history."""
        async with self._lock:
            self._history.append({"role": role, "content": content})

    async def get_history(self) -> List[Dict[str, str]]:
        """Get conversation history."""
        async with self._lock:
            return self._history.copy()

    async def clear(self) -> None:
        """Clear session history."""
        async with self._lock:
            self._history.clear()


class AnthropicSessionManager:
    """Manages Anthropic sessions."""

    def __init__(self):
        self._sessions: Dict[str, AnthropicSession] = {}
        self._lock = asyncio.Lock()

    def get_session(self, session_id: str) -> AnthropicSession:
        """Get or create a session."""
        if session_id not in self._sessions:
            self._sessions[session_id] = AnthropicSession(session_id)
        return self._sessions[session_id]

    async def clear_session(self, session_id: str) -> None:
        """Clear a session."""
        if session_id in self._sessions:
            await self._sessions[session_id].clear()
            del self._sessions[session_id]
```

---

## 7. Phase 5: Provider Factory

### File: `src/providers/factory.py`

```python
"""
Provider factory for selecting AI provider at runtime.
"""

import os
from typing import Dict, Any

from .base import BaseAgentFactory, AgentDefinition, AgentType
from .types import ProviderType
from .openai.factory import OpenAIAgentFactory
from .anthropic.factory import AnthropicAgentFactory


class ProviderFactory:
    """
    Factory for creating provider-specific agent factories.
    Selects provider based on AI_PROVIDER environment variable.
    """

    _factories: Dict[ProviderType, type] = {
        ProviderType.OPENAI: OpenAIAgentFactory,
        ProviderType.ANTHROPIC: AnthropicAgentFactory,
    }

    @classmethod
    def get_provider(cls) -> ProviderType:
        """Get configured provider from environment."""
        provider_str = os.getenv("AI_PROVIDER", "openai").lower()

        try:
            return ProviderType(provider_str)
        except ValueError:
            raise ValueError(
                f"Unknown AI_PROVIDER: {provider_str}. "
                f"Supported: {[p.value for p in ProviderType]}"
            )

    @classmethod
    def create_factory(cls, provider: ProviderType = None) -> BaseAgentFactory:
        """
        Create an agent factory for the specified provider.

        Args:
            provider: Provider type (defaults to AI_PROVIDER env var)

        Returns:
            Provider-specific agent factory
        """
        if provider is None:
            provider = cls.get_provider()

        factory_class = cls._factories.get(provider)
        if factory_class is None:
            raise ValueError(f"No factory registered for provider: {provider}")

        return factory_class()

    @classmethod
    def register_provider(
        cls,
        provider: ProviderType,
        factory_class: type
    ) -> None:
        """Register a new provider factory."""
        cls._factories[provider] = factory_class


def get_default_factory() -> BaseAgentFactory:
    """Convenience function to get default factory."""
    return ProviderFactory.create_factory()
```

---

## 8. Phase 6: Runtime Integration

### File: `src/runtime/creator_runtime.py` (Updated)

```python
"""
Creator runtime management with provider abstraction.
"""

import os
import logging
from typing import Dict, Any, Optional
from dataclasses import dataclass

from ..providers.factory import ProviderFactory, get_default_factory
from ..providers.base import BaseAgentFactory, AgentType, BaseAgent
from ..agents.definitions import get_all_agent_definitions
from ..services.data_service import DataService

logger = logging.getLogger(__name__)


@dataclass
class CreatorRuntime:
    """Runtime context for a creator."""
    creator_id: str
    agents: Dict[AgentType, BaseAgent]
    factory: BaseAgentFactory
    data_service: DataService
    provider: str


class RuntimeManager:
    """Manages creator runtimes with caching."""

    _runtimes: Dict[str, CreatorRuntime] = {}

    @classmethod
    async def get_runtime(
        cls,
        creator_id: str,
        force_refresh: bool = False
    ) -> CreatorRuntime:
        """
        Get or create runtime for a creator.

        Args:
            creator_id: Creator identifier
            force_refresh: Force rebuild of runtime

        Returns:
            CreatorRuntime with agents ready to use
        """
        cache_key = creator_id

        if not force_refresh and cache_key in cls._runtimes:
            return cls._runtimes[cache_key]

        runtime = await cls._build_runtime(creator_id)
        cls._runtimes[cache_key] = runtime

        return runtime

    @classmethod
    async def _build_runtime(cls, creator_id: str) -> CreatorRuntime:
        """Build a new runtime for a creator."""
        provider = ProviderFactory.get_provider()
        logger.info(f"Building runtime for creator '{creator_id}' with provider '{provider.value}'")

        # Create factory
        factory = ProviderFactory.create_factory(provider)

        # Load creator data
        data_service = DataService(creator_id)
        await data_service.load()

        # Build context for agents
        context = {
            "creator_id": creator_id,
            "creator": data_service.get_creator_profile(),
            "products": data_service.get_products(),
        }

        # Get agent definitions
        definitions = get_all_agent_definitions()

        # Create all agents
        agents = factory.create_all_agents(definitions, context)

        logger.info(
            f"Runtime ready for creator '{creator_id}' with "
            f"{len(agents)} agents [{provider.value}]"
        )

        return CreatorRuntime(
            creator_id=creator_id,
            agents=agents,
            factory=factory,
            data_service=data_service,
            provider=provider.value
        )

    @classmethod
    def clear_runtime(cls, creator_id: str) -> None:
        """Clear cached runtime for a creator."""
        if creator_id in cls._runtimes:
            del cls._runtimes[creator_id]

    @classmethod
    def clear_all(cls) -> None:
        """Clear all cached runtimes."""
        cls._runtimes.clear()


# Convenience function for backward compatibility
async def get_runtime_for_creator(creator_id: str) -> CreatorRuntime:
    """Get runtime for a creator."""
    return await RuntimeManager.get_runtime(creator_id)
```

### File: `src/agents/definitions.py`

```python
"""
Provider-agnostic agent definitions.
"""

from typing import List

from ..providers.base import AgentDefinition, AgentType, ModelConfig
from .prompts import AGENT_PROMPTS


# Model configurations
FAST_MODEL = ModelConfig(
    tier="fast",
    openai_model="gpt-4o-mini",
    anthropic_model="claude-3-5-haiku-20241022",
    max_tokens=150,
    temperature=0.7,
)

COMPLEX_MODEL = ModelConfig(
    tier="complex",
    openai_model="gpt-4o",
    anthropic_model="claude-3-5-sonnet-20241022",
    max_tokens=200,
    temperature=0.7,
)


# Agent definitions
AGENT_DEFINITIONS: List[AgentDefinition] = [
    AgentDefinition(
        agent_type=AgentType.GREETER,
        name="greeter",
        description="Welcomes customers and initiates conversation",
        system_prompt=AGENT_PROMPTS["greeter"],
        model_config=FAST_MODEL,
        tools=["send_text_message", "send_greeting_with_products_button", "get_all_products"],
        handoffs=[AgentType.PRODUCT_INFO, AgentType.TRIAGE],
    ),

    AgentDefinition(
        agent_type=AgentType.PRODUCT_INFO,
        name="product_info",
        description="Provides detailed product information",
        system_prompt=AGENT_PROMPTS["product_info"],
        model_config=COMPLEX_MODEL,
        tools=[
            "send_text_message", "get_all_products", "get_product_by_id",
            "send_single_product_message", "send_product_list"
        ],
        handoffs=[AgentType.SALES_CLOSER, AgentType.OBJECTION_HANDLER, AgentType.SUPPORT],
    ),

    AgentDefinition(
        agent_type=AgentType.SALES_CLOSER,
        name="sales_closer",
        description="Closes sales and handles purchase flow",
        system_prompt=AGENT_PROMPTS["sales_closer"],
        model_config=FAST_MODEL,
        tools=["send_text_message", "get_product_by_id", "create_order_and_send_payment"],
        handoffs=[AgentType.PAYMENT, AgentType.OBJECTION_HANDLER],
    ),

    AgentDefinition(
        agent_type=AgentType.OBJECTION_HANDLER,
        name="objection_handler",
        description="Handles customer objections and concerns",
        system_prompt=AGENT_PROMPTS["objection_handler"],
        model_config=COMPLEX_MODEL,
        tools=["send_text_message", "get_product_by_id"],
        handoffs=[AgentType.SALES_CLOSER, AgentType.SUPPORT],
    ),

    AgentDefinition(
        agent_type=AgentType.PAYMENT,
        name="payment",
        description="Handles payment-related queries",
        system_prompt=AGENT_PROMPTS["payment"],
        model_config=FAST_MODEL,
        tools=["send_text_message", "check_order_status", "send_pix_payment_to_customer"],
        handoffs=[AgentType.SUPPORT],
    ),

    AgentDefinition(
        agent_type=AgentType.SUPPORT,
        name="support",
        description="Handles support requests and escalations",
        system_prompt=AGENT_PROMPTS["support"],
        model_config=COMPLEX_MODEL,
        tools=["send_text_message", "enable_human_takeover", "check_order_status"],
        handoffs=[],  # Support is end of the line
    ),

    AgentDefinition(
        agent_type=AgentType.TRIAGE,
        name="triage",
        description="Routes conversations to appropriate specialists",
        system_prompt=AGENT_PROMPTS["triage"],
        model_config=FAST_MODEL,
        tools=["send_text_message"],
        handoffs=[
            AgentType.GREETER, AgentType.PRODUCT_INFO, AgentType.SALES_CLOSER,
            AgentType.PAYMENT, AgentType.SUPPORT, AgentType.OBJECTION_HANDLER
        ],
    ),

    # ... Add remaining agents (notification_optin, free_product, mentorship_booking)
]


def get_all_agent_definitions() -> List[AgentDefinition]:
    """Get all agent definitions."""
    return AGENT_DEFINITIONS


def get_agent_definition(agent_type: AgentType) -> AgentDefinition:
    """Get a specific agent definition."""
    for definition in AGENT_DEFINITIONS:
        if definition.agent_type == agent_type:
            return definition
    raise ValueError(f"No definition for agent type: {agent_type}")
```

---

## 9. Phase 7: Testing Strategy

### Unit Tests

```python
# tests/providers/test_factory.py

import pytest
import os
from unittest.mock import patch

from src.providers.factory import ProviderFactory
from src.providers.types import ProviderType
from src.providers.openai.factory import OpenAIAgentFactory
from src.providers.anthropic.factory import AnthropicAgentFactory


class TestProviderFactory:

    def test_default_provider_is_openai(self):
        with patch.dict(os.environ, {}, clear=True):
            provider = ProviderFactory.get_provider()
            assert provider == ProviderType.OPENAI

    def test_anthropic_provider_from_env(self):
        with patch.dict(os.environ, {"AI_PROVIDER": "anthropic"}):
            provider = ProviderFactory.get_provider()
            assert provider == ProviderType.ANTHROPIC

    def test_invalid_provider_raises_error(self):
        with patch.dict(os.environ, {"AI_PROVIDER": "invalid"}):
            with pytest.raises(ValueError):
                ProviderFactory.get_provider()

    def test_create_openai_factory(self):
        factory = ProviderFactory.create_factory(ProviderType.OPENAI)
        assert isinstance(factory, OpenAIAgentFactory)

    def test_create_anthropic_factory(self):
        factory = ProviderFactory.create_factory(ProviderType.ANTHROPIC)
        assert isinstance(factory, AnthropicAgentFactory)
```

### Integration Tests

```python
# tests/integration/test_providers.py

import pytest
from unittest.mock import AsyncMock, MagicMock

from src.providers.base import AgentDefinition, AgentType, ModelConfig
from src.providers.openai.factory import OpenAIAgentFactory
from src.providers.anthropic.factory import AnthropicAgentFactory


@pytest.fixture
def sample_definition():
    return AgentDefinition(
        agent_type=AgentType.GREETER,
        name="test_greeter",
        description="Test agent",
        system_prompt="You are a test agent.",
        model_config=ModelConfig(
            tier="fast",
            openai_model="gpt-4o-mini",
            anthropic_model="claude-3-5-haiku-20241022",
            max_tokens=100,
        ),
        tools=["send_text_message"],
        handoffs=[],
    )


@pytest.fixture
def sample_context():
    return {
        "creator_id": "test-creator",
        "creator": {"name": "Test Creator", "niche": "test"},
        "products": [],
    }


class TestOpenAIFactory:

    def test_create_agent(self, sample_definition, sample_context):
        factory = OpenAIAgentFactory()
        agent = factory.create_agent(sample_definition, sample_context)

        assert agent.name == "test_greeter"
        assert agent.agent_type == AgentType.GREETER


class TestAnthropicFactory:

    def test_create_agent(self, sample_definition, sample_context):
        factory = AnthropicAgentFactory()
        agent = factory.create_agent(sample_definition, sample_context)

        assert agent.name == "test_greeter"
        assert agent.agent_type == AgentType.GREETER
```

---

## 10. Migration Checklist

### Pre-Migration

- [ ] Create `src/providers/` directory structure
- [ ] Add `anthropic` to `requirements.txt`
- [ ] Add `AI_PROVIDER` and `ANTHROPIC_API_KEY` to `.env.example`
- [ ] Create abstract base classes (`providers/base.py`)
- [ ] Create type definitions (`providers/types.py`)

### Tool Migration

- [ ] Create provider-agnostic tool definitions (`providers/tools/definitions.py`)
- [ ] Move tool implementations from `function_tools.py` to `providers/tools/implementations.py`
- [ ] Create tool registry (`providers/tools/base.py`)
- [ ] Create OpenAI tool converter
- [ ] Create Anthropic tool converter

### OpenAI Migration

- [ ] Create `providers/openai/factory.py`
- [ ] Create `providers/openai/runner.py`
- [ ] Create `providers/openai/session.py`
- [ ] Create `providers/openai/tools.py`
- [ ] Test OpenAI implementation matches existing behavior

### Anthropic Implementation

- [ ] Create `providers/anthropic/factory.py`
- [ ] Create `providers/anthropic/runner.py` with agentic loop
- [ ] Create `providers/anthropic/session.py`
- [ ] Create `providers/anthropic/tools.py`
- [ ] Test Anthropic implementation

### Integration

- [ ] Create `providers/factory.py`
- [ ] Create `agents/definitions.py` with all agent definitions
- [ ] Create `agents/prompts.py` with all system prompts
- [ ] Update `runtime/creator_runtime.py` to use provider factory
- [ ] Update `main.py` to use new runtime

### Testing

- [ ] Write unit tests for all new classes
- [ ] Write integration tests for both providers
- [ ] Test handoff scenarios
- [ ] Test tool execution
- [ ] Load test both providers

### Cleanup

- [ ] Deprecate `agents/openai_factory.py`
- [ ] Remove hardcoded model references from `main.py`
- [ ] Update documentation
- [ ] Update deployment scripts with new env vars

---

## 11. Environment Variables

### New Variables

```bash
# .env

# AI Provider selection (openai or anthropic)
AI_PROVIDER=openai

# OpenAI configuration
OPENAI_API_KEY=sk-...

# Anthropic configuration (required if AI_PROVIDER=anthropic)
ANTHROPIC_API_KEY=sk-ant-...

# Optional: Model overrides
OPENAI_FAST_MODEL=gpt-4o-mini
OPENAI_COMPLEX_MODEL=gpt-4o
ANTHROPIC_FAST_MODEL=claude-3-5-haiku-20241022
ANTHROPIC_COMPLEX_MODEL=claude-3-5-sonnet-20241022
```

---

## 12. Estimated Timeline

| Phase | Tasks | Duration | Dependencies |
|-------|-------|----------|--------------|
| **Phase 1** | Abstract base classes | 2-3 days | None |
| **Phase 2** | Tool abstraction | 3-4 days | Phase 1 |
| **Phase 3** | OpenAI implementation | 3-4 days | Phase 1, 2 |
| **Phase 4** | Anthropic implementation | 5-7 days | Phase 1, 2 |
| **Phase 5** | Provider factory | 1-2 days | Phase 3, 4 |
| **Phase 6** | Runtime integration | 2-3 days | Phase 5 |
| **Phase 7** | Testing | 5-7 days | Phase 6 |
| **Cleanup** | Documentation, deprecation | 2-3 days | Phase 7 |

**Total: 23-33 days (~4-6 weeks)**

---

## Notes

1. **Backward Compatibility**: The existing `openai_factory.py` should continue to work during migration. Only deprecate after new system is stable.

2. **Feature Parity**: Anthropic implementation may not have 100% feature parity initially. Document differences.

3. **Performance Monitoring**: Add metrics to compare provider performance (latency, success rate, cost).

4. **Gradual Rollout**: Consider A/B testing with percentage-based provider selection before full switch.

5. **Fallback Strategy**: Implement automatic fallback to secondary provider if primary fails.
