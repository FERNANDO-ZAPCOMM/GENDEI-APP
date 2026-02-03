# Data Model: WhatsApp Integration

**Feature**: 004-whatsapp-integration
**Date**: 2026-02-04

---

## Firestore Collections

### 1. Clinic WhatsApp Fields: `gendei_clinics/{clinicId}`

Additional fields on the clinic document for quick access to WhatsApp status.

### 2. WhatsApp Connections: `gendei_whatsapp/{clinicId}`

Detailed WhatsApp connection information.

### 3. Encrypted Tokens: `gendei_tokens/{clinicId}`

Encrypted access tokens for Meta API.

---

## TypeScript Interfaces

### Clinic WhatsApp Fields

```typescript
/**
 * WhatsApp-related fields on the clinic document.
 * Used for quick status checks without reading full connection data.
 */
interface ClinicWhatsAppFields {
  /** Whether WhatsApp is connected and active */
  whatsappConnected: boolean;

  /** Meta Phone Number ID for API calls */
  whatsappPhoneNumberId?: string;

  /** WhatsApp Business Account ID */
  whatsappWabaId?: string;

  /** Display phone number (formatted) */
  whatsappDisplayPhone?: string;

  /** Current quality rating */
  whatsappQualityRating?: WhatsAppQualityRating;

  /** When WhatsApp was connected */
  whatsappConnectedAt?: Timestamp;
}

type WhatsAppQualityRating = 'GREEN' | 'YELLOW' | 'RED' | 'UNKNOWN';
```

---

### WhatsApp Connection (Full Document)

```typescript
import { Timestamp } from 'firebase/firestore';

/**
 * Full WhatsApp connection details.
 * Stored separately for security and to avoid bloating clinic document.
 */
interface WhatsAppConnection {
  /** Clinic ID (document ID matches this) */
  clinicId: string;

  // ─────────────────────────────────────────────
  // Meta Account Info
  // ─────────────────────────────────────────────

  /** WhatsApp Business Account ID */
  wabaId: string;

  /** Meta Business ID (from Embedded Signup) */
  businessId: string;

  // ─────────────────────────────────────────────
  // Phone Number Info
  // ─────────────────────────────────────────────

  /** Phone Number ID for API calls */
  phoneNumberId: string;

  /** Display phone number (e.g., +55 11 99999-8888) */
  displayPhone: string;

  /** Whether phone number is verified */
  verified: boolean;

  /** Verification method used */
  verificationMethod?: 'SMS' | 'VOICE';

  // ─────────────────────────────────────────────
  // Quality & Limits
  // ─────────────────────────────────────────────

  /** Current quality rating */
  qualityRating: WhatsAppQualityRating;

  /** Current messaging tier */
  messagingLimit: WhatsAppMessagingLimit;

  /** Number of business-initiated conversations in current window */
  conversationsUsed?: number;

  // ─────────────────────────────────────────────
  // Webhook Status
  // ─────────────────────────────────────────────

  /** Whether webhooks are subscribed */
  webhookSubscribed: boolean;

  /** Webhook fields subscribed to */
  webhookFields: string[];

  // ─────────────────────────────────────────────
  // Metadata
  // ─────────────────────────────────────────────

  /** Document creation timestamp */
  createdAt: Timestamp;

  /** Last update timestamp */
  updatedAt: Timestamp;

  /** Last webhook received */
  lastWebhookAt?: Timestamp;
}

type WhatsAppMessagingLimit =
  | 'TIER_1K'    // 1,000 conversations/day
  | 'TIER_10K'   // 10,000 conversations/day
  | 'TIER_100K'  // 100,000 conversations/day
  | 'TIER_UNLIMITED';
```

---

### Encrypted Tokens

```typescript
/**
 * Encrypted Meta API tokens.
 * Access tokens are encrypted with AES-256-GCM.
 */
interface EncryptedTokens {
  /** Clinic ID */
  clinicId: string;

  /** Encrypted access token */
  accessTokenEncrypted: string;

  /** Token type (usually 'Bearer') */
  tokenType: string;

  /** When the token expires (if known) */
  expiresAt?: Timestamp;

  /** User ID from Meta (for debugging) */
  metaUserId?: string;

  /** Scopes granted */
  scopes: string[];

  /** Document creation timestamp */
  createdAt: Timestamp;

  /** Last update timestamp */
  updatedAt: Timestamp;
}
```

---

### Webhook Event Types

