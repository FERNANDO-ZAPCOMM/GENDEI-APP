// Gendei Meta/WhatsApp Routes
// Handles Embedded Signup and WhatsApp connection management for clinics

import { Router, Request, Response } from 'express';
import { getFirestore } from 'firebase-admin/firestore';
import { verifyAuth, verifyClinicAccess } from '../middleware/auth';
import * as metaService from '../services/meta';

const router = Router();
const db = getFirestore();

const CLINICS = 'gendei_clinics';

// ============================================
// EMBEDDED SIGNUP ENDPOINTS
// ============================================

// POST /meta/embedded-signup/start - Start embedded signup flow for a clinic
router.post(
  '/embedded-signup/start',
  verifyAuth,
  async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const clinicId = user?.clinicId;

      if (!clinicId) {
        return res.status(400).json({ message: 'Clinic ID is required' });
      }

      const { redirectUrl } = req.body;

      const result = await metaService.createEmbeddedSignupSession({
        clinicId,
        redirectUrl,
      });

      return res.json({
        success: true,
        launchUrl: result.launchUrl,
        state: result.state,
        sessionId: result.sessionId,
        redirectUri: result.redirectUri,
      });
    } catch (error: any) {
      console.error('Error starting embedded signup:', error);
      return res.status(500).json({
        message: error.message || 'Failed to start embedded signup',
      });
    }
  }
);

// POST /meta/embedded-signup/complete - Complete embedded signup from FB SDK callback
router.post(
  '/embedded-signup/complete',
  verifyAuth,
  async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const clinicId = user?.clinicId;

      if (!clinicId) {
        return res.status(400).json({ message: 'Clinic ID is required' });
      }

      const { accessToken, code, userID, wabaId, phoneNumberId, redirectUri } = req.body;

      if (!accessToken && !code) {
        return res.status(400).json({ message: 'Access token or authorization code is required' });
      }

      console.log(`Completing embedded signup for clinic: ${clinicId}`);

      let finalAccessToken = accessToken;

      // If we have a code instead of accessToken, exchange it
      if (!accessToken && code) {
        console.log('Exchanging authorization code for access token...');
        if (redirectUri) {
          finalAccessToken = await metaService.exchangeCodeForToken(code, redirectUri);
        } else {
          finalAccessToken = await metaService.exchangeCodeForToken(code, '');
        }
      }

      const result = await metaService.completeEmbeddedSignup({
        clinicId,
        accessToken: finalAccessToken,
        userID,
        wabaId,
        phoneNumberId,
      });

      // If successful, create reminder templates
      if (result.success && result.wabaId) {
        try {
          const clinicDoc = await db.collection(CLINICS).doc(clinicId).get();
          const clinicName = clinicDoc.data()?.name || 'Clinic';

          console.log(`Creating reminder templates for clinic ${clinicId}...`);
          const templateResult = await metaService.createReminderTemplates(result.wabaId, clinicName);

          // Update clinic with template creation status
          await db.collection(CLINICS).doc(clinicId).update({
            'whatsappConfig.templatesCreated': true,
            'whatsappConfig.templatesResult': templateResult,
          });

          console.log(`✅ Reminder templates created for clinic ${clinicId}:`, templateResult);
        } catch (templateError: any) {
          console.error('Error creating reminder templates:', templateError);
          // Don't fail the whole signup if template creation fails
        }
      }

      return res.json(result);
    } catch (error: any) {
      console.error('Error completing embedded signup:', error);
      return res.status(500).json({
        message: error.message || 'Failed to complete WhatsApp setup',
      });
    }
  }
);

