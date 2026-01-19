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
    const clinicId = req.query.clinicId as string || user?.uid;
    const state = req.query.state as string;
    const isHumanTakeover = req.query.isHumanTakeover as string;
    const search = req.query.search as string;
    const professionalId = req.query.professionalId as string;
    const limit = parseInt(req.query.limit as string) || 50;

    if (!clinicId) {
      return res.status(400).json({ message: 'Clinic ID is required' });
    }

    if (user?.uid !== clinicId) {
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
    const clinicId = req.query.clinicId as string || user?.uid;

    if (!clinicId) {
      return res.status(400).json({ message: 'Clinic ID is required' });
    }

    if (user?.uid !== clinicId) {
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
    const clinicId = req.query.clinicId as string || user?.uid;

    if (!clinicId) {
      return res.status(400).json({ message: 'Clinic ID is required' });
    }

    if (user?.uid !== clinicId) {
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
    const clinicId = req.query.clinicId as string || user?.uid;
    const limit = parseInt(req.query.limit as string) || 100;

    if (!clinicId) {
      return res.status(400).json({ message: 'Clinic ID is required' });
    }

    if (user?.uid !== clinicId) {
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
    const clinicId = req.query.clinicId as string || user?.uid;

    if (!clinicId) {
      return res.status(400).json({ message: 'Clinic ID is required' });
    }

    if (user?.uid !== clinicId) {
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
    const clinicId = req.query.clinicId as string || user?.uid;

    if (!clinicId) {
      return res.status(400).json({ message: 'Clinic ID is required' });
    }

    if (user?.uid !== clinicId) {
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
    const clinicId = req.query.clinicId as string || user?.uid;

    if (!clinicId) {
      return res.status(400).json({ message: 'Clinic ID is required' });
    }

    if (user?.uid !== clinicId) {
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
    const clinicId = req.query.clinicId as string || user?.uid;

    if (!clinicId) {
      return res.status(400).json({ message: 'Clinic ID is required' });
    }

    if (user?.uid !== clinicId) {
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
    const clinicId = req.query.clinicId as string || user?.uid;

    if (!clinicId) {
      return res.status(400).json({ message: 'Clinic ID is required' });
    }

    if (user?.uid !== clinicId) {
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
    const clinicId = req.query.clinicId as string || user?.uid;

    if (!clinicId) {
      return res.status(400).json({ message: 'Clinic ID is required' });
    }

    if (user?.uid !== clinicId) {
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
    const clinicId = req.query.clinicId as string || user?.uid;

    if (!clinicId) {
      return res.status(400).json({ message: 'Clinic ID is required' });
    }

    if (user?.uid !== clinicId) {
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

export default router;
