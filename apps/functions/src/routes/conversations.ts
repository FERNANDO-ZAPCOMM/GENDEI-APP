// Gendei Conversations Route
// Operations for WhatsApp conversation management

import { Router, Request, Response } from 'express';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { verifyAuth } from '../middleware/auth';

const router = Router();
const db = getFirestore();

const CLINICS = 'gendei_clinics';
const TOKENS = 'gendei_tokens';
const MAX_MESSAGES_PER_CONVERSATION = 250;

// Conversation state enum
enum ConversationState {
  NOVO = 'novo',
  QUALIFICADO = 'qualificado',
  NEGOCIANDO = 'negociando',
  CHECKOUT = 'checkout',
  FECHADO = 'fechado',
}

type MessageDirection = 'in' | 'out';

interface StoredConversationMessage {
  conversationId: string;
  clinicId: string;
  direction: MessageDirection;
  from: string | null;
  to: string | null;
  body: string;
  messageType: string;
  timestamp: string;
  isAiGenerated?: boolean;
  isHumanSent?: boolean;
  sentBy?: string;
  wasQueued?: boolean;
  metadata?: Record<string, unknown>;
}

function sanitizeTimestampKey(timestamp: string): string {
  return timestamp.replace(/\./g, '_');
}

function parseTimestamp(value: unknown): Date {
  if (value && typeof value === 'object' && typeof (value as any).toDate === 'function') {
    return (value as any).toDate();
  }

  if (typeof value === 'string' || value instanceof Date) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return new Date();
}

function mapChatHistoryMessage(
  messageId: string,
  value: Record<string, unknown>,
  fallbackConversationId: string,
  fallbackClinicId: string
): StoredConversationMessage {
  const source = String(value.source || '').toLowerCase();
  const explicitDirection = value.direction === 'in' || value.direction === 'out'
    ? value.direction
    : null;
  const inferredDirection: MessageDirection = source === 'patient' || source === 'human'
    ? 'in'
    : 'out';
  const direction = (explicitDirection || inferredDirection) as MessageDirection;

  const timestampRaw = value.timestamp || messageId;
  const timestamp = parseTimestamp(timestampRaw);

  return {
    conversationId: String(value.conversationId || fallbackConversationId),
    clinicId: String(value.clinicId || fallbackClinicId),
    direction,
    from: (value.from as string) || (direction === 'in' ? 'patient' : 'agent'),
    to: (value.to as string) || (direction === 'in' ? 'agent' : 'patient'),
    body: String(value.body || value.content || value.text || ''),
    messageType: String(value.messageType || value.type || 'text'),
    timestamp: timestamp.toISOString(),
    isAiGenerated: Boolean(value.isAiGenerated || source === 'ai' || source === 'agent'),
    isHumanSent: Boolean(value.isHumanSent),
    sentBy: value.sentBy as string | undefined,
    wasQueued: Boolean(value.wasQueued),
    metadata: value.metadata as Record<string, unknown> | undefined,
  };
}

function looksLikeMessageObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.body === 'string' ||
    typeof v.content === 'string' ||
    typeof v.text === 'string' ||
    typeof v.messageType === 'string' ||
    typeof v.type === 'string' ||
    typeof v.direction === 'string' ||
    typeof v.source === 'string' ||
    v.timestamp !== undefined
  );
}

