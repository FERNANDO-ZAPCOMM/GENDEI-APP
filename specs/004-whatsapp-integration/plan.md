# Plan: WhatsApp Integration

**Feature**: 004-whatsapp-integration
**Status**: Planning
**Date**: 2026-02-04

---

## Overview

Integrate WhatsApp Business Platform using Meta's Embedded Signup flow, allowing clinics to connect their WhatsApp Business accounts to receive and send messages. This enables AI-powered appointment scheduling through WhatsApp.

---

## Technical Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16, TypeScript, Meta Embedded Signup SDK |
| Backend | Firebase Functions (Node.js 20, Express.js) |
| Agent | Python 3.11+, FastAPI, Uvicorn |
| API | Meta Graph API v22.0 |
| Webhooks | Google Cloud Run |
| Database | Firestore |

---

## Implementation Phases

### Phase 1: Meta App Configuration
**Duration**: Setup

**Tasks**:
- [ ] Create Meta Business App
- [ ] Configure WhatsApp Business API permissions
- [ ] Set up App Review for required permissions
- [ ] Generate App Secret and App ID
- [ ] Configure webhook endpoints

**Meta App Permissions Required**:
- `whatsapp_business_management`
- `whatsapp_business_messaging`

**Acceptance Criteria**:
- Meta App approved for production
- Webhook verification working
- App credentials securely stored

---

### Phase 2: Embedded Signup Frontend
**Duration**: Core feature

**Tasks**:
- [ ] Load Meta SDK script dynamically
- [ ] Create WhatsApp connection page
- [ ] Implement Embedded Signup button
- [ ] Handle OAuth callback
- [ ] Display connection status
- [ ] Build phone number selector

**Files**:
- `apps/web/src/app/[locale]/dashboard/whatsapp/page.tsx`
- `apps/web/src/components/whatsapp/EmbeddedSignup.tsx`
- `apps/web/src/components/whatsapp/PhoneSelector.tsx`
- `apps/web/src/lib/meta-sdk.ts`

**Acceptance Criteria**:
- Embedded Signup popup opens
- User can authorize WhatsApp access
- Phone numbers listed after auth
- Connection persists across sessions

---

### Phase 3: Backend OAuth Flow
**Duration**: Core feature

**Tasks**:
- [ ] Implement embedded signup start endpoint
- [ ] Implement OAuth token exchange
- [ ] Store access tokens securely (encrypted)
- [ ] Fetch WABA details from Graph API
- [ ] Store WhatsApp connection in Firestore
- [ ] Update clinic document with WhatsApp fields

**Files**:
- `apps/functions/src/routes/meta.ts`
- `apps/functions/src/controllers/metaController.ts`
- `apps/functions/src/services/metaService.ts`
- `apps/functions/src/lib/encryption.ts`

**API Endpoints**:
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /meta/embedded-signup/start | Start OAuth flow |
| POST | /meta/embedded-signup/complete | Exchange code for token |

**Acceptance Criteria**:
- Token exchange successful
- Tokens encrypted at rest
- WABA info fetched and stored

---

### Phase 4: Phone Number Registration
**Duration**: Core feature

**Tasks**:
- [ ] Implement phone number verification request
- [ ] Build SMS/Voice code verification UI
- [ ] Implement code verification endpoint
- [ ] Register phone number after verification
- [ ] Subscribe to webhooks for the phone number

**Files**:
- `apps/functions/src/controllers/whatsappController.ts`
- `apps/web/src/components/whatsapp/VerificationCode.tsx`

**API Endpoints**:
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /whatsapp/request-verification | Request SMS/Voice code |
| POST | /whatsapp/register-number | Verify code and register |

**Acceptance Criteria**:
- Verification code sent via SMS/Voice
- Code verified successfully
- Phone number registered with Meta

---

### Phase 5: Webhook Setup
**Duration**: Core feature

**Tasks**:
- [ ] Create webhook verification endpoint
- [ ] Implement incoming message handler
- [ ] Set up webhook in Meta App dashboard
- [ ] Handle message status updates
- [ ] Forward messages to AI agent

**Files**:
- `apps/functions/src/routes/meta.ts`
- `apps/agent/src/main.py` (webhook endpoints)