// POST /meta/embedded-signup/complete-with-ids - Complete with WABA IDs from postMessage
router.post(
  '/embedded-signup/complete-with-ids',
  verifyAuth,
  async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const clinicId = user?.clinicId;

      if (!clinicId) {
        return res.status(400).json({ message: 'Clinic ID is required' });
      }

      const { wabaId, phoneNumberId, state } = req.body;

      if (!wabaId) {
        return res.status(400).json({ message: 'WABA ID is required' });
      }

      console.log(`Completing embedded signup with IDs for clinic: ${clinicId}`);

      // Verify state token if provided
      if (state) {
        try {
          metaService.verifyStateToken(state);
        } catch (error: any) {
          console.warn('State token verification failed (non-fatal):', error.message);
        }
      }

      // Save connection directly with provided IDs
      const result = await metaService.saveConnectionWithIds({
        clinicId,
        wabaId,
        phoneNumberId,
      });

      // Create reminder templates
      if (result.success) {
        try {
          const clinicDoc = await db.collection(CLINICS).doc(clinicId).get();
          const clinicName = clinicDoc.data()?.name || 'Clinic';

          console.log(`Creating reminder templates for clinic ${clinicId}...`);
          const templateResult = await metaService.createReminderTemplates(wabaId, clinicName);

          await db.collection(CLINICS).doc(clinicId).update({
            'whatsappConfig.templatesCreated': true,
            'whatsappConfig.templatesResult': templateResult,
          });

          console.log(`✅ Reminder templates created for clinic ${clinicId}:`, templateResult);
        } catch (templateError: any) {
          console.error('Error creating reminder templates:', templateError);
        }
      }

      return res.json(result);
    } catch (error: any) {
      console.error('Error completing embedded signup with IDs:', error);
      return res.status(500).json({
        message: error.message || 'Failed to complete WhatsApp setup',
      });
    }
  }
);

// POST /meta/embedded-signup/complete-direct - Complete with WABA IDs from direct Meta redirect
// Authentication via state JWT token (not Firebase auth) since this is a redirect flow
router.post('/embedded-signup/complete-direct', async (req: Request, res: Response) => {
  try {
    const { wabaId, phoneNumberId, state } = req.body;

    if (!state) {
      return res.status(400).json({ message: 'State token is required' });
    }

    if (!wabaId) {
      return res.status(400).json({ message: 'WABA ID is required' });
    }

    // Verify state token and extract clinicId
    let clinicId: string;
    try {
      const decoded = metaService.verifyStateToken(state);
      clinicId = decoded.clinicId;
    } catch (error: any) {
      console.error('State token verification failed:', error.message);
      return res.status(401).json({ message: error.message || 'Invalid or expired state token' });
    }

    console.log(`Completing direct embedded signup for clinic: ${clinicId}`);

    // Save connection directly with provided IDs
    const result = await metaService.saveConnectionWithIds({
      clinicId,
      wabaId,
      phoneNumberId,
    });

    // Create reminder templates
    if (result.success) {
      try {
        const clinicDoc = await db.collection(CLINICS).doc(clinicId).get();
        const clinicName = clinicDoc.data()?.name || 'Clinic';

        const templateResult = await metaService.createReminderTemplates(wabaId, clinicName);

        await db.collection(CLINICS).doc(clinicId).update({
          'whatsappConfig.templatesCreated': true,
          'whatsappConfig.templatesResult': templateResult,
        });
      } catch (templateError: any) {
        console.error('Error creating reminder templates:', templateError);
      }
    }

    return res.json({ ...result, clinicId });
  } catch (error: any) {
    console.error('Error completing direct embedded signup:', error);
    return res.status(500).json({
      message: error.message || 'Failed to complete WhatsApp setup',
    });
  }
});

// POST /meta/embedded-signup/complete-code - Complete when Meta redirected with ?code&state
router.post('/embedded-signup/complete-code', async (req: Request, res: Response) => {
  try {
    const { code, state } = req.body;

    if (!state) {
      return res.status(400).json({ message: 'State token is required' });
    }
    if (!code) {
      return res.status(400).json({ message: 'Authorization code is required' });
    }

    // Verify state token and extract clinicId
    let clinicId: string;
    try {
      const decoded = metaService.verifyStateToken(state);
      clinicId = decoded.clinicId;
    } catch (error: any) {
      console.error('State token verification failed:', error.message);
      return res.status(401).json({ message: error.message || 'Invalid or expired state token' });
    }

    // Retrieve original redirect URI
    const session = await metaService.getEmbeddedSignupSession(state);
    const redirectUri =
      session?.redirectUri ||
      process.env.GENDEI_REDIRECT_URI ||
      `${process.env.GENDEI_FRONTEND_URL || 'https://gendei.com'}/meta/callback`;

    console.log(`Completing embedded signup via code for clinic: ${clinicId}`);

    // Process OAuth callback
    const connectionData = await metaService.processOAuthCallback(code, clinicId, redirectUri);

    // Update connection status
    await metaService.updateConnectionStatus(clinicId, connectionData);

    // Create reminder templates
    if (connectionData.wabaId) {
      try {
        const clinicDoc = await db.collection(CLINICS).doc(clinicId).get();
        const clinicName = clinicDoc.data()?.name || 'Clinic';

        const templateResult = await metaService.createReminderTemplates(connectionData.wabaId, clinicName);

        await db.collection(CLINICS).doc(clinicId).update({
          'whatsappConfig.templatesCreated': true,
          'whatsappConfig.templatesResult': templateResult,
        });
      } catch (templateError: any) {
        console.error('Error creating reminder templates:', templateError);
      }
    }

    return res.json({
      success: true,
      clinicId,
      ...connectionData,
    });
  } catch (error: any) {
    console.error('Error completing embedded signup via code:', error);
    return res.status(500).json({
      message: error.message || 'Failed to complete WhatsApp setup',
    });
  }
});