function normalizeChatHistoryMessages(
  data: Record<string, unknown>,
  conversationId: string,
  clinicId: string
): Array<StoredConversationMessage & { id: string }> {
  const candidates = [data.messages, data.chatHistory, data.history, data.items];
  const mapped: Array<StoredConversationMessage & { id: string }> = [];

  for (const candidate of candidates) {
    if (!candidate) continue;

    if (Array.isArray(candidate)) {
      candidate.forEach((item, index) => {
        if (!looksLikeMessageObject(item)) return;
        const rawTs = item.timestamp;
        const messageId = typeof rawTs === 'string'
          ? sanitizeTimestampKey(rawTs)
          : `msg_${index}`;
        mapped.push({
          id: messageId,
          ...mapChatHistoryMessage(messageId, item, conversationId, clinicId),
        });
      });
      if (mapped.length > 0) return mapped;
      continue;
    }

    if (typeof candidate === 'object') {
      const entries = Object.entries(candidate as Record<string, unknown>);
      entries.forEach(([key, value]) => {
        if (!looksLikeMessageObject(value)) return;
        mapped.push({
          id: key,
          ...mapChatHistoryMessage(key, value, conversationId, clinicId),
        });
      });
      if (mapped.length > 0) return mapped;

      // Some older docs stored a single message object directly.
      if (looksLikeMessageObject(candidate)) {
        const single = candidate as Record<string, unknown>;
        const rawTs = single.timestamp;
        const messageId = typeof rawTs === 'string'
          ? sanitizeTimestampKey(rawTs)
          : 'msg_0';
        return [{
          id: messageId,
          ...mapChatHistoryMessage(messageId, single, conversationId, clinicId),
        }];
      }
    }
  }

  // Final fallback: look for timestamp-keyed message objects at root level.
  const rootEntries = Object.entries(data).filter(([key]) => (
    key !== 'messages' &&
    key !== 'chatHistory' &&
    key !== 'history' &&
    key !== 'items' &&
    key !== 'lastUpdated' &&
    key !== 'messageCount' &&
    key !== 'clinicId' &&
    key !== 'waUserId' &&
    key !== 'conversationId' &&
    key !== 'creatorId'
  ));

  rootEntries.forEach(([key, value]) => {
    if (!looksLikeMessageObject(value)) return;
    mapped.push({
      id: key,
      ...mapChatHistoryMessage(key, value, conversationId, clinicId),
    });
  });

  return mapped;
}

async function appendMessageToChatHistory(
  convRef: FirebaseFirestore.DocumentReference,
  message: Omit<StoredConversationMessage, 'timestamp'> & { timestamp?: string }
): Promise<string> {
  const chatHistoryRef = convRef.collection('messages').doc('chat_history');
  const timestamp = message.timestamp || new Date().toISOString();
  const messageId = sanitizeTimestampKey(timestamp);

  const payload: StoredConversationMessage = {
    ...message,
    timestamp,
  };

  const chatHistoryDoc = await chatHistoryRef.get();

  if (!chatHistoryDoc.exists) {
    // One-time bootstrap: migrate legacy per-message docs into chat_history.
    const legacySnapshot = await convRef
      .collection('messages')
      .orderBy('timestamp', 'asc')
      .limit(MAX_MESSAGES_PER_CONVERSATION - 1)
      .get();

    const messagesMap: Record<string, StoredConversationMessage> = {};
    for (const legacyDoc of legacySnapshot.docs) {
      const legacyData = legacyDoc.data() as Record<string, unknown>;
      const legacyTimestamp = parseTimestamp(legacyData.timestamp).toISOString();
      const legacyId = sanitizeTimestampKey(legacyTimestamp);
      messagesMap[legacyId] = {
        ...mapChatHistoryMessage(
          legacyId,
          legacyData,
          payload.conversationId,
          payload.clinicId
        ),
        timestamp: legacyTimestamp,
      };
    }

    messagesMap[messageId] = payload;
    const entries = Object.entries(messagesMap).sort((a, b) => a[0].localeCompare(b[0]));
    const trimmed = entries.slice(-MAX_MESSAGES_PER_CONVERSATION);

    await chatHistoryRef.set({
      messages: Object.fromEntries(trimmed),
      lastUpdated: timestamp,
      messageCount: trimmed.length,
      conversationId: payload.conversationId,
      clinicId: payload.clinicId,
    });
  } else {
    await chatHistoryRef.set({
      [`messages.${messageId}`]: payload,
      lastUpdated: timestamp,
      messageCount: FieldValue.increment(1),
      conversationId: payload.conversationId,
      clinicId: payload.clinicId,
    }, { merge: true });
  }

  return messageId;
}

