import { getFirestore, Query, FieldValue } from 'firebase-admin/firestore';
import {
  Conversation,
  ConversationState,
  MessageDirection,
  MessageStatus,
  PaginationParams,
  PaginatedResponse,
  Collections,
} from '../types';

const db = getFirestore();

export interface ConversationFilters {
  creatorId?: string;
  state?: ConversationState;
  isHumanTakeover?: boolean;
  isSessionActive?: boolean;
  searchTerm?: string;
}

export interface MessageDocument {
  id: string;
  conversationId: string;
  creatorId: string;
  direction: MessageDirection;
  waMessageId: string | null;
  waUserId: string;
  phoneNumberId: string | null;
  payloadHash: string;
  payload: Record<string, unknown>;
  status: MessageStatus;
  error: string | null;
  idempotencyKey: string | null;
  createdAt: Date;
  // Frontend-compatible fields
  body: string;
  messageType: string;
  timestamp: Date;
  isAiGenerated: boolean;
  isHumanSent: boolean;
  deliveryStatus?: string;
  from: string;
  to: string;
}

export interface ConversationStats {
  totalConversations: number;
  activeConversations: number;
  humanTakeoverConversations: number;
  aiHandledConversations: number;
}

/**
 * Get conversations collection reference for a creator
 * Schema v2: creators/{creatorId}/conversations
 */
function getConversationsCollection(creatorId: string) {
  return db.collection(Collections.CREATORS).doc(creatorId).collection(Collections.CONVERSATIONS);
}

/**
 * Get messages collection reference for a conversation
 * Schema v2: creators/{creatorId}/conversations/{conversationId}/messages
 */
function getMessagesCollection(creatorId: string, conversationId: string) {
  return db
    .collection(Collections.CREATORS)
    .doc(creatorId)
    .collection(Collections.CONVERSATIONS)
    .doc(conversationId)
    .collection(Collections.MESSAGES);
}

/**
 * Serialize Firestore Timestamps to ISO strings
 */
function serializeConversation(conversation: Conversation): Conversation {
  const serialized: Record<string, unknown> = { ...conversation };

  // Convert Firestore Timestamps to ISO strings
  const dateFields = [
    'lastMessageAt',
    'sessionExpiresAt',
    'createdAt',
    'updatedAt',
    'takenOverAt',
  ];

  for (const field of dateFields) {
    const value = serialized[field] as {
      _seconds?: number;
      toDate?: () => Date;
    };
    if (value && typeof value === 'object' && '_seconds' in value) {
      serialized[field] = new Date(value._seconds! * 1000).toISOString();
    } else if (value instanceof Date) {
      serialized[field] = value.toISOString();
    }
  }

  // Handle nested timestamp in lastMessageSnapshot
  const snapshot = serialized.lastMessageSnapshot as {
    timestamp?: { _seconds?: number };
  };
  if (snapshot?.timestamp) {
    if (
      typeof snapshot.timestamp === 'object' &&
      '_seconds' in snapshot.timestamp
    ) {
      snapshot.timestamp = new Date(
        snapshot.timestamp._seconds! * 1000
      ).toISOString() as unknown as { _seconds?: number };
    }
  }

  return serialized as unknown as Conversation;
}

/**
 * Get all conversations with pagination support
 */
export async function getConversations(
  filters: ConversationFilters,
  pagination: PaginationParams = {}
): Promise<PaginatedResponse<Conversation>> {
  const creatorId = filters.creatorId;
  if (!creatorId) {
    throw new Error('creatorId is required');
  }
  const conversationsRef = getConversationsCollection(creatorId);
  const limit = pagination.limit || 20;

  let query: Query = conversationsRef;

  // Filter by state
  if (filters.state) {
    query = query.where('state', '==', filters.state);
  }

  // Filter by takeover status
  if (filters.isHumanTakeover !== undefined) {
    query = query.where('isHumanTakeover', '==', filters.isHumanTakeover);
  }

  // Filter by session active
  if (filters.isSessionActive !== undefined) {
    query = query.where('isSessionActive', '==', filters.isSessionActive);
  }

  // Apply ordering
  query = query.orderBy('lastMessageAt', 'desc');

  // Apply cursor if provided
  if (pagination.cursor) {
    const cursorDoc = await conversationsRef.doc(pagination.cursor).get();
    if (cursorDoc.exists) {
      query = query.startAfter(cursorDoc);
    }
  }

  // Fetch one extra document to check if there are more results
  query = query.limit(limit + 1);

  const snapshot = await query.get();
  const docs = snapshot.docs;

  const hasMore = docs.length > limit;
  const conversations = docs.slice(0, limit).map((doc) => {
    const data = doc.data() as Conversation;
    return serializeConversation({ ...data, id: doc.id });
  });
  const nextCursor = hasMore ? docs[limit - 1]?.id ?? null : null;

  // Apply search filter in memory
  let filteredConversations = conversations;
  if (filters.searchTerm) {
    const searchLower = filters.searchTerm.toLowerCase();
    filteredConversations = conversations.filter(
      (conv) =>
        conv.waUserName?.toLowerCase().includes(searchLower) ||
        conv.waUserPhone?.toLowerCase().includes(searchLower) ||
        conv.waUserId?.toLowerCase().includes(searchLower)
    );
  }

  return {
    data: filteredConversations,
    nextCursor,
    hasMore,
  };
}

