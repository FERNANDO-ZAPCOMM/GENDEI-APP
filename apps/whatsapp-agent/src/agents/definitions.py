"""
Provider-agnostic agent definitions.
These define all agents in the system with their tools and handoffs.
"""

from typing import List

from src.providers.base import AgentDefinition, AgentType, ModelConfig
from .prompts import AGENT_PROMPTS


# Model configurations
# Using Claude Sonnet 4.5 for ALL tasks
FAST_MODEL = ModelConfig(
    tier="fast",
    openai_model="gpt-4o-mini",
    anthropic_model="claude-sonnet-4-5",
    max_tokens=150,
    temperature=0.7,
    tool_choice="required",
)

COMPLEX_MODEL = ModelConfig(
    tier="complex",
    openai_model="gpt-4o",
    anthropic_model="claude-sonnet-4-5",
    max_tokens=200,
    temperature=0.7,
    tool_choice="required",
)

ROUTER_MODEL = ModelConfig(
    tier="fast",
    openai_model="gpt-4o-mini",
    anthropic_model="claude-sonnet-4-5",
    max_tokens=50,
    temperature=0.1,
    tool_choice="required",
)


# Agent definitions
AGENT_DEFINITIONS: List[AgentDefinition] = [
    AgentDefinition(
        agent_type=AgentType.GREETER,
        name="greeter_agent",
        description="First-contact agent: welcomes and handles the user's initial intent",
        system_prompt=AGENT_PROMPTS["greeter"],
        model_config=FAST_MODEL,
        tools=[
            "send_greeting_with_products_button",
            "send_notify_new_products_button",
            "send_text_message",
            "set_product_notification_preference",
        ],
        handoffs=[AgentType.PRODUCT_INFO, AgentType.FREE_PRODUCT, AgentType.SALES_CLOSER],
    ),

    AgentDefinition(
        agent_type=AgentType.NOTIFICATION_OPTIN,
        name="notification_optin_agent",
        description="Confirms notification opt-in and keeps the conversation open",
        system_prompt=AGENT_PROMPTS["notification_optin"],
        model_config=ModelConfig(
            tier="fast",
            openai_model="gpt-4o-mini",
            anthropic_model="claude-sonnet-4-5",
            max_tokens=120,
            temperature=0.4,
            tool_choice="required",
        ),
        tools=["send_text_message"],
        handoffs=[AgentType.PRODUCT_INFO, AgentType.SALES_CLOSER, AgentType.SUPPORT],
    ),

    AgentDefinition(
        agent_type=AgentType.PRODUCT_INFO,
        name="product_info_agent",
        description="Answers detailed questions about product content, features, and benefits using RAG",
        system_prompt=AGENT_PROMPTS["product_info"],
        model_config=COMPLEX_MODEL,
        tools=[
            "send_text_message",
            "send_notify_new_products_button",
            "get_product_info",
            "list_all_products",
            "get_product_details",
            "answer_customer_question",
            "get_objection_response",
            "set_product_notification_preference",
            "send_product_card",
            "send_product_catalog_list",
            "send_full_catalog",
        ],
        handoffs=[AgentType.FREE_PRODUCT, AgentType.SALES_CLOSER, AgentType.OBJECTION_HANDLER],
    ),

    AgentDefinition(
        agent_type=AgentType.FREE_PRODUCT,
        name="free_product_agent",
        description="Delivers free products/lead magnets to interested users",
        system_prompt=AGENT_PROMPTS["free_product"],
        model_config=ModelConfig(
            tier="fast",
            openai_model="gpt-4o-mini",
            anthropic_model="claude-sonnet-4-5",
            max_tokens=100,
            temperature=0.7,
            tool_choice="required",
        ),
        tools=["send_text_message", "deliver_free_product", "get_product_info"],
        handoffs=[AgentType.SALES_CLOSER, AgentType.PRODUCT_INFO],
    ),

    AgentDefinition(
        agent_type=AgentType.OBJECTION_HANDLER,
        name="objection_handler_agent",
        description="Handles common sales objections with empathy and value-focused responses",
        system_prompt=AGENT_PROMPTS["objection_handler"],
        model_config=COMPLEX_MODEL,
        tools=[
            "send_text_message",
            "get_product_info",
            "get_product_details",
            "get_objection_response",
        ],
        handoffs=[AgentType.SALES_CLOSER, AgentType.FREE_PRODUCT, AgentType.SUPPORT],
    ),

    AgentDefinition(
        agent_type=AgentType.SALES_CLOSER,
        name="sales_closer_agent",
        description="Closes sales when user shows buying intent",
        system_prompt=AGENT_PROMPTS["sales_closer"],
        model_config=ModelConfig(
            tier="fast",
            openai_model="gpt-4o-mini",
            anthropic_model="claude-sonnet-4-5",
            max_tokens=100,
            temperature=0.7,
            tool_choice="required",
        ),
        tools=["send_text_message", "create_order_and_send_payment", "get_product_info"],
        handoffs=[AgentType.PAYMENT, AgentType.OBJECTION_HANDLER],
    ),

    AgentDefinition(
        agent_type=AgentType.PAYMENT,
        name="payment_agent",
        description="Handles payment questions, PIX, and order status",
        system_prompt=AGENT_PROMPTS["payment"],
        model_config=ModelConfig(
            tier="fast",
            openai_model="gpt-4o-mini",
            anthropic_model="claude-sonnet-4-5",
            max_tokens=100,
            temperature=0.7,
            tool_choice="required",
        ),
        tools=["send_text_message", "create_order_and_send_payment", "check_order_status"],
        handoffs=[AgentType.SUPPORT],
    ),

    AgentDefinition(
        agent_type=AgentType.SUPPORT,
        name="support_agent",
        description="Handles help requests, complaints, and escalation to human support",
        system_prompt=AGENT_PROMPTS["support"],
        model_config=ModelConfig(
            tier="complex",
            openai_model="gpt-4o",
            anthropic_model="claude-sonnet-4-5",
            max_tokens=120,
            temperature=0.7,
            tool_choice="required",
        ),
        tools=[
            "send_text_message",
            "enable_human_takeover",
            "check_order_status",
            "set_product_notification_preference",
        ],
        handoffs=[],  # Support is the final escalation point
    ),

    AgentDefinition(
        agent_type=AgentType.MENTORSHIP_BOOKING,
        name="mentorship_booking_agent",
        description="Handles mentorship/consulting interest and collects details to schedule with a human",
        system_prompt=AGENT_PROMPTS["mentorship_booking"],
        model_config=ModelConfig(
            tier="fast",
            openai_model="gpt-4o-mini",
            anthropic_model="claude-sonnet-4-5",
            max_tokens=140,
            temperature=0.7,
            tool_choice="required",
        ),
        tools=["send_text_message", "enable_human_takeover"],
        handoffs=[AgentType.SUPPORT],
    ),

    AgentDefinition(
        agent_type=AgentType.TRIAGE,
        name="triage_agent",
        description="Routes messages to the appropriate specialized agent",
        system_prompt=AGENT_PROMPTS["triage"],
        model_config=ROUTER_MODEL,
        tools=["send_text_message"],
        handoffs=[
            AgentType.GREETER,
            AgentType.NOTIFICATION_OPTIN,
            AgentType.PRODUCT_INFO,
            AgentType.FREE_PRODUCT,
            AgentType.OBJECTION_HANDLER,
            AgentType.SALES_CLOSER,
            AgentType.PAYMENT,
            AgentType.SUPPORT,
            AgentType.MENTORSHIP_BOOKING,
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
