// Gendei Meta/WhatsApp Integration Service
// Handles Embedded Signup, OAuth, and WhatsApp API interactions for clinics

import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';

const db = getFirestore();

// Gendei Firestore collections
const CLINICS = 'gendei_clinics';
const TOKENS = 'gendei_tokens';
const OAUTH_SESSIONS = 'gendei_oauth_sessions';

// Get configuration from environment variables
const getMetaApiVersion = () => process.env.META_API_VERSION || 'v24.0';
const getMetaBisuToken = () => process.env.META_BISU_ACCESS_TOKEN || '';
const getMetaAppId = () => process.env.META_APP_ID || '';
const getMetaAppSecret = () => process.env.META_APP_SECRET || '';
const getMetaConfigId = () => process.env.META_CONFIG_ID || '';
const getJwtSecret = () => process.env.JWT_SECRET || 'gendei-jwt-secret-change-in-production';
const getFrontendUrl = () => process.env.GENDEI_FRONTEND_URL || 'https://gendei.com';
const getMetaRedirectUri = () => process.env.GENDEI_REDIRECT_URI || `${getFrontendUrl()}/meta/callback`;
const getWhatsAppAgentUrl = () => process.env.GENDEI_WHATSAPP_AGENT_URL || '';

export interface WhatsAppConnectionStatus {
  meta?: {
    businessManagerId?: string;
    businessManagerName?: string;
    wabaId?: string;
    wabaName?: string;
    phoneNumberId?: string;
    phoneNumber?: string;
    displayPhoneNumber?: string;
    verifiedName?: string;
    qualityRating?: string;
    connectedAt?: Date;
    lastSyncedAt?: Date;
  };
  whatsappStatus: string;
  whatsappConfig?: {
    isVerified?: boolean;
    verifiedAt?: Date;
    testMessageSent?: boolean;
    templatesCreated?: boolean;
  };
}

// ============================================
// CONNECTION STATUS
// ============================================

/**
 * Get WhatsApp connection status for a clinic
 */
export async function getConnectionStatus(
  clinicId: string
): Promise<WhatsAppConnectionStatus> {
  try {
    const doc = await db.collection(CLINICS).doc(clinicId).get();

    if (!doc.exists) {
      return { whatsappStatus: 'DISCONNECTED' };
    }

    const data = doc.data();
    if (!data) {
      return { whatsappStatus: 'DISCONNECTED' };
    }

    // Determine status based on connection
    let whatsappStatus = 'DISCONNECTED';
    if (data.whatsappConnected) {
      if (data.whatsappConfig?.isVerified) {
        whatsappStatus = 'READY';
      } else {
        whatsappStatus = 'NEEDS_VERIFICATION';
      }
    }

    return {
      meta: {
        businessManagerId: data.whatsappBusinessManagerId,
        businessManagerName: data.whatsappWabaName,
        wabaId: data.whatsappWabaId,
        wabaName: data.whatsappWabaName,
        phoneNumberId: data.whatsappPhoneNumberId,
        phoneNumber: data.whatsappPhoneNumber,
        displayPhoneNumber: data.whatsappPhoneNumber,
        verifiedName: data.whatsappVerifiedName,
        qualityRating: data.whatsappQualityRating,
        connectedAt: data.whatsappConnectedAt?.toDate?.() || data.whatsappConnectedAt,
        lastSyncedAt: data.whatsappLastSyncedAt?.toDate?.() || data.whatsappLastSyncedAt,
      },
      whatsappStatus,
      whatsappConfig: data.whatsappConfig,
    };
  } catch (error) {
    console.error('Error fetching connection status:', error);
    throw error;
  }
}

/**
 * Disconnect WhatsApp account from clinic
 */