/**
 * Get a single conversation
 */
export async function getConversation(
  creatorId: string,
  conversationId: string
): Promise<Conversation | null> {
  const conversationRef = getConversationsCollection(creatorId).doc(
    conversationId
  );

  const doc = await conversationRef.get();
  if (!doc.exists) {
    return null;
  }

  const conversation = doc.data() as Conversation;
  return serializeConversation({ ...conversation, id: doc.id });
}

/**
 * Get messages for a conversation
 * Supports both new single-document format and legacy individual documents
 */
export async function getMessages(
  creatorId: string,
  conversationId: string,
  limit: number = 100
): Promise<MessageDocument[]> {
  const messagesRef = getMessagesCollection(creatorId, conversationId);

  // Try new single-document format first (chat_history)
  const chatHistoryDoc = await messagesRef.doc('chat_history').get();

  if (chatHistoryDoc.exists) {
    // New format: all messages in a single document as a map
    const data = chatHistoryDoc.data();
    const messagesMap = data?.messages || {};

    // Helper function to process a message entry
    const processMessage = (timestamp: string, messageData: Record<string, unknown>): MessageDocument => {
      const isFromHuman = messageData.source === 'human';
      const isFromAgent = messageData.source === 'agent';
      const createdAt = new Date(messageData.timestamp as string || timestamp);

      // Extract body from various possible field names
      const messageBody = (messageData.content as string) ||
                         (messageData.body as string) ||
                         (messageData.text as string) || '';

      return {
        id: timestamp,
        conversationId,
        creatorId,
        direction: isFromHuman ? MessageDirection.INBOUND : MessageDirection.OUTBOUND,
        waMessageId: null,
        waUserId: messageData.waUserId as string || '',
        phoneNumberId: null,
        payloadHash: '',
        payload: {},
        status: MessageStatus.DELIVERED,
        error: null,
        idempotencyKey: null,
        createdAt,
        // Frontend-compatible fields
        body: messageBody,
        messageType: messageData.type as string || 'text',
        timestamp: createdAt,
        isAiGenerated: isFromAgent,
        isHumanSent: !isFromHuman && (messageData.isHumanSent as boolean || false),
        deliveryStatus: 'delivered',
        from: isFromHuman ? (messageData.waUserId as string || 'customer') : 'agent',
        to: isFromHuman ? 'agent' : (messageData.waUserId as string || 'customer'),
      } as MessageDocument;
    };

    // Convert map to array, handling both flat and nested structures
    // (nested happens when timestamp contains periods like 2026-01-08T23:27:07.054Z)
    const messages: MessageDocument[] = [];

    for (const [key, value] of Object.entries(messagesMap)) {
      const msgValue = value as Record<string, unknown>;

      // Check if this is a proper message (has 'source' or 'content' field)
      if (msgValue.source || msgValue.content) {
        // Direct message format
        messages.push(processMessage(key, msgValue));
      } else {
        // This might be a nested structure due to period in timestamp
        // e.g., key='2026-01-08T23:27:07' with nested '054Z' containing the actual message
        for (const [nestedKey, nestedValue] of Object.entries(msgValue)) {
          const nestedMsg = nestedValue as Record<string, unknown>;
          if (nestedMsg && typeof nestedMsg === 'object' && (nestedMsg.source || nestedMsg.content)) {
            // Reconstruct full timestamp: key + '.' + nestedKey
            const fullTimestamp = `${key}.${nestedKey}`;
            messages.push(processMessage(fullTimestamp, nestedMsg));
          }
        }
      }
    }

    // Sort by timestamp and apply limit
    messages.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    return messages.slice(-limit);
  }

  // Fallback: legacy format with individual documents
  const snapshot = await messagesRef
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get();

  const messages = snapshot.docs.map((doc) => {
    const data = doc.data();

    // Extract message text from payload or root-level body field
    let body = '';
    let messageType = 'text';

    if (data.payload?.text?.body) {
      body = data.payload.text.body;
    } else if (data.payload?.message?.text?.body) {
      body = data.payload.message.text.body;
    } else if (data.body) {
      // Fallback: check root-level body field (used by human-sent messages)
      body = data.body;
    }

    if (data.payload?.type) {
      messageType = data.payload.type;
    } else if (data.messageType) {
      messageType = data.messageType;
    }

    const isOutbound = data.direction === MessageDirection.OUTBOUND;
    const createdAt = data.createdAt?.toDate?.() || new Date(data.createdAt) || new Date();

    return {
      id: doc.id,
      conversationId,
      creatorId,
      direction: data.direction as MessageDirection,
      waMessageId: data.waMessageId || null,
      waUserId: data.waUserId || '',
      phoneNumberId: data.phoneNumberId || null,
      payloadHash: data.payloadHash || '',
      payload: data.payload || {},
      status: data.status as MessageStatus,
      error: data.error || null,
      idempotencyKey: data.idempotencyKey || null,
      createdAt,
      // Frontend-compatible fields
      body,
      messageType,
      timestamp: createdAt,
      isAiGenerated: isOutbound && !data.isFromHuman,
      isHumanSent: data.isFromHuman || false,
      deliveryStatus: data.status || 'delivered',
      from: isOutbound ? 'agent' : (data.waUserId || 'customer'),
      to: isOutbound ? (data.waUserId || 'customer') : 'agent',
    } as MessageDocument;
  });

  // Return in chronological order (oldest first)
  return messages.reverse();
}