// GET /meta/oauth/callback - Handle OAuth callback from Meta (PUBLIC endpoint)
router.get('/oauth/callback', async (req: Request, res: Response) => {
  const frontendUrl = process.env.GENDEI_FRONTEND_URL || 'https://gendei.com';
  const redirectUrl = process.env.GENDEI_REDIRECT_URI || `${frontendUrl}/meta/callback`;

  try {
    console.log('OAuth callback received with params:', req.query);

    const { code, state, waba_id, phone_number_id } = req.query;

    if (!state) {
      const message = encodeURIComponent('State token missing');
      return res.redirect(`${redirectUrl}?status=error&message=${message}`);
    }

    // Verify state token and extract clinicId
    const { clinicId } = metaService.verifyStateToken(state as string);

    // Get the session to retrieve original redirect URI
    const session = await metaService.getEmbeddedSignupSession(state as string);
    const originalRedirectUri = session?.redirectUri || redirectUrl;

    // If we got an authorization code, prioritize the full OAuth flow
    if (code) {
      try {
        const connectionData = await metaService.processOAuthCallback(
          code as string,
          clinicId,
          originalRedirectUri
        );

        // Update connection status in Firestore
        await metaService.updateConnectionStatus(clinicId, connectionData);

        // Create reminder templates
        if (connectionData.wabaId) {
          try {
            const clinicDoc = await db.collection(CLINICS).doc(clinicId).get();
            const clinicName = clinicDoc.data()?.name || 'Clinic';
            await metaService.createReminderTemplates(connectionData.wabaId, clinicName);
          } catch (templateError) {
            console.error('Error creating templates:', templateError);
          }
        }

        // Redirect to frontend success page
        const params = new URLSearchParams({
          status: 'success',
          clinicId,
          wabaId: connectionData.wabaId,
        });
        if (connectionData.phoneNumberId) {
          params.append('phoneNumberId', connectionData.phoneNumberId);
        }
        return res.redirect(`${redirectUrl}?${params.toString()}`);
      } catch (codeError) {
        console.error('OAuth code handling failed:', codeError);
      }
    }

    // Check if we received WABA info directly
    if (waba_id) {
      console.log(`Received WABA info directly: wabaId=${waba_id}, phoneNumberId=${phone_number_id}`);

      await metaService.saveConnectionWithIds({
        clinicId,
        wabaId: waba_id as string,
        phoneNumberId: phone_number_id as string | undefined,
      });

      // Create reminder templates
      try {
        const clinicDoc = await db.collection(CLINICS).doc(clinicId).get();
        const clinicName = clinicDoc.data()?.name || 'Clinic';
        await metaService.createReminderTemplates(waba_id as string, clinicName);
      } catch (templateError) {
        console.error('Error creating templates:', templateError);
      }

      const params = new URLSearchParams({
        status: 'success',
        clinicId,
        wabaId: waba_id as string,
      });
      if (phone_number_id) {
        params.append('phoneNumberId', phone_number_id as string);
      }
      return res.redirect(`${redirectUrl}?${params.toString()}`);
    }

    const message = encodeURIComponent('Missing authorization code or WABA information');
    return res.redirect(`${redirectUrl}?status=error&message=${message}`);
  } catch (error: any) {
    console.error('OAuth callback error:', error);
    const message = encodeURIComponent(error.message || 'OAuth callback failed');
    return res.redirect(`${redirectUrl}?status=error&message=${message}`);
  }
});