export async function disconnect(clinicId: string): Promise<boolean> {
  try {
    // Clear WhatsApp connection data
    await db.collection(CLINICS).doc(clinicId).update({
      whatsappConnected: false,
      whatsappPhoneNumber: FieldValue.delete(),
      whatsappPhoneNumberId: FieldValue.delete(),
      whatsappWabaId: FieldValue.delete(),
      whatsappWabaName: FieldValue.delete(),
      whatsappBusinessManagerId: FieldValue.delete(),
      whatsappQualityRating: FieldValue.delete(),
      whatsappConnectedAt: FieldValue.delete(),
      whatsappLastSyncedAt: FieldValue.delete(),
      whatsappConfig: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Delete access token
    await db.collection(TOKENS).doc(clinicId).delete();

    console.log(`Disconnected WhatsApp for clinic: ${clinicId}`);
    return true;
  } catch (error) {
    console.error('Error disconnecting WhatsApp:', error);
    throw error;
  }
}

// ============================================
// ACCESS TOKEN MANAGEMENT
// ============================================

/**
 * Get access token for a clinic
 */
export async function getAccessToken(clinicId: string): Promise<string> {
  // First try BISU token from environment
  const bisuToken = getMetaBisuToken();
  if (bisuToken) {
    return bisuToken;
  }

  // Fall back to clinic OAuth token
  const doc = await db.collection(TOKENS).doc(clinicId).get();

  if (!doc.exists) {
    throw new Error('Access token not found');
  }

  const data = doc.data();
  if (!data?.accessToken) {
    throw new Error('Access token data is invalid');
  }

  return data.accessToken;
}

/**
 * Store access token for a clinic
 */
export async function storeAccessToken(
  clinicId: string,
  accessToken: string,
  expiresIn?: number
): Promise<void> {
  const tokenData: Record<string, any> = {
    accessToken,
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (expiresIn) {
    tokenData.expiresAt = new Date(Date.now() + expiresIn * 1000);
  }

  await db.collection(TOKENS).doc(clinicId).set(tokenData, { merge: true });
  console.log(`Stored access token for clinic: ${clinicId}`);
}

// ============================================
// EMBEDDED SIGNUP FUNCTIONS
// ============================================

/**
 * Generate state token for OAuth flow
 */
export function generateStateToken(clinicId: string): string {
  const secret = getJwtSecret();
  const nonce = crypto.randomBytes(16).toString('hex');

  return jwt.sign(
    {
      clinicId,
      timestamp: Date.now(),
      nonce,
    },
    secret,
    {
      expiresIn: '10m',
      issuer: 'gendei',
      audience: 'meta-oauth',
    }
  );
}

/**
 * Verify and decode state token
 */
export function verifyStateToken(state: string): { clinicId: string; timestamp: number } {
  try {
    const secret = getJwtSecret();
    const decoded = jwt.verify(state, secret, {
      issuer: 'gendei',
      audience: 'meta-oauth',
    }) as { clinicId: string; timestamp: number; nonce: string };

    return { clinicId: decoded.clinicId, timestamp: decoded.timestamp };
  } catch (error: any) {
    console.error('State token verification failed:', error);
    if (error.name === 'TokenExpiredError') {
      throw new Error('State token has expired. Please try again.');
    }
    throw new Error('Invalid or expired state token');
  }
}

/**
 * Generate Meta Embedded Signup URL
 */
function generateEmbeddedSignupUrl(state: string, redirectUri: string): string {
  const appId = getMetaAppId();
  const configId = getMetaConfigId();

  const params = new URLSearchParams({
    app_id: appId,
    redirect_uri: redirectUri,
    state,
  });

  if (configId) {
    params.append('config_id', configId);
  }

  return `https://business.facebook.com/messaging/whatsapp/onboard/?${params.toString()}`;
}

/**
 * Create embedded signup session for a clinic
 */
export async function createEmbeddedSignupSession(options: {
  clinicId: string;
  redirectUrl?: string;
}): Promise<{
  launchUrl: string;
  state: string;
  sessionId?: string;
  redirectUri: string;
}> {
  const { clinicId } = options;
  const redirectUri = options.redirectUrl || getMetaRedirectUri();
  const state = generateStateToken(clinicId);

  const launchUrl = generateEmbeddedSignupUrl(state, redirectUri);

  console.log('Creating embedded signup session:', {
    clinicId,
    redirectUri,
    launchUrl: launchUrl.substring(0, 100) + '...',
  });

  // Store session for later retrieval
  const sessionId = crypto.randomBytes(16).toString('hex');
  await db.collection(OAUTH_SESSIONS).doc(sessionId).set({
    clinicId,
    state,
    redirectUri,
    createdAt: FieldValue.serverTimestamp(),
    expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
  });

  return {
    launchUrl,
    state,
    sessionId,
    redirectUri,
  };
}

/**
 * Get embedded signup session
 */
export async function getEmbeddedSignupSession(
  state: string
): Promise<{ redirectUri?: string; clinicId?: string } | null> {
  try {
    const snapshot = await db
      .collection(OAUTH_SESSIONS)
      .where('state', '==', state)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return null;
    }

    return snapshot.docs[0].data() as { redirectUri?: string; clinicId?: string };
  } catch (error) {
    console.error('Error getting signup session:', error);
    return null;
  }
}

/**
 * Exchange authorization code for access token
 */
export async function exchangeCodeForToken(
  code: string,
  redirectUri: string
): Promise<string> {
  const appId = getMetaAppId();
  const appSecret = getMetaAppSecret();

  const params = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    code,
  });

  if (redirectUri) {
    params.append('redirect_uri', redirectUri);
  }

  const response = await fetch(
    `https://graph.facebook.com/v24.0/oauth/access_token?${params.toString()}`
  );

  if (!response.ok) {
    const error = await response.json();
    console.error('Token exchange failed:', error);
    throw new Error(error.error?.message || 'Failed to exchange code for token');
  }

  const data = await response.json();
  return data.access_token;
}

/**
 * Complete embedded signup with provided WABA IDs
 */
