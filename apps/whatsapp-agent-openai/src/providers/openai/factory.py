"""
OpenAI provider implementation using OpenAI Agents SDK.

Uses direct @function_tool functions from function_tools.py (SDK-native tools)
instead of the ToolConverter, and attaches SDK guardrails to agents.
"""

from typing import Dict, List, Any, Optional
import logging

from agents import Agent, ModelSettings  # type: ignore

from ..base import (
    BaseAgent, BaseAgentFactory, BaseRunner,
    AgentDefinition, AgentType, ModelConfig
)
from .runner import OpenAIRunner
from .session import OpenAISessionManager

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
    """Factory for creating OpenAI agents using direct SDK tools and guardrails."""

    def __init__(self):
        self.session_manager = OpenAISessionManager()
        self._runner: Optional[OpenAIRunner] = None

    def create_agent(
        self,
        definition: AgentDefinition,
        context: Dict[str, Any]
    ) -> OpenAIAgent:
        """Create an OpenAI agent from definition."""

        # Use direct @function_tool functions from function_tools.py
        # These are SDK-native tools with RunContextWrapper support
        from src.agents.function_tools import get_tools_for_agent
        sdk_tools = get_tools_for_agent(definition.name)

        # Create model settings
        model_settings = ModelSettings(
            max_tokens=definition.model_config.max_tokens,
            temperature=definition.model_config.temperature,
        )

        if definition.model_config.tool_choice == "required":
            model_settings.tool_choice = "required"

        # Build system prompt with context
        system_prompt = self._build_prompt(definition, context)

        # Load SDK guardrails
        from src.agents.guardrails import injection_guard, output_sanitizer

        # Create SDK agent with guardrails
        sdk_agent = Agent(
            name=definition.name,
            handoff_description=definition.description,
            instructions=system_prompt,
            model=definition.model_config.openai_model,
            model_settings=model_settings,
            tools=sdk_tools,
            input_guardrails=[injection_guard],
            output_guardrails=[output_sanitizer],
        )

        logger.debug(f"Created OpenAI agent: {definition.name} with {len(sdk_tools)} tools, guardrails attached")

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

        logger.info(f"Created {len(agents)} OpenAI agents with SDK guardrails")
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

        # Inject clinic context (Gendei)
        if "clinic" in context:
            clinic = context["clinic"]
            prompt = prompt.replace("{clinic_name}", str(clinic.get("name", "Clínica")))
            prompt = prompt.replace("{clinic_context}", self._format_clinic_context(clinic))

        # Inject vertical terminology
        if "vertical" in context:
            v = context["vertical"]
            appointment_term = v.get("appointment_term", "consulta")
            appointment_plural = v.get("appointment_plural", "consultas")
            prompt = prompt.replace("{appointment_term}", appointment_term)
            prompt = prompt.replace("{appointment_plural}", appointment_plural)
            prompt = prompt.replace("{appointment_term_upper}", appointment_term.upper())
            prompt = prompt.replace("{appointment_plural_upper}", appointment_plural.upper())
            prompt = prompt.replace("{client_term}", v.get("client_term", "paciente"))
            prompt = prompt.replace("{professional_term}", v.get("professional_term", "médico(a)"))
            prompt = prompt.replace("{professional_emoji}", v.get("professional_emoji", ""))
            prompt = prompt.replace("{convenio_instruction}", v.get("convenio_instruction", ""))
            prompt = prompt.replace("{no_emoji_reason}", "ambiente profissional")

        # Inject professionals context
        if "professionals" in context:
            prof_str = self._format_professionals(context["professionals"])
            prompt = prompt.replace("{professionals}", prof_str)

        # Inject services context
        if "services" in context:
            services_str = self._format_services(context["services"])
            prompt = prompt.replace("{services}", services_str)

        return prompt

    def _format_clinic_context(self, clinic: Dict) -> str:
        """Format clinic info for prompt injection."""
        lines = []

        if clinic.get("name"):
            lines.append(f"Nome: {clinic['name']}")

        if clinic.get("address"):
            lines.append(f"Endereço: {clinic['address']}")

        if clinic.get("opening_hours"):
            lines.append(f"Horário: {clinic['opening_hours']}")

        if clinic.get("phone"):
            lines.append(f"Telefone: {clinic['phone']}")

        greeting_summary = clinic.get("greeting_summary")
        if not greeting_summary:
            description = (clinic.get("description") or "").strip()
            if description:
                summary = description.split(".")[0].strip()
                if not summary:
                    summary = description[:180].strip()
                if summary:
                    greeting_summary = summary
        if greeting_summary:
            lines.append(f"Resumo saudação: {greeting_summary}")

        # Payment settings
        payment = clinic.get("payment_settings", {})
        if payment.get("acceptsParticular"):
            lines.append("Aceita: Particular")
        if payment.get("convenios"):
            lines.append(f"Convênios: {', '.join(payment['convenios'])}")

        return "\n".join(lines) if lines else "Informações não disponíveis."

    def _format_professionals(self, professionals: List[Dict]) -> str:
        """Format professionals for prompt injection."""
        if not professionals:
            return "Nenhum profissional cadastrado."

        lines = []
        for p in professionals:
            name = p.get('full_name') or p.get('name', 'Profissional')
            specialty = p.get('specialty', '')
            line = f"- {name}"
            if specialty:
                line += f" ({specialty})"
            lines.append(line)
        return "\n".join(lines)

    def _format_services(self, services: List[Dict]) -> str:
        """Format services for prompt injection."""
        if not services:
            return "Nenhum serviço cadastrado."

        lines = []
        for s in services:
            name = getattr(s, "name", None) or s.get('name', 'Serviço')
            duration = getattr(s, "duration_minutes", None)
            if duration is None:
                duration = s.get('duration', 30)
            price_cents = getattr(s, "price_cents", None)
            if price_cents is None:
                price = s.get('price', 0)
            else:
                price = price_cents / 100
            line = f"- {name} ({duration} min)"
            if price and price > 0:
                line += f" - R$ {price:.2f}".replace('.', ',')
            lines.append(line)
        return "\n".join(lines)

    def get_runner(self) -> BaseRunner:
        """Get the OpenAI runner."""
        if self._runner is None:
            self._runner = OpenAIRunner(self.session_manager)
        return self._runner