/**
 * Take over a conversation from AI
 */
export async function takeoverConversation(
  creatorId: string,
  conversationId: string,
  userId: string
): Promise<Conversation> {
  const conversationRef = getConversationsCollection(creatorId).doc(
    conversationId
  );

  const doc = await conversationRef.get();
  if (!doc.exists) {
    throw new Error('Conversation not found');
  }

  const conversation = doc.data() as Conversation;

  const updatedConversation = {
    ...conversation,
    isHumanTakeover: true,
    aiPaused: true,
    takenOverAt: new Date(),
    takenOverBy: userId,
    updatedAt: new Date(),
  };

  await conversationRef.set(updatedConversation);

  console.log(`Conversation ${conversationId} taken over by user ${userId}`);

  return updatedConversation;
}

/**
 * Release a conversation back to AI
 */
export async function releaseConversation(
  creatorId: string,
  conversationId: string
): Promise<Conversation> {
  const conversationRef = getConversationsCollection(creatorId).doc(
    conversationId
  );

  const doc = await conversationRef.get();
  if (!doc.exists) {
    throw new Error('Conversation not found');
  }

  const conversation = doc.data() as Conversation;

  const updatedConversation = {
    ...conversation,
    isHumanTakeover: false,
    aiPaused: false,
    takenOverAt: FieldValue.delete(),
    takenOverBy: FieldValue.delete(),
    updatedAt: new Date(),
  };

  await conversationRef.update(updatedConversation);

  console.log(`Conversation ${conversationId} released back to AI`);

  // Fetch and return the updated document
  const updated = await conversationRef.get();
  return serializeConversation(updated.data() as Conversation);
}

/**
 * Send a message in a conversation
 * Only writes to chat_history document (no individual message documents)
 */
