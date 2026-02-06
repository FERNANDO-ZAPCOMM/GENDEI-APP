// Gendei Conversations Route
// Operations for WhatsApp conversation management

import { Router, Request, Response } from 'express';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { verifyAuth } from '../middleware/auth';

const router = Router();
const db = getFirestore();

const CLINICS = 'gendei_clinics';
const TOKENS = 'gendei_tokens';

// Conversation state enum
enum ConversationState {
  NOVO = 'novo',
  QUALIFICADO = 'qualificado',
  NEGOCIANDO = 'negociando',
  CHECKOUT = 'checkout',
  FECHADO = 'fechado',
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

    const snapshot = await db
      .collection(CLINICS)
      .doc(clinicId)
      .collection('conversations')
      .doc(conversationId)
      .collection('messages')
      .orderBy('timestamp', 'asc')
      .limit(limit)
      .get();

    const messages = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toDate?.() || doc.data().timestamp,
    }));

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

    // Save message to Firestore
    const messageRef = await convRef.collection('messages').add({
      conversationId,
      clinicId,
      direction: 'out',
      from: phoneNumberId,
      to: waUserPhone,
      body: message,
      messageType: 'text',
      timestamp: FieldValue.serverTimestamp(),
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
        messageId: messageRef.id,
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
          // Save message to Firestore
          await convRef.collection('messages').add({
            conversationId,
            clinicId,
            direction: 'out',
            from: phoneNumberId,
            to: waUserPhone,
            body: queuedMsg.text,
            messageType: 'text',
            timestamp: FieldValue.serverTimestamp(),
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
