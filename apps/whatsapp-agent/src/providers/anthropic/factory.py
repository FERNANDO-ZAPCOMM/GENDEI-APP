"""
Anthropic provider implementation using Claude API.
"""

from typing import Dict, List, Any, Optional
import logging
import os

import anthropic

from ..base import (
    BaseAgent, BaseAgentFactory, BaseRunner,
    AgentDefinition, AgentType, ModelConfig
)
from ..tools.base import get_tool_registry
from .runner import AnthropicRunner
from .session import AnthropicSessionManager
from .tools import AnthropicToolConverter

logger = logging.getLogger(__name__)


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
        # Store system_prompt in context for runner access
        self.context["system_prompt"] = system_prompt


class AnthropicAgentFactory(BaseAgentFactory):
    """Factory for creating Anthropic agents."""

    def __init__(self):
        self.tool_registry = get_tool_registry()
        self.tool_converter = AnthropicToolConverter()
        self.session_manager = AnthropicSessionManager()
        self._client = anthropic.Anthropic(
            api_key=os.getenv("ANTHROPIC_API_KEY")
        )
        self._runner: Optional[AnthropicRunner] = None

    def create_agent(
        self,
        definition: AgentDefinition,
        context: Dict[str, Any]
    ) -> AnthropicAgent:
        """Create an Anthropic agent from definition."""

        # Get and convert tools
        tool_defs = self.tool_registry.get_tools(definition.tools)
        anthropic_tools = self.tool_converter.convert_all(tool_defs, context)

        # Build system prompt with context and handoff instructions
        system_prompt = self._build_prompt(definition, context)

        logger.debug(f"Created Anthropic agent: {definition.name} with {len(anthropic_tools)} tools")

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
        agents: Dict[AgentType, AnthropicAgent] = {}

        for definition in definitions:
            agents[definition.agent_type] = self.create_agent(definition, context)

        logger.info(f"Created {len(agents)} Anthropic agents")
        return agents

    def _build_prompt(
        self,
        definition: AgentDefinition,
        context: Dict[str, Any]
    ) -> str:
        """Build system prompt with context injection and handoff instructions."""
        prompt = definition.system_prompt

        # Add handoff instructions for Anthropic
        # Since Anthropic doesn't have native handoffs, we use a text-based protocol
        if definition.handoffs:
            handoff_names = [h.value for h in definition.handoffs]
            prompt += f"\n\n## HANDOFF INSTRUCTIONS\n"
            prompt += f"You can request a handoff to these specialists: {', '.join(handoff_names)}.\n"
            prompt += "To request a handoff, include this exact format in your response:\n"
            prompt += "[HANDOFF:agent_name] reason for handoff\n"
            prompt += "\nExample: [HANDOFF:support] Customer is requesting to speak with a human.\n"
            prompt += "\nOnly use handoff when the conversation clearly requires a different specialist."

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
        """Format products for prompt injection, INCLUDING product type."""
        if not products:
            return "No products available."

        lines = []
        types_available = set()

        for p in products:
            title = p.get('title', 'Produto')
            product_type = p.get('type', 'ebook')  # Include product type
            types_available.add(product_type)
            product_id = p.get('productId', p.get('id', 'unknown'))
            price = p.get('price', {})
            if isinstance(price, dict):
                formatted = price.get('formatted', 'N/A')
            else:
                formatted = f"R$ {float(price):.2f}" if price else 'Grátis'
            lines.append(f"- {title} [TIPO: {product_type}] [ID: {product_id}]: {formatted}")

        # Add summary of available types at the top
        types_summary = f"TIPOS DE PRODUTO DISPONÍVEIS: {', '.join(sorted(types_available))}"
        return types_summary + "\n\nProdutos:\n" + "\n".join(lines)

    def get_runner(self) -> BaseRunner:
        """Get the Anthropic runner."""
        if self._runner is None:
            self._runner = AnthropicRunner(self._client, self.session_manager)
        return self._runner
