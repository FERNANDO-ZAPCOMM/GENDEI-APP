"""
Firestore Adapter - Matches NestJS Backend Schema
Handles all database operations for WhatsApp agent conversations
"""

import os
import logging
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta
from google.cloud import firestore
from google.cloud.firestore_v1.base_query import FieldFilter  # type: ignore

from src.utils.helpers import ensure_phone_has_plus

logger = logging.getLogger(__name__)


class FirestoreAdapter:
    """
    Firestore adapter that matches the Schema v2 structure:
    structure:
    creators/{creatorId}/
        - profile (embedded in creator document)
        - channels/{channelId} (collection)
        - products/{productId} (collection)
        - conversations/{waUserId} (collection)
        - orders/{orderId} (collection)
        - messages/{messageId} (subcollection under conversations)
    server-only collections (root level):
    _tokens/{creatorId}
    _oauth/{sessionId}
    """

    def __init__(self, creator_id: str):
        """
        initialize Firestore adapter for a specific creator
        args:
            creator_id: The creator ID (formerly tenant_id)
        """
        self.creator_id = creator_id

        try:
            # Initialize Firestore client
            project_id = os.getenv('GOOGLE_CLOUD_PROJECT')
            if project_id:
                self.db = firestore.Client(project=project_id)
            else:
                self.db = firestore.Client()

            logger.info(f"✅ Firestore initialized for creator: {creator_id}")

        except Exception as e:
            logger.error(f"❌ Failed to initialize Firestore: {e}")
            raise

    # ===== STATE NORMALIZATION =====
    # Canonical conversation states are pt-BR (stored in Firestore).
    _STATE_CANONICAL_MAP: Dict[str, str] = {
        # Funnel stages (canonical)
        "novo": "novo",
        "qualificado": "qualificado",
        "negociando": "negociando",
        "checkout": "checkout",
        "fechado": "fechado",

        # Legacy/internal values (normalize to pt-BR canonical)
        "new": "novo",
        "engaged": "qualificado",
        "negotiating": "negociando",
        "purchased": "fechado",
        "closed": "fechado",
        "workflow_active": "workflow_ativo",
        "selecting_product": "selecionando_produto",
        "browsing": "navegando",
        # Canonical internal pt-BR
        "workflow_ativo": "workflow_ativo",
        "selecionando_produto": "selecionando_produto",
        "navegando": "navegando",
    }

    @classmethod
    def normalize_conversation_state(cls, raw_state: Optional[str]) -> str:
        """
        Normalize any known conversation state value to the canonical pt-BR string.
        Defaults to 'novo' when missing/unknown.
        """
        if not raw_state:
            return "novo"
        return cls._STATE_CANONICAL_MAP.get(raw_state, raw_state)


    # ===== CREATOR & PROFILE =====
    def get_creator_ref(self):
        """
        get creator document reference (Schema v2: creators/{creatorId})
        """
        return self.db.collection('creators').document(self.creator_id)

    def get_creator_data(self) -> Optional[Dict[str, Any]]:
        """
        get creator data
        """
        try:
            doc = self.get_creator_ref().get()
            if doc.exists:
                return doc.to_dict()
            return None
        except Exception as e:
            logger.error(f"Error getting creator data: {e}")
            return None

    def get_creator_profile(self) -> Optional[Dict[str, Any]]:
        """
        get creator profile (Schema v2: profile is embedded in creator document)
        returns:
            Dict with keys: displayName, voiceStyle, speakingPerspective,
            toneAttributes, keyPhrases, primaryLanguage, bio, etc.
        """
        try:
            # Schema v2: profile is embedded in creator.profile
            creator_doc = self.get_creator_ref().get()

            if creator_doc.exists:
                creator_data = creator_doc.to_dict()
                profile = creator_data.get('profile', {})

                # merge with name if available
                if 'name' in creator_data:
                    profile['displayName'] = profile.get('displayName', creator_data['name'])

                logger.info(f"✅ Loaded creator profile for {self.creator_id}: {profile.get('displayName', 'Unknown')}")
                return profile
            else:
                logger.warning(f"No creator found for {self.creator_id}")
                return None

        except Exception as e:
            logger.error(f"Error loading creator profile: {e}")
            return None


    # ===== CHANNELS (WhatsApp Connections) =====
    def get_active_channel(self, phone_number_id: str) -> Optional[Dict[str, Any]]:
        """
        get active WhatsApp channel by phone number ID
        args:
            phone_number_id: WhatsApp phone number ID
        returns:
            channel data with accessToken, wabaId, phoneNumber, etc.
        """
        try:
            channels_ref = self.get_creator_ref().collection('channels')
            query = channels_ref.where(
                filter=FieldFilter('phoneNumberId', '==', phone_number_id)
            ).where(
                filter=FieldFilter('isActive', '==', True)
            ).limit(1)

            docs = query.stream()
            for doc in docs:
                channel = doc.to_dict()
                channel['id'] = doc.id
                return channel

            return None

        except Exception as e:
            logger.error(f"Error getting channel: {e}")
            return None

    def list_active_channels(self) -> List[Dict[str, Any]]:
        """
        get all active WhatsApp channels for this creator
        """
        try:
            channels_ref = self.get_creator_ref().collection('channels')
            query = channels_ref.where(filter=FieldFilter('isActive', '==', True))

            channels = []
            for doc in query.stream():
                channel = doc.to_dict()
                channel['id'] = doc.id
                channels.append(channel)

            return channels

        except Exception as e:
            logger.error(f"Error listing channels: {e}")
            return []

    def get_first_active_channel(self) -> Optional[Dict[str, Any]]:
        """
        get the first active WhatsApp channel for this creator
        useful when processing payments where we don't have a specific phone_number_id
        returns:
            channel data with accessToken, wabaId, phoneNumberId, etc. or None
        """
        try:
            channels_ref = self.get_creator_ref().collection('channels')
            query = channels_ref.where(
                filter=FieldFilter('isActive', '==', True)
            ).limit(1)

            for doc in query.stream():
                channel = doc.to_dict()
                channel['id'] = doc.id
                logger.info(f"✅ Found first active channel: {channel.get('phoneNumberId', 'unknown')}")
                return channel

            logger.warning("⚠️ No active channels found for creator")
            return None

        except Exception as e:
            logger.error(f"Error getting first active channel: {e}")
            return None


    # ===== PRODUCTS =====
    def list_active_products(self) -> List[Dict[str, Any]]:
        """
        get all active products for this creator
        returns:
            list of products matching Product entity structure
        """
        try:
            # Schema v2: products collection (renamed from digital_products)
            products_ref = self.get_creator_ref().collection('products')

            # debug: first get ALL products to see what's in the collection
            all_products_query = products_ref.stream()
            all_products = []
            for doc in all_products_query:
                p = doc.to_dict()
                p['id'] = doc.id
                all_products.append(p)
                logger.info(f"📦 Found product: {p.get('title', 'Unknown')} - isActive={p.get('isActive')}")

            logger.info(f"📊 Total products in collection (any status): {len(all_products)}")

            # now filter for active ones
            query = products_ref.where(
                filter=FieldFilter('isActive', '==', True)
            )

            products = []
            for doc in query.stream():
                product = doc.to_dict()
                product['id'] = doc.id
                products.append(product)

            logger.info(f"✅ Loaded {len(products)} ACTIVE products for creator {self.creator_id}")
            return products

        except Exception as e:
            logger.error(f"❌ Error loading products: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return []

    def get_product_by_id(self, product_id: str) -> Optional[Dict[str, Any]]:
        """
        get a specific product by ID
        """
        try:
            product_ref = (
                self.get_creator_ref()
                .collection('products')
                .document(product_id)
            )
            doc = product_ref.get()

            if doc.exists:
                product = doc.to_dict()
                product['id'] = doc.id
                return product

            return None

        except Exception as e:
            logger.error(f"Error getting product {product_id}: {e}")
            return None


    # ===== CONVERSATIONS =====
    async def load_conversation_state(self, wa_user_id: str) -> Dict[str, Any]:
        """
        load conversation state for a WhatsApp user
        args:
            wa_user_id: WhatsApp user ID (phone number)
        returns:
            conversation state matching Conversation entity
        """
        # normalize phone number to always have + prefix (prevents duplicates)
        wa_user_id = ensure_phone_has_plus(wa_user_id)

        try:
            conv_ref = self.get_creator_ref().collection('conversations').document(wa_user_id)
            doc = conv_ref.get()

            if doc.exists:
                state = doc.to_dict()

                # convert Firestore timestamps to datetime
                if 'lastMessageAt' in state and state['lastMessageAt']:
                    state['lastMessageAt'] = state['lastMessageAt']
                if 'sessionExpiresAt' in state and state['sessionExpiresAt']:
                    state['sessionExpiresAt'] = state['sessionExpiresAt']

                # normalize state values to canonical pt-BR
                state["state"] = self.normalize_conversation_state(state.get("state"))
                return state
            else:
                # create new conversation
                now = datetime.utcnow()
                new_state = {
                    'id': wa_user_id,
                    'creatorId': self.creator_id,
                    'waUserId': wa_user_id,
                    'state': 'novo',
                    'context': {},
                    'lastMessageAt': now,
                    'sessionExpiresAt': now + timedelta(minutes=15),
                    'isSessionActive': True,
                    'createdAt': now,
                    'updatedAt': now
                }

                # save to Firestore
                conv_ref.set(new_state)

                return new_state

        except Exception as e:
            logger.error(f"Error loading conversation state: {e}")
            # return minimal state
            return {
                'waUserId': wa_user_id,
                'creatorId': self.creator_id,
                'state': 'novo',
                'context': {},
                'isSessionActive': True
            }

    async def save_conversation_state(self, wa_user_id: str, state: Dict[str, Any]) -> bool:
        """
        save conversation state
        args:
            wa_user_id: WhatsApp user ID
            state: Conversation state to save
        """
        # normalize phone number to always have + prefix (prevents duplicates)
        wa_user_id = ensure_phone_has_plus(wa_user_id)

        try:
            conv_ref = self.get_creator_ref().collection('conversations').document(wa_user_id)

            # normalize state values to canonical pt-BR before persisting
            if "state" in state:
                state["state"] = self.normalize_conversation_state(state.get("state"))

            # update timestamps
            state['updatedAt'] = datetime.utcnow()
            state['lastMessageAt'] = datetime.utcnow()

            # merge with existing data
            conv_ref.set(state, merge=True)

            return True

        except Exception as e:
            logger.error(f"Error saving conversation state: {e}")
            return False


    # ===== ORDERS =====
    def create_order(self, order_data: Dict[str, Any]) -> Optional[str]:
        """
        create a new order
        args:
            order_data: order data matching Order entity
        returns:
            Order ID if successful
        """
        try:
            orders_ref = self.get_creator_ref().collection('orders')

            # add timestamps
            now = datetime.utcnow()
            order_data['createdAt'] = now
            order_data['updatedAt'] = now
            order_data['creatorId'] = self.creator_id

            # create order
            doc_ref = orders_ref.add(order_data)
            order_id = doc_ref[1].id

            logger.info(f"✅ Created order {order_id}")
            return order_id

        except Exception as e:
            logger.error(f"Error creating order: {e}")
            return None

    def update_order(self, order_id: str, updates: Dict[str, Any]) -> bool:
        """
        update an existing order
        """
        try:
            order_ref = self.get_creator_ref().collection('orders').document(order_id)
            updates['updatedAt'] = datetime.utcnow()
            order_ref.update(updates)
            return True
        except Exception as e:
            logger.error(f"Error updating order: {e}")
            return False

    def get_order_by_payment_id(self, payment_id: str) -> Optional[Dict[str, Any]]:
        """
        get order by payment ID
        """
        try:
            orders_ref = self.get_creator_ref().collection('orders')
            query = orders_ref.where(filter=FieldFilter('paymentId', '==', payment_id)).limit(1)

            for doc in query.stream():
                order = doc.to_dict()
                order['id'] = doc.id
                return order

            return None

        except Exception as e:
            logger.error(f"Error getting order by payment ID: {e}")
            return None


    # ===== MESSAGE LOGS =====
    MAX_MESSAGES_PER_CONVERSATION = 250  # Limit to prevent Firestore index issues

    def log_interaction(
        self,
        wa_user_id: str,
        message_type: str,
        content: str,
        source: str = "agent",
        metadata: Optional[Dict[str, Any]] = None
    ):
        """
        log a message interaction using single-document pattern
        all messages for a conversation are stored in ONE document as a map
        args:
            wa_user_id: WhatsApp user ID
            message_type: Type of message (text, audio, image, etc.)
            content: Message content
            source: 'human' or 'agent'
            metadata: Additional metadata
        """
        # normalize phone number to always have + prefix
        wa_user_id = ensure_phone_has_plus(wa_user_id)

        try:
            # schema v2: ALL messages in single document
            # path: creators/{creatorId}/conversations/{waUserId}/messages/chat_history
            chat_history_ref = (
                self.get_creator_ref()
                .collection('conversations')
                .document(wa_user_id)
                .collection('messages')
                .document('chat_history')
            )

            # create message with timestamp key
            timestamp = datetime.utcnow().isoformat()
            message_data = {
                'creatorId': self.creator_id,
                'waUserId': wa_user_id,
                'type': message_type,
                'content': content[:2000] if content else None,  # limit content size
                'source': source,
                'metadata': metadata or {},
                'timestamp': timestamp
            }

            # get current history
            doc = chat_history_ref.get()
            if doc.exists:
                current_messages = doc.to_dict().get('messages', {})
            else:
                current_messages = {}

            # add new message
            current_messages[timestamp] = message_data

            # keep only last N messages to prevent index limit issues
            if len(current_messages) > self.MAX_MESSAGES_PER_CONVERSATION:
                sorted_messages = sorted(
                    current_messages.items(),
                    key=lambda x: x[0],
                    reverse=True
                )[:self.MAX_MESSAGES_PER_CONVERSATION]
                current_messages = dict(sorted_messages)

            # save to single document
            chat_history_ref.set({
                'messages': current_messages,
                'lastUpdated': timestamp,
                'messageCount': len(current_messages),
                'creatorId': self.creator_id,
                'waUserId': wa_user_id
            }, merge=True)

            logger.debug(f"📝 Logged message for {wa_user_id} (total: {len(current_messages)})")

        except Exception as e:
            logger.error(f"Error logging interaction: {e}")

    def get_chat_history(self, wa_user_id: str, limit: int = 50) -> List[Dict[str, Any]]:
        """
        get chat history for a conversation
        args:
            wa_user_id: WhatsApp user ID
            limit: maximum number of messages to return
        returns:
            List of messages sorted by timestamp (oldest first)
        """
        # normalize phone number to always have + prefix
        wa_user_id = ensure_phone_has_plus(wa_user_id)

        try:
            chat_history_ref = (
                self.get_creator_ref()
                .collection('conversations')
                .document(wa_user_id)
                .collection('messages')
                .document('chat_history')
            )

            doc = chat_history_ref.get()
            if not doc.exists:
                return []

            messages_map = doc.to_dict().get('messages', {})

            # sort by timestamp (oldest first) and limit
            sorted_messages = sorted(
                messages_map.items(),
                key=lambda x: x[0]
            )[-limit:]

            # return as list of message objects
            return [msg for _, msg in sorted_messages]

        except Exception as e:
            logger.error(f"Error getting chat history: {e}")
            return []

    def clear_chat_history(self, wa_user_id: str) -> bool:
        """
        clear chat history for a conversation (used for cleanup/reset).
        """
        try:
            chat_history_ref = (
                self.get_creator_ref()
                .collection('conversations')
                .document(wa_user_id)
                .collection('messages')
                .document('chat_history')
            )
            chat_history_ref.delete()
            logger.info(f"🗑️ Cleared chat history for {wa_user_id}")
            return True
        except Exception as e:
            logger.error(f"Error clearing chat history: {e}")
            return False


    # ===== HUMAN TAKEOVER =====
    def is_human_takeover_enabled(self, wa_user_id: str) -> bool:
        """
        check if human takeover is enabled for this conversation
        Checks both 'isHumanTakeover' (dashboard) and 'humanTakeover' (agent) fields
        Also checks 'aiPaused' for additional safety
        """
        try:
            conv_ref = self.get_creator_ref().collection('conversations').document(wa_user_id)
            doc = conv_ref.get()

            if doc.exists:
                data = doc.to_dict()
                # Check all possible takeover flags (dashboard uses isHumanTakeover, agent uses humanTakeover)
                is_takeover = data.get('isHumanTakeover', False) or data.get('humanTakeover', False)
                ai_paused = data.get('aiPaused', False)
                return is_takeover or ai_paused

            return False

        except Exception as e:
            logger.error(f"Error checking human takeover: {e}")
            return False


    # ===== CONTACTS =====
    async def upsert_contact(
        self,
        phone: str,
        name: Optional[str] = None,
        profile_picture_url: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Optional[str]:
        """
        create or update a contact in the contacts collection
        args:
            phone: WhatsApp phone number (used as document ID)
            name: contact name from WhatsApp profile
            profile_picture_url: URL to profile picture
            metadata: additional metadata
        returns:
            contact id if successful
        """
        try:
            # use phone number as document ID (keep + to match conversation IDs)
            contact_id = phone.replace(' ', '')
            contact_ref = self.get_creator_ref().collection('contacts').document(contact_id)

            # check if contact exists
            doc = contact_ref.get()
            now = datetime.utcnow()

            if doc.exists:
                # update existing contact
                updates = {
                    'updatedAt': now,
                    'lastMessageAt': now,
                }

                # only update name if provided and different
                if name:
                    updates['name'] = name

                # only update profile picture if provided
                if profile_picture_url:
                    updates['profilePictureUrl'] = profile_picture_url

                # increment message count
                current_data = doc.to_dict()
                updates['messageCount'] = current_data.get('messageCount', 0) + 1

                contact_ref.update(updates)
                logger.info(f"👤 Updated contact {contact_id}: {name}")
            else:
                # create new contact
                contact_data = {
                    'id': contact_id,
                    'phone': phone,
                    'name': name,
                    'profilePictureUrl': profile_picture_url,
                    'creatorId': self.creator_id,
                    'source': 'whatsapp',
                    'messageCount': 1,
                    'tags': [],
                    'metadata': metadata or {},
                    'createdAt': now,
                    'updatedAt': now,
                    'lastMessageAt': now,
                }

                contact_ref.set(contact_data)
                logger.info(f"👤 Created new contact {contact_id}: {name}")

            return contact_id

        except Exception as e:
            logger.error(f"Error upserting contact: {e}")
            return None

    def get_contact(self, phone: str) -> Optional[Dict[str, Any]]:
        """
        get a contact by phone number
        args:
            phone: WhatsApp phone number
        returns:
            contact data if found
        """
        try:
            contact_id = phone.replace(' ', '')
            contact_ref = self.get_creator_ref().collection('contacts').document(contact_id)
            doc = contact_ref.get()

            if doc.exists:
                contact = doc.to_dict()
                contact['id'] = doc.id
                return contact

            return None

        except Exception as e:
            logger.error(f"Error getting contact: {e}")
            return None

    def update_contact_profile_picture(self, phone: str, profile_picture_url: str) -> bool:
        """
        update contact's profile picture URL
        args:
            phone: WhatsApp phone number
            profile_picture_url: URL to profile picture
        returns:
            True if successful
        """
        try:
            contact_id = phone.replace(' ', '')
            contact_ref = self.get_creator_ref().collection('contacts').document(contact_id)

            contact_ref.update({
                'profilePictureUrl': profile_picture_url,
                'updatedAt': datetime.utcnow()
            })

            logger.info(f"📸 Updated profile picture for contact {contact_id}")
            return True

        except Exception as e:
            logger.error(f"Error updating contact profile picture: {e}")
            return False

    async def update_contact_notification_preference(
        self,
        phone: str,
        wants_notification: bool,
        interests: Optional[str] = None
    ) -> bool:
        """
        update contact's notification preference for new products
        args:
            phone: WhatsApp phone number
            wants_notification: whether contact wants to be notified
            interests: optional interests/topics the contact mentioned
        returns:
            True if successful
        """
        try:
            contact_id = phone.replace(' ', '')
            contact_ref = self.get_creator_ref().collection('contacts').document(contact_id)

            updates = {
                'wantsProductNotification': wants_notification,
                'notificationOptInAt': datetime.utcnow() if wants_notification else None,
                'updatedAt': datetime.utcnow()
            }

            if interests:
                updates['interests'] = interests

            # check if contact exists, create if not
            doc = contact_ref.get()
            if doc.exists:
                contact_ref.update(updates)
            else:
                # create new contact with notification preference
                updates.update({
                    'id': contact_id,
                    'phone': phone,
                    'name': None,
                    'creatorId': self.creator_id,
                    'source': 'whatsapp',
                    'messageCount': 1,
                    'tags': ['notification_optin'] if wants_notification else [],
                    'createdAt': datetime.utcnow(),
                })
                contact_ref.set(updates)

            logger.info(f"🔔 Updated notification preference for {contact_id}: {wants_notification}")
            return True

        except Exception as e:
            logger.error(f"Error updating notification preference: {e}")
            return False


    # ===== WORKFLOWS =====
    def get_active_workflow(self) -> Optional[Dict[str, Any]]:
        """
        Get the active workflow for this creator
        Returns the most recently updated workflow with isActive=True
        """
        try:
            workflows_ref = self.get_creator_ref().collection('workflows')
            # Query for active workflows (no ordering to avoid composite index requirement)
            query = workflows_ref.where(
                filter=FieldFilter('isActive', '==', True)
            )

            # Get all active workflows and sort by updatedAt in Python
            # (avoids needing a composite index in Firestore)
            active_workflows = []
            for doc in query.stream():
                workflow = doc.to_dict()
                workflow['id'] = doc.id
                active_workflows.append(workflow)

            if not active_workflows:
                logger.info("ℹ️ No active workflow found for creator")
                return None

            # Sort by updatedAt descending to get the most recently updated
            active_workflows.sort(
                key=lambda w: w.get('updatedAt', w.get('createdAt', '')),
                reverse=True
            )

            workflow = active_workflows[0]
            logger.info(f"✅ Loaded active workflow: {workflow.get('name', 'Unknown')} (id={workflow['id']})")
            return workflow

        except Exception as e:
            logger.error(f"Error getting active workflow: {e}")
            return None

    def get_workflow_by_id(self, workflow_id: str) -> Optional[Dict[str, Any]]:
        """
        Get a specific workflow by ID
        """
        try:
            workflow_ref = self.get_creator_ref().collection('workflows').document(workflow_id)
            doc = workflow_ref.get()

            if doc.exists:
                workflow = doc.to_dict()
                workflow['id'] = doc.id
                return workflow

            return None

        except Exception as e:
            logger.error(f"Error getting workflow {workflow_id}: {e}")
            return None

    def get_workflow_execution(self, phone: str) -> Optional[Dict[str, Any]]:
        """
        Get current workflow execution state for a conversation
        Args:
            phone: WhatsApp phone number
        Returns:
            Workflow execution state if exists
        """
        try:
            conv_ref = self.get_creator_ref().collection('conversations').document(phone)
            doc = conv_ref.get()

            if doc.exists:
                data = doc.to_dict()
                context = data.get('context', {})
                execution = context.get('workflowExecution')
                if execution:
                    logger.info(f"📍 Found workflow execution for {phone}: node={execution.get('currentNodeId')}")
                return execution

            return None

        except Exception as e:
            logger.error(f"Error getting workflow execution: {e}")
            return None

    def update_workflow_execution(self, phone: str, execution: Dict[str, Any]) -> bool:
        """
        Update or create workflow execution state for a conversation
        Args:
            phone: WhatsApp phone number
            execution: Workflow execution state
        Returns:
            True if successful
        """
        try:
            conv_ref = self.get_creator_ref().collection('conversations').document(phone)

            # Update the context.workflowExecution field
            conv_ref.set({
                'context': {
                    'workflowExecution': execution
                },
                'updatedAt': datetime.utcnow()
            }, merge=True)

            logger.info(f"💾 Updated workflow execution for {phone}: node={execution.get('currentNodeId')}")
            return True

        except Exception as e:
            logger.error(f"Error updating workflow execution: {e}")
            return False

    def clear_workflow_execution(self, phone: str) -> bool:
        """
        Clear workflow execution state (workflow ended)
        Args:
            phone: WhatsApp phone number
        Returns:
            True if successful
        """
        try:
            conv_ref = self.get_creator_ref().collection('conversations').document(phone)

            # Clear the workflowExecution field
            conv_ref.set({
                'context': {
                    'workflowExecution': None
                },
                'updatedAt': datetime.utcnow()
            }, merge=True)

            logger.info(f"🗑️ Cleared workflow execution for {phone}")
            return True

        except Exception as e:
            logger.error(f"Error clearing workflow execution: {e}")
            return False

    def add_contact_tags(self, phone: str, tags: List[str]) -> bool:
        """
        Add tags to a contact
        Args:
            phone: WhatsApp phone number
            tags: List of tags to add
        Returns:
            True if successful
        """
        try:
            contact_id = phone.replace(' ', '')
            contact_ref = self.get_creator_ref().collection('contacts').document(contact_id)

            doc = contact_ref.get()
            if doc.exists:
                current_data = doc.to_dict()
                current_tags = set(current_data.get('tags', []))
                current_tags.update(tags)

                contact_ref.update({
                    'tags': list(current_tags),
                    'updatedAt': datetime.utcnow()
                })
            else:
                # Create contact with tags
                contact_ref.set({
                    'id': contact_id,
                    'phone': phone,
                    'creatorId': self.creator_id,
                    'source': 'whatsapp',
                    'tags': tags,
                    'createdAt': datetime.utcnow(),
                    'updatedAt': datetime.utcnow()
                })

            logger.info(f"🏷️ Added tags to contact {contact_id}: {tags}")
            return True

        except Exception as e:
            logger.error(f"Error adding contact tags: {e}")
            return False

    def remove_contact_tags(self, phone: str, tags: List[str]) -> bool:
        """
        Remove tags from a contact
        Args:
            phone: WhatsApp phone number
            tags: List of tags to remove
        Returns:
            True if successful
        """
        try:
            contact_id = phone.replace(' ', '')
            contact_ref = self.get_creator_ref().collection('contacts').document(contact_id)

            doc = contact_ref.get()
            if doc.exists:
                current_data = doc.to_dict()
                current_tags = set(current_data.get('tags', []))
                current_tags -= set(tags)

                contact_ref.update({
                    'tags': list(current_tags),
                    'updatedAt': datetime.utcnow()
                })

                logger.info(f"🏷️ Removed tags from contact {contact_id}: {tags}")
                return True

            return False

        except Exception as e:
            logger.error(f"Error removing contact tags: {e}")
            return False

    def set_human_takeover(self, phone: str, enabled: bool, reason: Optional[str] = None) -> bool:
        """
        Set human takeover status for a conversation
        Args:
            phone: WhatsApp phone number
            enabled: Whether to enable human takeover
            reason: Optional reason for handoff
        Returns:
            True if successful
        """
        try:
            conv_ref = self.get_creator_ref().collection('conversations').document(phone)

            updates = {
                'humanTakeover': enabled,
                'isHumanTakeover': enabled,  # Dashboard uses this field
                'handledBy': 'human' if enabled else 'ai',
                'aiPaused': enabled,
                'updatedAt': datetime.utcnow()
            }

            if enabled:
                updates['humanTakeoverAt'] = datetime.utcnow()
                updates['takenOverAt'] = datetime.utcnow()  # Dashboard uses this field
                if reason:
                    updates['humanTakeoverReason'] = reason

            conv_ref.set(updates, merge=True)

            logger.info(f"{'🙋' if enabled else '🤖'} Human takeover {'enabled' if enabled else 'disabled'} for {phone}")
            return True

        except Exception as e:
            logger.error(f"Error setting human takeover: {e}")
            return False
