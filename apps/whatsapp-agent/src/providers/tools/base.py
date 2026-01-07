"""
Tool registry and conversion utilities.
"""

from typing import Dict, List, Any, Callable, Optional
import logging

from .definitions import TOOL_DEFINITIONS, AGENT_TOOL_GROUPS

logger = logging.getLogger(__name__)


class ToolRegistry:
    """
    Registry for tool definitions and implementations.
    Singleton pattern ensures consistent tool access across the application.
    """

    _instance: Optional["ToolRegistry"] = None
    _initialized: bool = False

    def __new__(cls) -> "ToolRegistry":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
        self._definitions: Dict[str, Dict[str, Any]] = TOOL_DEFINITIONS.copy()
        self._implementations: Dict[str, Callable] = {}
        self._initialized = True
        logger.info(f"ToolRegistry initialized with {len(self._definitions)} tool definitions")

    def register_implementation(self, name: str, handler: Callable) -> None:
        """Register a tool implementation."""
        if name not in self._definitions:
            logger.warning(f"Registering implementation for unknown tool: {name}")
        self._implementations[name] = handler

    def register_implementations(self, implementations: Dict[str, Callable]) -> None:
        """Register multiple tool implementations at once."""
        for name, handler in implementations.items():
            self.register_implementation(name, handler)

    def get_definition(self, name: str) -> Dict[str, Any]:
        """Get tool definition by name."""
        if name not in self._definitions:
            raise ValueError(f"Unknown tool: {name}")
        return self._definitions[name].copy()

    def get_implementation(self, name: str) -> Callable:
        """Get tool implementation by name."""
        if name not in self._implementations:
            raise ValueError(f"No implementation for tool: {name}")
        return self._implementations[name]

    def has_implementation(self, name: str) -> bool:
        """Check if a tool has an implementation registered."""
        return name in self._implementations

    def get_tools(self, names: List[str]) -> List[Dict[str, Any]]:
        """Get multiple tool definitions with implementations."""
        tools = []
        for name in names:
            if name not in self._definitions:
                logger.warning(f"Skipping unknown tool: {name}")
                continue
            tool = self._definitions[name].copy()
            if name in self._implementations:
                tool["handler"] = self._implementations[name]
            tools.append(tool)
        return tools

    def get_tools_for_agent(self, agent_type: str) -> List[Dict[str, Any]]:
        """Get all tools for a specific agent type."""
        tool_names = AGENT_TOOL_GROUPS.get(agent_type, ["send_text_message"])
        return self.get_tools(tool_names)

    def list_all_tools(self) -> List[str]:
        """List all registered tool names."""
        return list(self._definitions.keys())

    def list_implemented_tools(self) -> List[str]:
        """List tools that have implementations."""
        return list(self._implementations.keys())


# Global registry instance
_registry: Optional[ToolRegistry] = None


def get_tool_registry() -> ToolRegistry:
    """Get the global tool registry instance."""
    global _registry
    if _registry is None:
        _registry = ToolRegistry()
    return _registry


def register_tool_implementations() -> None:
    """
    Register all tool implementations from function_tools.py.
    This should be called during application initialization.
    """
    from src.agents.function_tools import (
        _send_text_message_impl,
        _send_greeting_with_products_button_impl,
        _send_notify_new_products_button_impl,
        _set_product_notification_preference_impl,
        _get_product_info_impl,
        _list_all_products_impl,
        _get_product_details_impl,
        _answer_customer_question_impl,
        _get_objection_response_impl,
        _send_product_card_impl,
        _send_product_catalog_list_impl,
        _send_full_catalog_impl,
        _create_order_and_send_payment_impl,
        _check_order_status_impl,
        _enable_human_takeover_impl,
        _deliver_free_product_impl,
    )

    registry = get_tool_registry()

    implementations = {
        "send_text_message": _send_text_message_impl,
        "send_greeting_with_products_button": _send_greeting_with_products_button_impl,
        "send_notify_new_products_button": _send_notify_new_products_button_impl,
        "set_product_notification_preference": _set_product_notification_preference_impl,
        "get_product_info": _get_product_info_impl,
        "list_all_products": _list_all_products_impl,
        "get_product_details": _get_product_details_impl,
        "answer_customer_question": _answer_customer_question_impl,
        "get_objection_response": _get_objection_response_impl,
        "send_product_card": _send_product_card_impl,
        "send_product_catalog_list": _send_product_catalog_list_impl,
        "send_full_catalog": _send_full_catalog_impl,
        "create_order_and_send_payment": _create_order_and_send_payment_impl,
        "check_order_status": _check_order_status_impl,
        "enable_human_takeover": _enable_human_takeover_impl,
        "deliver_free_product": _deliver_free_product_impl,
    }

    registry.register_implementations(implementations)
    logger.info(f"Registered {len(implementations)} tool implementations")