async function getConversationMessages(
  convRef: FirebaseFirestore.DocumentReference,
  clinicId: string,
  conversationId: string,
  limit: number
): Promise<Array<StoredConversationMessage & { id: string }>> {
  const chatHistoryDoc = await convRef.collection('messages').doc('chat_history').get();

  if (chatHistoryDoc.exists) {
    const data = chatHistoryDoc.data() || {};
    const mapped = normalizeChatHistoryMessages(
      data as Record<string, unknown>,
      conversationId,
      clinicId
    )
      .sort((a, b) => parseTimestamp(a.timestamp).getTime() - parseTimestamp(b.timestamp).getTime());
    if (mapped.length > 0) {
      return mapped.slice(-limit);
    }
  }

  // Legacy fallback: one document per message in subcollection.
  const legacySnapshot = await convRef
    .collection('messages')
    .orderBy('timestamp', 'asc')
    .limit(limit + 1)
    .get();

  return legacySnapshot.docs
    .filter((doc) => doc.id !== 'chat_history')
    .map(doc => ({
      id: doc.id,
      ...(doc.data() as StoredConversationMessage),
      timestamp: parseTimestamp(doc.data().timestamp).toISOString(),
    }))
    .slice(-limit);
}

// GET /conversations?clinicId=xxx - Get conversations for a clinic
router.get('/', verifyAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const clinicId = req.query.clinicId as string || user?.clinicId;
    const state = req.query.state as string;
    const isHumanTakeover = req.query.isHumanTakeover as string;
    const search = req.query.search as string;
    const professionalId = req.query.professionalId as string;
    const limit = parseInt(req.query.limit as string) || 50;

    if (!clinicId) {
      return res.status(400).json({ message: 'Clinic ID is required' });
    }

    if (user?.clinicId !== clinicId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    let query: FirebaseFirestore.Query = db
      .collection(CLINICS)
      .doc(clinicId)
      .collection('conversations')
      .orderBy('lastMessageAt', 'desc')
      .limit(limit);

    // Apply filters
    if (state) {
      query = query.where('state', '==', state);
    }

    if (isHumanTakeover !== undefined) {
      query = query.where('isHumanTakeover', '==', isHumanTakeover === 'true');
    }

    if (professionalId) {
      query = query.where('professionalId', '==', professionalId);
    }

    const snapshot = await query.get();

    let conversations = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      lastMessageAt: doc.data().lastMessageAt?.toDate?.() || doc.data().lastMessageAt,
      createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
      updatedAt: doc.data().updatedAt?.toDate?.() || doc.data().updatedAt,
      takenOverAt: doc.data().takenOverAt?.toDate?.() || doc.data().takenOverAt,
    }));

    // Client-side search if provided
    if (search) {
      const searchLower = search.toLowerCase();
      conversations = conversations.filter(c =>
        (c as any).waUserName?.toLowerCase().includes(searchLower) ||
        (c as any).waUserPhone?.includes(search)
      );
    }

    return res.json({ data: conversations });
  } catch (error: any) {
    console.error('Error getting conversations:', error);
    return res.status(500).json({ message: error.message });
  }
});

// GET /conversations/stats?clinicId=xxx - Get conversation statistics
router.get('/stats', verifyAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const clinicId = req.query.clinicId as string || user?.clinicId;

    if (!clinicId) {
      return res.status(400).json({ message: 'Clinic ID is required' });
    }

    if (user?.clinicId !== clinicId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const conversationsRef = db
      .collection(CLINICS)
      .doc(clinicId)
      .collection('conversations');

    // Get all conversations for stats
    const snapshot = await conversationsRef.get();

    let totalConversations = 0;
    let activeConversations = 0;
    let humanTakeoverConversations = 0;
    let closedConversations = 0;

    snapshot.docs.forEach(doc => {
      const data = doc.data();
      totalConversations++;

      if (data.state === ConversationState.FECHADO) {
        closedConversations++;
      } else {
        activeConversations++;
      }

      if (data.isHumanTakeover) {
        humanTakeoverConversations++;
      }
    });

    return res.json({
      data: {
        totalConversations,
        activeConversations,
        humanTakeoverConversations,
        closedConversations,
      }
    });
  } catch (error: any) {
    console.error('Error getting conversation stats:', error);
    return res.status(500).json({ message: error.message });
  }
});

