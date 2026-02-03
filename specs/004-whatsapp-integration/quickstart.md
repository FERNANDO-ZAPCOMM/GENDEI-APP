# Quickstart: WhatsApp Integration

**Feature**: 004-whatsapp-integration
**Date**: 2026-02-04

---

## Prerequisites

- Meta Business Account
- Meta Developer App with WhatsApp API access
- Firebase project with Functions and Firestore
- Completed clinic onboarding (001)

---

## Meta App Setup

### 1. Create Meta App

1. Go to [Meta for Developers](https://developers.facebook.com/)
2. Create a new app → Business type
3. Add WhatsApp product
4. Note your App ID and App Secret

### 2. Configure Embedded Signup

1. In Meta App Dashboard → WhatsApp → Embedded Signup
2. Create configuration
3. Note the Configuration ID
4. Set up OAuth redirect URL

### 3. Environment Variables

```bash
# apps/functions/.env
META_APP_ID=your_app_id
META_APP_SECRET=your_app_secret
META_CONFIG_ID=your_config_id
WEBHOOK_VERIFY_TOKEN=your_random_verify_token
ENCRYPTION_KEY=base64_encoded_32_byte_key

# apps/web/.env.local
NEXT_PUBLIC_META_APP_ID=your_app_id
NEXT_PUBLIC_META_CONFIG_ID=your_config_id
```

---

## Code Implementation

### 1. Encryption Utility

```typescript
// apps/functions/src/lib/encryption.ts
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY = Buffer.from(process.env.ENCRYPTION_KEY!, 'base64');

export function encrypt(text: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, KEY, iv);

  let encrypted = cipher.update(text, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  const authTag = cipher.getAuthTag();

  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
}

export function decrypt(encrypted: string): string {
  const [ivBase64, authTagBase64, ciphertext] = encrypted.split(':');

  const iv = Buffer.from(ivBase64, 'base64');
  const authTag = Buffer.from(authTagBase64, 'base64');

  const decipher = createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
```

### 2. Meta Service

```typescript
// apps/functions/src/services/metaService.ts
import { encrypt, decrypt } from '../lib/encryption';
import { db } from '../lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

const GRAPH_API_URL = 'https://graph.facebook.com/v22.0';

export async function exchangeCodeForToken(code: string): Promise<{
  accessToken: string;
  userId: string;
}> {
  const response = await fetch(
    `${GRAPH_API_URL}/oauth/access_token?` +
    `client_id=${process.env.META_APP_ID}&` +
    `client_secret=${process.env.META_APP_SECRET}&` +
    `code=${code}`
  );

  const data = await response.json();

  if (data.error) {
    throw new Error(data.error.message);
  }

  return {
    accessToken: data.access_token,
    userId: data.user_id,
  };
}

export async function getWabaInfo(accessToken: string) {
  // Get user's business accounts
  const response = await fetch(
    `${GRAPH_API_URL}/me/businesses?fields=id,name&access_token=${accessToken}`
  );

  const businesses = await response.json();
  const businessId = businesses.data[0]?.id;

  if (!businessId) {
    throw new Error('No business found');
  }

  // Get WABA for this business
  const wabaResponse = await fetch(
    `${GRAPH_API_URL}/${businessId}/owned_whatsapp_business_accounts?` +
    `fields=id,name,phone_numbers{id,display_phone_number,verified_name}&` +
    `access_token=${accessToken}`
  );

  const wabas = await wabaResponse.json();
  const waba = wabas.data[0];

  if (!waba) {
    throw new Error('No WABA found');
  }

  return {
    wabaId: waba.id,
    businessId,
    phoneNumbers: waba.phone_numbers?.data || [],
  };
}

export async function saveTokens(clinicId: string, accessToken: string, metaUserId: string) {
  const encrypted = encrypt(accessToken);

  await db.collection('gendei_tokens').doc(clinicId).set({
    clinicId,
    accessTokenEncrypted: encrypted,
    tokenType: 'Bearer',
    metaUserId,
    scopes: ['whatsapp_business_management', 'whatsapp_business_messaging'],
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
}

export async function getAccessToken(clinicId: string): Promise<string> {
  const doc = await db.collection('gendei_tokens').doc(clinicId).get();

  if (!doc.exists) {
    throw new Error('No tokens found');
  }

  const { accessTokenEncrypted } = doc.data()!;
  return decrypt(accessTokenEncrypted);
}

export async function saveWhatsAppConnection(
  clinicId: string,
  wabaId: string,
  businessId: string,
  phoneNumberId: string,
  displayPhone: string
) {
  const batch = db.batch();

  // Save full connection details
  const connectionRef = db.collection('gendei_whatsapp').doc(clinicId);
  batch.set(connectionRef, {
    clinicId,
    wabaId,
    businessId,
    phoneNumberId,
    displayPhone,
    verified: false,
    qualityRating: 'UNKNOWN',
    messagingLimit: 'TIER_1K',
    webhookSubscribed: false,
    webhookFields: [],
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  // Update clinic with quick-access fields
  const clinicRef = db.collection('gendei_clinics').doc(clinicId);
  batch.update(clinicRef, {
    whatsappConnected: true,
    whatsappPhoneNumberId: phoneNumberId,
    whatsappWabaId: wabaId,
    whatsappDisplayPhone: displayPhone,
    whatsappQualityRating: 'UNKNOWN',
    whatsappConnectedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  await batch.commit();
}
```

### 3. Meta Controller

```typescript
// apps/functions/src/controllers/metaController.ts
import { Request, Response } from 'express';
import * as metaService from '../services/metaService';
import { db } from '../lib/firebase-admin';

export async function startEmbeddedSignup(req: Request, res: Response) {
  // Generate state token for CSRF protection
  const state = crypto.randomUUID();

  // Store state temporarily (5 minute expiry)
  await db.collection('_oauth_states').doc(state).set({
    clinicId: req.clinicId,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 5 * 60 * 1000),
  });

  return res.json({
    appId: process.env.META_APP_ID,
    configId: process.env.META_CONFIG_ID,
    state,
  });
}

export async function completeEmbeddedSignup(req: Request, res: Response) {
  try {
    const { code } = req.body;
    const clinicId = req.clinicId!;

    // Exchange code for token
    const { accessToken, userId } = await metaService.exchangeCodeForToken(code);

    // Get WABA info
    const { wabaId, businessId, phoneNumbers } = await metaService.getWabaInfo(accessToken);

    // Save encrypted token
    await metaService.saveTokens(clinicId, accessToken, userId);

    return res.json({
      success: true,
      wabaId,
      phoneNumbers: phoneNumbers.map((p: any) => ({
        id: p.id,
        displayPhone: p.display_phone_number,
        verified: !!p.verified_name,
      })),
    });
  } catch (error: any) {
    console.error('Embedded signup error:', error);
    return res.status(400).json({ error: error.message });
  }
}
```

### 4. WhatsApp Controller

```typescript
// apps/functions/src/controllers/whatsappController.ts
import { Request, Response } from 'express';
import * as metaService from '../services/metaService';
import { db } from '../lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

const GRAPH_API_URL = 'https://graph.facebook.com/v22.0';

export async function requestVerificationCode(req: Request, res: Response) {
  try {
    const { phoneNumberId, codeMethod } = req.body;
    const clinicId = req.clinicId!;

    const accessToken = await metaService.getAccessToken(clinicId);

    const response = await fetch(`${GRAPH_API_URL}/${phoneNumberId}/request_code`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code_method: codeMethod,
        language: 'pt_BR',
      }),
    });

    const data = await response.json();

    if (data.error) {
      return res.status(400).json({ error: data.error.message });
    }

    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}

export async function registerPhoneNumber(req: Request, res: Response) {
  try {
    const { phoneNumberId, verificationCode } = req.body;
    const clinicId = req.clinicId!;

    const accessToken = await metaService.getAccessToken(clinicId);

    // Verify code
    const verifyResponse = await fetch(`${GRAPH_API_URL}/${phoneNumberId}/verify_code`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code: verificationCode }),
    });

    const verifyData = await verifyResponse.json();

    if (verifyData.error) {
      return res.status(400).json({ error: verifyData.error.message });
    }

    // Register phone number
    const registerResponse = await fetch(`${GRAPH_API_URL}/${phoneNumberId}/register`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        pin: verificationCode,
      }),
    });

    const registerData = await registerResponse.json();

    if (registerData.error) {
      return res.status(400).json({ error: registerData.error.message });
    }

    // Update connection as verified
    await db.collection('gendei_whatsapp').doc(clinicId).update({
      verified: true,
      verificationMethod: req.body.codeMethod || 'SMS',
      updatedAt: FieldValue.serverTimestamp(),
    });

    return res.json({
      success: true,
      phoneNumberId,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}

export async function sendTestMessage(req: Request, res: Response) {
  try {
    const { phoneNumber } = req.body;
    const clinicId = req.clinicId!;

    const [connection, accessToken] = await Promise.all([
      db.collection('gendei_whatsapp').doc(clinicId).get(),
      metaService.getAccessToken(clinicId),
    ]);

    if (!connection.exists) {
      return res.status(404).json({ error: 'WhatsApp not connected' });
    }

    const { phoneNumberId } = connection.data()!;

    const response = await fetch(`${GRAPH_API_URL}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phoneNumber.replace(/\D/g, ''),
        type: 'text',
        text: {
          body: '✅ Conexão WhatsApp funcionando!\n\nSua clínica está pronta para receber agendamentos via WhatsApp.\n\n— Gendei',
        },
      }),
    });

    const data = await response.json();

    if (data.error) {
      return res.status(400).json({ error: data.error.message });
    }

    return res.json({
      success: true,
      messageId: data.messages?.[0]?.id,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}

export async function getConnection(req: Request, res: Response) {
  try {
    const clinicId = req.clinicId!;

    const doc = await db.collection('gendei_whatsapp').doc(clinicId).get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'WhatsApp not connected', connected: false });
    }

    const data = doc.data()!;

    return res.json({
      connected: true,
      phoneNumberId: data.phoneNumberId,
      displayPhone: data.displayPhone,
      qualityRating: data.qualityRating,
      messagingLimit: data.messagingLimit,
      verified: data.verified,
      connectedAt: data.createdAt?.toDate?.()?.toISOString(),
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
```

### 5. Webhook Handler

```typescript
// apps/functions/src/controllers/webhookController.ts
import { Request, Response } from 'express';

const VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN;

export function verifyWebhook(req: Request, res: Response) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('Webhook verified');
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
}

export async function handleWebhook(req: Request, res: Response) {
  // Verify signature
  const signature = req.headers['x-hub-signature-256'] as string;
  const payload = JSON.stringify(req.body);

  // TODO: Verify signature with app secret

  const { entry } = req.body;

  for (const e of entry || []) {
    for (const change of e.changes || []) {
      if (change.field === 'messages') {
        await handleMessages(change.value);
      } else if (change.field === 'phone_number_quality_update') {
        await handleQualityUpdate(change.value);
      }
    }
  }

  return res.status(200).json({ status: 'ok' });
}

async function handleMessages(value: any) {
  const phoneNumberId = value.metadata?.phone_number_id;
  const messages = value.messages || [];

  for (const message of messages) {
    console.log('Received message:', {
      from: message.from,
      type: message.type,
      text: message.text?.body,
    });

    // Forward to AI agent (via internal API or pub/sub)
    // TODO: Implement agent routing
  }
}

async function handleQualityUpdate(value: any) {
  const { display_phone_number, current_limit } = value;

  // Find clinic by phone and update quality
  // TODO: Implement quality update
  console.log('Quality update:', display_phone_number, current_limit);
}
```

### 6. Frontend: Embedded Signup Component

```typescript
// apps/web/src/components/whatsapp/EmbeddedSignup.tsx
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

declare global {
  interface Window {
    FB: any;
    fbAsyncInit: () => void;
  }
}

interface Props {
  onSuccess: (data: { wabaId: string; phoneNumbers: any[] }) => void;
  onError: (error: string) => void;
}

export function EmbeddedSignup({ onSuccess, onError }: Props) {
  const [loading, setLoading] = useState(false);
  const [sdkLoaded, setSdkLoaded] = useState(false);

  useEffect(() => {
    // Load FB SDK
    window.fbAsyncInit = function () {
      window.FB.init({
        appId: process.env.NEXT_PUBLIC_META_APP_ID,
        cookie: true,
        xfbml: true,
        version: 'v22.0',
      });
      setSdkLoaded(true);
    };

    if (!document.getElementById('facebook-jssdk')) {
      const script = document.createElement('script');
      script.id = 'facebook-jssdk';
      script.src = 'https://connect.facebook.net/en_US/sdk.js';
      script.async = true;
      document.head.appendChild(script);
    } else if (window.FB) {
      setSdkLoaded(true);
    }
  }, []);

  const handleConnect = async () => {
    if (!window.FB) {
      onError('Facebook SDK not loaded');
      return;
    }

    setLoading(true);

    try {
      // Get config from backend
      const configResponse = await fetch('/api/meta/embedded-signup/start', {
        method: 'POST',
      });
      const { appId, configId, state } = await configResponse.json();

      // Launch FB Login
      window.FB.login(
        async (response: any) => {
          if (response.authResponse?.code) {
            // Exchange code for token on backend
            const completeResponse = await fetch('/api/meta/embedded-signup/complete', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ code: response.authResponse.code }),
            });

            const data = await completeResponse.json();

            if (data.success) {
              onSuccess(data);
            } else {
              onError(data.error || 'Failed to complete signup');
            }
          } else {
            onError('Authorization cancelled');
          }
          setLoading(false);
        },
        {
          config_id: configId,
          response_type: 'code',
          override_default_response_type: true,
          extras: {
            setup: {},
            featureType: '',
            sessionInfoVersion: 2,
          },
        }
      );
    } catch (error: any) {
      onError(error.message);
      setLoading(false);
    }
  };

  return (
    <Button
      onClick={handleConnect}
      disabled={!sdkLoaded || loading}
      className="w-full"
    >
      {loading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Conectando...
        </>
      ) : (
        'Conectar WhatsApp Business'
      )}
    </Button>
  );
}
```

### 7. Routes

```typescript
// apps/functions/src/routes/meta.ts
import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { clinicMiddleware } from '../middleware/clinic';
import * as metaController from '../controllers/metaController';
import * as webhookController from '../controllers/webhookController';

