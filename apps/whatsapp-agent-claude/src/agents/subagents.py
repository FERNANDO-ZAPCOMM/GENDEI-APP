"""
Gendei Subagent Definitions - Claude Agent SDK
Specialized subagents for different aspects of clinic operations.
"""

from typing import Dict, Any
from claude_agent_sdk import AgentDefinition

from .prompts import get_prompt
from .tools import ALL_TOOL_NAMES


# Tool subsets for different agents
MESSAGING_TOOLS = [
    "mcp__gendei-clinic-tools__send_text_message",
]

CLINIC_INFO_TOOLS = [
    "mcp__gendei-clinic-tools__send_text_message",
    "mcp__gendei-clinic-tools__get_clinic_info",
    "mcp__gendei-clinic-tools__get_professionals",
    "mcp__gendei-clinic-tools__get_services",
]

SCHEDULING_TOOLS = [
    "mcp__gendei-clinic-tools__send_text_message",
    "mcp__gendei-clinic-tools__get_services",
    "mcp__gendei-clinic-tools__get_professionals",
    "mcp__gendei-clinic-tools__get_available_slots",
    "mcp__gendei-clinic-tools__create_appointment",
    "mcp__gendei-clinic-tools__send_appointment_confirmation",
]

APPOINTMENT_MANAGER_TOOLS = [
    "mcp__gendei-clinic-tools__send_text_message",
    "mcp__gendei-clinic-tools__get_patient_appointments",
    "mcp__gendei-clinic-tools__cancel_appointment",
    "mcp__gendei-clinic-tools__reschedule_appointment",
    "mcp__gendei-clinic-tools__get_available_slots",
]

SUPPORT_TOOLS = [
    "mcp__gendei-clinic-tools__send_text_message",
    "mcp__gendei-clinic-tools__enable_human_takeover",
]


def create_clinic_info_agent(clinic_name: str, clinic_context: str) -> AgentDefinition:
    """
    Create a clinic information subagent.

    Args:
        clinic_name: Name of the clinic
        clinic_context: Context string with clinic information

    Returns:
        AgentDefinition for the clinic info agent
    """
    return AgentDefinition(
        description="Specialist for clinic information queries - location, hours, professionals, services, payment methods.",
        prompt=get_prompt("clinic_info", clinic_name, clinic_context),
        tools=CLINIC_INFO_TOOLS,
        model="haiku"  # Fast model for simple info queries
    )


def create_scheduling_agent(clinic_name: str, clinic_context: str) -> AgentDefinition:
    """
    Create an appointment scheduling subagent.

    Args:
        clinic_name: Name of the clinic
        clinic_context: Context string with clinic information

    Returns:
        AgentDefinition for the scheduling agent
    """
    return AgentDefinition(
        description="Appointment booking specialist - helps patients schedule new appointments with professionals.",
        prompt=get_prompt("scheduling", clinic_name, clinic_context),
        tools=SCHEDULING_TOOLS,
        model="sonnet"  # More capable model for complex scheduling
    )


def create_appointment_manager_agent(clinic_name: str, clinic_context: str) -> AgentDefinition:
    """
    Create an appointment management subagent.

    Args:
        clinic_name: Name of the clinic
        clinic_context: Context string with clinic information

    Returns:
        AgentDefinition for the appointment manager agent
    """
    return AgentDefinition(
        description="Appointment management specialist - view, cancel, or reschedule existing appointments.",
        prompt=get_prompt("appointment_manager", clinic_name, clinic_context),
        tools=APPOINTMENT_MANAGER_TOOLS,
        model="haiku"  # Fast model for appointment lookups
    )


def create_support_agent(clinic_name: str, clinic_context: str) -> AgentDefinition:
    """
    Create a support subagent for human escalation.

    Args:
        clinic_name: Name of the clinic
        clinic_context: Context string with clinic information

    Returns:
        AgentDefinition for the support agent
    """
    return AgentDefinition(
        description="Support specialist - handles complaints, billing issues, and escalation to human agents.",
        prompt=get_prompt("support", clinic_name, clinic_context),
        tools=SUPPORT_TOOLS,
        model="haiku"  # Fast model for support routing
    )


def get_agent_definitions(clinic_name: str, clinic_context: str) -> Dict[str, AgentDefinition]:
    """
    Get all agent definitions for a clinic.

    Args:
        clinic_name: Name of the clinic
        clinic_context: Context string with clinic information

    Returns:
        Dictionary of agent name to AgentDefinition
    """
    return {
        "clinic-info": create_clinic_info_agent(clinic_name, clinic_context),
        "scheduling": create_scheduling_agent(clinic_name, clinic_context),
        "appointment-manager": create_appointment_manager_agent(clinic_name, clinic_context),
        "support": create_support_agent(clinic_name, clinic_context),
    }


# Pre-built agent definitions for common use (with placeholder context)
CLINIC_INFO_AGENT = AgentDefinition(
    description="Specialist for clinic information queries - location, hours, professionals, services.",
    prompt="You are a clinic information specialist. Help patients with questions about the clinic.",
    tools=CLINIC_INFO_TOOLS,
    model="haiku"
)

SCHEDULING_AGENT = AgentDefinition(
    description="Appointment booking specialist - helps patients schedule new appointments.",
    prompt="You are an appointment scheduling specialist. Help patients book appointments.",
    tools=SCHEDULING_TOOLS,
    model="sonnet"
)

APPOINTMENT_MANAGER_AGENT = AgentDefinition(
    description="Manages existing appointments - view, cancel, or reschedule.",
    prompt="You are an appointment management specialist. Help patients manage their appointments.",
    tools=APPOINTMENT_MANAGER_TOOLS,
    model="haiku"
)

SUPPORT_AGENT = AgentDefinition(
    description="Handles support requests and escalation to human agents.",
    prompt="You are a support specialist. Help with complaints and escalate when needed.",
    tools=SUPPORT_TOOLS,
    model="haiku"
)
