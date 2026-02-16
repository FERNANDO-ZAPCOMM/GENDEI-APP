"""
OpenAI runner implementation using OpenAI Agents SDK.
"""

import logging
from typing import Dict, Any, Optional, TYPE_CHECKING

from agents import Runner, RunConfig  # type: ignore

from ..base import BaseRunner, BaseAgent, ExecutionResult, AgentType
from .session import OpenAISessionManager
from src.runtime.context import Runtime

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
        context: Dict[str, Any],
        runtime: Optional[Runtime] = None
    ) -> ExecutionResult:
        """
        Execute an OpenAI agent.

        Args:
            agent: The agent to execute (must be OpenAIAgent)
            message: User message
            session_id: Unique session identifier
            context: Additional context
            runtime: Optional Runtime context for RunContextWrapper injection in tools

        Returns:
            ExecutionResult with response and metadata
        """
        try:
            # Get or create session
            session = self.session_manager.get_sdk_session(session_id)

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
                session=session,
                context=runtime,
                max_turns=10,
                run_config=RunConfig(workflow_name="whatsapp-clinic")
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

        if context.get("patient_name"):
            parts.append(f"\n[Paciente: {context['patient_name']}]")
        if context.get("phone"):
            parts.append(f"\n[Telefone: {context['phone']}]")

        return "\n".join(parts)

    def _parse_result(self, sdk_result: Any, agent: BaseAgent) -> ExecutionResult:
        """Parse SDK result into ExecutionResult."""
        try:
            # Use SDK's final_output directly
            response_text = ""
            if hasattr(sdk_result, "final_output") and sdk_result.final_output:
                response_text = str(sdk_result.final_output)

            # Check for handoff
            handoff_to = None
            if hasattr(sdk_result, "last_agent") and sdk_result.last_agent:
                last_agent_name = sdk_result.last_agent.name
                if last_agent_name != agent.name:
                    for agent_type in AgentType:
                        if agent_type.value in last_agent_name or last_agent_name in agent_type.value:
                            handoff_to = agent_type
                            break

            # Extract tool calls from new_items
            tool_calls = []
            if hasattr(sdk_result, "new_items"):
                for item in sdk_result.new_items:
                    item_type = getattr(item, "type", "")
                    if item_type == "function_call_output" or (hasattr(item, "raw_item") and getattr(getattr(item, "raw_item", None), "type", "") == "function_call"):
                        tool_calls.append({
                            "name": getattr(item, "name", getattr(getattr(item, "raw_item", None), "name", "unknown")),
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
            return ExecutionResult(success=True, response="", metadata={"parse_error": str(e)})
