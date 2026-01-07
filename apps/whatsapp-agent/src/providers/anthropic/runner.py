"""
Anthropic runner implementation with agentic loop.
Implements tool use and handoff detection for Claude.
"""

import re
import os
import logging
from typing import Dict, List, Any, Optional

import anthropic

from ..base import BaseRunner, BaseAgent, ExecutionResult, AgentType
from ..tools.base import get_tool_registry
from .session import AnthropicSessionManager

logger = logging.getLogger(__name__)


class AnthropicRunner(BaseRunner):
    """
    Runner for Anthropic agents.
    Implements an agentic loop to handle tool calls and handoffs.
    """

    # Pattern to detect handoff requests in response text
    HANDOFF_PATTERN = re.compile(r'\[HANDOFF:(\w+)\]\s*(.*)', re.IGNORECASE | re.DOTALL)

    def __init__(
        self,
        client: Optional[anthropic.Anthropic] = None,
        session_manager: Optional[AnthropicSessionManager] = None
    ):
        """
        Initialize the Anthropic runner.

        Args:
            client: Anthropic client. Creates one from env if not provided.
            session_manager: Session manager. Creates one if not provided.
        """
        self.client = client or anthropic.Anthropic(
            api_key=os.getenv("ANTHROPIC_API_KEY")
        )
        self.session_manager = session_manager or AnthropicSessionManager()
        self.tool_registry = get_tool_registry()

    async def run(
        self,
        agent: BaseAgent,
        message: str,
        session_id: str,
        context: Dict[str, Any]
    ) -> ExecutionResult:
        """
        Execute an Anthropic agent with agentic loop.

        Args:
            agent: The agent to execute
            message: User message
            session_id: Unique session identifier
            context: Additional context

        Returns:
            ExecutionResult with response and metadata
        """
        try:
            # Get conversation history
            session = self.session_manager.get_session(session_id)
            raw_history = await session.get_history()

            # Filter out messages with empty content (from previous failed calls)
            raw_history = self._filter_valid_messages(raw_history)

            # Build user message with context
            enriched_message = self._build_prompt(message, context)

            # Save user message to session FIRST (before API call)
            await session.add_message("user", enriched_message)

            # Build history for API call
            # Anthropic requires messages to start with user role and alternate
            # For simplicity, we'll start fresh each call but include recent context
            history = self._build_valid_history(raw_history, enriched_message)

            # Agentic loop
            max_iterations = 10
            tool_calls = []

            for iteration in range(max_iterations):
                logger.debug(f"Anthropic agent '{agent.name}' iteration {iteration + 1}")

                # Call Claude API
                # Build API call kwargs
                api_kwargs = {
                    "model": agent.definition.model_config.anthropic_model,
                    "max_tokens": agent.definition.model_config.max_tokens,
                    "system": agent.context.get("system_prompt", agent.definition.system_prompt),
                    "messages": history,
                }

                # Add tools if available
                if agent.tools:
                    api_kwargs["tools"] = agent.tools
                    # Enforce tool use if required by config
                    if agent.definition.model_config.tool_choice == "required":
                        api_kwargs["tool_choice"] = {"type": "any"}

                response = self.client.messages.create(**api_kwargs)

                # Check for tool use
                if response.stop_reason == "tool_use":
                    # Process tool calls
                    assistant_content = response.content
                    history.append({"role": "assistant", "content": assistant_content})

                    # Execute each tool call
                    tool_results = []
                    message_sent = False  # Track if we sent a message to user
                    tools_called = set()  # Track which tools have been called this turn

                    # List of tools that send messages to the user
                    MESSAGE_SENDING_TOOLS = (
                        "send_text_message", "send_greeting_with_products_button",
                        "send_notify_new_products_button", "send_product_card",
                        "send_product_catalog_list", "send_full_catalog",
                        "deliver_free_product", "create_order_and_send_payment"
                    )

                    # Tools that can be combined (text + button is OK)
                    # Only skip if the SAME tool is called twice
                    COMBINABLE_TOOLS = ("send_text_message", "send_notify_new_products_button")

                    for block in response.content:
                        if block.type == "tool_use":
                            # Skip if the SAME tool was already called this turn
                            # BUT allow different tools (e.g., text + button is OK)
                            if block.name in tools_called:
                                logger.info(f"Skipping duplicate call to '{block.name}' - already called this turn")
                                tool_results.append({
                                    "type": "tool_result",
                                    "tool_use_id": block.id,
                                    "content": "Skipped - tool already called this turn"
                                })
                                continue

                            # Skip incompatible combinations (e.g., greeting + text = confusing)
                            # But allow combinable tools together
                            if message_sent and block.name in MESSAGE_SENDING_TOOLS:
                                # Allow text + button combination
                                if not (block.name in COMBINABLE_TOOLS and all(t in COMBINABLE_TOOLS for t in tools_called if t in MESSAGE_SENDING_TOOLS)):
                                    logger.info(f"Skipping '{block.name}' - incompatible with already sent message")
                                    tool_results.append({
                                        "type": "tool_result",
                                        "tool_use_id": block.id,
                                        "content": "Skipped - message already sent to user"
                                    })
                                    continue

                            tool_result = await self._execute_tool(
                                block.name,
                                block.input,
                                context
                            )
                            tools_called.add(block.name)
                            tool_calls.append({
                                "tool": block.name,
                                "input": block.input,
                                "output": tool_result
                            })
                            tool_results.append({
                                "type": "tool_result",
                                "tool_use_id": block.id,
                                "content": str(tool_result)
                            })
                            # Check if this was a message-sending tool that ACTUALLY sent a message
                            # (not blocked/skipped)
                            if block.name in MESSAGE_SENDING_TOOLS:
                                result_str = str(tool_result).lower()
                                # Check if the message was blocked or skipped
                                was_blocked = any(x in result_str for x in [
                                    "blocked", "skipped", "not sent", "already sent"
                                ])
                                if not was_blocked:
                                    message_sent = True
                                    logger.debug(f"Message-sending tool '{block.name}' executed successfully")
                                else:
                                    logger.info(f"Message tool '{block.name}' was blocked/skipped, continuing loop")

                    # If we sent a message to the user, exit the loop - job done!
                    if message_sent:
                        logger.info(f"Agent sent message to user via tool - completing execution")
                        return ExecutionResult(
                            success=True,
                            response="",
                            tool_calls=tool_calls,
                            metadata={"iterations": iteration + 1, "message_sent": True}
                        )

                    # Add tool results to history and continue loop
                    history.append({"role": "user", "content": tool_results})
                    continue

                # No more tool calls - extract final response
                text_response = self._extract_text(response)

                # Check for handoff request in response
                handoff = self._detect_handoff(text_response)

                if handoff:
                    logger.info(f"Handoff detected to {handoff['target']}")
                    # Save history (only if non-empty)
                    if text_response:
                        await session.add_message("assistant", text_response)

                    return ExecutionResult(
                        success=True,
                        response=handoff["message"],
                        tool_calls=tool_calls,
                        handoff_to=self._resolve_agent_type(handoff["target"]),
                        metadata={"iterations": iteration + 1}
                    )

                # Normal completion - save to session (only if non-empty)
                if text_response:
                    await session.add_message("assistant", text_response)

                return ExecutionResult(
                    success=True,
                    response=text_response,
                    tool_calls=tool_calls,
                    metadata={"iterations": iteration + 1}
                )

            # Max iterations reached
            logger.warning(f"Max iterations ({max_iterations}) reached for agent '{agent.name}'")
            return ExecutionResult(
                success=False,
                error="Max iterations reached in agentic loop",
                tool_calls=tool_calls
            )

        except anthropic.APIError as e:
            logger.error(f"Anthropic API error: {e}")
            return ExecutionResult(
                success=False,
                error=f"API error: {str(e)}"
            )
        except Exception as e:
            logger.error(f"Error running Anthropic agent '{agent.name}': {e}")
            return ExecutionResult(
                success=False,
                error=str(e)
            )

    async def handle_handoff(
        self,
        from_agent: BaseAgent,
        to_agent_type: AgentType,
        message: str,
        session_id: str,
        context: Dict[str, Any]
    ) -> ExecutionResult:
        """Handle explicit handoff to another agent."""
        logger.info(f"Handling handoff from {from_agent.name} to {to_agent_type.value}")
        return ExecutionResult(
            success=True,
            handoff_to=to_agent_type,
            response=message,
            metadata={"from_agent": from_agent.name}
        )

    async def _execute_tool(
        self,
        tool_name: str,
        tool_input: Dict[str, Any],
        context: Dict[str, Any]
    ) -> Any:
        """Execute a tool and return result."""
        try:
            handler = self.tool_registry.get_implementation(tool_name)
            logger.debug(f"Executing tool: {tool_name} with input: {tool_input}")

            # Call the handler (inject context if needed)
            import inspect
            if inspect.iscoroutinefunction(handler):
                result = await handler(**tool_input)
            else:
                result = handler(**tool_input)

            return result

        except Exception as e:
            logger.error(f"Error executing tool {tool_name}: {e}")
            return f"Error executing {tool_name}: {str(e)}"

    def _build_prompt(self, message: str, context: Dict[str, Any]) -> str:
        """Build enriched prompt with user context."""
        parts = [message]

        # Add user context if available
        if "user_context" in context:
            uc = context["user_context"]
            user_info = []
            if uc.get("name"):
                user_info.append(f"Name: {uc['name']}")
            if uc.get("stage"):
                user_info.append(f"Stage: {uc['stage']}")
            if user_info:
                parts.append(f"\n[User: {', '.join(user_info)}]")

        return "\n".join(parts)

    def _extract_text(self, response) -> str:
        """Extract text content from response."""
        for block in response.content:
            if hasattr(block, "text"):
                return block.text
        return ""

    def _detect_handoff(self, text: str) -> Optional[Dict[str, str]]:
        """Detect handoff request in response text."""
        match = self.HANDOFF_PATTERN.search(text)
        if match:
            target = match.group(1).strip()
            message = match.group(2).strip() if match.group(2) else text
            return {
                "target": target,
                "message": message
            }
        return None

    def _resolve_agent_type(self, agent_name: str) -> Optional[AgentType]:
        """Resolve agent name string to AgentType enum."""
        # Try exact match first
        try:
            return AgentType(agent_name.lower())
        except ValueError:
            pass

        # Try to find by substring
        name_lower = agent_name.lower()
        for agent_type in AgentType:
            if agent_type.value in name_lower or name_lower in agent_type.value:
                return agent_type

        logger.warning(f"Could not resolve agent type: {agent_name}")
        return None

    def _filter_valid_messages(self, messages: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Filter out messages with empty content.
        Anthropic API requires all messages to have non-empty content.
        """
        valid = []
        for msg in messages:
            content = msg.get("content")
            # Check for empty content
            if content is None:
                continue
            if isinstance(content, str) and not content.strip():
                continue
            if isinstance(content, list) and len(content) == 0:
                continue
            valid.append(msg)

        if len(valid) != len(messages):
            logger.debug(f"Filtered {len(messages) - len(valid)} empty messages from history")

        return valid

    def _build_valid_history(
        self,
        raw_history: List[Dict[str, Any]],
        current_message: str
    ) -> List[Dict[str, Any]]:
        """
        Build a valid message history for Anthropic API.

        Anthropic requirements:
        1. Messages must start with user role
        2. Roles must alternate (user, assistant, user, assistant...)
        3. All messages must have non-empty content

        For simplicity, we start fresh with just the current user message.
        This avoids complex history management while still being functional.
        """
        # Start fresh with just the current user message
        # This is simpler and avoids state issues
        # The system prompt provides context, so history isn't critical
        return [{"role": "user", "content": current_message}]