const router = Router();

// Webhook endpoints (no auth - Meta calls these)
router.get('/webhook', webhookController.verifyWebhook);
router.post('/webhook', webhookController.handleWebhook);

// Protected endpoints
router.use(authMiddleware, clinicMiddleware);
router.post('/embedded-signup/start', metaController.startEmbeddedSignup);
router.post('/embedded-signup/complete', metaController.completeEmbeddedSignup);

export default router;

// apps/functions/src/routes/whatsapp.ts
import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { clinicMiddleware } from '../middleware/clinic';
import * as whatsappController from '../controllers/whatsappController';

const router = Router();

router.use(authMiddleware, clinicMiddleware);

router.get('/connection', whatsappController.getConnection);
router.post('/request-verification', whatsappController.requestVerificationCode);
router.post('/register-number', whatsappController.registerPhoneNumber);
router.post('/test-message', whatsappController.sendTestMessage);

export default router;
```

---

## Testing

### Manual Testing Flow

1. Start local emulators
2. Load WhatsApp connection page
3. Click "Connect WhatsApp Business"
4. Complete Meta authorization
5. Select phone number
6. Enter verification code
7. Send test message

### Test with curl

```bash
TOKEN="your_firebase_token"

# Get connection status
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:5001/gendei-dev/us-central1/api/whatsapp/connection

# Send test message
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber": "+5511999999999"}' \
  http://localhost:5001/gendei-dev/us-central1/api/whatsapp/test-message
```

---

## Webhook Setup

1. Deploy webhook endpoint
2. In Meta App Dashboard → WhatsApp → Configuration
3. Add Callback URL: `https://your-domain/api/meta/webhook`
4. Add Verify Token: same as `WEBHOOK_VERIFY_TOKEN`
5. Subscribe to: `messages`, `phone_number_quality_update`