// ============================================
// STATUS & MANAGEMENT ENDPOINTS
// ============================================

// GET /meta/status/:clinicId - Get WhatsApp connection status
router.get(
  '/status/:clinicId',
  verifyAuth,
  verifyClinicAccess,
  async (req: Request, res: Response) => {
    try {
      const { clinicId } = req.params;
      const status = await metaService.getConnectionStatus(clinicId);
      res.json({
        success: true,
        data: status,
      });
    } catch (error) {
      console.error('Error fetching connection status:', error);
      res.status(500).json({ error: 'Failed to fetch connection status' });
    }
  }
);

// POST /meta/sync/:clinicId - Sync WhatsApp connection data
router.post(
  '/sync/:clinicId',
  verifyAuth,
  verifyClinicAccess,
  async (req: Request, res: Response) => {
    try {
      const { clinicId } = req.params;

      // Fix verification status if needed
      await metaService.fixVerificationStatus(clinicId);

      const status = await metaService.getConnectionStatus(clinicId);
      res.json({
        success: true,
        data: status,
      });
    } catch (error) {
      console.error('Error syncing connection:', error);
      res.status(500).json({ error: 'Failed to sync connection' });
    }
  }
);

// POST /meta/disconnect/:clinicId - Disconnect WhatsApp
router.post(
  '/disconnect/:clinicId',
  verifyAuth,
  verifyClinicAccess,
  async (req: Request, res: Response) => {
    try {
      const { clinicId } = req.params;
      await metaService.disconnect(clinicId);
      res.json({ success: true });
    } catch (error) {
      console.error('Error disconnecting WhatsApp:', error);
      res.status(500).json({ error: 'Failed to disconnect WhatsApp' });
    }
  }
);

// POST /meta/configure-webhook/:clinicId - Configure webhook for existing connection
router.post(
  '/configure-webhook/:clinicId',
  verifyAuth,
  verifyClinicAccess,
  async (req: Request, res: Response) => {
    try {
      const { clinicId } = req.params;

      const status = await metaService.getConnectionStatus(clinicId);

      if (!status.meta?.wabaId) {
        return res.status(400).json({ error: 'No WhatsApp Business Account connected' });
      }

      await metaService.configureWebhook(clinicId, status.meta.wabaId);

      return res.json({
        success: true,
        message: 'Webhook configured successfully',
        wabaId: status.meta.wabaId,
      });
    } catch (error: any) {
      console.error('Error configuring webhook:', error);
      return res.status(500).json({ error: error.message || 'Failed to configure webhook' });
    }
  }
);

// ============================================
// TEMPLATE MANAGEMENT ENDPOINTS
// ============================================

// GET /meta/templates/:clinicId - Get all message templates
router.get(
  '/templates/:clinicId',
  verifyAuth,
  verifyClinicAccess,
  async (req: Request, res: Response) => {
    try {
      const { clinicId } = req.params;

      const status = await metaService.getConnectionStatus(clinicId);

      if (!status.meta?.wabaId) {
        return res.status(400).json({ error: 'No WhatsApp Business Account connected' });
      }

      const templates = await metaService.getMessageTemplates(status.meta.wabaId);

      return res.json({
        success: true,
        wabaId: status.meta.wabaId,
        templates,
      });
    } catch (error: any) {
      console.error('Error fetching templates:', error);
      return res.status(500).json({ error: error.message || 'Failed to fetch templates' });
    }
  }
);

