"""
Gendei Agent Definitions - Clinic Scheduling Agents
Provider-agnostic agent definitions for healthcare/clinic use case.
"""

from typing import List

from src.providers.base import AgentDefinition, AgentType, ModelConfig
from .prompts import AGENT_PROMPTS


# Model configurations
FAST_MODEL = ModelConfig(
    tier="fast",
    openai_model="gpt-4o-mini",
    max_tokens=200,
    temperature=0.7,
    tool_choice="required",
)

COMPLEX_MODEL = ModelConfig(
    tier="complex",
    openai_model="gpt-4o",
    max_tokens=300,
    temperature=0.7,
    tool_choice="required",
)

ROUTER_MODEL = ModelConfig(
    tier="fast",
    openai_model="gpt-4o-mini",
    max_tokens=50,
    temperature=0.1,
    tool_choice="required",
)


# Gendei Agent Definitions for Clinic Scheduling
AGENT_DEFINITIONS: List[AgentDefinition] = [
    # Greeter Agent - First contact, welcomes patients
    AgentDefinition(
        agent_type=AgentType.GREETER,
        name="greeter_agent",
        description="First-contact agent: welcomes patients and identifies their intent",
        system_prompt=AGENT_PROMPTS["greeter"],
        model_config=FAST_MODEL,
        tools=[
            "send_text_message",
        ],
        handoffs=[AgentType.PRODUCT_INFO, AgentType.SALES_CLOSER, AgentType.SUPPORT],
    ),

    # Clinic Info Agent - Answers questions about the clinic
    AgentDefinition(
        agent_type=AgentType.PRODUCT_INFO,  # Reusing type for clinic info
        name="clinic_info_agent",
        description="Answers questions about clinic location, hours, services, professionals",
        system_prompt=AGENT_PROMPTS["clinic_info"],
        model_config=COMPLEX_MODEL,
        tools=[
            "send_text_message",
            "get_clinic_info",
            "get_professionals",
            "get_services",
        ],
        handoffs=[AgentType.SALES_CLOSER, AgentType.SUPPORT],
    ),

    # Scheduling Agent - Handles appointment booking
    AgentDefinition(
        agent_type=AgentType.SALES_CLOSER,  # Reusing type for scheduling
        name="scheduling_agent",
        description="Handles appointment booking flow - collects info and creates appointments",
        system_prompt=AGENT_PROMPTS["scheduling"],
        model_config=COMPLEX_MODEL,
        tools=[
            "send_text_message",
            "get_available_slots",
            "get_professionals",
            "get_services",
            "create_appointment",
            "send_appointment_confirmation",
        ],
        handoffs=[AgentType.PAYMENT, AgentType.SUPPORT],
    ),

    # Appointment Manager Agent - View/cancel/reschedule
    AgentDefinition(
        agent_type=AgentType.PAYMENT,  # Reusing type for appointment management
        name="appointment_manager_agent",
        description="Manages existing appointments - view, cancel, reschedule",
        system_prompt=AGENT_PROMPTS["appointment_manager"],
        model_config=FAST_MODEL,
        tools=[
            "send_text_message",
            "get_patient_appointments",
            "cancel_appointment",
            "reschedule_appointment",
        ],
        handoffs=[AgentType.SALES_CLOSER, AgentType.SUPPORT],
    ),

    # Support Agent - Human escalation
    AgentDefinition(
        agent_type=AgentType.SUPPORT,
        name="support_agent",
        description="Handles help requests, complaints, and escalation to human support",
        system_prompt=AGENT_PROMPTS["support"],
        model_config=FAST_MODEL,
        tools=[
            "send_text_message",
            "enable_human_takeover",
        ],
        handoffs=[],  # Support is the final escalation point
    ),

    # Triage Agent - Intelligent router
    AgentDefinition(
        agent_type=AgentType.TRIAGE,
        name="triage_agent",
        description="Routes messages to the appropriate specialized agent",
        system_prompt=AGENT_PROMPTS["triage"],
        model_config=ROUTER_MODEL,
        tools=["send_text_message"],
        handoffs=[
            AgentType.GREETER,
            AgentType.PRODUCT_INFO,  # clinic_info
            AgentType.SALES_CLOSER,  # scheduling
            AgentType.PAYMENT,  # appointment_manager
            AgentType.SUPPORT,
        ],
    ),
]


def get_all_agent_definitions() -> List[AgentDefinition]:
    """Get all agent definitions."""
    return AGENT_DEFINITIONS


def get_agent_definition(agent_type: AgentType) -> AgentDefinition:
    """Get a specific agent definition by type."""
    for definition in AGENT_DEFINITIONS:
        if definition.agent_type == agent_type:
            return definition
    raise ValueError(f"No definition for agent type: {agent_type}")


def get_agent_definition_by_name(name: str) -> AgentDefinition:
    """Get a specific agent definition by name."""
    for definition in AGENT_DEFINITIONS:
        if definition.name == name:
            return definition
    raise ValueError(f"No definition for agent name: {name}")
