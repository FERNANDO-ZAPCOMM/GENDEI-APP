"""
Gendei Agent Orchestrator
Routes incoming WhatsApp messages to the appropriate AI agent.
"""

import logging
from typing import Dict, Any, Optional, List

from src.providers.base import AgentType, ExecutionResult
from src.providers.openai.factory import OpenAIAgentFactory, OpenAIAgent
from src.agents.definitions import get_all_agent_definitions
from src.agents.function_tools import get_tools_for_agent

logger = logging.getLogger(__name__)


class AgentOrchestrator:
    """
    Orchestrates AI agents for clinic message handling.
    Creates and manages agents, routes messages to appropriate agents.
    """

    def __init__(self, clinic_id: str, db: Any):
        """
        Initialize the orchestrator.

        Args:
            clinic_id: The clinic ID to load context for
            db: Database instance for loading clinic data
        """
        self.clinic_id = clinic_id
        self.db = db
        self.factory = OpenAIAgentFactory()
        self.runner = self.factory.get_runner()
        self._agents: Optional[Dict[AgentType, OpenAIAgent]] = None
        self._clinic_context: Optional[Dict[str, Any]] = None

    def _load_clinic_context(self) -> Dict[str, Any]:
        """Load clinic context for agent prompts."""
        if self._clinic_context:
            return self._clinic_context

        context: Dict[str, Any] = {}

        try:
            # Load clinic info
            clinic = self.db.get_clinic(self.clinic_id)
            if clinic:
                context["clinic"] = {
                    "name": clinic.name,
                    "address": getattr(clinic, 'address', ''),
                    "phone": getattr(clinic, 'phone', ''),
                    "opening_hours": getattr(clinic, 'opening_hours', ''),
                    "payment_settings": getattr(clinic, 'payment_settings', {}),
                }

            # Load professionals
            professionals = self.db.get_clinic_professionals(self.clinic_id)
            if professionals:
                context["professionals"] = [
                    {
                        "id": p.id,
                        "name": p.name,
                        "full_name": getattr(p, 'full_name', p.name),
                        "specialty": getattr(p, 'specialty', ''),
                    }
                    for p in professionals
                ]

            # Load services
            services = self.db.get_clinic_services(self.clinic_id)
            if services:
                context["services"] = services

        except Exception as e:
            logger.error(f"Error loading clinic context: {e}")
            context["clinic"] = {"name": "Clínica"}

        self._clinic_context = context
        return context

    def _get_agents(self) -> Dict[AgentType, OpenAIAgent]:
        """Get or create agents for this clinic."""
        if self._agents:
            return self._agents

        # Load context and create agents
        context = self._load_clinic_context()
        definitions = get_all_agent_definitions()

        self._agents = self.factory.create_all_agents(definitions, context)
        logger.info(f"Created {len(self._agents)} agents for clinic {self.clinic_id}")

        return self._agents

    def _select_starting_agent(self, message: str) -> AgentType:
        """
        Select the starting agent based on message content.
        Uses deterministic routing for common patterns.
        """
        msg_lower = message.lower().strip()

        # Pure greetings -> greeter
        greetings = ["oi", "olá", "ola", "bom dia", "boa tarde", "boa noite", "eae", "opa"]
        if msg_lower in greetings or (len(msg_lower) < 10 and any(g in msg_lower for g in greetings)):
            return AgentType.GREETER

        # Clinic info questions
        info_keywords = [
            "onde fica", "endereço", "endereco", "localização", "localizacao",
            "horário", "horario", "que horas", "funcionamento",
            "quem atende", "médico", "medico", "profissional",
            "convênio", "convenio", "aceita", "pagamento",
        ]
        if any(kw in msg_lower for kw in info_keywords):
            return AgentType.PRODUCT_INFO  # clinic_info

        # Scheduling intent
        scheduling_keywords = [
            "agendar", "marcar", "consulta", "horários", "horarios",
            "disponibilidade", "agenda", "atendimento", "quero agendar",
        ]
        if any(kw in msg_lower for kw in scheduling_keywords):
            return AgentType.SALES_CLOSER  # scheduling

        # Appointment management
        appointment_keywords = [
            "minha consulta", "minhas consultas", "meu agendamento",
            "cancelar", "desmarcar", "remarcar", "reagendar",
        ]
        if any(kw in msg_lower for kw in appointment_keywords):
            return AgentType.PAYMENT  # appointment_manager

        # Support/help
        support_keywords = [
            "ajuda", "problema", "atendente", "humano", "reclamação", "reclamacao",
        ]
        if any(kw in msg_lower for kw in support_keywords):
            return AgentType.SUPPORT

        # Default to triage for complex messages
        return AgentType.TRIAGE

    async def process_message(
        self,
        phone: str,
        message: str,
        contact_name: Optional[str] = None
    ) -> ExecutionResult:
        """
        Process an incoming message and get an AI response.

        Args:
            phone: Patient phone number
            message: The message text
            contact_name: Optional patient name

        Returns:
            ExecutionResult with the agent's response
        """
        try:
            agents = self._get_agents()

            # Select starting agent
            agent_type = self._select_starting_agent(message)
            agent = agents.get(agent_type)

            if not agent:
                logger.error(f"Agent {agent_type} not found")
                return ExecutionResult(
                    success=False,
                    error=f"Agent {agent_type} not available"
                )

            logger.info(f"🤖 Routing to {agent.name} for message: {message[:50]}...")

            # Build context
            context = {
                "phone": phone,
                "patient_name": contact_name,
                "clinic_id": self.clinic_id,
            }

            # Create session ID
            session_id = f"{self.clinic_id}:{phone}"

            # Run the agent
            result = await self.runner.run(agent, message, session_id, context)

            logger.info(f"✅ Agent {agent.name} responded: {result.success}")

            return result

        except Exception as e:
            logger.error(f"Error processing message: {e}")
            return ExecutionResult(
                success=False,
                error=str(e)
            )


# Global orchestrator cache per clinic
_orchestrators: Dict[str, AgentOrchestrator] = {}


def get_orchestrator(clinic_id: str, db: Any) -> AgentOrchestrator:
    """Get or create an orchestrator for a clinic."""
    if clinic_id not in _orchestrators:
        _orchestrators[clinic_id] = AgentOrchestrator(clinic_id, db)
    return _orchestrators[clinic_id]