// POST /meta/templates/:clinicId - Create reminder templates
router.post(
  '/templates/:clinicId',
  verifyAuth,
  verifyClinicAccess,
  async (req: Request, res: Response) => {
    try {
      const { clinicId } = req.params;

      const status = await metaService.getConnectionStatus(clinicId);

      if (!status.meta?.wabaId) {
        return res.status(400).json({ error: 'No WhatsApp Business Account connected' });
      }

      const clinicDoc = await db.collection(CLINICS).doc(clinicId).get();
      const clinicName = clinicDoc.data()?.name || 'Clinic';

      const result = await metaService.createReminderTemplates(status.meta.wabaId, clinicName);

      // Update clinic with template creation status
      await db.collection(CLINICS).doc(clinicId).update({
        'whatsappConfig.templatesCreated': true,
        'whatsappConfig.templatesResult': result,
      });

      return res.json({
        success: true,
        wabaId: status.meta.wabaId,
        ...result,
      });
    } catch (error: any) {
      console.error('Error creating templates:', error);
      return res.status(500).json({ error: error.message || 'Failed to create templates' });
    }
  }
);

// DELETE /meta/templates/:clinicId/:templateName - Delete a message template
router.delete(
  '/templates/:clinicId/:templateName',
  verifyAuth,
  verifyClinicAccess,
  async (req: Request, res: Response) => {
    try {
      const { clinicId, templateName } = req.params;

      const status = await metaService.getConnectionStatus(clinicId);

      if (!status.meta?.wabaId) {
        return res.status(400).json({ error: 'No WhatsApp Business Account connected' });
      }

      await metaService.deleteMessageTemplate(status.meta.wabaId, templateName);

      return res.json({
        success: true,
        message: `Template "${templateName}" deleted successfully`,
      });
    } catch (error: any) {
      console.error('Error deleting template:', error);
      return res.status(500).json({ error: error.message || 'Failed to delete template' });
    }
  }
);

// ============================================
// MESSAGING ENDPOINTS
// ============================================

// POST /meta/send/:clinicId - Send WhatsApp message
router.post(
  '/send/:clinicId',
  verifyAuth,
  verifyClinicAccess,
  async (req: Request, res: Response) => {
    try {
      const { clinicId } = req.params;
      const { to, message } = req.body;

      if (!to || !message) {
        return res.status(400).json({ error: 'Phone number and message are required' });
      }

      const result = await metaService.sendMessage(clinicId, to, message);

      return res.json({
        success: true,
        ...result,
      });
    } catch (error: any) {
      console.error('Error sending message:', error);
      return res.status(500).json({ error: error.message || 'Failed to send message' });
    }
  }
);

// POST /meta/send-template/:clinicId - Send template message
router.post(
  '/send-template/:clinicId',
  verifyAuth,
  verifyClinicAccess,
  async (req: Request, res: Response) => {
    try {
      const { clinicId } = req.params;
      const { to, templateName, parameters } = req.body;

      if (!to || !templateName) {
        return res.status(400).json({ error: 'Phone number and template name are required' });
      }

      const result = await metaService.sendTemplateMessage(
        clinicId,
        to,
        templateName,
        parameters || []
      );

      return res.json({
        success: true,
        ...result,
      });
    } catch (error: any) {
      console.error('Error sending template message:', error);
      return res.status(500).json({ error: error.message || 'Failed to send template message' });
    }
  }
);

// POST /meta/test/:clinicId - Send test message
router.post(
  '/test/:clinicId',
  verifyAuth,
  verifyClinicAccess,
  async (req: Request, res: Response) => {
    try {
      const { clinicId } = req.params;
      const { to } = req.body;

      if (!to) {
        return res.status(400).json({ error: 'Phone number is required' });
      }

      const status = await metaService.getConnectionStatus(clinicId);

      if (!status.meta?.phoneNumberId) {
        return res.status(400).json({ error: 'WhatsApp not configured' });
      }

      const result = await metaService.sendTestMessage(status.meta.phoneNumberId, to, clinicId);

      return res.json({
        success: true,
        ...result,
      });
    } catch (error: any) {
      console.error('Error sending test message:', error);
      return res.status(500).json({ error: error.message || 'Failed to send test message' });
    }
  }
);

// ============================================
// WHATSAPP FLOWS ENDPOINTS
// ============================================