**Webhook Events**:
- `messages` - Incoming messages
- `message_template_status_update` - Template status
- `phone_number_quality_update` - Quality rating

**Acceptance Criteria**:
- Webhook verification passes
- Messages received and logged
- Status updates processed

---

### Phase 6: Test Message Feature
**Duration**: Enhancement

**Tasks**:
- [ ] Create test message endpoint
- [ ] Build test message UI
- [ ] Send test message via Graph API
- [ ] Display delivery status
- [ ] Handle send errors

**Files**:
- `apps/web/src/components/whatsapp/TestMessage.tsx`
- `apps/functions/src/controllers/whatsappController.ts`

**API Endpoints**:
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /whatsapp/test-message | Send test message |

**Acceptance Criteria**:
- Test message sends successfully
- Delivery status displayed
- Error handling for invalid numbers

---

### Phase 7: Connection Status Dashboard
**Duration**: UI

**Tasks**:
- [ ] Display WhatsApp connection status
- [ ] Show phone number quality rating
- [ ] Display message limits
- [ ] Build reconnect flow
- [ ] Add disconnect option

**Files**:
- `apps/web/src/components/whatsapp/ConnectionStatus.tsx`
- `apps/web/src/components/whatsapp/QualityRating.tsx`

**Acceptance Criteria**:
- Status clearly displayed
- Quality rating visible
- Reconnect works if disconnected

---

### Phase 8: Agent Webhook Receiver
**Duration**: Backend

**Tasks**:
- [ ] Create FastAPI webhook endpoints
- [ ] Implement webhook signature verification
- [ ] Parse incoming WhatsApp messages
- [ ] Route to AI agents
- [ ] Handle media messages

**Files**:
- `apps/agent/src/main.py`
- `apps/agent/src/adapters/whatsapp_parser.py`
- `apps/agent/src/adapters/whatsapp_sender.py`

**Agent Endpoints**:
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /whatsapp | Webhook verification |
| POST | /whatsapp | Incoming messages |

**Acceptance Criteria**:
- Webhooks verified and received
- Messages parsed correctly
- Responses sent via Graph API

---

## Data Model

### Firestore: `gendei_clinics/{clinicId}` (WhatsApp fields)

```typescript
interface ClinicWhatsAppFields {
  whatsappConnected: boolean;
  whatsappPhoneNumberId: string;
  whatsappWabaId: string;
  whatsappDisplayPhone: string;
  whatsappQualityRating: 'GREEN' | 'YELLOW' | 'RED';
  whatsappConnectedAt: Timestamp;
}
```

### Firestore: `gendei_whatsapp/{clinicId}`

```typescript
interface WhatsAppConnection {
  clinicId: string;
  wabaId: string;
  phoneNumberId: string;
  displayPhone: string;
  qualityRating: string;
  messagingLimit: string;
  accessTokenEncrypted: string;
  webhookSubscribed: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### Firestore: `gendei_tokens/{clinicId}`

```typescript
interface EncryptedTokens {
  clinicId: string;
  accessToken: string;  // Encrypted
  refreshToken?: string;  // Encrypted
  expiresAt: Timestamp;
  createdAt: Timestamp;
}
```

---

## Security Considerations

1. **Token Encryption**: Access tokens encrypted with AES-256-GCM
2. **Webhook Verification**: Validate X-Hub-Signature-256 header
3. **App Secret**: Stored in Secret Manager, not env vars
4. **Rate Limiting**: Respect Meta API rate limits
5. **Audit Logging**: Log all API calls for debugging

---

## Testing Strategy

1. **Unit Tests**: Token encryption, webhook verification
2. **Integration Tests**: Meta API mocks
3. **E2E Tests**: Full connection flow with test WABA
4. **Manual Testing**: Production Meta App

---

## Dependencies

- `@tanstack/react-query`
- `crypto` (Node.js built-in for encryption)
- `aiohttp` (Python async HTTP)
- Firebase Secret Manager

---

## Success Metrics

- WhatsApp connection success rate > 95%
- Webhook delivery rate > 99.9%
- Message send latency < 2 seconds