// GET /conversations/:conversationId?clinicId=xxx - Get specific conversation
router.get('/:conversationId', verifyAuth, async (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params;
    const user = (req as any).user;
    const clinicId = req.query.clinicId as string || user?.clinicId;

    if (!clinicId) {
      return res.status(400).json({ message: 'Clinic ID is required' });
    }

    if (user?.clinicId !== clinicId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const doc = await db
      .collection(CLINICS)
      .doc(clinicId)
      .collection('conversations')
      .doc(conversationId)
      .get();

    if (!doc.exists) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    const data = doc.data();

    return res.json({
      data: {
        id: doc.id,
        ...data,
        lastMessageAt: data?.lastMessageAt?.toDate?.() || data?.lastMessageAt,
        createdAt: data?.createdAt?.toDate?.() || data?.createdAt,
        updatedAt: data?.updatedAt?.toDate?.() || data?.updatedAt,
        takenOverAt: data?.takenOverAt?.toDate?.() || data?.takenOverAt,
      }
    });
  } catch (error: any) {
    console.error('Error getting conversation:', error);
    return res.status(500).json({ message: error.message });
  }
});

// GET /conversations/:conversationId/messages?clinicId=xxx - Get messages for a conversation
router.get('/:conversationId/messages', verifyAuth, async (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params;
    const user = (req as any).user;
    const clinicId = req.query.clinicId as string || user?.clinicId;
    const limit = parseInt(req.query.limit as string) || 100;

    if (!clinicId) {
      return res.status(400).json({ message: 'Clinic ID is required' });
    }

    if (user?.clinicId !== clinicId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Verify conversation exists
    const convDoc = await db
      .collection(CLINICS)
      .doc(clinicId)
      .collection('conversations')
      .doc(conversationId)
      .get();

    if (!convDoc.exists) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    const convRef = db
      .collection(CLINICS)
      .doc(clinicId)
      .collection('conversations')
      .doc(conversationId);

    const messages = await getConversationMessages(convRef, clinicId, conversationId, limit);

    return res.json({ data: messages });
  } catch (error: any) {
    console.error('Error getting messages:', error);
    return res.status(500).json({ message: error.message });
  }
});

