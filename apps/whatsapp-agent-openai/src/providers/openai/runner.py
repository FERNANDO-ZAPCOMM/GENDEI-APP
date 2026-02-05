"""
OpenAI runner implementation using OpenAI Agents SDK.
"""

import logging
from typing import Dict, Any, Optional, TYPE_CHECKING

from agents import Runner  # type: ignore

from ..base import BaseRunner, BaseAgent, ExecutionResult, AgentType
from .session import OpenAISessionManager

if TYPE_CHECKING:
    from .factory import OpenAIAgent

logger = logging.getLogger(__name__)


class OpenAIRunner(BaseRunner):
    """Runner for OpenAI agents using the Agents SDK."""

    def __init__(self, session_manager: Optional[OpenAISessionManager] = None):
        """
        Initialize the OpenAI runner.

        Args:
            session_manager: Optional session manager. Creates one if not provided.
        """
        self.session_manager = session_manager or OpenAISessionManager()

    async def run(
        self,
        agent: BaseAgent,
        message: str,
        session_id: str,
        context: Dict[str, Any]
    ) -> ExecutionResult:
        """
        Execute an OpenAI agent.

        Args:
            agent: The agent to execute (must be OpenAIAgent)
            message: User message
            session_id: Unique session identifier
            context: Additional context

        Returns:
            ExecutionResult with response and metadata
        """
        try:
            # Get or create session
            session = self.session_manager.get_sqlite_session(session_id)

            # Build enriched prompt with context
            prompt = self._build_prompt(message, context)

            # Get the SDK agent
            sdk_agent = getattr(agent, "sdk_agent", None)
            if sdk_agent is None:
                return ExecutionResult(
                    success=False,
                    error="Agent does not have sdk_agent attribute"
                )

            # Run agent via SDK
            logger.debug(f"Running agent '{agent.name}' with message: {message[:50]}...")
            result = await Runner.run(
                sdk_agent,
                prompt,
                session=session
            )

            # Parse result
            return self._parse_result(result, agent)

        except Exception as e:
            logger.error(f"Error running OpenAI agent '{agent.name}': {e}")
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
        """
        Handle agent handoff.

        Note: OpenAI Agents SDK handles handoffs internally via Runner.run()
        when agent.handoffs is set. This method is here for explicit handoff requests.
        """
        # The SDK handles handoffs automatically when agent.handoffs is set
        # This method can be used for manual handoff orchestration if needed
        return ExecutionResult(
            success=True,
            handoff_to=to_agent_type,
            response=message,
            metadata={"from_agent": from_agent.name}
        )

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

    def _parse_result(self, sdk_result: Any, agent: BaseAgent) -> ExecutionResult:
        """Parse SDK result into ExecutionResult."""
        try:
            # Extract response text from SDK result (avoid raw RunResult dumps)
            response_text = ""
            if sdk_result is None:
                response_text = ""
            elif hasattr(sdk_result, "output_text") and sdk_result.output_text:
                response_text = sdk_result.output_text
            elif hasattr(sdk_result, "final_output") and sdk_result.final_output:
                response_text = sdk_result.final_output
            elif hasattr(sdk_result, "output") and sdk_result.output:
                # SDK output can be a list of items with text/content
                parts = []
                for item in sdk_result.output:
                    text = getattr(item, "text", None) or getattr(item, "content", None)
                    if text:
                        parts.append(str(text))
                response_text = "\n".join(parts).strip()
            else:
                # Fallback to string, but strip noisy RunResult summary if present
                raw = str(sdk_result)
                if raw.startswith("RunResult"):
                    response_text = ""
                else:
                    response_text = raw

            # Check for handoff in the result
            handoff_to = None
            if hasattr(sdk_result, "last_agent"):
                last_agent = sdk_result.last_agent
                if last_agent and hasattr(last_agent, "name"):
                    # Check if we handed off to a different agent
                    last_agent_name = last_agent.name
                    if last_agent_name != agent.name:
                        # Try to map agent name to AgentType
                        for agent_type in AgentType:
                            if agent_type.value in last_agent_name or last_agent_name in agent_type.value:
                                handoff_to = agent_type
                                break

            # Extract tool calls if available
            tool_calls = []
            if hasattr(sdk_result, "new_items"):
                for item in sdk_result.new_items:
                    if hasattr(item, "type") and item.type == "function_call":
                        tool_calls.append({
                            "name": getattr(item, "name", "unknown"),
                            "arguments": getattr(item, "arguments", {}),
                        })
            elif hasattr(sdk_result, "output"):
                for item in sdk_result.output:
                    if getattr(item, "type", None) == "function_call":
                        tool_calls.append({
                            "name": getattr(item, "name", "unknown"),
                            "arguments": getattr(item, "arguments", {}),
                        })

            return ExecutionResult(
                success=True,
                response=response_text,
                tool_calls=tool_calls,
                handoff_to=handoff_to,
                metadata={
                    "agent": agent.name,
                    "last_agent": getattr(getattr(sdk_result, "last_agent", None), "name", None),
                }
            )

        except Exception as e:
            logger.warning(f"Error parsing SDK result: {e}")
            return ExecutionResult(
                success=True,
                response=str(sdk_result) if sdk_result else "",
                metadata={"parse_error": str(e)}
            )
