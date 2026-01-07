"""
Workflow Executor - Core workflow execution engine
Executes workflow nodes and manages state transitions
"""

import logging
import json
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Callable, Awaitable
from datetime import datetime, timezone
from enum import Enum

from src.workflows.contract import NodeType, TriggerType

logger = logging.getLogger(__name__)


class AgentType(str, Enum):
    """
    specialized agent types for workflow handoffs
    maps workflow node types to specific agents
    """
    GREETER = "greeter"
    PRODUCT_INFO = "product_info"
    FREE_PRODUCT = "free_product"
    OBJECTION_HANDLER = "objection_handler"
    SALES_CLOSER = "sales_closer"
    PAYMENT = "payment"
    SUPPORT = "support"
    TRIAGE = "triage"


# mapping from node types to specialized agents
NODE_TO_AGENT_MAP = {
    NodeType.START: AgentType.GREETER,
    NodeType.MESSAGE: AgentType.PRODUCT_INFO,
    NodeType.OFFER_PRODUCT: AgentType.SALES_CLOSER,  # default for paid products
    NodeType.COLLECT_INFO: AgentType.PRODUCT_INFO,
    NodeType.CONDITION: AgentType.OBJECTION_HANDLER,  # conditions often check objections
    NodeType.INTENT_ROUTER: AgentType.TRIAGE,
    NodeType.WAIT_RESPONSE: AgentType.TRIAGE,
    NodeType.ASSIGN_TAG: AgentType.TRIAGE,
    NodeType.HANDOFF: AgentType.SUPPORT,  # default for human handoff
    NodeType.END: AgentType.TRIAGE,
}


def get_agent_for_node(node_type: str, node_data: dict = None) -> str:
    """
    get the appropriate specialized agent for a workflow node
    args:
        node_type: the workflow node type
        node_data: optional node data for context-aware routing
    returns:
        agent type string (e.g., 'greeter', 'sales_closer')
    """
    # special handling for offer_product nodes
    if node_type == NodeType.OFFER_PRODUCT and node_data:
        offer_type = node_data.get('offerType', 'paid')
        if offer_type in ('free', 'free_first'):
            return AgentType.FREE_PRODUCT.value
        return AgentType.SALES_CLOSER.value

    # special handling for handoff nodes
    if node_type == NodeType.HANDOFF and node_data:
        handoff_type = node_data.get('handoffType', 'human')
        # map legacy agent names to new specialized agents
        agent_mapping = {
            'human': AgentType.SUPPORT.value,
            'sales': AgentType.SALES_CLOSER.value,
            'payment': AgentType.PAYMENT.value,
            'triage': AgentType.TRIAGE.value,
            'support': AgentType.SUPPORT.value,
            # NEW SPECIALIZED AGENT NAMES (PASS THROUGH)
            'greeter': AgentType.GREETER.value,
            'product_info': AgentType.PRODUCT_INFO.value,
            'free_product': AgentType.FREE_PRODUCT.value,
            'objection_handler': AgentType.OBJECTION_HANDLER.value,
            'sales_closer': AgentType.SALES_CLOSER.value,
        }
        return agent_mapping.get(handoff_type, AgentType.TRIAGE.value)

    # special handling for condition nodes
    if node_type == NodeType.CONDITION and node_data:
        condition_type = node_data.get('conditionType', '')
        # objection-type conditions go to objection handler
        if 'objection' in condition_type.lower():
            return AgentType.OBJECTION_HANDLER.value
        # buy intent conditions go to sales closer
        if 'buy' in condition_type.lower() or 'purchase' in condition_type.lower():
            return AgentType.SALES_CLOSER.value

    # default mapping
    try:
        node_enum = NodeType(node_type)
        return NODE_TO_AGENT_MAP.get(node_enum, AgentType.TRIAGE).value
    except ValueError:
        return AgentType.TRIAGE.value


class ExecutionStatus(str, Enum):
    """
    workflow execution status
    """
    RUNNING = "running"
    WAITING = "waiting"
    COMPLETED = "completed"
    ERROR = "error"
    HANDOFF = "handoff"


