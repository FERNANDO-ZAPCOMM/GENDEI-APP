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
    Register all clinic tool implementations from function_tools.py.
    This should be called during application initialization.
    """
    from src.agents.function_tools import (
        _send_text_message_impl,
        _get_clinic_info_impl,
        _get_professionals_impl,
        _get_services_impl,
        _get_available_slots_impl,
        _create_appointment_impl,
        _send_appointment_confirmation_impl,
        _get_patient_appointments_impl,
        _cancel_appointment_impl,
        _reschedule_appointment_impl,
        _enable_human_takeover_impl,
    )

    registry = get_tool_registry()

    implementations = {
        "send_text_message": _send_text_message_impl,
        "get_clinic_info": _get_clinic_info_impl,
        "get_professionals": _get_professionals_impl,
        "get_services": _get_services_impl,
        "get_available_slots": _get_available_slots_impl,
        "create_appointment": _create_appointment_impl,
        "send_appointment_confirmation": _send_appointment_confirmation_impl,
        "get_patient_appointments": _get_patient_appointments_impl,
        "cancel_appointment": _cancel_appointment_impl,
        "reschedule_appointment": _reschedule_appointment_impl,
        "enable_human_takeover": _enable_human_takeover_impl,
    }

    registry.register_implementations(implementations)
    logger.info(f"Registered {len(implementations)} clinic tool implementations")
