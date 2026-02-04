// Gendei Clinics Route
// CRUD operations for clinic management

import { Router, Request, Response } from 'express';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { verifyAuth } from '../middleware/auth';
import Anthropic from '@anthropic-ai/sdk';

const router = Router();
const db = getFirestore();

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

// Collection names
const CLINICS = 'gendei_clinics';

// GET /clinics - Get current user's clinic
router.get('/', verifyAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const clinicId = user?.uid;

    if (!clinicId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const clinicDoc = await db.collection(CLINICS).doc(clinicId).get();

    if (!clinicDoc.exists) {
      return res.status(404).json({ message: 'Clinic not found' });
    }

    return res.json({
      id: clinicDoc.id,
      ...clinicDoc.data()
    });
  } catch (error: any) {
    console.error('Error getting clinic:', error);
    return res.status(500).json({ message: error.message });
  }
});

// GET /clinics/me - Get current user's clinic (alias)
router.get('/me', verifyAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const clinicId = user?.uid;

    if (!clinicId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const clinicDoc = await db.collection(CLINICS).doc(clinicId).get();

    if (!clinicDoc.exists) {
      return res.status(404).json({ message: 'Clinic not found' });
    }

    return res.json({
      id: clinicDoc.id,
      ...clinicDoc.data()
    });
  } catch (error: any) {
    console.error('Error getting clinic:', error);
    return res.status(500).json({ message: error.message });
  }
});

// PATCH /clinics/me - Update current user's clinic
router.patch('/me', verifyAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const clinicId = user?.uid;

    if (!clinicId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const clinicDoc = await db.collection(CLINICS).doc(clinicId).get();

    if (!clinicDoc.exists) {
      // Create new clinic if it doesn't exist
      const {
        name,
        phone,
        email,
        address,
        city,
        state,
        zipCode,
        cnpj,
        categories,
        signalPercentage = 15
      } = req.body;

      const clinicData = {
        name: name || 'Nova Clínica',
        ownerId: clinicId,
        phone: phone || '',
        email: email || user?.email || '',
        address: address || '',
        city: city || '',
        state: state || '',
        zipCode: zipCode || '',
        cnpj: cnpj || null,
        categories: categories || [],
        whatsappConnected: false,
        whatsappPhoneNumberId: null,
        whatsappWabaId: null,
        paymentGateway: 'pagseguro',
        signalPercentage,
        adminIds: [],
        timezone: 'America/Sao_Paulo',
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      };

      await db.collection(CLINICS).doc(clinicId).set(clinicData);

      return res.status(201).json({
        id: clinicId,
        ...clinicData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }

    // Update existing clinic
    const allowedFields = [
      'name', 'phone', 'email', 'address', 'city', 'state',
      'zipCode', 'cnpj', 'categories', 'signalPercentage', 'timezone',
      'paymentSettings', 'pixKey', 'depositPercentage', 'requiresDeposit',
      'description', 'website', 'openingHours', 'addressData', 'greetingSummary',
      'workflowMode'
    ];

    const updateData: any = {
      updatedAt: FieldValue.serverTimestamp()
    };

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    }

    await db.collection(CLINICS).doc(clinicId).update(updateData);

    const updatedDoc = await db.collection(CLINICS).doc(clinicId).get();

    return res.json({
      id: clinicId,
      ...updatedDoc.data()
    });
  } catch (error: any) {
    console.error('Error updating clinic:', error);
    return res.status(500).json({ message: error.message });
  }
});