@dataclass
class WorkflowExecutionResult:
    """
    result of workflow execution step
    """
    status: ExecutionStatus
    messages: List[str] = field(default_factory=list)
    current_node_id: Optional[str] = None
    variables: Dict[str, Any] = field(default_factory=dict)
    products_offered: List[str] = field(default_factory=list)
    tags_assigned: List[str] = field(default_factory=list)
    info_collected: Dict[str, str] = field(default_factory=dict)
    should_use_agent: bool = False
    agent_type: Optional[str] = None  # specialized: 'greeter', 'product_info', 'sales_closer', 'payment', 'triage', etc.
    handoff_reason: Optional[str] = None
    error_message: Optional[str] = None


@dataclass
class WorkflowContext:
    """
    execution context for workflow
    """
    phone: str
    user_message: str
    user_name: Optional[str] = None
    is_new_conversation: bool = False
    conversation_state: Dict[str, Any] = field(default_factory=dict)
    variables: Dict[str, Any] = field(default_factory=dict)
    current_node_id: Optional[str] = None
    messages_to_send: List[str] = field(default_factory=list)


class WorkflowExecutor:
    """
    executes workflow nodes and manages state
    usage:
        executor = WorkflowExecutor(data_service, firestore_adapter)
        result = await executor.execute(
            phone="+5511999999999",
            user_message="Oi",
            is_new_conversation=True
        )
    """

    def __init__(
        self,
        data_service: Any,
        firestore_adapter: Any,
        llm_evaluator: Optional[Callable[[str, str, List[str]], Awaitable[str]]] = None,
        send_message_fn: Optional[Callable[[str, str], Awaitable[bool]]] = None
    ):
        """
        initialize workflow executor
        args:
            data_service: DataService instance with workflow loaded
            firestore_adapter: FirestoreAdapter for state persistence
            llm_evaluator: Optional LLM function for condition evaluation
            send_message_fn: Optional function to send WhatsApp messages
        """
        self.data_service = data_service
        self.db = firestore_adapter
        self.llm_evaluator = llm_evaluator
        self.send_message_fn = send_message_fn

    def should_trigger_workflow(self, message: str, is_new_conversation: bool = False) -> bool:
        """
        check if workflow should be triggered for this message
        """
        return self.data_service.check_workflow_trigger(message, is_new_conversation)

    def has_active_workflow(self) -> bool:
        """
        check if there's an active workflow
        """
        return self.data_service.has_active_workflow()

    async def execute(
        self,
        phone: str,
        user_message: str,
        user_name: Optional[str] = None,
        is_new_conversation: bool = False,
        existing_state: Optional[Dict[str, Any]] = None
    ) -> WorkflowExecutionResult:
        """
        execute workflow for a user message
        args:
            phone: User phone number
            user_message: User's message
            user_name: User's name if known
            is_new_conversation: Whether this is a new conversation
            existing_state: Existing workflow execution state (from Firestore)
        returns:
            WorkflowExecutionResult with status and output
        """
        try:
            # check if workflow is active
            if not self.has_active_workflow():
                logger.info(f"No active workflow for execution")
                return WorkflowExecutionResult(
                    status=ExecutionStatus.COMPLETED,
                    should_use_agent=True,
                    agent_type=AgentType.TRIAGE.value
                )

            # initialize context
            context = WorkflowContext(
                phone=phone,
                user_message=user_message,
                user_name=user_name,
                is_new_conversation=is_new_conversation
            )

            # load or initialize execution state
            if existing_state:
                context.current_node_id = existing_state.get('currentNodeId')
                context.variables = existing_state.get('variables', {})
                context.variables["_workflow_resumed"] = True
                logger.info(f"Resuming workflow at node: {context.current_node_id}")
            else:
                context.variables["_workflow_resumed"] = False
                # check if we should start the workflow
                if not self.should_trigger_workflow(user_message, is_new_conversation):
                    logger.info(f"Workflow not triggered for message: {user_message[:50]}")
                    return WorkflowExecutionResult(
                        status=ExecutionStatus.COMPLETED,
                        should_use_agent=True,
                        agent_type=AgentType.TRIAGE.value
                    )

                # start from the beginning
                context.current_node_id = self.data_service.get_workflow_start_node_id()
                logger.info(f"Starting workflow from node: {context.current_node_id}")

            if not context.current_node_id:
                logger.warning("No start node found in workflow")
                return WorkflowExecutionResult(
                    status=ExecutionStatus.ERROR,
                    error_message="No start node defined"
                )

            # execute nodes until we hit a wait point or end
            result = await self._execute_nodes(context)

            # persist state if waiting
            if result.status == ExecutionStatus.WAITING:
                await self._save_execution_state(phone, result)
            elif result.status in [ExecutionStatus.COMPLETED, ExecutionStatus.ERROR, ExecutionStatus.HANDOFF]:
                # clear execution state
                self.db.clear_workflow_execution(phone)

            return result

        except Exception as e:
            logger.error(f"Workflow execution error: {e}", exc_info=True)
            return WorkflowExecutionResult(
                status=ExecutionStatus.ERROR,
                error_message=str(e),
                should_use_agent=True,
                agent_type=AgentType.TRIAGE.value
            )

    async def _execute_nodes(self, context: WorkflowContext) -> WorkflowExecutionResult:
        """
        execute nodes until we hit a stopping point
        """
        result = WorkflowExecutionResult(
            status=ExecutionStatus.RUNNING,
            variables=context.variables.copy()
        )

        max_iterations = 20  # prevent infinite loops
        iterations = 0

        while iterations < max_iterations:
            iterations += 1

            node = self.data_service.get_workflow_node(context.current_node_id)
            if not node:
                logger.warning(f"Node not found: {context.current_node_id}")
                result.status = ExecutionStatus.ERROR
                result.error_message = f"Node not found: {context.current_node_id}"
                break

            node_type = node.get('type')
            node_data = node.get('data', {})

            logger.info(f"Executing node: {context.current_node_id} (type: {node_type})")

            # execute based on node type
            if node_type == NodeType.START:
                # move to next node
                next_nodes = self.data_service.get_next_nodes(context.current_node_id)
                if next_nodes:
                    context.current_node_id = next_nodes[0]
                else:
                    result.status = ExecutionStatus.COMPLETED
                    break

            elif node_type == NodeType.MESSAGE:
                # send a message
                template = node_data.get('message') or node_data.get('messageTemplate') or ''
                message = self._format_message(template, result.variables, context)
                result.messages.append(message)

                # send if we have a send function
                if self.send_message_fn:
                    await self.send_message_fn(context.phone, message)

                # move to next node
                next_nodes = self.data_service.get_next_nodes(context.current_node_id)
                if next_nodes:
                    context.current_node_id = next_nodes[0]
                else:
                    result.status = ExecutionStatus.COMPLETED
                    break

            elif node_type == NodeType.OFFER_PRODUCT:
                # offer a product
                offer_type_raw = node_data.get('offerType', 'paid')
                offer_type = 'free' if offer_type_raw in ('free', 'free_first') else offer_type_raw

                product_id = node_data.get('productId')
                product_selection = node_data.get('productSelection')
                product_ids = node_data.get('productIds') or []

                # canonical TS schema: resolve a product based on selection rules
                resolved_product_id = None
                if product_id:
                    resolved_product_id = product_id
                elif product_selection == 'specific' and product_ids:
                    resolved_product_id = product_ids[0]

                if resolved_product_id:
                    product = self.data_service.get_product_by_id(resolved_product_id)
                else:
                    # fallback selection strategies
                    product = None
                    products = self.data_service.get_all_products()
                    if product_selection == 'by_type':
                        desired_type = node_data.get('productType')
                        if desired_type:
                            product = next((p for p in products if p.get('type') == desired_type), None)
                    elif product_selection == 'by_price':
                        price_range = node_data.get('priceRange') or {}
                        min_price = price_range.get('min')
                        max_price = price_range.get('max')

                        def _amount(p: Dict[str, Any]) -> int:
                            return int(p.get('price', {}).get('amount', 0) or 0)

                        candidates = []
                        for p in products:
                            amt = _amount(p)
                            if min_price is not None and amt < int(min_price):
                                continue
                            if max_price is not None and amt > int(max_price):
                                continue
                            candidates.append(p)
                        product = candidates[0] if candidates else None

                    if not product:
                        # last resort: old helper by offer type (free/paid/upsell)
                        product = self.data_service.get_product_for_offer(offer_type, None)

                if product:
                    product_any_id = product.get('id') or product.get('productId')
                    if product_any_id:
                        result.products_offered.append(product_any_id)
                    result.variables['current_product'] = product
                    result.variables['current_product_id'] = product_any_id
                    result.variables['current_product_name'] = product.get('title', '')
                    result.variables['current_product_price'] = product.get('price', {}).get('formatted', '')

                    # track which agent should handle follow-up based on offer type
                    suggested_agent = get_agent_for_node(node_type, node_data)
                    result.variables['suggested_agent'] = suggested_agent
                    logger.info(f"Offer product node suggests {suggested_agent} agent for follow-up")

                    # generate offer message
                    offer_message = self._generate_product_offer(product, offer_type, node_data, context)
                    result.messages.append(offer_message)

                    if self.send_message_fn:
                        await self.send_message_fn(context.phone, offer_message)

                # move to next node
                next_nodes = self.data_service.get_next_nodes(context.current_node_id)
                if next_nodes:
                    context.current_node_id = next_nodes[0]
                else:
                    # no more nodes - hand off to appropriate agent based on offer type
                    result.status = ExecutionStatus.COMPLETED
                    result.should_use_agent = True
                    result.agent_type = get_agent_for_node(node_type, node_data)
                    logger.info(f"Offer product completed, handing to {result.agent_type} agent")
                    break

            elif node_type == NodeType.COLLECT_INFO:
                # collect user information
                field_name = node_data.get('storeIn') or node_data.get('fieldName') or 'info'
                prompt = node_data.get('prompt', 'Por favor, informe:')

                # only treat current message as an answer when resuming from WAITING
                if context.variables.get("_workflow_resumed") and context.user_message:
                    result.info_collected[str(field_name)] = context.user_message
                    result.variables[str(field_name)] = context.user_message
                    result.variables['user_' + str(field_name)] = context.user_message

                    # move to next node
                    next_nodes = self.data_service.get_next_nodes(context.current_node_id)
                    if next_nodes:
                        context.current_node_id = next_nodes[0]
                    else:
                        result.status = ExecutionStatus.COMPLETED
                        break
                else:
                    # ask for the information
                    formatted_prompt = self._format_message(prompt, result.variables, context)
                    result.messages.append(formatted_prompt)

                    if self.send_message_fn:
                        await self.send_message_fn(context.phone, formatted_prompt)

                    result.status = ExecutionStatus.WAITING
                    result.current_node_id = context.current_node_id
                    break

            elif node_type == NodeType.CONDITION:
                # evaluate condition
                condition_type = node_data.get('conditionType', 'llm')
                condition = node_data.get('condition')
                if not condition:
                    if condition_type == 'llm':
                        condition = node_data.get('llmPrompt', '')
                    elif condition_type == 'expression':
                        condition = node_data.get('expression', '')
                    else:
                        condition = node_data.get('llmPrompt') or node_data.get('expression') or ''

                condition_result = await self._evaluate_condition(
                    condition_type,
                    str(condition or ''),
                    context,
                    result.variables
                )

                # track condition result for agent routing
                result.variables['last_condition_result'] = condition_result
                result.variables['last_condition_type'] = condition_type

                outcomes = node_data.get('outcomes') or []
                if isinstance(outcomes, list) and len(outcomes) >= 2:
                    chosen_outcome = outcomes[0] if condition_result else outcomes[1]
                else:
                    chosen_outcome = 'true' if condition_result else 'false'

                next_nodes = self.data_service.get_next_nodes(context.current_node_id, chosen_outcome)

                if next_nodes:
                    context.current_node_id = next_nodes[0]
                else:
                    # try default edge
                    next_nodes = self.data_service.get_next_nodes(context.current_node_id)
                    if next_nodes:
                        context.current_node_id = next_nodes[0]
                    else:
                        # no edges - hand off to appropriate agent based on condition type
                        result.status = ExecutionStatus.COMPLETED
                        result.should_use_agent = True
                        result.agent_type = get_agent_for_node(node_type, node_data)
                        logger.info(f"Condition completed, handing to {result.agent_type} agent")
                        break

            elif node_type == NodeType.INTENT_ROUTER:
                # detect user intent and route
                intents_raw = node_data.get('intents', []) or []
                default_outcome = node_data.get('defaultOutcome') or ''
                intents = []
                for i in intents_raw:
                    # canonical TS uses `name`; legacy uses `id`
                    intent_id = i.get('id') or i.get('name') or ''
                    intents.append({
                        'id': intent_id,
                        'description': i.get('description', ''),
                        'keywords': i.get('keywords', []) or [],
                        'isDefault': bool(default_outcome and intent_id == default_outcome),
                    })

                detected_intent = await self._detect_intent(
                    context.user_message,
                    intents,
                    context,
                    result.variables
                )

                result.variables['detected_intent'] = detected_intent

                # find matching edge
                next_nodes = self.data_service.get_next_nodes(
                    context.current_node_id,
                    detected_intent
                )

                if next_nodes:
                    context.current_node_id = next_nodes[0]
                else:
                    # try default edge
                    next_nodes = self.data_service.get_next_nodes(context.current_node_id)
                    if next_nodes:
                        context.current_node_id = next_nodes[0]
                    else:
                        # no edges - use triage agent to handle the detected intent
                        result.status = ExecutionStatus.COMPLETED
                        result.should_use_agent = True
                        result.agent_type = AgentType.TRIAGE.value
                        logger.info(f"Intent router completed with intent '{detected_intent}', handing to triage agent")
                        break

            elif node_type == NodeType.WAIT_RESPONSE:
                # canonical TS: if resuming, treat current message as the answer and continue
                variable_name = node_data.get('variableName') or node_data.get('storeIn') or 'user_response'
                if context.variables.get("_workflow_resumed") and context.user_message:
                    result.variables[str(variable_name)] = context.user_message
                    next_nodes = self.data_service.get_next_nodes(context.current_node_id)
                    if next_nodes:
                        context.current_node_id = next_nodes[0]
                    else:
                        result.status = ExecutionStatus.COMPLETED
                        break
                else:
                    timeout_seconds = node_data.get('timeoutSeconds')
                    if timeout_seconds is None:
                        timeout_seconds = node_data.get('timeout', 300)

                    # Get timeout node ID if specified
                    timeout_node_id = node_data.get('timeoutNodeId') or node_data.get('onTimeoutNodeId')

                    result.status = ExecutionStatus.WAITING
                    result.current_node_id = context.current_node_id
                    result.variables['wait_started_at'] = datetime.now(timezone.utc).isoformat()
                    result.variables['wait_timeout'] = timeout_seconds
                    result.variables['wait_timeout_node_id'] = timeout_node_id
                    result.variables['wait_node_id'] = context.current_node_id

                    logger.info(f"⏱️ WAIT_RESPONSE: timeout={timeout_seconds}s, timeout_node={timeout_node_id}")
                    break

            elif node_type == NodeType.ASSIGN_TAG:
                # assign tags to contact
                tags = node_data.get('tags', [])
                action = node_data.get('action', 'add')

                if tags:
                    if action == 'add':
                        self.db.add_contact_tags(context.phone, tags)
                        result.tags_assigned.extend(tags)
                    elif action == 'remove':
                        self.db.remove_contact_tags(context.phone, tags)

                # move to next node
                next_nodes = self.data_service.get_next_nodes(context.current_node_id)
                if next_nodes:
                    context.current_node_id = next_nodes[0]
                else:
                    result.status = ExecutionStatus.COMPLETED
                    break

            elif node_type == NodeType.HANDOFF:
                # hand off to human or specialized agent
                handoff_type = node_data.get('handoffType', 'human')
                reason = node_data.get('reason', 'Solicitação de atendimento humano')

                if handoff_type == 'human':
                    self.db.set_human_takeover(context.phone, True, reason)
                    result.status = ExecutionStatus.HANDOFF
                    result.handoff_reason = reason
                    # Also set agent for potential AI support before human takes over
                    result.should_use_agent = True
                    result.agent_type = AgentType.SUPPORT.value

                    # send handoff message if specified
                    handoff_message = node_data.get('message')
                    if handoff_message:
                        formatted_msg = self._format_message(handoff_message, result.variables, context)
                        result.messages.append(formatted_msg)
                        if self.send_message_fn:
                            await self.send_message_fn(context.phone, formatted_msg)
                    break
                else:
                    # hand off to specialized agent using smart routing
                    result.should_use_agent = True
                    result.agent_type = get_agent_for_node(node_type, node_data)
                    logger.info(f"Handing off to specialized agent: {result.agent_type}")
                    result.status = ExecutionStatus.COMPLETED
                    break

            elif node_type == NodeType.END:
                # end workflow
                end_message = node_data.get('message')
                if end_message:
                    formatted_msg = self._format_message(end_message, result.variables, context)
                    result.messages.append(formatted_msg)
                    if self.send_message_fn:
                        await self.send_message_fn(context.phone, formatted_msg)

                result.status = ExecutionStatus.COMPLETED
                break

            else:
                logger.warning(f"Unknown node type: {node_type}")
                # try to continue to next node
                next_nodes = self.data_service.get_next_nodes(context.current_node_id)
                if next_nodes:
                    context.current_node_id = next_nodes[0]
                else:
                    result.status = ExecutionStatus.COMPLETED
                    break

        if iterations >= max_iterations:
            logger.error("Workflow execution exceeded max iterations")
            result.status = ExecutionStatus.ERROR
            result.error_message = "Workflow exceeded max iterations"

        return result

    def _format_message(self, template: str, variables: Dict[str, Any], context: WorkflowContext) -> str:
        """
        format a message template with variables
        """
        # add context variables
        all_vars = {
            'user_name': context.user_name or 'Cliente',
            'user_phone': context.phone,
            **variables
        }

        return self.data_service.format_workflow_message(template, all_vars)

    def _generate_product_offer(
        self,
        product: Dict[str, Any],
        offer_type: str,
        node_data: Dict[str, Any],
        context: WorkflowContext
    ) -> str:
        """
        generate a product offer message
        """
        custom_message = node_data.get('message') or node_data.get('messageTemplate')
        if custom_message:
            return self._format_message(custom_message, {'current_product': product}, context)

        title = product.get('title', 'Produto')
        price = product.get('price', {}).get('formatted', '')
        main_benefit = product.get('salesContext', {}).get('mainBenefit', '')
        description = product.get('description', '')[:200]

        if offer_type == 'free':
            lines = [
                f"🎁 Tenho um presente especial para você!\n",
                f"*{title}* - GRATUITO!\n"
            ]
            if main_benefit:
                lines.append(f"✨ {main_benefit}\n")
            lines.append("Quer receber agora? 😊")

        elif offer_type == 'upsell':
            lines = [
                f"🚀 Que tal turbinar seus resultados?\n",
                f"Conheça o *{title}*\n"
            ]
            if price:
                lines.append(f"💳 Por apenas {price}\n")
            if main_benefit:
                lines.append(f"✨ {main_benefit}\n")
            lines.append("Interesse? 🎯")

        elif offer_type == 'downsell':
            lines = [
                f"💡 Tenho outra opção que pode te interessar!\n",
                f"*{title}*\n"
            ]
            if price:
                lines.append(f"💳 Apenas {price}\n")
            if main_benefit:
                lines.append(f"✨ {main_benefit}\n")
            lines.append("O que acha? 😊")

        else:  # 'paid' or default
            lines = [
                f"🎯 Apresento o *{title}*!\n"
            ]
            if description:
                lines.append(f"{description}...\n")
            if main_benefit:
                lines.append(f"✨ Principal benefício: {main_benefit}\n")
            if price:
                lines.append(f"💳 Investimento: {price}\n")
            lines.append("Posso te ajudar com mais informações? 😊")

        return '\n'.join(lines)

    async def _evaluate_condition(
        self,
        condition_type: str,
        condition: str,
        context: WorkflowContext,
        variables: Dict[str, Any]
    ) -> bool:
        """Evaluate a workflow condition"""
        try:
            if condition_type == 'variable':
                # simple variable check: "user_interested == true"
                parts = condition.split()
                if len(parts) >= 3:
                    var_name = parts[0]
                    operator = parts[1]
                    expected = ' '.join(parts[2:]).strip('"\'')

                    actual = str(variables.get(var_name, ''))

                    if operator == '==':
                        return actual.lower() == expected.lower()
                    elif operator == '!=':
                        return actual.lower() != expected.lower()
                    elif operator == 'contains':
                        return expected.lower() in actual.lower()

            elif condition_type == 'message_contains':
                # check if user message contains keywords
                keywords = condition.split(',')
                message_lower = context.user_message.lower()
                return any(kw.strip().lower() in message_lower for kw in keywords)

            elif condition_type == 'llm' and self.llm_evaluator:
                # use LLM to evaluate natural language condition
                result = await self.llm_evaluator(
                    condition,
                    context.user_message,
                    ['true', 'false']
                )
                return result.lower() == 'true'

            elif condition_type == 'has_product':
                # check if user has expressed interest in product
                product_id = condition
                return product_id in [str(variables.get('current_product_id', ''))]

            elif condition_type == 'user_said_yes':
                # check for affirmative response
                affirmatives = ['sim', 'quero', 'ok', 'pode', 'claro', 'yes', 'bora', 'vamos']
                return any(aff in context.user_message.lower() for aff in affirmatives)

            elif condition_type == 'user_said_no':
                # check for negative response
                negatives = ['não', 'nao', 'no', 'nunca', 'nem', 'prefiro não']
                return any(neg in context.user_message.lower() for neg in negatives)

            # default: use simple keyword matching
            return condition.lower() in context.user_message.lower()

        except Exception as e:
            logger.error(f"Condition evaluation error: {e}")
            return False

    async def _detect_intent(
        self,
        message: str,
        intents: List[Dict[str, Any]],
        context: WorkflowContext,
        variables: Dict[str, Any]
    ) -> str:
        """
        detect user intent from message
        """
        message_lower = message.lower()

        # first try keyword matching
        for intent in intents:
            intent_id = intent.get('id', '')
            keywords = intent.get('keywords', [])

            if any(kw.lower() in message_lower for kw in keywords):
                logger.info(f"Detected intent via keywords: {intent_id}")
                return intent_id

        # fall back to LLM if available
        if self.llm_evaluator:
            intent_ids = [i.get('id', '') for i in intents if i.get('id')]
            intent_descriptions = [
                f"{i.get('id', '')}: {i.get('description', '')}"
                for i in intents if i.get('id')
            ]

            prompt = f"Given the user message and these possible intents, which one best matches?\n\nIntents:\n" + \
                     '\n'.join(intent_descriptions) + \
                     f"\n\nUser message: {message}\n\nRespond with just the intent ID."

            try:
                result = await self.llm_evaluator(prompt, message, intent_ids)
                if result in intent_ids:
                    logger.info(f"Detected intent via LLM: {result}")
                    return result
            except Exception as e:
                logger.warning(f"LLM intent detection failed: {e}")

        # default intent
        default_intent = next((i.get('id') for i in intents if i.get('isDefault')), None)
        if default_intent:
            logger.info(f"Using default intent: {default_intent}")
            return default_intent

        return 'unknown'

    async def _save_execution_state(self, phone: str, result: WorkflowExecutionResult):
        """
        save workflow execution state to Firestore
        """
        workflow = self.data_service.get_active_workflow()
        if not workflow:
            return

        execution_state = {
            'workflowId': workflow.get('id'),
            'workflowName': workflow.get('name'),
            'currentNodeId': result.current_node_id,
            'status': result.status.value,
            'variables': result.variables,
            'productsOffered': result.products_offered,
            'tagsAssigned': result.tags_assigned,
            'infoCollected': result.info_collected,
            'startedAt': result.variables.get('workflow_started_at', datetime.now(timezone.utc).isoformat()),
            'updatedAt': datetime.now(timezone.utc).isoformat()
        }

        self.db.update_workflow_execution(phone, execution_state)
        logger.info(f"Saved workflow execution state for {phone} at node {result.current_node_id}")