export async function saveConnectionWithIds(options: {
  clinicId: string;
  wabaId: string;
  phoneNumberId?: string;
}): Promise<{ success: boolean; wabaId: string; phoneNumberId?: string }> {
  const { clinicId, wabaId, phoneNumberId } = options;

  console.log(`Saving WhatsApp connection for clinic ${clinicId}:`, { wabaId, phoneNumberId });

  // Get phone number details if we have phoneNumberId
  let phoneNumber: string | undefined;
  let verifiedName: string | undefined;

  if (phoneNumberId) {
    try {
      const bisuToken = getMetaBisuToken();
      if (bisuToken) {
        const response = await fetch(
          `https://graph.facebook.com/v24.0/${phoneNumberId}?fields=display_phone_number,verified_name,quality_rating`,
          {
            headers: { Authorization: `Bearer ${bisuToken}` },
          }
        );

        if (response.ok) {
          const data = await response.json();
          phoneNumber = data.display_phone_number;
          verifiedName = data.verified_name;
        }
      }
    } catch (error) {
      console.warn('Could not fetch phone details:', error);
    }
  }

  // Update clinic with WhatsApp connection
  const updateData: Record<string, any> = {
    whatsappConnected: true,
    whatsappWabaId: wabaId,
    whatsappConnectedAt: FieldValue.serverTimestamp(),
    whatsappLastSyncedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (phoneNumberId) {
    updateData.whatsappPhoneNumberId = phoneNumberId;
  }
  if (phoneNumber) {
    updateData.whatsappPhoneNumber = phoneNumber;
  }
  if (verifiedName) {
    updateData.whatsappVerifiedName = verifiedName;
  }

  // Mark as verified (Embedded Signup phones are pre-verified)
  updateData.whatsappConfig = {
    isVerified: true,
    verifiedAt: new Date(),
  };

  await db.collection(CLINICS).doc(clinicId).update(updateData);

  console.log(`✅ WhatsApp connected for clinic ${clinicId}`);

  return {
    success: true,
    wabaId,
    phoneNumberId,
  };
}

/**
 * Complete embedded signup flow
 */
export async function completeEmbeddedSignup(options: {
  clinicId: string;
  accessToken: string;
  userID?: string;
  wabaId?: string;
  phoneNumberId?: string;
}): Promise<{ success: boolean; wabaId?: string; phoneNumberId?: string }> {
  const { clinicId, accessToken, wabaId, phoneNumberId } = options;

  console.log(`Completing embedded signup for clinic: ${clinicId}`);

  // Store access token
  await storeAccessToken(clinicId, accessToken);

  // If WABA ID was provided directly, save it
  if (wabaId) {
    return saveConnectionWithIds({ clinicId, wabaId, phoneNumberId });
  }

  // Otherwise discover WABA from access token
  try {
    const discovered = await discoverWABAFromToken(accessToken);
    if (discovered.wabaId) {
      return saveConnectionWithIds({
        clinicId,
        wabaId: discovered.wabaId,
        phoneNumberId: discovered.phoneNumberId,
      });
    }
  } catch (error) {
    console.error('WABA discovery failed:', error);
  }

  return { success: false };
}

/**
 * Discover WABA ID from access token
 */
async function discoverWABAFromToken(
  accessToken: string
): Promise<{ wabaId?: string; phoneNumberId?: string }> {
  // Get debug token info
  const appToken = `${getMetaAppId()}|${getMetaAppSecret()}`;
  const debugResponse = await fetch(
    `https://graph.facebook.com/v24.0/debug_token?input_token=${accessToken}&access_token=${appToken}`
  );

  if (!debugResponse.ok) {
    throw new Error('Failed to debug token');
  }

  const debugData = await debugResponse.json();
  const granularScopes = debugData.data?.granular_scopes || [];

  // Find whatsapp_business_messaging scope with target_ids
  const wabaScope = granularScopes.find(
    (s: any) => s.scope === 'whatsapp_business_messaging'
  );

  if (wabaScope?.target_ids?.length > 0) {
    const wabaId = wabaScope.target_ids[0];

    // Get phone numbers for this WABA
    const phonesResponse = await fetch(
      `https://graph.facebook.com/v24.0/${wabaId}/phone_numbers`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (phonesResponse.ok) {
      const phonesData = await phonesResponse.json();
      const phoneNumberId = phonesData.data?.[0]?.id;
      return { wabaId, phoneNumberId };
    }

    return { wabaId };
  }

  return {};
}

/**
 * Process OAuth callback (code exchange + WABA discovery)
 */
export async function processOAuthCallback(
  code: string,
  clinicId: string,
  redirectUri: string
): Promise<{ wabaId: string; phoneNumberId?: string }> {
  // Exchange code for token
  const accessToken = await exchangeCodeForToken(code, redirectUri);

  // Store token
  await storeAccessToken(clinicId, accessToken);

  // Discover WABA
  const discovered = await discoverWABAFromToken(accessToken);

  if (!discovered.wabaId) {
    throw new Error('Could not discover WABA from access token');
  }

  return {
    wabaId: discovered.wabaId,
    phoneNumberId: discovered.phoneNumberId,
  };
}

/**
 * Update connection status after OAuth callback
 */
export async function updateConnectionStatus(
  clinicId: string,
  connectionData: { wabaId: string; phoneNumberId?: string }
): Promise<void> {
  await saveConnectionWithIds({
    clinicId,
    wabaId: connectionData.wabaId,
    phoneNumberId: connectionData.phoneNumberId,
  });
}

/**
 * Fix verification status for existing connections
 */
export async function fixVerificationStatus(clinicId: string): Promise<void> {
  const doc = await db.collection(CLINICS).doc(clinicId).get();
  const data = doc.data();

  if (data?.whatsappConnected && !data?.whatsappConfig?.isVerified) {
    await db.collection(CLINICS).doc(clinicId).update({
      'whatsappConfig.isVerified': true,
      'whatsappConfig.verifiedAt': new Date(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    console.log(`Fixed verification status for clinic ${clinicId}`);
  }
}

// ============================================
// WEBHOOK CONFIGURATION
// ============================================

/**
 * Configure webhook for WABA
 */
export async function configureWebhook(clinicId: string, wabaId: string): Promise<void> {
  const bisuToken = getMetaBisuToken();
  if (!bisuToken) {
    throw new Error('BISU token required to configure webhooks');
  }

  const webhookUrl = getWhatsAppAgentUrl();
  if (!webhookUrl) {
    throw new Error('WhatsApp Agent URL not configured');
  }

  // Subscribe to WABA webhooks
  const response = await fetch(
    `https://graph.facebook.com/v24.0/${wabaId}/subscribed_apps`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${bisuToken}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to subscribe to webhooks');
  }

  console.log(`✅ Webhook configured for WABA ${wabaId}`);
}

// ============================================
// MESSAGE TEMPLATES (REMINDERS)
// ============================================

/**
 * Get message templates for a WABA
 */
export async function getMessageTemplates(wabaId: string): Promise<any[]> {
  const bisuToken = getMetaBisuToken();
  if (!bisuToken) {
    throw new Error('BISU token required');
  }

  const response = await fetch(
    `https://graph.facebook.com/v24.0/${wabaId}/message_templates?limit=250`,
    { headers: { Authorization: `Bearer ${bisuToken}` } }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to fetch templates');
  }

  const data = await response.json();
  return data.data || [];
}

/**
 * Create clinic reminder templates (24h and 2h)
 * Called after Embedded Signup completion
 */
export async function createReminderTemplates(
  wabaId: string,
  clinicName: string
): Promise<{ created: string[]; errors: string[] }> {
  const bisuToken = getMetaBisuToken();
  if (!bisuToken) {
    throw new Error('BISU token required');
  }

  const created: string[] = [];
  const errors: string[] = [];

  // Template configurations for clinic reminders
  const templates = [
    {
      // 24h reminder WITH reschedule option (for clinics that allow rescheduling)
      name: 'lembrete_consulta_24h',
      category: 'UTILITY',
      language: 'pt_BR',
      components: [
        {
          type: 'BODY',
          text: `Olá {{1}}! 👋\n\nPassando para lembrar que sua consulta é *amanhã*:\n\n📅 *{{2}}* às *{{3}}*\n👨‍⚕️ *{{4}}*\n📍 *{{5}}*\n\nVocê confirma presença?`,
          example: {
            body_text: [['Maria', 'Segunda, 15/01', '14:00', 'Dr. João Silva', 'Av. Paulista, 1000']],
          },
        },
        {
          type: 'BUTTONS',
          buttons: [
            { type: 'QUICK_REPLY', text: 'Confirmar' },
            { type: 'QUICK_REPLY', text: 'Reagendar' },
            { type: 'QUICK_REPLY', text: 'Cancelar' },
          ],
        },
      ],
    },
    {
      // 24h reminder WITHOUT reschedule option (for clinics that don't allow rescheduling)
      name: 'lembrete_consulta_24h_simples',
      category: 'UTILITY',
      language: 'pt_BR',
      components: [
        {
          type: 'BODY',
          text: `Olá {{1}}! 👋\n\nPassando para lembrar que sua consulta é *amanhã*:\n\n📅 *{{2}}* às *{{3}}*\n👨‍⚕️ *{{4}}*\n📍 *{{5}}*\n\nVocê confirma presença?`,
          example: {
            body_text: [['Maria', 'Segunda, 15/01', '14:00', 'Dr. João Silva', 'Av. Paulista, 1000']],
          },
        },
        {
          type: 'BUTTONS',
          buttons: [
            { type: 'QUICK_REPLY', text: 'Confirmar' },
            { type: 'QUICK_REPLY', text: 'Cancelar' },
          ],
        },
      ],
    },
    {
      name: 'lembrete_consulta_2h',
      category: 'UTILITY',
      language: 'pt_BR',
      components: [
        {
          type: 'BODY',
          text: `Olá {{1}}! 👋\n\nSua consulta é daqui a *2 horas*!\n\n🕐 *Hoje às {{2}}*\n👨‍⚕️ *{{3}}*\n📍 *{{4}}*\n\nTe esperamos! Lembre-se de chegar 15 minutos antes.`,
          example: {
            body_text: [['Maria', '14:00', 'Dr. João Silva', 'Av. Paulista, 1000']],
          },
        },
      ],
    },
    {
      name: 'confirmacao_agendamento',
      category: 'UTILITY',
      language: 'pt_BR',
      components: [
        {
          type: 'BODY',
          text: `*CONSULTA CONFIRMADA!* ✅\n\n📅 *Data:* {{1}}\n🕐 *Horário:* {{2}}\n👨‍⚕️ *Profissional:* {{3}}\n📍 *Local:* {{4}}\n\n{{5}}\n\nChegue *15 minutos antes* do horário marcado.`,
          example: {
            body_text: [['Segunda, 15/01/2024', '14:00', 'Dr. João Silva', 'Av. Paulista, 1000', 'Sinal pago: R$ 30,00']],
          },
        },
      ],
    },
    {
      name: 'link_pagamento_sinal',
      category: 'UTILITY',
      language: 'pt_BR',
      components: [
        {
          type: 'BODY',
          text: `Olá {{1}}! 👋\n\nPara confirmar seu agendamento, realize o pagamento do sinal:\n\n📅 *{{2}}* às *{{3}}*\n👨‍⚕️ *{{4}}*\n💰 *Sinal: R$ {{5}}*\n\nClique no botão abaixo para pagar:`,
          example: {
            body_text: [['Maria', 'Segunda, 15/01', '14:00', 'Dr. João Silva', '30,00']],
          },
        },
        {
          type: 'BUTTONS',
          buttons: [
            {
              type: 'URL',
              text: 'Pagar Agora',
              url: 'https://gendei.com/pagar/{{1}}',
              example: ['abc123'],
            },
          ],
        },
      ],
    },
  ];

  for (const template of templates) {
    try {
      const response = await fetch(
        `https://graph.facebook.com/v24.0/${wabaId}/message_templates`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${bisuToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(template),
        }
      );

      if (response.ok) {
        created.push(template.name);
        console.log(`✅ Created template: ${template.name}`);
      } else {
        const error = await response.json();
        // Template might already exist
        if (error.error?.code === 100 && error.error?.error_subcode === 2388090) {
          console.log(`Template ${template.name} already exists, skipping`);
        } else {
          errors.push(`${template.name}: ${error.error?.message || 'Unknown error'}`);
          console.error(`Failed to create template ${template.name}:`, error);
        }
      }
    } catch (error: any) {
      errors.push(`${template.name}: ${error.message}`);
    }
  }

  return { created, errors };
}

/**
 * Delete a message template
 */
export async function deleteMessageTemplate(
  wabaId: string,
  templateName: string
): Promise<void> {
  const bisuToken = getMetaBisuToken();
  if (!bisuToken) {
    throw new Error('BISU token required');
  }

  const response = await fetch(
    `https://graph.facebook.com/v24.0/${wabaId}/message_templates?name=${templateName}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${bisuToken}` },
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to delete template');
  }

  console.log(`✅ Deleted template: ${templateName}`);
}

// ============================================
// VERIFICATION (for new phone numbers)
// ============================================

/**
 * Request verification code for phone number
 */
export async function requestVerificationCode(
  phoneNumberId: string,
  method: 'SMS' | 'VOICE',
  clinicId: string
): Promise<boolean> {
  const accessToken = await getAccessToken(clinicId);
  const apiVersion = getMetaApiVersion();

  const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/request_code`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      code_method: method,
      language: 'pt_BR',
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    console.error('Failed to request verification code:', error);
    throw new Error(error.error?.message || 'Failed to request verification code');
  }

  console.log(`Verification code requested for phone: ${phoneNumberId}`);
  return true;
}

/**
 * Register phone number with verification code
 */
export async function registerPhoneNumber(
  phoneNumberId: string,
  code: string,
  clinicId: string
): Promise<boolean> {
  const accessToken = await getAccessToken(clinicId);
  const apiVersion = getMetaApiVersion();

  const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/register`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      pin: code,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    console.error('Failed to register phone number:', error);
    throw new Error(error.error?.message || 'Invalid verification code');
  }

  // Update clinic as verified
  await db.collection(CLINICS).doc(clinicId).update({
    'whatsappConfig.isVerified': true,
    'whatsappConfig.verifiedAt': new Date(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  console.log(`Phone number registered successfully: ${phoneNumberId}`);
  return true;
}

/**
 * Send test message
 */
export async function sendTestMessage(
  phoneNumberId: string,
  to: string,
  clinicId: string
): Promise<{ messageId: string }> {
  const accessToken = await getAccessToken(clinicId);
  const apiVersion = getMetaApiVersion();

  const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: {
        body: 'Olá! Esta é uma mensagem de teste da sua conexão WhatsApp Business. ✅',
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    console.error('Failed to send test message:', error);
    throw new Error(error.error?.message || 'Failed to send message');
  }

  const result = await response.json();
  const messageId = result.messages?.[0]?.id;

  // Update clinic
  await db.collection(CLINICS).doc(clinicId).update({
    'whatsappConfig.testMessageSent': true,
    updatedAt: FieldValue.serverTimestamp(),
  });

  console.log(`Test message sent successfully: ${messageId}`);
  return { messageId };
}

// ============================================
// WHATSAPP MESSAGING
// ============================================

/**
 * Send WhatsApp message to a patient
 */
export async function sendMessage(
  clinicId: string,
  to: string,
  message: string
): Promise<{ messageId: string }> {
  const accessToken = await getAccessToken(clinicId);
  const apiVersion = getMetaApiVersion();

  // Get clinic's phone number ID
  const clinicDoc = await db.collection(CLINICS).doc(clinicId).get();
  const clinicData = clinicDoc.data();

  if (!clinicData?.whatsappPhoneNumberId) {
    throw new Error('Clinic WhatsApp not configured');
  }

  const url = `https://graph.facebook.com/${apiVersion}/${clinicData.whatsappPhoneNumberId}/messages`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: message },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to send message');
  }

  const result = await response.json();
  return { messageId: result.messages?.[0]?.id };
}

/**
 * Send template message
 */
export async function sendTemplateMessage(
  clinicId: string,
  to: string,
  templateName: string,
  parameters: string[]
): Promise<{ messageId: string }> {
  const accessToken = await getAccessToken(clinicId);
  const apiVersion = getMetaApiVersion();

  // Get clinic's phone number ID
  const clinicDoc = await db.collection(CLINICS).doc(clinicId).get();
  const clinicData = clinicDoc.data();

  if (!clinicData?.whatsappPhoneNumberId) {
    throw new Error('Clinic WhatsApp not configured');
  }

  const url = `https://graph.facebook.com/${apiVersion}/${clinicData.whatsappPhoneNumberId}/messages`;

  const bodyComponents = parameters.map((param) => ({
    type: 'text',
    text: param,
  }));

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: 'pt_BR' },
        components: [
          {
            type: 'body',
            parameters: bodyComponents,
          },
        ],
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to send template message');
  }

  const result = await response.json();
  return { messageId: result.messages?.[0]?.id };
}

// ============================================
// WHATSAPP FLOWS - Scheduling Flow Creation
// ============================================

/**
 * Generate Flow JSON for scheduling appointments
 * @param acceptsConvenio - Whether the clinic accepts health insurance (convênio)
 */
export function generateSchedulingFlowJSON(acceptsConvenio: boolean): object {
  const baseScreens: any[] = [
    // Screen 1: Select Specialty/Professional
    {
      id: 'ESPECIALIDADE',
      title: 'Agendar Consulta',
      layout: {
        type: 'SingleColumnLayout',
        children: [
          {
            type: 'TextBody',
            text: 'Qual especialidade você precisa?',
          },
          {
            type: 'Form',
            name: 'form_especialidade',
            children: [
              {
                type: 'RadioButtonsGroup',
                name: 'especialidade',
                label: 'Especialidade',
                required: true,
                'data-source': '${data.especialidades}',
              },
              {
                type: 'Footer',
                label: 'Continuar',
                'on-click-action': {
                  name: 'data_exchange',
                  payload: {
                    especialidade: '${form.especialidade}',
                    screen: 'ESPECIALIDADE',
                  },
                },
              },
            ],
          },
        ],
      },
      data: {
        especialidades: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              title: { type: 'string' },
              description: { type: 'string' },
            },
          },
          __example__: [
            { id: 'derma_clinica', title: 'Dermatologia Clínica', description: 'Dr. Ricardo Mendes' },
          ],
        },
      },
    },
  ];

  // Screen 2: Payment type (only if clinic accepts convênio)
  if (acceptsConvenio) {
    baseScreens.push({
      id: 'TIPO_ATENDIMENTO',
      title: 'Tipo de Atendimento',
      data: {
        especialidade: {
          type: 'string',
          __example__: 'derma_clinica',
        },
        profissional_nome: {
          type: 'string',
          __example__: 'Dr. Ricardo Mendes',
        },
      },
      layout: {
        type: 'SingleColumnLayout',
        children: [
          {
            type: 'TextBody',
            text: 'Como será o pagamento da consulta?',
          },
          {
            type: 'Form',
            name: 'form_pagamento',
            children: [
              {
                type: 'RadioButtonsGroup',
                name: 'tipo_pagamento',
                label: 'Tipo de atendimento',
                required: true,
                'data-source': [
                  { id: 'convenio', title: 'Convênio', description: 'Tenho plano de saúde' },
                  { id: 'particular', title: 'Particular', description: 'Pagamento direto (PIX/Cartão)' },
                ],
              },
              {
                type: 'Footer',
                label: 'Continuar',
                'on-click-action': {
                  name: 'data_exchange',
                  payload: {
                    especialidade: '${data.especialidade}',
                    profissional_nome: '${data.profissional_nome}',
                    tipo_pagamento: '${form.tipo_pagamento}',
                    screen: 'TIPO_ATENDIMENTO',
                  },
                },
              },
            ],
          },
        ],
      },
    });

    // Screen 3: Convênio info (only shown if user selects convênio)
    baseScreens.push({
      id: 'INFO_CONVENIO',
      title: 'Dados do Convênio',
      data: {
        especialidade: { type: 'string', __example__: 'derma_clinica' },
        profissional_nome: { type: 'string', __example__: 'Dr. Ricardo Mendes' },
        tipo_pagamento: { type: 'string', __example__: 'convenio' },
        convenios_aceitos: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              title: { type: 'string' },
            },
          },
          __example__: [{ id: 'unimed', title: 'Unimed' }],
        },
      },
      layout: {
        type: 'SingleColumnLayout',
        children: [
          {
            type: 'TextBody',
            text: 'Informe os dados do seu convênio.',
          },
          {
            type: 'Form',
            name: 'form_convenio',
            children: [
              {
                type: 'Dropdown',
                name: 'convenio_nome',
                label: 'Seu convênio',
                required: true,
                'data-source': '${data.convenios_aceitos}',
              },
              {
                type: 'TextInput',
                name: 'convenio_numero',
                label: 'Nº da carteirinha',
                'input-type': 'text',
                required: true,
                'helper-text': 'Encontre no cartão do convênio',
              },
              {
                type: 'Footer',
                label: 'Continuar',
                'on-click-action': {
                  name: 'navigate',
                  next: { type: 'screen', name: 'DADOS_PACIENTE' },
                  payload: {
                    especialidade: '${data.especialidade}',
                    profissional_nome: '${data.profissional_nome}',
                    tipo_pagamento: '${data.tipo_pagamento}',
                    convenio_nome: '${form.convenio_nome}',
                    convenio_numero: '${form.convenio_numero}',
                  },
                },
              },
            ],
          },
        ],
      },
    });
  }

  // Screen 4: Patient data
  baseScreens.push({
    id: 'DADOS_PACIENTE',
    title: 'Dados do Paciente',
    data: {
      especialidade: { type: 'string', __example__: 'derma_clinica' },
      profissional_nome: { type: 'string', __example__: 'Dr. Ricardo Mendes' },
      tipo_pagamento: { type: 'string', __example__: 'particular' },
      convenio_nome: { type: 'string', __example__: '' },
      convenio_numero: { type: 'string', __example__: '' },
    },
    layout: {
      type: 'SingleColumnLayout',
      children: [
        {
          type: 'TextBody',
          text: 'Preencha seus dados para o agendamento.',
        },
        {
          type: 'Form',
          name: 'form_paciente',
          children: [
            {
              type: 'TextInput',
              name: 'nome',
              label: 'Nome completo',
              'input-type': 'text',
              required: true,
              'helper-text': 'Como consta no documento',
            },
            {
              type: 'TextInput',
              name: 'cpf',
              label: 'CPF',
              'input-type': 'text',
              required: true,
              'helper-text': 'Ex: 123.456.789-00',
            },
            {
              type: 'DatePicker',
              name: 'data_nascimento',
              label: 'Data de nascimento',
              required: true,
              'helper-text': 'Selecione sua data de nascimento',
            },
            {
              type: 'Footer',
              label: 'Escolher Horário',
              'on-click-action': {
                name: 'data_exchange',
                payload: {
                  especialidade: '${data.especialidade}',
                  profissional_nome: '${data.profissional_nome}',
                  tipo_pagamento: '${data.tipo_pagamento}',
                  convenio_nome: '${data.convenio_nome}',
                  convenio_numero: '${data.convenio_numero}',
                  nome: '${form.nome}',
                  cpf: '${form.cpf}',
                  data_nascimento: '${form.data_nascimento}',
                  screen: 'DADOS_PACIENTE',
                },
              },
            },
          ],
        },
      ],
    },
  });

  // Screen 5: Select date and time
  baseScreens.push({
    id: 'SELECAO_HORARIO',
    title: 'Escolha o Horário',
    terminal: true,
    success: true,
    data: {
      especialidade: { type: 'string', __example__: 'derma_clinica' },
      profissional_nome: { type: 'string', __example__: 'Dr. Ricardo Mendes' },
      tipo_pagamento: { type: 'string', __example__: 'particular' },
      convenio_nome: { type: 'string', __example__: '' },
      convenio_numero: { type: 'string', __example__: '' },
      nome: { type: 'string', __example__: 'Maria Silva' },
      cpf: { type: 'string', __example__: '123.456.789-00' },
      data_nascimento: { type: 'string', __example__: '1990-05-15' },
      horarios_disponiveis: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
          },
        },
        __example__: [{ id: '08:00', title: '08:00' }],
      },
    },
    layout: {
      type: 'SingleColumnLayout',
      children: [
        {
          type: 'TextBody',
          text: 'Agenda de ${data.profissional_nome}',
        },
        {
          type: 'Form',
          name: 'form_horario',
          children: [
            {
              type: 'DatePicker',
              name: 'data_consulta',
              label: 'Data da consulta',
              required: true,
            },
            {
              type: 'Dropdown',
              name: 'horario',
              label: 'Horário',
              required: true,
              'data-source': '${data.horarios_disponiveis}',
            },
            {
              type: 'Footer',
              label: 'Confirmar Agendamento',
              'on-click-action': {
                name: 'complete',
                payload: {
                  especialidade: '${data.especialidade}',
                  profissional_nome: '${data.profissional_nome}',
                  tipo_pagamento: '${data.tipo_pagamento}',
                  convenio_nome: '${data.convenio_nome}',
                  convenio_numero: '${data.convenio_numero}',
                  nome: '${data.nome}',
                  cpf: '${data.cpf}',
                  data_nascimento: '${data.data_nascimento}',
                  data_consulta: '${form.data_consulta}',
                  horario: '${form.horario}',
                },
              },
            },
          ],
        },
      ],
    },
  });

  return {
    version: '6.2',
    data_api_version: '3.0',
    routing_model: {
      ESPECIALIDADE: ['TIPO_ATENDIMENTO', 'DADOS_PACIENTE'],
      ...(acceptsConvenio
        ? {
            TIPO_ATENDIMENTO: ['INFO_CONVENIO', 'DADOS_PACIENTE'],
            INFO_CONVENIO: ['DADOS_PACIENTE'],
          }
        : {}),
      DADOS_PACIENTE: ['SELECAO_HORARIO'],
      SELECAO_HORARIO: [],
    },
    screens: baseScreens,
  };
}