// GET /clinics/:clinicId - Get specific clinic
router.get('/:clinicId', verifyAuth, async (req: Request, res: Response) => {
  try {
    const { clinicId } = req.params;
    const user = (req as any).user;

    // Verify access
    if (user?.uid !== clinicId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const clinicDoc = await db.collection(CLINICS).doc(clinicId).get();

    if (!clinicDoc.exists) {
      return res.status(404).json({ message: 'Clinic not found' });
    }

    return res.json({
      id: clinicDoc.id,
      ...clinicDoc.data()
    });
  } catch (error: any) {
    console.error('Error getting clinic:', error);
    return res.status(500).json({ message: error.message });
  }
});

// POST /clinics - Create new clinic
router.post('/', verifyAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const clinicId = user?.uid;

    if (!clinicId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const {
      name,
      phone,
      email,
      address,
      city,
      state,
      zipCode,
      cnpj,
      signalPercentage = 15
    } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Clinic name is required' });
    }

    const clinicData = {
      name,
      ownerId: clinicId,
      phone: phone || '',
      email: email || user?.email || '',
      address: address || '',
      city: city || '',
      state: state || '',
      zipCode: zipCode || '',
      cnpj: cnpj || null,
      whatsappConnected: false,
      whatsappPhoneNumberId: null,
      whatsappWabaId: null,
      paymentGateway: 'pagseguro',
      signalPercentage,
      adminIds: [],
      timezone: 'America/Sao_Paulo',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    };

    await db.collection(CLINICS).doc(clinicId).set(clinicData);

    return res.status(201).json({
      id: clinicId,
      ...clinicData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error creating clinic:', error);
    return res.status(500).json({ message: error.message });
  }
});

// PUT /clinics/:clinicId - Update clinic
router.put('/:clinicId', verifyAuth, async (req: Request, res: Response) => {
  try {
    const { clinicId } = req.params;
    const user = (req as any).user;

    // Verify ownership
    if (user?.uid !== clinicId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const clinicDoc = await db.collection(CLINICS).doc(clinicId).get();

    if (!clinicDoc.exists) {
      return res.status(404).json({ message: 'Clinic not found' });
    }

    const allowedFields = [
      'name', 'phone', 'email', 'address', 'city', 'state',
      'zipCode', 'cnpj', 'signalPercentage', 'timezone',
      'paymentSettings', 'pixKey', 'depositPercentage', 'requiresDeposit',
      'description', 'website', 'openingHours', 'addressData', 'greetingSummary', 'categories',
      'workflowMode'
    ];

    const updateData: any = {
      updatedAt: FieldValue.serverTimestamp()
    };

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    }

    await db.collection(CLINICS).doc(clinicId).update(updateData);

    const updatedDoc = await db.collection(CLINICS).doc(clinicId).get();

    return res.json({
      id: clinicId,
      ...updatedDoc.data()
    });
  } catch (error: any) {
    console.error('Error updating clinic:', error);
    return res.status(500).json({ message: error.message });
  }
});

// GET /clinics/:clinicId/settings - Get clinic settings
router.get('/:clinicId/settings', verifyAuth, async (req: Request, res: Response) => {
  try {
    const { clinicId } = req.params;
    const user = (req as any).user;

    if (user?.uid !== clinicId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const settingsRef = db.collection(CLINICS).doc(clinicId).collection('settings');
    const settingsDocs = await settingsRef.get();

    const settings: any = {};
    settingsDocs.forEach(doc => {
      settings[doc.id] = doc.data();
    });

    return res.json(settings);
  } catch (error: any) {
    console.error('Error getting clinic settings:', error);
    return res.status(500).json({ message: error.message });
  }
});

// PUT /clinics/:clinicId/settings/:key - Update clinic setting
router.put('/:clinicId/settings/:key', verifyAuth, async (req: Request, res: Response) => {
  try {
    const { clinicId, key } = req.params;
    const user = (req as any).user;

    if (user?.uid !== clinicId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { value } = req.body;

    await db.collection(CLINICS).doc(clinicId).collection('settings').doc(key).set({
      value,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });

    return res.json({ key, value });
  } catch (error: any) {
    console.error('Error updating clinic setting:', error);
    return res.status(500).json({ message: error.message });
  }
});

// GET /clinics/:clinicId/stats - Get clinic statistics
router.get('/:clinicId/stats', verifyAuth, async (req: Request, res: Response) => {
  try {
    const { clinicId } = req.params;
    const user = (req as any).user;

    if (user?.uid !== clinicId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Get appointment counts
    const today = new Date().toISOString().split('T')[0];

    const [
      totalAppointments,
      todayAppointments,
      pendingAppointments,
      totalPatients,
      totalProfessionals
    ] = await Promise.all([
      db.collection('gendei_appointments')
        .where('clinicId', '==', clinicId)
        .count().get(),
      db.collection('gendei_appointments')
        .where('clinicId', '==', clinicId)
        .where('date', '==', today)
        .count().get(),
      db.collection('gendei_appointments')
        .where('clinicId', '==', clinicId)
        .where('status', '==', 'pending')
        .count().get(),
      db.collection('gendei_patients')
        .where('clinicIds', 'array-contains', clinicId)
        .count().get(),
      db.collection(CLINICS).doc(clinicId).collection('professionals')
        .where('active', '==', true)
        .count().get()
    ]);

    return res.json({
      totalAppointments: totalAppointments.data().count,
      todayAppointments: todayAppointments.data().count,
      pendingAppointments: pendingAppointments.data().count,
      totalPatients: totalPatients.data().count,
      totalProfessionals: totalProfessionals.data().count
    });
  } catch (error: any) {
    console.error('Error getting clinic stats:', error);
    return res.status(500).json({ message: error.message });
  }
});

// GET /clinics/:clinicId/pending-counts - Get pending action counts for sidebar
router.get('/:clinicId/pending-counts', verifyAuth, async (req: Request, res: Response) => {
  try {
    const { clinicId } = req.params;
    const user = (req as any).user;

    if (user?.uid !== clinicId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const [
      pendingAppointments,
      escalatedConversations
    ] = await Promise.all([
      db.collection('gendei_appointments')
        .where('clinicId', '==', clinicId)
        .where('status', '==', 'pending')
        .count().get(),
      db.collection('gendei_conversations')
        .where('clinicId', '==', clinicId)
        .where('isHumanTakeover', '==', true)
        .count().get()
    ]);

    return res.json({
      pendingAppointments: pendingAppointments.data().count,
      escalatedConversations: escalatedConversations.data().count
    });
  } catch (error: any) {
    console.error('Error getting pending counts:', error);
    return res.status(500).json({ message: error.message });
  }
});

// ============================================
// AI SUMMARY GENERATION
// ============================================

// POST /clinics/me/generate-summary - Generate AI greeting summary from description
router.post('/me/generate-summary', verifyAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const clinicId = user?.uid;

    if (!clinicId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const { description, clinicName } = req.body;

    if (!description || description.trim().length < 20) {
      return res.status(400).json({ message: 'Description must be at least 20 characters' });
    }

    // Check if Anthropic API key is configured
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(500).json({ message: 'AI service not configured' });
    }

    // Generate summary using Claude
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 200,
      messages: [
        {
          role: 'user',
          content: `Você é um assistente de uma clínica de saúde. Crie uma mensagem de saudação curta e profissional (máximo 2 frases) para o bot do WhatsApp da clínica.

Nome da clínica: ${clinicName || 'a clínica'}

Descrição completa da clínica:
${description}

Regras:
- Comece com "Olá" ou "Oi"
- Mencione o nome da clínica
- Resuma em 1-2 frases o que a clínica oferece
- Use linguagem amigável e profissional
- Não use emojis
- Máximo 150 caracteres

Exemplo de formato:
"Olá, somos a [Nome]. [Breve descrição dos serviços em 1 frase]."

Responda APENAS com a mensagem de saudação, sem explicações adicionais.`
        }
      ]
    });

    const summary = (message.content[0] as any).text?.trim() || '';

    // Save the summary to the clinic document
    await db.collection(CLINICS).doc(clinicId).update({
      greetingSummary: summary,
      updatedAt: FieldValue.serverTimestamp()
    });

    return res.json({ summary });
  } catch (error: any) {
    console.error('Error generating summary:', error);
    return res.status(500).json({ message: error.message || 'Failed to generate summary' });
  }
});

// ============================================
// TIME BLOCKS
// ============================================

const TIME_BLOCKS = 'gendei_time_blocks';

// GET /clinics/:clinicId/time-blocks - Get time blocks for a date range
router.get('/:clinicId/time-blocks', verifyAuth, async (req: Request, res: Response) => {
  try {
    const { clinicId } = req.params;
    const user = (req as any).user;
    const { startDate, endDate, professionalId } = req.query;

    if (user?.uid !== clinicId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Simple query - just filter by clinicId to avoid index requirements
    const snapshot = await db.collection(TIME_BLOCKS)
      .where('clinicId', '==', clinicId)
      .get();

    let timeBlocks = snapshot.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data()
    }));

    // Filter by date range in memory
    if (startDate) {
      timeBlocks = timeBlocks.filter((block: any) => block.date >= startDate);
    }
    if (endDate) {
      timeBlocks = timeBlocks.filter((block: any) => block.date <= endDate);
    }

    // Filter by professional if specified
    if (professionalId) {
      timeBlocks = timeBlocks.filter((block: any) =>
        !block.professionalId || block.professionalId === professionalId
      );
    }

    // Sort by date and time
    timeBlocks.sort((a: any, b: any) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return (a.startTime || '').localeCompare(b.startTime || '');
    });

    return res.json({ timeBlocks });
  } catch (error: any) {
    console.error('Error getting time blocks:', error);
    return res.status(500).json({ message: error.message });
  }
});

