"""
Anthropic tool format converter.
Converts provider-agnostic tool definitions to Anthropic API format.
"""

from typing import Dict, List, Any
import logging

from ..base import BaseToolConverter

logger = logging.getLogger(__name__)


class AnthropicToolConverter(BaseToolConverter):
    """
    converts tool definitions to Anthropic API format
    """

    def convert(self, tool_definition: Dict[str, Any], context: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        convert a tool definition to Anthropic format.

        Anthropic format:
        {
            "name": "tool_name",
            "description": "Tool description",
            "input_schema": {
                "type": "object",
                "properties": {...},
                "required": [...]
            }
        }
        """
        properties = {}
        required = []

        for param in tool_definition.get("parameters", []):
            param_schema = {
                "type": self._convert_type(param.get("type", "string")),
                "description": param.get("description", "")
            }

            # handle enum values
            if param.get("enum"):
                param_schema["enum"] = param["enum"]

            # handle default values
            if "default" in param:
                param_schema["default"] = param["default"]

            properties[param["name"]] = param_schema

            if param.get("required", False):
                required.append(param["name"])

        return {
            "name": tool_definition["name"],
            "description": tool_definition.get("description", ""),
            "input_schema": {
                "type": "object",
                "properties": properties,
                "required": required
            }
        }

    def convert_all(self, tool_definitions: List[Dict[str, Any]], context: Dict[str, Any] = None) -> List[Dict[str, Any]]:
        """
        convert all tool definitions to Anthropic format
        """
        converted = []
        for td in tool_definitions:
            try:
                converted.append(self.convert(td, context))
            except Exception as e:
                logger.warning(f"Error converting tool {td.get('name', 'unknown')}: {e}")
        return converted

    def _convert_type(self, param_type: str) -> str:
        """
        convert parameter type to JSON Schema type
        """
        type_map = {
            "string": "string",
            "str": "string",
            "int": "integer",
            "integer": "integer",
            "float": "number",
            "number": "number",
            "bool": "boolean",
            "boolean": "boolean",
            "list": "array",
            "array": "array",
            "dict": "object",
            "object": "object",
        }
        return type_map.get(param_type.lower(), "string")
