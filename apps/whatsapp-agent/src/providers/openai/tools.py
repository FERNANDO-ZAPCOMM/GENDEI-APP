"""
OpenAI tool format converter.
Converts provider-agnostic tool definitions to OpenAI Agents SDK format.
"""

from typing import Dict, List, Any, Callable
import logging
import functools
import inspect

from agents import function_tool  # type: ignore

from ..base import BaseToolConverter

logger = logging.getLogger(__name__)


class OpenAIToolConverter(BaseToolConverter):
    """Converts tool definitions to OpenAI Agents SDK format using @function_tool decorator."""

    def convert(
        self,
        tool_definition: Dict[str, Any],
        context: Dict[str, Any]
    ) -> Callable:
        """
        Convert a tool definition to OpenAI @function_tool format.

        Args:
            tool_definition: Provider-agnostic tool definition
            context: Runtime context to inject into tool calls

        Returns:
            A function decorated with @function_tool
        """
        handler = tool_definition.get("handler")
        tool_name = tool_definition.get("name", "unknown")
        tool_description = tool_definition.get("description", "")

        if handler is None:
            raise ValueError(f"No handler for tool: {tool_name}")

        # Check if handler is async
        is_async = inspect.iscoroutinefunction(handler)

        if is_async:
            @functools.wraps(handler)
            async def contextualized_handler(*args, **kwargs):
                # Inject context into handler if it accepts _context
                sig = inspect.signature(handler)
                if "_context" in sig.parameters:
                    kwargs["_context"] = context
                return await handler(*args, **kwargs)
        else:
            @functools.wraps(handler)
            def contextualized_handler(*args, **kwargs):
                # Inject context into handler if it accepts _context
                sig = inspect.signature(handler)
                if "_context" in sig.parameters:
                    kwargs["_context"] = context
                return handler(*args, **kwargs)

        # Copy function metadata
        contextualized_handler.__name__ = tool_name
        contextualized_handler.__doc__ = tool_description

        # Apply the function_tool decorator
        return function_tool(contextualized_handler)

    def convert_all(
        self,
        tool_definitions: List[Dict[str, Any]],
        context: Dict[str, Any]
    ) -> List[Callable]:
        """Convert all tool definitions to OpenAI format."""
        converted = []
        for td in tool_definitions:
            try:
                converted.append(self.convert(td, context))
            except ValueError as e:
                logger.warning(f"Skipping tool conversion: {e}")
        return converted