// POST /clinics/:clinicId/time-blocks - Create a time block
router.post('/:clinicId/time-blocks', verifyAuth, async (req: Request, res: Response) => {
  try {
    const { clinicId } = req.params;
    const user = (req as any).user;

    if (user?.uid !== clinicId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { date, startTime, endTime, reason, professionalId, professionalName } = req.body;

    if (!date || !startTime || !endTime) {
      return res.status(400).json({ message: 'Date, start time, and end time are required' });
    }

    const blockData = {
      clinicId,
      date,
      startTime,
      endTime,
      reason: reason || 'Bloqueado',
      professionalId: professionalId || null,
      professionalName: professionalName || null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    };

    const docRef = await db.collection(TIME_BLOCKS).add(blockData);

    return res.status(201).json({
      id: docRef.id,
      ...blockData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error creating time block:', error);
    return res.status(500).json({ message: error.message });
  }
});

// DELETE /clinics/:clinicId/time-blocks/:blockId - Delete a time block
router.delete('/:clinicId/time-blocks/:blockId', verifyAuth, async (req: Request, res: Response) => {
  try {
    const { clinicId, blockId } = req.params;
    const user = (req as any).user;

    if (user?.uid !== clinicId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const blockDoc = await db.collection(TIME_BLOCKS).doc(blockId).get();

    if (!blockDoc.exists) {
      return res.status(404).json({ message: 'Time block not found' });
    }

    const blockData = blockDoc.data();
    if (blockData?.clinicId !== clinicId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    await db.collection(TIME_BLOCKS).doc(blockId).delete();

    return res.json({ message: 'Time block deleted' });
  } catch (error: any) {
    console.error('Error deleting time block:', error);
    return res.status(500).json({ message: error.message });
  }
});

export default router;
