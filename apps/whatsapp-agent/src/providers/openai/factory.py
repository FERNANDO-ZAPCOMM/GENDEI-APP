"""
OpenAI provider implementation using OpenAI Agents SDK.
"""

from typing import Dict, List, Any, Optional
import logging

from agents import Agent, ModelSettings  # type: ignore

from ..base import (
    BaseAgent, BaseAgentFactory, BaseRunner,
    AgentDefinition, AgentType, ModelConfig
)
from ..tools.base import get_tool_registry
from .runner import OpenAIRunner
from .session import OpenAISessionManager
from .tools import OpenAIToolConverter

logger = logging.getLogger(__name__)


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

    def set_handoffs(self, handoff_agents: List["OpenAIAgent"]) -> None:
        """Set the handoff agents for this agent."""
        self.sdk_agent.handoffs = [a.sdk_agent for a in handoff_agents]


class OpenAIAgentFactory(BaseAgentFactory):
    """Factory for creating OpenAI agents."""

    def __init__(self):
        self.tool_registry = get_tool_registry()
        self.tool_converter = OpenAIToolConverter()
        self.session_manager = OpenAISessionManager()
        self._runner: Optional[OpenAIRunner] = None

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

        logger.debug(f"Created OpenAI agent: {definition.name} with {len(sdk_tools)} tools")

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
        agents: Dict[AgentType, OpenAIAgent] = {}

        # First pass: create all agents
        for definition in definitions:
            agents[definition.agent_type] = self.create_agent(definition, context)

        # Second pass: set up handoffs after all agents are created
        self._setup_handoffs(agents, definitions)

        logger.info(f"Created {len(agents)} OpenAI agents")
        return agents

    def _setup_handoffs(
        self,
        agents: Dict[AgentType, OpenAIAgent],
        definitions: List[AgentDefinition]
    ) -> None:
        """Configure agent handoffs."""
        for definition in definitions:
            agent = agents.get(definition.agent_type)
            if not agent:
                continue

            handoff_agents = []
            for h in definition.handoffs:
                if h in agents:
                    handoff_agents.append(agents[h])
                else:
                    logger.warning(f"Handoff target {h.value} not found for agent {definition.name}")

            if handoff_agents:
                agent.set_handoffs(handoff_agents)
                logger.debug(f"Set {len(handoff_agents)} handoffs for {definition.name}")

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
            prompt = prompt.replace("{creator_name}", str(creator.get("name", "")))
            prompt = prompt.replace("{creator_niche}", str(creator.get("niche", "")))
            prompt = prompt.replace("{tone}", str(creator.get("tone", "friendly")))
            prompt = prompt.replace("{voice_style}", str(creator.get("voiceStyle", "friendly_coach")))

        # Inject product context
        if "products" in context:
            products_str = self._format_products(context["products"])
            prompt = prompt.replace("{products}", products_str)
            prompt = prompt.replace("{product_count}", str(len(context["products"])))

        # Inject free products context
        if "free_products" in context:
            free_str = self._format_products(context["free_products"])
            prompt = prompt.replace("{free_products}", free_str)

        # Inject paid products context
        if "paid_products" in context:
            paid_str = self._format_products(context["paid_products"])
            prompt = prompt.replace("{paid_products}", paid_str)

        return prompt

    def _format_products(self, products: List[Dict]) -> str:
        """Format products for prompt injection."""
        if not products:
            return "No products available."

        lines = []
        for p in products:
            title = p.get('title', 'Produto')
            price = p.get('price', {})
            if isinstance(price, dict):
                formatted = price.get('formatted', 'N/A')
            else:
                formatted = f"R$ {float(price):.2f}" if price else 'Grátis'
            lines.append(f"- {title}: {formatted}")
        return "\n".join(lines)

    def get_runner(self) -> BaseRunner:
        """Get the OpenAI runner."""
        if self._runner is None:
            self._runner = OpenAIRunner(self.session_manager)
        return self._runner