export async function sendMessage(
  creatorId: string,
  conversationId: string,
  messageText: string,
  userId: string
): Promise<MessageDocument> {
  // Verify conversation exists
  const conversation = await getConversation(creatorId, conversationId);
  if (!conversation) {
    throw new Error('Conversation not found');
  }

  const messagesRef = getMessagesCollection(creatorId, conversationId);
  const now = new Date();
  const waUserId = conversation.waUserId || conversation.contactPhone || '';
  const timestamp = now.toISOString();
  // Sanitize timestamp key by replacing periods with underscores to avoid Firestore nested path issues
  const timestampKey = timestamp.replace(/\./g, '_');

  // Build message document for return value
  const message: MessageDocument = {
    id: timestampKey,
    conversationId,
    creatorId,
    direction: MessageDirection.OUTBOUND,
    waMessageId: null,
    waUserId,
    phoneNumberId: null,
    payloadHash: '',
    payload: {},
    status: MessageStatus.QUEUED,
    error: null,
    idempotencyKey: null,
    createdAt: now,
    body: messageText,
    messageType: 'text',
    timestamp: now,
    isAiGenerated: false,
    isHumanSent: true,
    deliveryStatus: 'queued',
    from: 'agent',
    to: waUserId,
  };

  // Write to chat_history document only (optimized - no individual message documents)
  const chatHistoryRef = messagesRef.doc('chat_history');
  const chatHistoryDoc = await chatHistoryRef.get();
  const chatMessage = {
    source: 'agent',
    content: messageText,
    timestamp,
    type: 'text',
    waUserId,
    isHumanSent: true,
    status: 'queued',
  };

  if (chatHistoryDoc.exists) {
    await chatHistoryRef.update({
      [`messages.${timestampKey}`]: chatMessage,
      lastUpdated: timestamp,
      messageCount: FieldValue.increment(1),
    });
  } else {
    await chatHistoryRef.set({
      messages: { [timestampKey]: chatMessage },
      lastUpdated: timestamp,
      messageCount: 1,
      creatorId,
      waUserId,
    });
  }

  // Update conversation last message time
  const conversationRef = getConversationsCollection(creatorId).doc(
    conversationId
  );

  await conversationRef.update({
    lastMessageAt: now,
    lastMessagePreview: messageText.substring(0, 100),
    lastMessageSnapshot: {
      text: messageText.substring(0, 200),
      type: 'text',
      direction: 'outbound',
      timestamp: now,
    },
    updatedAt: now,
  });

  console.log(
    `Message sent by user ${userId} in conversation ${conversationId}`
  );

  return message;
}

/**
 * Get conversation statistics for a creator
 */
export async function getConversationStats(
  creatorId: string
): Promise<ConversationStats> {
  const result = await getConversations({ creatorId }, { limit: 10000 });
  const conversations = result.data;

  const totalConversations = conversations.length;
  const activeConversations = conversations.filter(
    (c) => c.isSessionActive
  ).length;
  const humanTakeoverConversations = conversations.filter(
    (c) => c.isHumanTakeover
  ).length;
  const aiHandledConversations = conversations.filter(
    (c) => !c.isHumanTakeover && c.isSessionActive
  ).length;

  return {
    totalConversations,
    activeConversations,
    humanTakeoverConversations,
    aiHandledConversations,
  };
}

/**
 * Archive a conversation (soft delete)
 */
export async function archiveConversation(
  creatorId: string,
  conversationId: string
): Promise<Conversation> {
  const conversationRef = getConversationsCollection(creatorId).doc(conversationId);
  const doc = await conversationRef.get();

  if (!doc.exists) {
    throw new Error('Conversation not found');
  }

  const now = new Date();
  await conversationRef.update({
    isArchived: true,
    archivedAt: now,
    updatedAt: now,
  });

  const updated = await conversationRef.get();
  return serializeConversation({
    id: updated.id,
    ...updated.data(),
  } as Conversation);
}

/**
 * Unarchive a conversation
 */
export async function unarchiveConversation(
  creatorId: string,
  conversationId: string
): Promise<Conversation> {
  const conversationRef = getConversationsCollection(creatorId).doc(conversationId);
  const doc = await conversationRef.get();

  if (!doc.exists) {
    throw new Error('Conversation not found');
  }

  const now = new Date();
  await conversationRef.update({
    isArchived: false,
    archivedAt: FieldValue.delete(),
    updatedAt: now,
  });

  const updated = await conversationRef.get();
  return serializeConversation({
    id: updated.id,
    ...updated.data(),
  } as Conversation);
}

/**
 * Delete a conversation permanently
 * This deletes the conversation document and all its messages
 */
export async function deleteConversation(
  creatorId: string,
  conversationId: string
): Promise<void> {
  const conversationRef = getConversationsCollection(creatorId).doc(conversationId);
  const doc = await conversationRef.get();

  if (!doc.exists) {
    throw new Error('Conversation not found');
  }

  // Delete all messages in the conversation (including chat_history)
  const messagesRef = getMessagesCollection(creatorId, conversationId);
  const messagesSnapshot = await messagesRef.get();

  const batch = db.batch();

  // Delete all message documents
  messagesSnapshot.docs.forEach((messageDoc) => {
    batch.delete(messageDoc.ref);
  });

  // Delete the conversation document
  batch.delete(conversationRef);

  await batch.commit();

  console.log(`Deleted conversation ${conversationId} and ${messagesSnapshot.size} messages`);
}