async def create_llm_evaluator(openai_client: Any = None) -> Callable[[str, str, List[str]], Awaitable[str]]:
    """
    create an LLM evaluator function for conditions
    args:
        openai_client: Optional OpenAI client instance
    returns:
        async function that evaluates conditions using LLM
    """
    async def evaluate(condition: str, user_message: str, options: List[str]) -> str:
        """
        evaluate a condition using LLM
        args:
            condition: The condition to evaluate
            user_message: User's message
            options: Possible output options
        returns:
            one of the options
        """
        if not openai_client:
            # fall back to simple keyword matching
            for option in options:
                if option.lower() in user_message.lower():
                    return option
            return options[0] if options else 'unknown'

        try:
            prompt = f"""Given this condition and user message, respond with exactly one of these options: {', '.join(options)}

Condition: {condition}
User message: {user_message}

Your response (just the option, nothing else):"""

            response = await openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are a classifier. Respond with exactly one word from the given options."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=10,
                temperature=0
            )

            result = response.choices[0].message.content.strip().lower()

            # match to closest option
            for option in options:
                if option.lower() in result or result in option.lower():
                    return option

            return options[0] if options else 'unknown'

        except Exception as e:
            logger.error(f"LLM evaluation error: {e}")
            return options[0] if options else 'unknown'

    return evaluate
