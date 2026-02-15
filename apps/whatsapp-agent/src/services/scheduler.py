"""
Scheduler Service - Time-based follow-ups and conversation recovery

Enables:
- Scheduled follow-up messages (e.g., 24 hours after last message)
- Abandoned cart recovery
- Re-engagement campaigns
- Conversation history restoration

Based on OpenAI Agents SDK best practices for:
- Session management (SQLiteSession for persistence)
- Conversation history restoration from Firestore
"""

import os
import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Callable, Awaitable
from dataclasses import dataclass
from enum import Enum

logger = logging.getLogger(__name__)


class ScheduledTaskType(str, Enum):
    """Types of scheduled tasks"""
    FOLLOW_UP = "follow_up"               # Generic follow-up message
    CART_RECOVERY = "cart_recovery"       # Abandoned checkout recovery
    RE_ENGAGEMENT = "re_engagement"       # Re-engage inactive users
    WORKFLOW_TIMER = "workflow_timer"     # Workflow timer-based trigger
    NURTURE = "nurture"                   # Lead nurturing sequence


class ScheduledTaskStatus(str, Enum):
    """Status of scheduled tasks"""
    PENDING = "pending"
    EXECUTING = "executing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


@dataclass
class ScheduledTask:
    """A scheduled task to be executed at a specific time"""
    id: str
    creator_id: str
    phone: str
    task_type: ScheduledTaskType
    scheduled_for: datetime
    status: ScheduledTaskStatus
    payload: Dict[str, Any]
    created_at: datetime
    executed_at: Optional[datetime] = None
    error_message: Optional[str] = None

    # Optional context for re-engagement
    conversation_context: Optional[Dict[str, Any]] = None
    last_message_at: Optional[datetime] = None

    def to_dict(self) -> Dict[str, Any]:
        """
        convert to dictionary for Firestore storage
        """
        return {
            "id": self.id,
            "creatorId": self.creator_id,
            "phone": self.phone,
            "taskType": self.task_type.value,
            "scheduledFor": self.scheduled_for,
            "status": self.status.value,
            "payload": self.payload,
            "createdAt": self.created_at,
            "executedAt": self.executed_at,
            "errorMessage": self.error_message,
            "conversationContext": self.conversation_context,
            "lastMessageAt": self.last_message_at,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ScheduledTask":
        """
        create from Firestore document
        """
        # handle Firestore timestamps
        def parse_timestamp(val):
            if val is None:
                return None
            if hasattr(val, 'toDate'):
                return val.toDate()
            if isinstance(val, datetime):
                return val
            return datetime.fromisoformat(val) if isinstance(val, str) else None

        return cls(
            id=data.get("id", ""),
            creator_id=data.get("creatorId", ""),
            phone=data.get("phone", ""),
            task_type=ScheduledTaskType(data.get("taskType", "follow_up")),
            scheduled_for=parse_timestamp(data.get("scheduledFor")) or datetime.now(),
            status=ScheduledTaskStatus(data.get("status", "pending")),
            payload=data.get("payload", {}),
            created_at=parse_timestamp(data.get("createdAt")) or datetime.now(),
            executed_at=parse_timestamp(data.get("executedAt")),
            error_message=data.get("errorMessage"),
            conversation_context=data.get("conversationContext"),
            last_message_at=parse_timestamp(data.get("lastMessageAt")),
        )


class SchedulerService:
    """
    Manages scheduled tasks and conversation recovery

    Usage:
        scheduler = SchedulerService(firestore_adapter, send_message_fn)

        # Schedule a follow-up
        await scheduler.schedule_follow_up(
            phone="+5511999999999",
            delay_hours=24,
            message="Hey! Just checking in - did you have any questions?",
            task_type=ScheduledTaskType.FOLLOW_UP
        )

        # Process due tasks (called by cron)
        await scheduler.process_due_tasks()

        # Recover conversation context
        context = await scheduler.get_conversation_context(phone)
    """

    def __init__(
        self,
        firestore_adapter: Any,
        send_message_fn: Callable[[str, str], Awaitable[bool]],
        creator_id: Optional[str] = None
    ):
        self.db = firestore_adapter
        self.send_message = send_message_fn
        self.creator_id = creator_id or os.getenv("DEFAULT_CREATOR_ID", "default_creator")

        # Collection paths
        self._scheduled_tasks_collection = "scheduled_tasks"
        self._conversation_history_collection = "conversation_history"

    # ===== SCHEDULING METHODS =====

    async def schedule_follow_up(
        self,
        phone: str,
        delay_hours: float,
        message: str,
        task_type: ScheduledTaskType = ScheduledTaskType.FOLLOW_UP,
        product_id: Optional[str] = None,
        workflow_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Schedule a follow-up message to be sent after a delay

        Args:
            phone: Recipient phone number
            delay_hours: Hours to wait before sending
            message: Message to send
            task_type: Type of task (follow_up, cart_recovery, etc.)
            product_id: Optional product ID for context
            workflow_id: Optional workflow ID for workflow-based triggers
            metadata: Optional additional metadata

        Returns:
            Task ID
        """
        import uuid

        task_id = f"task_{uuid.uuid4().hex[:12]}"
        scheduled_for = datetime.now() + timedelta(hours=delay_hours)

        # get current conversation context for context-aware follow-ups
        conversation_context = await self._get_conversation_snapshot(phone)

        task = ScheduledTask(
            id=task_id,
            creator_id=self.creator_id,
            phone=phone,
            task_type=task_type,
            scheduled_for=scheduled_for,
            status=ScheduledTaskStatus.PENDING,
            payload={
                "message": message,
                "productId": product_id,
                "workflowId": workflow_id,
                "metadata": metadata or {}
            },
            created_at=datetime.now(),
            conversation_context=conversation_context,
            last_message_at=datetime.now()
        )

        # save to Firestore
        self._save_task(task)

        logger.info(f"📅 Scheduled {task_type.value} for {phone} at {scheduled_for}")
        return task_id

    async def schedule_cart_recovery(
        self,
        phone: str,
        product_id: str,
        product_name: str,
        product_price: str,
        delay_hours: float = 24.0
    ) -> str:
        """
        Schedule an abandoned cart recovery message

        Args:
            phone: Customer phone number
            product_id: ID of the product they were interested in
            product_name: Name of the product
            product_price: Formatted price
            delay_hours: Hours to wait before sending (default 24)

        Returns:
            Task ID
        """
        # craft a personalized recovery message
        message = (
            f"Oi! 👋\n\n"
            f"Vi que você estava interessado(a) no *{product_name}*.\n\n"
            f"💳 Valor: {product_price}\n\n"
            f"Posso te ajudar a finalizar? Ainda tem alguma dúvida? 😊"
        )

        return await self.schedule_follow_up(
            phone=phone,
            delay_hours=delay_hours,
            message=message,
            task_type=ScheduledTaskType.CART_RECOVERY,
            product_id=product_id,
            metadata={
                "productName": product_name,
                "productPrice": product_price
            }
        )

    async def schedule_workflow_timeout(
        self,
        phone: str,
        workflow_id: str,
        node_id: str,
        timeout_seconds: int,
        timeout_node_id: Optional[str] = None,
    ) -> str:
        """
        Schedule a workflow timeout task for WAIT_RESPONSE nodes.
        When the timeout expires, the workflow will resume at timeout_node_id
        or end if no timeout node is specified.

        Args:
            phone: Customer phone number
            workflow_id: Current workflow ID
            node_id: Current WAIT_RESPONSE node ID
            timeout_seconds: Seconds to wait before triggering timeout
            timeout_node_id: Node to jump to on timeout (optional)

        Returns:
            Task ID
        """
        import uuid

        task_id = f"wftimeout_{uuid.uuid4().hex[:12]}"
        scheduled_for = datetime.now() + timedelta(seconds=timeout_seconds)

        # get current conversation context
        conversation_context = await self._get_conversation_snapshot(phone)

        task = ScheduledTask(
            id=task_id,
            creator_id=self.creator_id,
            phone=phone,
            task_type=ScheduledTaskType.WORKFLOW_TIMER,
            scheduled_for=scheduled_for,
            status=ScheduledTaskStatus.PENDING,
            payload={
                "workflowId": workflow_id,
                "nodeId": node_id,
                "timeoutNodeId": timeout_node_id,
                "action": "timeout",
            },
            created_at=datetime.now(),
            conversation_context=conversation_context,
            last_message_at=datetime.now()
        )

        # save to Firestore
        self._save_task(task)

        logger.info(f"⏱️ Scheduled workflow timeout for {phone} in {timeout_seconds}s (node: {node_id})")
        return task_id

    async def cancel_workflow_timeouts(self, phone: str) -> int:
        """
        Cancel all pending workflow timeout tasks for a phone number.
        Call this when user responds (auto-cancel timeout).

        Args:
            phone: Customer phone number

        Returns:
            Number of cancelled tasks
        """
        return await self.cancel_tasks_for_phone(
            phone=phone,
            task_types=[ScheduledTaskType.WORKFLOW_TIMER]
        )

    async def schedule_re_engagement(
        self,
        phone: str,
        delay_hours: float = 72.0,
        custom_message: Optional[str] = None
    ) -> str:
        """
        Schedule a re-engagement message for inactive users

        Args:
            phone: Customer phone number
            delay_hours: Hours to wait (default 72 = 3 days)
            custom_message: Optional custom message

        Returns:
            Task ID
        """
        message = custom_message or (
            "Oi! 👋\n\n"
            "Faz um tempinho que não nos falamos.\n\n"
            "Tem alguma novidade que eu possa te ajudar? 😊"
        )

        return await self.schedule_follow_up(
            phone=phone,
            delay_hours=delay_hours,
            message=message,
            task_type=ScheduledTaskType.RE_ENGAGEMENT
        )

    async def cancel_task(self, task_id: str) -> bool:
        """
        cancel a scheduled task
        """
        try:
            task_ref = self.db.db.collection(
                self._col(self._scheduled_tasks_collection)
            ).document(task_id)

            task_ref.update({
                "status": ScheduledTaskStatus.CANCELLED.value,
                "executedAt": datetime.now()
            })

            logger.info(f"❌ Cancelled task {task_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to cancel task {task_id}: {e}")
            return False

    async def cancel_tasks_for_phone(
        self,
        phone: str,
        task_types: Optional[List[ScheduledTaskType]] = None
    ) -> int:
        """
        Cancel all pending tasks for a phone number
        Useful when a customer responds and you don't want to send follow-ups

        Args:
            phone: Customer phone number
            task_types: Optional filter for specific task types

        Returns:
            Number of cancelled tasks
        """
        try:
            query = self.db.db.collection(
                self._col(self._scheduled_tasks_collection)
            ).where("phone", "==", phone).where(
                "status", "==", ScheduledTaskStatus.PENDING.value
            )

            if task_types:
                query = query.where(
                    "taskType", "in", [t.value for t in task_types]
                )

            cancelled = 0
            for doc in query.stream():
                doc.reference.update({
                    "status": ScheduledTaskStatus.CANCELLED.value,
                    "executedAt": datetime.now()
                })
                cancelled += 1

            if cancelled > 0:
                logger.info(f"❌ Cancelled {cancelled} pending task(s) for {phone}")

            return cancelled
        except Exception as e:
            logger.error(f"Failed to cancel tasks for {phone}: {e}")
            return 0

    # ===== TASK PROCESSING =====

    async def process_due_tasks(self, batch_size: int = 50) -> int:
        """
        Process all tasks that are due
        Should be called by a cron job (e.g., every 5 minutes)

        Args:
            batch_size: Maximum number of tasks to process

        Returns:
            Number of tasks processed
        """
        try:
            now = datetime.now()

            # Query pending tasks that are due
            query = self.db.db.collection(
                self._col(self._scheduled_tasks_collection)
            ).where("status", "==", ScheduledTaskStatus.PENDING.value).where(
                "scheduledFor", "<=", now
            ).limit(batch_size)

            processed = 0
            for doc in query.stream():
                task = ScheduledTask.from_dict(doc.to_dict())
                await self._execute_task(task)
                processed += 1

            if processed > 0:
                logger.info(f"✅ Processed {processed} scheduled task(s)")

            return processed
        except Exception as e:
            logger.error(f"Error processing due tasks: {e}")
            return 0

    async def _execute_task(self, task: ScheduledTask) -> bool:
        """
        execute a single scheduled task
        """
        task_ref = self.db.db.collection(
            self._col(self._scheduled_tasks_collection)
        ).document(task.id)

        try:
            # mark as executing
            task_ref.update({"status": ScheduledTaskStatus.EXECUTING.value})

            # check if user has responded since task was scheduled
            # if so, skip the task (they're already engaged)
            if await self._has_user_responded_since(task.phone, task.created_at):
                logger.info(f"⏭️ Skipping task {task.id} - user responded since scheduled")
                task_ref.update({
                    "status": ScheduledTaskStatus.CANCELLED.value,
                    "executedAt": datetime.now(),
                    "errorMessage": "User responded since scheduling"
                })
                return True

            # Handle WORKFLOW_TIMER tasks specially - update workflow state to timeout node
            if task.task_type == ScheduledTaskType.WORKFLOW_TIMER:
                await self._handle_workflow_timeout(task)
            else:
                # send the message for other task types
                message = task.payload.get("message", "")
                if message:
                    await self.send_message(task.phone, message)

                    # log the interaction
                    self.db.log_interaction(
                        task.phone,
                        "scheduled_message",
                        message,
                        source="scheduler",
                        metadata={
                            "taskId": task.id,
                            "taskType": task.task_type.value
                        }
                    )

            # mark as completed
            task_ref.update({
                "status": ScheduledTaskStatus.COMPLETED.value,
                "executedAt": datetime.now()
            })

            logger.info(f"✅ Executed task {task.id} ({task.task_type.value}) for {task.phone}")
            return True

        except Exception as e:
            logger.error(f"❌ Failed to execute task {task.id}: {e}")
            task_ref.update({
                "status": ScheduledTaskStatus.FAILED.value,
                "executedAt": datetime.now(),
                "errorMessage": str(e)
            })
            return False

    # ===== CONVERSATION HISTORY =====

    async def save_conversation_history(
        self,
        phone: str,
        messages: List[Dict[str, Any]],
        metadata: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        Save conversation history for later restoration
        Call this periodically or at conversation end

        Args:
            phone: Customer phone number
            messages: List of message dictionaries
            metadata: Optional metadata (stage, context, etc.)

        Returns:
            Success status
        """
        try:
            doc_ref = self.db.db.collection(
                self._col(self._conversation_history_collection)
            ).document(self._phone_to_doc_id(phone))

            doc_ref.set({
                "phone": phone,
                "creatorId": self.creator_id,
                "messages": messages[-50:],  # Keep last 50 messages
                "messageCount": len(messages),
                "metadata": metadata or {},
                "lastUpdated": datetime.now()
            }, merge=True)

            logger.debug(f"💾 Saved conversation history for {phone}")
            return True
        except Exception as e:
            logger.error(f"Failed to save conversation history: {e}")
            return False

    async def restore_conversation_history(
        self,
        phone: str
    ) -> Optional[List[Dict[str, Any]]]:
        """
        Restore conversation history from Firestore
        Use this when resuming a conversation after timeout

        Args:
            phone: Customer phone number

        Returns:
            List of messages or None if not found
        """
        try:
            doc_ref = self.db.db.collection(
                self._col(self._conversation_history_collection)
            ).document(self._phone_to_doc_id(phone))

            doc = doc_ref.get()
            if doc.exists:
                data = doc.to_dict()
                messages = data.get("messages", [])
                logger.info(f"📖 Restored {len(messages)} messages for {phone}")
                return messages

            return None
        except Exception as e:
            logger.error(f"Failed to restore conversation history: {e}")
            return None

    async def get_conversation_context(
        self,
        phone: str
    ) -> Optional[Dict[str, Any]]:
        """
        Get conversation context for a phone number
        Includes: last stage, interests, products discussed, etc.

        Args:
            phone: Customer phone number

        Returns:
            Context dictionary or None
        """
        try:
            # get conversation state
            state = await self.db.load_conversation_state(phone)

            # get contact info
            contact = self.db.get_contact(phone)

            # get conversation history
            history = await self.restore_conversation_history(phone)

            # build context
            context = {
                "stage": state.get("state", "novo") if state else "novo",
                "lastInteraction": state.get("updatedAt") if state else None,
                "userName": state.get("waUserName") if state else None,
                "interests": contact.get("interests") if contact else None,
                "tags": contact.get("tags", []) if contact else [],
                "wantsNotification": contact.get("wantsProductNotification", False) if contact else False,
                "messageCount": len(history) if history else 0,
                "lastMessages": history[-5:] if history else []
            }

            return context
        except Exception as e:
            logger.error(f"Failed to get conversation context: {e}")
            return None

    async def get_conversation_summary(
        self,
        phone: str
    ) -> str:
        """
        Get a text summary of the conversation for agent context
        Useful when restoring a conversation

        Args:
            phone: Customer phone number

        Returns:
            Summary text
        """
        context = await self.get_conversation_context(phone)
        if not context:
            return "Novo cliente, primeira interação."

        lines = []

        if context.get("userName"):
            lines.append(f"Nome: {context['userName']}")

        if context.get("stage"):
            stage_labels = {
                "novo": "Novo contato",
                "em_atendimento": "Em atendimento",
                "agendando": "Agendando consulta",
                "confirmando": "Confirmando agendamento",
                "concluido": "Concluido",
                "cliente": "Cliente ativo",
            }
            lines.append(f"Status: {stage_labels.get(context['stage'], context['stage'])}")

        if context.get("interests"):
            lines.append(f"Interesses: {context['interests'][:100]}")

        if context.get("tags"):
            lines.append(f"Tags: {', '.join(context['tags'][:5])}")

        if context.get("messageCount"):
            lines.append(f"Histórico: {context['messageCount']} mensagens")

        return "\n".join(lines) if lines else "Contexto não disponível."

    # ===== ABANDONED CART DETECTION =====

    async def detect_abandoned_checkouts(
        self,
        hours_threshold: float = 24.0
    ) -> List[Dict[str, Any]]:
        """
        Find users who started checkout but didn't complete

        Args:
            hours_threshold: Hours since last activity to consider abandoned

        Returns:
            List of abandoned checkout records
        """
        try:
            cutoff = datetime.now() - timedelta(hours=hours_threshold)

            # query conversations in 'confirmando' or 'agendando' state
            # that haven't been updated since cutoff
            query = self.db.db.collection(
                self._col("conversations")
            ).where("state", "in", ["confirmando", "agendando", "checkout", "negociando"]).where(
                "updatedAt", "<=", cutoff
            )

            abandoned = []
            for doc in query.stream():
                data = doc.to_dict()
                # check if we haven't already scheduled a recovery
                existing_task = self._get_pending_task(
                    data.get("phone"),
                    ScheduledTaskType.CART_RECOVERY
                )
                if not existing_task:
                    abandoned.append(data)

            logger.info(f"🔍 Found {len(abandoned)} abandoned checkout(s)")
            return abandoned
        except Exception as e:
            logger.error(f"Failed to detect abandoned checkouts: {e}")
            return []

    async def schedule_recovery_for_abandoned(
        self,
        delay_hours: float = 24.0
    ) -> int:
        """
        Schedule recovery messages for all abandoned checkouts
        Call this from a daily cron job

        Args:
            delay_hours: Hours to wait before sending recovery

        Returns:
            Number of recovery tasks scheduled
        """
        abandoned = await self.detect_abandoned_checkouts(hours_threshold=delay_hours)

        scheduled = 0
        for record in abandoned:
            phone = record.get("phone")
            context = record.get("context", {})
            last_product = context.get("lastProduct", {})

            if phone and last_product:
                await self.schedule_cart_recovery(
                    phone=phone,
                    product_id=last_product.get("id", ""),
                    product_name=last_product.get("title", "nosso produto"),
                    product_price=last_product.get("price", ""),
                    delay_hours=0  # send immediately since we already waited
                )
                scheduled += 1

        logger.info(f"📅 Scheduled {scheduled} cart recovery message(s)")
        return scheduled

    # ===== HELPER METHODS =====

    def _col(self, name: str) -> str:
        """
        get full collection path for creator
        """
        return f"creators/{self.creator_id}/{name}"

    def _phone_to_doc_id(self, phone: str) -> str:
        """
        convert phone to safe document ID
        """
        return phone.replace("+", "").replace("-", "").replace(" ", "")

    def _save_task(self, task: ScheduledTask) -> None:
        """
        save a task to Firestore
        """
        self.db.db.collection(
            self._col(self._scheduled_tasks_collection)
        ).document(task.id).set(task.to_dict())

    def _get_pending_task(
        self,
        phone: str,
        task_type: ScheduledTaskType
    ) -> Optional[ScheduledTask]:
        """
        check if there's already a pending task of this type for phone
        """
        try:
            query = self.db.db.collection(
                self._col(self._scheduled_tasks_collection)
            ).where("phone", "==", phone).where(
                "taskType", "==", task_type.value
            ).where(
                "status", "==", ScheduledTaskStatus.PENDING.value
            ).limit(1)

            for doc in query.stream():
                return ScheduledTask.from_dict(doc.to_dict())
            return None
        except:
            return None

    async def _get_conversation_snapshot(
        self,
        phone: str
    ) -> Optional[Dict[str, Any]]:
        """
        get current conversation state for context
        """
        try:
            state = await self.db.load_conversation_state(phone)
            return {
                "stage": state.get("state"),
                "context": state.get("context", {}),
                "updatedAt": state.get("updatedAt")
            } if state else None
        except:
            return None

    async def _has_user_responded_since(
        self,
        phone: str,
        since: datetime
    ) -> bool:
        """
        check if user has sent any message since a given time
        """
        try:
            state = await self.db.load_conversation_state(phone)
            if not state:
                return False

            updated_at = state.get("updatedAt")
            if hasattr(updated_at, 'toDate'):
                updated_at = updated_at.toDate()

            return updated_at and updated_at > since
        except:
            return False

    async def _handle_workflow_timeout(self, task: ScheduledTask) -> None:
        """
        Handle a workflow timeout task.
        Updates the workflow execution state to jump to the timeout node,
        or sends a timeout message and clears the workflow state.
        """
        try:
            workflow_id = task.payload.get("workflowId")
            node_id = task.payload.get("nodeId")
            timeout_node_id = task.payload.get("timeoutNodeId")

            logger.info(f"⏱️ Handling workflow timeout for {task.phone} (node: {node_id})")

            if timeout_node_id:
                # Update workflow execution state to jump to timeout node
                self.db.update_workflow_execution(task.phone, {
                    "workflowId": workflow_id,
                    "currentNodeId": timeout_node_id,
                    "status": "running",
                    "variables": {
                        "_timeout_triggered": True,
                        "_timed_out_from_node": node_id,
                    },
                    "updatedAt": datetime.now().isoformat(),
                })
                logger.info(f"⏱️ Workflow timeout: jumping to node {timeout_node_id}")

                # Send a timeout message to user
                timeout_message = "Opa, parece que você está ocupado(a). Quando tiver um tempinho, me chama que continuo te ajudando!"
                await self.send_message(task.phone, timeout_message)

                self.db.log_interaction(
                    task.phone,
                    "workflow_timeout",
                    timeout_message,
                    source="scheduler",
                    metadata={
                        "taskId": task.id,
                        "workflowId": workflow_id,
                        "fromNode": node_id,
                        "toNode": timeout_node_id,
                    }
                )
            else:
                # No timeout node - clear workflow state and send gentle message
                self.db.clear_workflow_execution(task.phone)
                logger.info(f"⏱️ Workflow timeout: no timeout node, cleared workflow state")

                # Send a soft re-engagement message
                timeout_message = "Oi! Percebi que ficamos um tempo sem nos falar. Quando quiser continuar, é só me chamar!"
                await self.send_message(task.phone, timeout_message)

                self.db.log_interaction(
                    task.phone,
                    "workflow_timeout",
                    timeout_message,
                    source="scheduler",
                    metadata={
                        "taskId": task.id,
                        "workflowId": workflow_id,
                        "fromNode": node_id,
                        "action": "cleared",
                    }
                )

        except Exception as e:
            logger.error(f"❌ Failed to handle workflow timeout: {e}")