```typescript
/**
 * Incoming WhatsApp webhook payload.
 */
interface WhatsAppWebhookPayload {
  object: 'whatsapp_business_account';
  entry: WhatsAppEntry[];
}

interface WhatsAppEntry {
  id: string;  // WABA ID
  changes: WhatsAppChange[];
}

interface WhatsAppChange {
  field: 'messages' | 'phone_number_quality_update' | 'account_update';
  value: WhatsAppMessageValue | WhatsAppQualityValue | WhatsAppAccountValue;
}

/**
 * Message webhook value.
 */
interface WhatsAppMessageValue {
  messaging_product: 'whatsapp';
  metadata: {
    display_phone_number: string;
    phone_number_id: string;
  };
  contacts?: WhatsAppContact[];
  messages?: WhatsAppMessage[];
  statuses?: WhatsAppStatus[];
}

interface WhatsAppContact {
  profile: {
    name: string;
  };
  wa_id: string;
}

interface WhatsAppMessage {
  id: string;
  from: string;
  timestamp: string;
  type: WhatsAppMessageType;
  text?: { body: string };
  image?: WhatsAppMedia;
  audio?: WhatsAppMedia;
  video?: WhatsAppMedia;
  document?: WhatsAppMedia;
  interactive?: WhatsAppInteractiveReply;
}

type WhatsAppMessageType =
  | 'text'
  | 'image'
  | 'audio'
  | 'video'
  | 'document'
  | 'sticker'
  | 'location'
  | 'contacts'
  | 'interactive'
  | 'button';

interface WhatsAppMedia {
  id: string;
  mime_type: string;
  sha256?: string;
  caption?: string;
  filename?: string;
}

interface WhatsAppInteractiveReply {
  type: 'button_reply' | 'list_reply';
  button_reply?: {
    id: string;
    title: string;
  };
  list_reply?: {
    id: string;
    title: string;
    description?: string;
  };
}

interface WhatsAppStatus {
  id: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  recipient_id: string;
  errors?: Array<{
    code: number;
    title: string;
  }>;
}

/**
 * Quality update webhook value.
 */
interface WhatsAppQualityValue {
  display_phone_number: string;
  event: 'FLAGGED' | 'UNFLAGGED';
  current_limit: WhatsAppQualityRating;
}

/**
 * Account update webhook value.
 */
interface WhatsAppAccountValue {
  phone_number_id: string;
  event: 'VERIFIED' | 'DISABLED' | 'REINSTATED';
}
```

---

### API Request/Response Types

```typescript
/**
 * Embedded Signup completion request.
 */
interface EmbeddedSignupCompleteRequest {
  code: string;  // OAuth code from FB.login
}

/**
 * Embedded Signup completion response.
 */
interface EmbeddedSignupCompleteResponse {
  success: boolean;
  wabaId: string;
  phoneNumbers: Array<{
    id: string;
    displayPhone: string;
    verified: boolean;
  }>;
}

/**
 * Phone number registration request.
 */
interface RegisterPhoneRequest {
  phoneNumberId: string;
  verificationCode: string;
}

/**
 * Test message request.
 */
interface TestMessageRequest {
  phoneNumber: string;  // Recipient phone (with country code)
}

/**
 * Test message response.
 */
interface TestMessageResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}
```

---

## Firestore Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Helper functions
    function isAuthenticated() {
      return request.auth != null;
    }

    function isClinicMember(clinicId) {
      let clinic = get(/databases/$(database)/documents/gendei_clinics/$(clinicId)).data;
      return isAuthenticated() &&
        (clinic.ownerId == request.auth.uid || request.auth.uid in clinic.adminIds);
    }

    // WhatsApp connections - clinic members only
    match /gendei_whatsapp/{clinicId} {
      allow read: if isClinicMember(clinicId);
      // Write only via backend (no client writes)
      allow write: if false;
    }

    // Encrypted tokens - never readable from client
    match /gendei_tokens/{clinicId} {
      allow read, write: if false;
    }
  }
}
```

---

## Indexes

```json
{
  "indexes": [
    {
      "collectionGroup": "gendei_whatsapp",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "phoneNumberId", "order": "ASCENDING" }
      ]
    }
  ]
}
```

---

## Example Documents

### WhatsApp Connection

```json
{
  "clinicId": "clinic_abc123",
  "wabaId": "123456789012345",
  "businessId": "987654321098765",
  "phoneNumberId": "111222333444555",
  "displayPhone": "+55 11 99999-8888",
  "verified": true,
  "verificationMethod": "SMS",
  "qualityRating": "GREEN",
  "messagingLimit": "TIER_1K",
  "webhookSubscribed": true,
  "webhookFields": ["messages", "phone_number_quality_update"],
  "createdAt": "2026-02-04T10:00:00Z",
  "updatedAt": "2026-02-04T10:00:00Z"
}
```

### Encrypted Tokens

```json
{
  "clinicId": "clinic_abc123",
  "accessTokenEncrypted": "base64iv:base64tag:base64ciphertext",
  "tokenType": "Bearer",
  "scopes": ["whatsapp_business_management", "whatsapp_business_messaging"],
  "metaUserId": "10000000000001",
  "createdAt": "2026-02-04T10:00:00Z",
  "updatedAt": "2026-02-04T10:00:00Z"
}
```

---

## Query Patterns

### Get WhatsApp Connection for Clinic

```typescript
const connectionDoc = await db
  .collection('gendei_whatsapp')
  .doc(clinicId)
  .get();

if (!connectionDoc.exists) {
  // WhatsApp not connected
}

const connection = connectionDoc.data() as WhatsAppConnection;
```

### Find Clinic by Phone Number ID

```typescript
// Used by webhook handler to route messages
const snapshot = await db
  .collection('gendei_whatsapp')
  .where('phoneNumberId', '==', phoneNumberId)
  .limit(1)
  .get();

if (!snapshot.empty) {
  const clinicId = snapshot.docs[0].id;
}
```

### Check WhatsApp Status (Quick)

```typescript
// Read just the clinic document for status
const clinicDoc = await db
  .collection('gendei_clinics')
  .doc(clinicId)
  .get();

const isConnected = clinicDoc.data()?.whatsappConnected === true;
```
