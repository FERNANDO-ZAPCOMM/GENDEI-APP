# Research: WhatsApp Integration

**Feature**: 004-whatsapp-integration
**Date**: 2026-02-04

---

## Technology Decisions

### 1. Integration Approach

**Decision**: Meta Embedded Signup (recommended by Meta)

**Alternatives Considered**:

| Approach | Pros | Cons | Decision |
|----------|------|------|----------|
| Embedded Signup | Official, user-friendly | Complex setup | **Selected** |
| Manual WABA setup | Full control | Poor UX, manual steps | Rejected |
| Third-party BSP | Simpler API | Cost, vendor lock-in | Rejected |

**Why Embedded Signup**:
- Official Meta-recommended flow
- User authorizes in popup (no redirect)
- Automatic WABA creation if needed
- Better conversion rates

**Implementation**:
```typescript
// Load Meta SDK
const loadFbSdk = () => {
  return new Promise((resolve) => {
    window.fbAsyncInit = function () {
      FB.init({
        appId: process.env.NEXT_PUBLIC_META_APP_ID,
        cookie: true,
        xfbml: true,
        version: 'v22.0',
      });
      resolve(FB);
    };

    // Load SDK script
    const script = document.createElement('script');
    script.src = 'https://connect.facebook.net/en_US/sdk.js';
    script.async = true;
    document.head.appendChild(script);
  });
};

// Launch Embedded Signup
const launchEmbeddedSignup = () => {
  FB.login(
    (response) => {
      if (response.authResponse) {
        const code = response.authResponse.code;
        // Send code to backend for token exchange
        exchangeCodeForToken(code);
      }
    },
    {
      config_id: process.env.NEXT_PUBLIC_META_CONFIG_ID,
      response_type: 'code',
      override_default_response_type: true,
      extras: {
        setup: {},
        featureType: '',
        sessionInfoVersion: 2,
      },
    }
  );
};
```

---

### 2. Token Storage

**Decision**: AES-256-GCM encryption in Firestore

**Alternatives Considered**:

| Approach | Pros | Cons | Decision |
|----------|------|------|----------|
| Encrypted Firestore | Simple, integrated | Key management | **Selected** |
| Secret Manager | Managed, versioned | Per-secret cost | For App Secret only |
| Vault | Full-featured | Complexity, cost | Rejected |

**Why Encrypted Firestore**:
- Access tokens per clinic (many tokens)
- Firestore already in use
- Simple key rotation
- Cost-effective

**Implementation**:
```typescript
// apps/functions/src/lib/encryption.ts
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY = Buffer.from(process.env.ENCRYPTION_KEY!, 'base64'); // 32 bytes

export function encrypt(text: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, KEY, iv);

  let encrypted = cipher.update(text, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:ciphertext
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

---

### 3. Webhook Architecture

**Decision**: Cloud Run Python agent receives webhooks

**Why Cloud Run**:
- Already hosting Python agent
- Auto-scaling for webhook volume
- Persistent connections for AI processing
- Single deployment for agent + webhooks

**Webhook Verification**:
```python
# apps/agent/src/utils/webhook.py
import hmac
import hashlib

def verify_webhook_signature(payload: bytes, signature: str, app_secret: str) -> bool:
    """Verify X-Hub-Signature-256 header."""
    expected = 'sha256=' + hmac.new(
        app_secret.encode(),
        payload,
        hashlib.sha256
    ).hexdigest()

    return hmac.compare_digest(expected, signature)
```

**Webhook Endpoint**:
```python
# apps/agent/src/main.py
from fastapi import FastAPI, Request, HTTPException

app = FastAPI()

@app.get("/whatsapp")
async def verify_webhook(
    hub_mode: str = Query(None, alias="hub.mode"),
    hub_verify_token: str = Query(None, alias="hub.verify_token"),
    hub_challenge: str = Query(None, alias="hub.challenge"),
):
    """Meta webhook verification."""
    if hub_mode == "subscribe" and hub_verify_token == VERIFY_TOKEN:
        return int(hub_challenge)
    raise HTTPException(status_code=403, detail="Verification failed")

@app.post("/whatsapp")
async def handle_webhook(request: Request):
    """Receive incoming WhatsApp messages."""
    payload = await request.body()
    signature = request.headers.get("X-Hub-Signature-256", "")

    if not verify_webhook_signature(payload, signature, APP_SECRET):
        raise HTTPException(status_code=403, detail="Invalid signature")

    data = await request.json()
    await process_webhook(data)

    return {"status": "ok"}
```

---

### 4. Phone Number Registration Flow

**Decision**: Two-step verification (request code → verify code)

**Flow**:
```
1. User selects phone number from WABA
2. Backend requests verification code (SMS/Voice)
3. User enters code in UI
4. Backend verifies code with Meta
5. Phone number registered and subscribed to webhooks
```

**API Calls**:
```typescript
// Request verification code
const requestVerificationCode = async (phoneNumberId: string, codeMethod: 'SMS' | 'VOICE') => {
  const response = await fetch(
    `https://graph.facebook.com/v22.0/${phoneNumberId}/request_code`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code_method: codeMethod,
        language: 'pt_BR',
      }),
    }
  );

  return response.json();
};