/**
 * Create a WhatsApp Flow for appointment scheduling
 */
export async function createSchedulingFlow(
  wabaId: string,
  clinicId: string,
  acceptsConvenio: boolean,
  endpointUri: string
): Promise<{ flowId: string; success: boolean; errors: string[] }> {
  const bisuToken = getMetaBisuToken();
  if (!bisuToken) {
    throw new Error('BISU token required');
  }

  const apiVersion = getMetaApiVersion();
  const errors: string[] = [];

  const flowName = acceptsConvenio
    ? 'gendei_agendamento_convenio'
    : 'gendei_agendamento_particular';

  const flowJSON = generateSchedulingFlowJSON(acceptsConvenio);

  try {
    // Create the flow
    const response = await fetch(`https://graph.facebook.com/${apiVersion}/${wabaId}/flows`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${bisuToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: flowName,
        categories: ['APPOINTMENT_BOOKING'],
        flow_json: JSON.stringify(flowJSON),
        endpoint_uri: endpointUri,
        publish: true,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      // Check if flow already exists
      if (result.error?.code === 100 || result.error?.message?.includes('already exists')) {
        console.log(`Flow ${flowName} already exists`);
        // Try to get existing flow ID
        const existingFlow = await getExistingFlow(wabaId, flowName);
        if (existingFlow) {
          return { flowId: existingFlow.id, success: true, errors: [] };
        }
      }
      errors.push(result.error?.message || 'Failed to create flow');
      console.error('Flow creation error:', result);
      return { flowId: '', success: false, errors };
    }

    // Check for validation errors
    if (result.validation_errors?.length > 0) {
      for (const validationError of result.validation_errors) {
        errors.push(`${validationError.error}: ${validationError.message}`);
      }
    }

    console.log(`✅ Created flow: ${flowName} (ID: ${result.id})`);

    // Store flow info in clinic document
    await db.collection(CLINICS).doc(clinicId).update({
      whatsappFlowId: result.id,
      whatsappFlowName: flowName,
      whatsappFlowCreatedAt: new Date(),
    });

    return { flowId: result.id, success: true, errors };
  } catch (error: any) {
    errors.push(error.message);
    return { flowId: '', success: false, errors };
  }
}

/**
 * Get existing flow by name
 */
async function getExistingFlow(
  wabaId: string,
  flowName: string
): Promise<{ id: string; name: string; status: string } | null> {
  const bisuToken = getMetaBisuToken();
  if (!bisuToken) return null;

  const apiVersion = getMetaApiVersion();

  try {
    const response = await fetch(`https://graph.facebook.com/${apiVersion}/${wabaId}/flows`, {
      headers: { Authorization: `Bearer ${bisuToken}` },
    });

    if (!response.ok) return null;

    const result = await response.json();
    const flow = result.data?.find((f: any) => f.name === flowName);

    return flow || null;
  } catch {
    return null;
  }
}

/**
 * List all flows for a WABA
 */
export async function listFlows(wabaId: string): Promise<any[]> {
  const bisuToken = getMetaBisuToken();
  if (!bisuToken) {
    throw new Error('BISU token required');
  }

  const apiVersion = getMetaApiVersion();

  const response = await fetch(`https://graph.facebook.com/${apiVersion}/${wabaId}/flows`, {
    headers: { Authorization: `Bearer ${bisuToken}` },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to list flows');
  }

  const result = await response.json();
  return result.data || [];
}

/**
 * Send a flow message to a user
 */
export async function sendFlowMessage(
  clinicId: string,
  to: string,
  flowId: string,
  flowToken: string,
  headerText: string,
  bodyText: string,
  ctaText: string,
  initialData?: Record<string, any>
): Promise<{ messageId: string }> {
  const accessToken = await getAccessToken(clinicId);
  const apiVersion = getMetaApiVersion();

  const clinicDoc = await db.collection(CLINICS).doc(clinicId).get();
  const clinicData = clinicDoc.data();

  if (!clinicData?.whatsappPhoneNumberId) {
    throw new Error('Clinic WhatsApp not configured');
  }

  const url = `https://graph.facebook.com/${apiVersion}/${clinicData.whatsappPhoneNumberId}/messages`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'interactive',
      interactive: {
        type: 'flow',
        header: {
          type: 'text',
          text: headerText,
        },
        body: {
          text: bodyText,
        },
        footer: {
          text: 'Gendei - Agendamento Inteligente',
        },
        action: {
          name: 'flow',
          parameters: {
            flow_message_version: '3',
            flow_token: flowToken,
            flow_id: flowId,
            flow_cta: ctaText,
            flow_action: 'navigate',
            flow_action_payload: {
              screen: 'ESPECIALIDADE',
              data: initialData || {},
            },
          },
        },
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to send flow message');
  }

  const result = await response.json();
  return { messageId: result.messages?.[0]?.id };
}