// POST /conversations/:conversationId/takeover - Take over conversation from AI
router.post('/:conversationId/takeover', verifyAuth, async (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params;
    const { userId } = req.body;
    const user = (req as any).user;
    const clinicId = req.query.clinicId as string || user?.clinicId;

    if (!clinicId) {
      return res.status(400).json({ message: 'Clinic ID is required' });
    }

    if (user?.clinicId !== clinicId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const convRef = db
      .collection(CLINICS)
      .doc(clinicId)
      .collection('conversations')
      .doc(conversationId);

    const convDoc = await convRef.get();

    if (!convDoc.exists) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    await convRef.update({
      isHumanTakeover: true,
      aiPaused: true,
      takenOverAt: FieldValue.serverTimestamp(),
      takenOverBy: userId || user?.uid,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return res.json({
      data: { success: true, message: 'Conversation taken over' }
    });
  } catch (error: any) {
    console.error('Error taking over conversation:', error);
    return res.status(500).json({ message: error.message });
  }
});

// POST /conversations/:conversationId/release - Release conversation back to AI
router.post('/:conversationId/release', verifyAuth, async (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params;
    const user = (req as any).user;
    const clinicId = req.query.clinicId as string || user?.clinicId;

    if (!clinicId) {
      return res.status(400).json({ message: 'Clinic ID is required' });
    }

    if (user?.clinicId !== clinicId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const convRef = db
      .collection(CLINICS)
      .doc(clinicId)
      .collection('conversations')
      .doc(conversationId);

    const convDoc = await convRef.get();

    if (!convDoc.exists) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    await convRef.update({
      isHumanTakeover: false,
      aiPaused: false,
      takenOverAt: null,
      takenOverBy: null,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return res.json({
      data: { success: true, message: 'Conversation released to AI' }
    });
  } catch (error: any) {
    console.error('Error releasing conversation:', error);
    return res.status(500).json({ message: error.message });
  }
});

// POST /conversations/:conversationId/messages - Send a message in conversation
router.post('/:conversationId/messages', verifyAuth, async (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params;
    const { message, userId } = req.body;
    const user = (req as any).user;
    const clinicId = req.query.clinicId as string || user?.clinicId;

    if (!clinicId) {
      return res.status(400).json({ message: 'Clinic ID is required' });
    }

    if (user?.clinicId !== clinicId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (!message) {
      return res.status(400).json({ message: 'Message is required' });
    }

    // Get conversation
    const convRef = db
      .collection(CLINICS)
      .doc(clinicId)
      .collection('conversations')
      .doc(conversationId);

    const convDoc = await convRef.get();

    if (!convDoc.exists) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    const convData = convDoc.data();
    const waUserPhone = convData?.waUserPhone;

    if (!waUserPhone) {
      return res.status(400).json({ message: 'No phone number for this conversation' });
    }

    // Get WhatsApp token
    const tokenDoc = await db.collection(TOKENS).doc(clinicId).get();

    if (!tokenDoc.exists) {
      return res.status(400).json({ message: 'WhatsApp not connected' });
    }

    const tokenData = tokenDoc.data();
    const accessToken = tokenData?.accessToken;
    const phoneNumberId = tokenData?.phoneNumberId;

    if (!accessToken || !phoneNumberId) {
      return res.status(400).json({ message: 'WhatsApp configuration incomplete' });
    }

    // Send message via WhatsApp API
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: waUserPhone.replace(/\D/g, ''),
          type: 'text',
          text: { body: message },
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error('WhatsApp API error:', errorData);
      throw new Error('Failed to send WhatsApp message');
    }

    // Save message to Firestore (single-document chat_history format)
    const messageId = await appendMessageToChatHistory(convRef, {
      conversationId,
      clinicId,
      direction: 'out',
      from: phoneNumberId,
      to: waUserPhone,
      body: message,
      messageType: 'text',
      isAiGenerated: false,
      isHumanSent: true,
      sentBy: userId || user?.uid,
    });

    // Update conversation
    await convRef.update({
      lastMessageAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return res.json({
      data: {
        success: true,
        messageId,
      }
    });
  } catch (error: any) {
    console.error('Error sending message:', error);
    return res.status(500).json({ message: error.message });
  }
});

// PATCH /conversations/:conversationId - Update conversation state
router.patch('/:conversationId', verifyAuth, async (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params;
    const { state } = req.body;
    const user = (req as any).user;
    const clinicId = req.query.clinicId as string || user?.clinicId;

    if (!clinicId) {
      return res.status(400).json({ message: 'Clinic ID is required' });
    }

    if (user?.clinicId !== clinicId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const convRef = db
      .collection(CLINICS)
      .doc(clinicId)
      .collection('conversations')
      .doc(conversationId);

    const convDoc = await convRef.get();

    if (!convDoc.exists) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    const updateData: any = {
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (state) {
      updateData.state = state;
    }

    await convRef.update(updateData);

    return res.json({
      data: { success: true }
    });
  } catch (error: any) {
    console.error('Error updating conversation:', error);
    return res.status(500).json({ message: error.message });
  }
});

// POST /conversations/:conversationId/archive - Archive a conversation
router.post('/:conversationId/archive', verifyAuth, async (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params;
    const user = (req as any).user;
    const clinicId = req.query.clinicId as string || user?.clinicId;

    if (!clinicId) {
      return res.status(400).json({ message: 'Clinic ID is required' });
    }

    if (user?.clinicId !== clinicId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const convRef = db
      .collection(CLINICS)
      .doc(clinicId)
      .collection('conversations')
      .doc(conversationId);

    const convDoc = await convRef.get();

    if (!convDoc.exists) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    await convRef.update({
      isArchived: true,
      archivedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return res.json({
      data: { success: true, message: 'Conversation archived' }
    });
  } catch (error: any) {
    console.error('Error archiving conversation:', error);
    return res.status(500).json({ message: error.message });
  }
});

// POST /conversations/:conversationId/unarchive - Unarchive a conversation
router.post('/:conversationId/unarchive', verifyAuth, async (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params;
    const user = (req as any).user;
    const clinicId = req.query.clinicId as string || user?.clinicId;

    if (!clinicId) {
      return res.status(400).json({ message: 'Clinic ID is required' });
    }

    if (user?.clinicId !== clinicId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const convRef = db
      .collection(CLINICS)
      .doc(clinicId)
      .collection('conversations')
      .doc(conversationId);

    const convDoc = await convRef.get();

    if (!convDoc.exists) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    await convRef.update({
      isArchived: false,
      archivedAt: null,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return res.json({
      data: { success: true, message: 'Conversation unarchived' }
    });
  } catch (error: any) {
    console.error('Error unarchiving conversation:', error);
    return res.status(500).json({ message: error.message });
  }
});

// DELETE /conversations/:conversationId - Delete a conversation permanently
router.delete('/:conversationId', verifyAuth, async (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params;
    const user = (req as any).user;
    const clinicId = req.query.clinicId as string || user?.clinicId;

    if (!clinicId) {
      return res.status(400).json({ message: 'Clinic ID is required' });
    }

    if (user?.clinicId !== clinicId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const convRef = db
      .collection(CLINICS)
      .doc(clinicId)
      .collection('conversations')
      .doc(conversationId);

    const convDoc = await convRef.get();

    if (!convDoc.exists) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    // Delete all messages in the conversation first
    const messagesSnapshot = await convRef.collection('messages').get();
    const batch = db.batch();

    messagesSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    // Delete the conversation document
    batch.delete(convRef);

    await batch.commit();

    return res.status(204).send();
  } catch (error: any) {
    console.error('Error deleting conversation:', error);
    return res.status(500).json({ message: error.message });
  }
});

// ============================================
// 24H MESSAGING WINDOW & MESSAGE QUEUE
// ============================================

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

function isWindowOpen(lastCustomerMessageAt: Date | string | undefined): boolean {
  if (!lastCustomerMessageAt) return false;

  const lastMessageTime = typeof lastCustomerMessageAt === 'string'
    ? new Date(lastCustomerMessageAt)
    : lastCustomerMessageAt;

  const now = new Date();
  const timeSinceLastMessage = now.getTime() - lastMessageTime.getTime();

  return timeSinceLastMessage < TWENTY_FOUR_HOURS_MS;
}

// GET /conversations/:conversationId/window-status - Get 24h window status and queue
router.get('/:conversationId/window-status', verifyAuth, async (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params;
    const user = (req as any).user;
    const clinicId = req.query.clinicId as string || user?.clinicId;

    if (!clinicId) {
      return res.status(400).json({ message: 'Clinic ID is required' });
    }

    if (user?.clinicId !== clinicId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const convRef = db
      .collection(CLINICS)
      .doc(clinicId)
      .collection('conversations')
      .doc(conversationId);

    const convDoc = await convRef.get();

    if (!convDoc.exists) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    const convData = convDoc.data();
    const lastCustomerMessageAt = convData?.lastCustomerMessageAt?.toDate?.() || convData?.lastCustomerMessageAt;
    const reengagementSentAt = convData?.reengagementSentAt?.toDate?.() || convData?.reengagementSentAt;
    const messageQueue = convData?.messageQueue || [];

    return res.json({
      data: {
        isWindowOpen: isWindowOpen(lastCustomerMessageAt),
        lastCustomerMessageAt: lastCustomerMessageAt || null,
        reengagementSentAt: reengagementSentAt || null,
        queuedMessagesCount: messageQueue.length,
        queuedMessages: messageQueue,
      }
    });
  } catch (error: any) {
    console.error('Error getting window status:', error);
    return res.status(500).json({ message: error.message });
  }
});

// POST /conversations/:conversationId/queue - Queue a message
router.post('/:conversationId/queue', verifyAuth, async (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params;
    const { message } = req.body;
    const user = (req as any).user;
    const clinicId = req.query.clinicId as string || user?.clinicId;

    if (!clinicId) {
      return res.status(400).json({ message: 'Clinic ID is required' });
    }

    if (user?.clinicId !== clinicId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (!message) {
      return res.status(400).json({ message: 'Message is required' });
    }

    const convRef = db
      .collection(CLINICS)
      .doc(clinicId)
      .collection('conversations')
      .doc(conversationId);

    const convDoc = await convRef.get();

    if (!convDoc.exists) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    const queuedMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      text: message,
      queuedAt: new Date().toISOString(),
      queuedBy: user?.uid,
    };

    await convRef.update({
      messageQueue: FieldValue.arrayUnion(queuedMessage),
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Get updated queue length
    const updatedDoc = await convRef.get();
    const queueLength = updatedDoc.data()?.messageQueue?.length || 1;

    return res.json({
      data: {
        queuedMessage,
        queueLength,
      }
    });
  } catch (error: any) {
    console.error('Error queueing message:', error);
    return res.status(500).json({ message: error.message });
  }
});

// DELETE /conversations/:conversationId/queue - Clear message queue
router.delete('/:conversationId/queue', verifyAuth, async (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params;
    const user = (req as any).user;
    const clinicId = req.query.clinicId as string || user?.clinicId;

    if (!clinicId) {
      return res.status(400).json({ message: 'Clinic ID is required' });
    }

    if (user?.clinicId !== clinicId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const convRef = db
      .collection(CLINICS)
      .doc(clinicId)
      .collection('conversations')
      .doc(conversationId);

    const convDoc = await convRef.get();

    if (!convDoc.exists) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    await convRef.update({
      messageQueue: [],
      updatedAt: FieldValue.serverTimestamp(),
    });

    return res.json({
      data: { success: true, message: 'Queue cleared' }
    });
  } catch (error: any) {
    console.error('Error clearing queue:', error);
    return res.status(500).json({ message: error.message });
  }
});

// POST /conversations/:conversationId/send-queue - Send all queued messages
router.post('/:conversationId/send-queue', verifyAuth, async (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params;
    const user = (req as any).user;
    const clinicId = req.query.clinicId as string || user?.clinicId;

    if (!clinicId) {
      return res.status(400).json({ message: 'Clinic ID is required' });
    }

    if (user?.clinicId !== clinicId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const convRef = db
      .collection(CLINICS)
      .doc(clinicId)
      .collection('conversations')
      .doc(conversationId);

    const convDoc = await convRef.get();

    if (!convDoc.exists) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    const convData = convDoc.data();
    const lastCustomerMessageAt = convData?.lastCustomerMessageAt?.toDate?.() || convData?.lastCustomerMessageAt;

    // Check if window is open
    if (!isWindowOpen(lastCustomerMessageAt)) {
      return res.status(400).json({ message: '24h window is closed. Customer must reply first.' });
    }

    const messageQueue = convData?.messageQueue || [];

    if (messageQueue.length === 0) {
      return res.status(400).json({ message: 'No messages in queue' });
    }

    const waUserPhone = convData?.waUserPhone;

    if (!waUserPhone) {
      return res.status(400).json({ message: 'No phone number for this conversation' });
    }

    // Get WhatsApp token
    const tokenDoc = await db.collection(TOKENS).doc(clinicId).get();

    if (!tokenDoc.exists) {
      return res.status(400).json({ message: 'WhatsApp not connected' });
    }

    const tokenData = tokenDoc.data();
    const accessToken = tokenData?.accessToken;
    const phoneNumberId = tokenData?.phoneNumberId;

    if (!accessToken || !phoneNumberId) {
      return res.status(400).json({ message: 'WhatsApp configuration incomplete' });
    }

    let sent = 0;
    let failed = 0;

    // Send each queued message
    for (const queuedMsg of messageQueue) {
      try {
        const response = await fetch(
          `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              messaging_product: 'whatsapp',
              to: waUserPhone.replace(/\D/g, ''),
              type: 'text',
              text: { body: queuedMsg.text },
            }),
          }
        );

        if (response.ok) {
          // Save message to Firestore (single-document chat_history format)
          await appendMessageToChatHistory(convRef, {
            conversationId,
            clinicId,
            direction: 'out',
            from: phoneNumberId,
            to: waUserPhone,
            body: queuedMsg.text,
            messageType: 'text',
            isAiGenerated: false,
            isHumanSent: true,
            sentBy: queuedMsg.queuedBy,
            wasQueued: true,
          });
          sent++;
        } else {
          failed++;
        }

        // Small delay between messages to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error('Error sending queued message:', error);
        failed++;
      }
    }

    // Clear queue after sending
    await convRef.update({
      messageQueue: [],
      lastMessageAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return res.json({
      data: { sent, failed }
    });
  } catch (error: any) {
    console.error('Error sending queue:', error);
    return res.status(500).json({ message: error.message });
  }
});

// POST /conversations/:conversationId/reengagement - Send re-engagement template
router.post('/:conversationId/reengagement', verifyAuth, async (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params;
    const user = (req as any).user;
    const clinicId = req.query.clinicId as string || user?.clinicId;

    if (!clinicId) {
      return res.status(400).json({ message: 'Clinic ID is required' });
    }

    if (user?.clinicId !== clinicId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const convRef = db
      .collection(CLINICS)
      .doc(clinicId)
      .collection('conversations')
      .doc(conversationId);

    const convDoc = await convRef.get();

    if (!convDoc.exists) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    const convData = convDoc.data();
    const waUserPhone = convData?.waUserPhone;

    if (!waUserPhone) {
      return res.status(400).json({ message: 'No phone number for this conversation' });
    }

    // Get WhatsApp token
    const tokenDoc = await db.collection(TOKENS).doc(clinicId).get();

    if (!tokenDoc.exists) {
      return res.status(400).json({ message: 'WhatsApp not connected' });
    }

    const tokenData = tokenDoc.data();
    const accessToken = tokenData?.accessToken;
    const phoneNumberId = tokenData?.phoneNumberId;

    if (!accessToken || !phoneNumberId) {
      return res.status(400).json({ message: 'WhatsApp configuration incomplete' });
    }

    // Get clinic to find the re-engagement template name
    const clinicDoc = await db.collection(CLINICS).doc(clinicId).get();
    const clinicData = clinicDoc.data();
    const templateName = clinicData?.reengagementTemplateName || 'gendei_atendimento';

    // Send template message via WhatsApp API
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: waUserPhone.replace(/\D/g, ''),
          type: 'template',
          template: {
            name: templateName,
            language: { code: 'pt_BR' },
          },
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error('WhatsApp API error:', errorData);
      throw new Error('Failed to send re-engagement template');
    }

    const responseData = await response.json();

    // Update conversation with reengagement timestamp
    await convRef.update({
      reengagementSentAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return res.json({
      data: {
        success: true,
        messageId: responseData.messages?.[0]?.id,
        message: 'Re-engagement template sent. Waiting for customer reply to open 24h window.',
      }
    });
  } catch (error: any) {
    console.error('Error sending reengagement:', error);
    return res.status(500).json({ message: error.message });
  }
});

export default router;