// Verify code
const verifyCode = async (phoneNumberId: string, code: string) => {
  const response = await fetch(
    `https://graph.facebook.com/v22.0/${phoneNumberId}/verify_code`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code }),
    }
  );

  return response.json();
};
```

---

### 5. Message Sending

**Decision**: Direct Graph API calls from Python agent

**Why Direct API**:
- Full control over message formatting
- No additional dependencies
- Real-time sending
- Easy error handling

**Implementation**:
```python
# apps/agent/src/adapters/whatsapp_sender.py
import aiohttp

async def send_whatsapp_message(
    phone_number_id: str,
    access_token: str,
    to: str,
    message_type: str,
    content: dict,
) -> dict:
    """Send a WhatsApp message via Graph API."""
    url = f"https://graph.facebook.com/v22.0/{phone_number_id}/messages"

    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": to,
        "type": message_type,
        **content,
    }

    async with aiohttp.ClientSession() as session:
        async with session.post(
            url,
            json=payload,
            headers={"Authorization": f"Bearer {access_token}"},
        ) as response:
            return await response.json()

# Send text message
async def send_text(phone_number_id: str, token: str, to: str, text: str):
    return await send_whatsapp_message(
        phone_number_id,
        token,
        to,
        "text",
        {"text": {"body": text}},
    )

# Send interactive buttons
async def send_buttons(phone_number_id: str, token: str, to: str, body: str, buttons: list):
    return await send_whatsapp_message(
        phone_number_id,
        token,
        to,
        "interactive",
        {
            "interactive": {
                "type": "button",
                "body": {"text": body},
                "action": {
                    "buttons": [
                        {"type": "reply", "reply": {"id": b["id"], "title": b["title"]}}
                        for b in buttons[:3]  # Max 3 buttons
                    ]
                }
            }
        },
    )
```

---

### 6. Quality Rating Monitoring

**Decision**: Store and display quality rating from webhooks

**Quality Levels**:
- `GREEN`: High quality, no restrictions
- `YELLOW`: Medium quality, may have lower limits
- `RED`: Low quality, restricted messaging

**Webhook Handler**:
```python
async def handle_quality_update(data: dict):
    """Handle phone_number_quality_update webhook."""
    for entry in data.get("entry", []):
        for change in entry.get("changes", []):
            if change["field"] == "phone_number_quality_update":
                value = change["value"]
                phone_number_id = value["display_phone_number"]
                quality = value["current_limit"]  # GREEN, YELLOW, RED

                # Update in Firestore
                await update_quality_rating(phone_number_id, quality)
```

---

### 7. Test Message Feature

**Decision**: Simple endpoint to send a test message

**Why**:
- Verify connection works
- User confidence
- Debug integration issues

**Implementation**:
```typescript
// Backend endpoint
export async function sendTestMessage(req: Request, res: Response) {
  const { phoneNumber } = req.body;
  const clinicId = await getClinicId(req.user!.uid);

  // Get WhatsApp credentials
  const connection = await getWhatsAppConnection(clinicId);
  const accessToken = await decryptToken(clinicId);

  // Send test message
  const result = await fetch(
    `https://graph.facebook.com/v22.0/${connection.phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phoneNumber,
        type: 'text',
        text: { body: '✅ Conexão WhatsApp funcionando! - Gendei' },
      }),
    }
  );

  const data = await result.json();

  if (data.error) {
    return res.status(400).json({ error: data.error.message });
  }

  return res.json({ success: true, messageId: data.messages[0].id });
}
```

---

### 8. Rate Limiting

**Decision**: Respect Meta API limits with exponential backoff

**Limits**:
- 80 messages/second per phone number
- Business-initiated conversation limits based on quality

**Implementation**:
```python
from aiolimiter import AsyncLimiter

# 80 messages per second
wa_limiter = AsyncLimiter(80, 1)

async def send_with_rate_limit(func, *args, **kwargs):
    async with wa_limiter:
        return await func(*args, **kwargs)

async def send_with_retry(func, *args, max_retries=3, **kwargs):
    for attempt in range(max_retries):
        try:
            return await send_with_rate_limit(func, *args, **kwargs)
        except RateLimitError:
            await asyncio.sleep(2 ** attempt)
    raise Exception("Max retries exceeded")
```

---

## Meta API Reference

### Graph API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/{waba_id}` | GET | Get WABA details |
| `/{waba_id}/phone_numbers` | GET | List phone numbers |
| `/{phone_id}/request_code` | POST | Request verification |
| `/{phone_id}/verify_code` | POST | Verify code |
| `/{phone_id}/messages` | POST | Send message |
| `/{phone_id}/register` | POST | Register number |

### Webhook Events

| Event | Description |
|-------|-------------|
| `messages` | Incoming messages |
| `message_template_status_update` | Template approval status |
| `phone_number_quality_update` | Quality rating change |
| `account_update` | WABA status change |

---

## Security Considerations

1. **App Secret**: Store in Secret Manager
2. **Access Tokens**: Encrypt at rest
3. **Webhook Verification**: Always verify signature
4. **HTTPS Only**: All API calls over HTTPS
5. **Token Rotation**: Refresh tokens before expiry

---

## References

- [WhatsApp Business Platform](https://developers.facebook.com/docs/whatsapp/cloud-api)
- [Embedded Signup](https://developers.facebook.com/docs/whatsapp/embedded-signup)
- [Graph API Reference](https://developers.facebook.com/docs/graph-api)
- [Webhooks](https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks)