// POST /meta/flows/endpoint - WhatsApp Flow data exchange endpoint (PUBLIC - called by Meta)
// This is the endpoint that WhatsApp Flows call when they need dynamic data
router.post('/flows/endpoint', async (req: Request, res: Response) => {
  try {
    console.log('Flow endpoint called:', JSON.stringify(req.body, null, 2));

    const { flow_token, screen, data, version } = req.body;

    // Parse flow_token to get clinicId
    let clinicId: string | null = null;
    try {
      const tokenData = JSON.parse(Buffer.from(flow_token, 'base64').toString());
      clinicId = tokenData.clinicId;
    } catch {
      console.error('Failed to parse flow_token');
    }

    if (!clinicId) {
      return res.status(400).json({ error: 'Invalid flow token' });
    }

    // Get clinic data
    const clinicDoc = await db.collection(CLINICS).doc(clinicId).get();
    const clinicData = clinicDoc.data();

    if (!clinicData) {
      return res.status(404).json({ error: 'Clinic not found' });
    }

    // Handle different screens
    let responseData: any = {};
    let nextScreen: string | null = null;

    switch (screen) {
      case 'ESPECIALIDADE': {
        // User selected a specialty, navigate to next screen
        const selectedEspecialidade = data?.especialidade;

        // Get professional info for the selected specialty
        const professionalsRef = db.collection(CLINICS).doc(clinicId).collection('professionals');
        const profSnapshot = await professionalsRef
          .where('specialty', '==', selectedEspecialidade)
          .limit(1)
          .get();

        const professional = profSnapshot.docs[0]?.data();

        if (clinicData.acceptsConvenio) {
          nextScreen = 'TIPO_ATENDIMENTO';
          responseData = {
            especialidade: selectedEspecialidade,
            profissional_nome: professional?.name || 'Profissional',
          };
        } else {
          nextScreen = 'DADOS_PACIENTE';
          responseData = {
            especialidade: selectedEspecialidade,
            profissional_nome: professional?.name || 'Profissional',
            tipo_pagamento: 'particular',
            convenio_nome: '',
            convenio_numero: '',
          };
        }
        break;
      }

      case 'TIPO_ATENDIMENTO': {
        // User selected payment type
        const tipoPagamento = data?.tipo_pagamento;

        if (tipoPagamento === 'convenio') {
          nextScreen = 'INFO_CONVENIO';
          // Get accepted convenios from clinic settings
          const conveniosAceitos = clinicData.acceptedConvenios || [
            { id: 'unimed', title: 'Unimed' },
            { id: 'bradesco_saude', title: 'Bradesco Saúde' },
            { id: 'sulamerica', title: 'SulAmérica' },
            { id: 'amil', title: 'Amil' },
            { id: 'hapvida', title: 'Hapvida' },
            { id: 'outro', title: 'Outro' },
          ];
          responseData = {
            ...data,
            convenios_aceitos: conveniosAceitos,
          };
        } else {
          nextScreen = 'DADOS_PACIENTE';
          responseData = {
            ...data,
            convenio_nome: '',
            convenio_numero: '',
          };
        }
        break;
      }

      case 'DADOS_PACIENTE': {
        // User filled patient data, show available times
        nextScreen = 'SELECAO_HORARIO';

        // Get available time slots from clinic settings or defaults
        const horariosDisponiveis = clinicData.availableTimeSlots || [
          { id: '08:00', title: '08:00' },
          { id: '09:00', title: '09:00' },
          { id: '10:00', title: '10:00' },
          { id: '11:00', title: '11:00' },
          { id: '14:00', title: '14:00' },
          { id: '15:00', title: '15:00' },
          { id: '16:00', title: '16:00' },
          { id: '17:00', title: '17:00' },
        ];

        responseData = {
          ...data,
          horarios_disponiveis: horariosDisponiveis,
        };
        break;
      }

      default:
        return res.status(400).json({ error: `Unknown screen: ${screen}` });
    }

    // Return response in WhatsApp Flow format
    return res.json({
      version: version || '3.0',
      screen: nextScreen,
      data: responseData,
    });
  } catch (error: any) {
    console.error('Flow endpoint error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// GET /meta/flows/endpoint - Health check for WhatsApp Flows (called by Meta to verify endpoint)
router.get('/flows/endpoint', (_req: Request, res: Response) => {
  return res.status(200).json({ status: 'ok' });
});

// GET /meta/flows/:clinicId - List flows for a clinic
router.get(
  '/flows/:clinicId',
  verifyAuth,
  verifyClinicAccess,
  async (req: Request, res: Response) => {
    try {
      const { clinicId } = req.params;

      const clinicDoc = await db.collection(CLINICS).doc(clinicId).get();
      const clinicData = clinicDoc.data();

      if (!clinicData?.whatsappWabaId) {
        return res.status(400).json({ error: 'WhatsApp not configured for this clinic' });
      }

      const flows = await metaService.listFlows(clinicData.whatsappWabaId);

      return res.json({
        success: true,
        flows,
        clinicFlowId: clinicData.whatsappFlowId,
        clinicFlowName: clinicData.whatsappFlowName,
      });
    } catch (error: any) {
      console.error('Error listing flows:', error);
      return res.status(500).json({ error: error.message || 'Failed to list flows' });
    }
  }
);

// POST /meta/flows/:clinicId - Create scheduling flow for a clinic
router.post(
  '/flows/:clinicId',
  verifyAuth,
  verifyClinicAccess,
  async (req: Request, res: Response) => {
    try {
      const { clinicId } = req.params;
      const { acceptsConvenio } = req.body;

      const clinicDoc = await db.collection(CLINICS).doc(clinicId).get();
      const clinicData = clinicDoc.data();

      if (!clinicData?.whatsappWabaId) {
        return res.status(400).json({ error: 'WhatsApp not configured for this clinic' });
      }

      // Get the endpoint URI from environment or construct it
      const endpointUri =
        process.env.GENDEI_FLOWS_ENDPOINT_URI ||
        `${process.env.FUNCTIONS_URL || 'https://us-central1-gendei.cloudfunctions.net/api'}/meta/flows/endpoint`;

      const result = await metaService.createSchedulingFlow(
        clinicData.whatsappWabaId,
        clinicId,
        acceptsConvenio ?? clinicData.acceptsConvenio ?? false,
        endpointUri
      );

      // Update clinic with acceptsConvenio setting
      if (acceptsConvenio !== undefined) {
        await db.collection(CLINICS).doc(clinicId).update({
          acceptsConvenio,
        });
      }

      return res.json({
        success: result.success,
        flowId: result.flowId,
        errors: result.errors,
      });
    } catch (error: any) {
      console.error('Error creating flow:', error);
      return res.status(500).json({ error: error.message || 'Failed to create flow' });
    }
  }
);

// POST /meta/flows/:clinicId/send - Send a flow message to a patient
router.post(
  '/flows/:clinicId/send',
  verifyAuth,
  verifyClinicAccess,
  async (req: Request, res: Response) => {
    try {
      const { clinicId } = req.params;
      const { to, headerText, bodyText, ctaText } = req.body;

      if (!to) {
        return res.status(400).json({ error: 'Phone number (to) is required' });
      }

      const clinicDoc = await db.collection(CLINICS).doc(clinicId).get();
      const clinicData = clinicDoc.data();

      if (!clinicData?.whatsappFlowId) {
        return res.status(400).json({ error: 'Flow not configured for this clinic' });
      }

      // Create flow token with clinic info
      const flowToken = Buffer.from(
        JSON.stringify({
          clinicId,
          timestamp: Date.now(),
        })
      ).toString('base64');

      // Get specialties/services for initial data
      const servicesRef = db.collection(CLINICS).doc(clinicId).collection('services');
      const servicesSnapshot = await servicesRef.where('isActive', '==', true).get();

      const especialidades = servicesSnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          title: data.name,
          description: data.professionalName || data.description || '',
        };
      });

      // If no services, use default
      const initialData = {
        especialidades:
          especialidades.length > 0
            ? especialidades
            : [{ id: 'consulta', title: 'Consulta Geral', description: 'Atendimento médico' }],
      };

      const result = await metaService.sendFlowMessage(
        clinicId,
        to,
        clinicData.whatsappFlowId,
        flowToken,
        headerText || 'Agendar Consulta',
        bodyText || 'Clique no botão abaixo para agendar sua consulta de forma rápida e fácil.',
        ctaText || 'Agendar Agora',
        initialData
      );

      return res.json({
        success: true,
        messageId: result.messageId,
      });
    } catch (error: any) {
      console.error('Error sending flow message:', error);
      return res.status(500).json({ error: error.message || 'Failed to send flow message' });
    }
  }
);

export default router;
