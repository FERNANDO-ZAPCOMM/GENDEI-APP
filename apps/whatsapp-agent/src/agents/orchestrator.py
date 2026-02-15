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
from src.runtime.context import Runtime
from src.vertical_config import get_vertical_config, get_specialty_name

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
        vertical_slug = "geral"

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
                    "greeting_summary": getattr(clinic, 'greeting_summary', ''),
                    "description": getattr(clinic, 'description', ''),
                    "workflow_mode": getattr(clinic, 'workflow_mode', 'booking'),
                    "workflow_welcome_message": getattr(clinic, 'workflow_welcome_message', ''),
                    "workflow_cta": getattr(clinic, 'workflow_cta', ''),
                    "workflow_faqs": getattr(clinic, 'workflow_faqs', []) or [],
                }

                # Load vertical config
                vertical_slug = getattr(clinic, 'vertical', None) or 'geral'
                vc = get_vertical_config(vertical_slug)
                term = vc.terminology
                context["vertical"] = {
                    "slug": vc.slug,
                    "appointment_term": term.appointment_term,
                    "appointment_plural": term.appointment_term_plural,
                    "client_term": term.client_term,
                    "professional_term": term.professional_term,
                    "professional_emoji": term.professional_emoji,
                    "service_emoji": term.service_emoji,
                }
                # Build convenio instruction based on vertical features
                if vc.features.has_convenio:
                    convenio_text = "- Convênio do {client_term} (se aplicável)".format(
                        client_term=term.client_term
                    )
                    if vc.features.ask_convenio_number:
                        convenio_text += "\n- Número da carteirinha do convênio"
                    context["vertical"]["convenio_instruction"] = convenio_text
                else:
                    context["vertical"]["convenio_instruction"] = ""

            # Load professionals
            professionals = self.db.get_clinic_professionals(self.clinic_id)
            if professionals:
                def _specialty_display(prof: Any) -> str:
                    raw_specialties = getattr(prof, 'specialties', []) or []
                    if not raw_specialties:
                        legacy = getattr(prof, 'specialty', '') or ''
                        raw_specialties = [legacy] if legacy else []
                    display = [get_specialty_name(vertical_slug, s) for s in raw_specialties if s]
                    return ", ".join(dict.fromkeys(display))

                context["professionals"] = [
                    {
                        "id": p.id,
                        "name": p.name,
                        "full_name": getattr(p, 'full_name', p.name),
                        "specialty": _specialty_display(p),
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

        # Scheduling intent (check BEFORE info)
        scheduling_keywords = [
            "agendar", "marcar", "horários", "horarios",
            "disponibilidade", "agenda", "quero agendar",
            "sessão", "sessao", "procedimento",
        ]
        if any(kw in msg_lower for kw in scheduling_keywords):
            return AgentType.SALES_CLOSER  # scheduling

        # Clinic info questions
        info_keywords = [
            "onde fica", "endereço", "endereco", "localização", "localizacao",
            "horário de funcionamento", "que horas", "funcionamento",
            "quem atende", "médico", "medico", "profissional",
            "convênio", "convenio", "aceita", "pagamento",
            "valor", "preço", "preco", "duração", "duracao", "quanto tempo",
            "minutos", "serviço", "servico",
        ]
        if any(kw in msg_lower for kw in info_keywords):
            return AgentType.PRODUCT_INFO  # clinic_info

        # Appointment management
        appointment_keywords = [
            "minha consulta", "minhas consultas", "meu agendamento",
            "minha sessão", "minha sessao", "minhas sessões", "minhas sessoes",
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
        contact_name: Optional[str] = None,
        runtime: Optional[Runtime] = None
    ) -> ExecutionResult:
        """
        Process an incoming message and get an AI response.

        Args:
            phone: Patient phone number
            message: The message text
            contact_name: Optional patient name
            runtime: Optional Runtime context for SDK RunContextWrapper injection

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

            logger.info(f"Routing to {agent.name} for message: {message[:50]}...")

            # Build context
            context = {
                "phone": phone,
                "patient_name": contact_name,
                "clinic_id": self.clinic_id,
            }

            # Create session ID
            session_id = f"{self.clinic_id}:{phone}"

            # Run the agent with Runtime context for SDK RunContextWrapper
            result = await self.runner.run(
                agent, message, session_id, context,
                runtime=runtime
            )

            logger.info(f"Agent {agent.name} responded: {result.success}")

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
