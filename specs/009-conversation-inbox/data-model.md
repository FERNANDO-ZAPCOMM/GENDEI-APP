# Data Model: Conversation Inbox

**Feature**: 009-conversation-inbox
**Date**: 2026-02-04

---

## Collections Overview

```
gendei_conversations (top-level)
├── {conversationId}

gendei_messages (top-level)
├── {messageId}

gendei_quick_replies (subcollection)
└── gendei_clinics/{clinicId}/quick_replies/{replyId}
```

---

## Conversation Document

**Collection**: `gendei_conversations`

```typescript
interface Conversation {
  // Identity
  id: string;
  clinicId: string;
  patientId: string;

  // Patient info (denormalized)
  patientPhone: string;
  patientName: string;
  patientPhotoUrl?: string;

  // Conversation status
  status: ConversationStatus;
  priority: 'low' | 'normal' | 'high' | 'urgent';

  // AI control
  aiEnabled: boolean;
  aiPausedAt?: Timestamp;
  aiPausedBy?: string;

  // Assignment
  assignedTo?: string;
  assignedAt?: Timestamp;

  // Counts
  unreadCount: number;
  messageCount: number;

  // Last message preview
  lastMessageAt: Timestamp;
  lastMessagePreview: string;
  lastMessageDirection: 'inbound' | 'outbound';

  // Tags/Labels
  tags: string[];

  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
  resolvedAt?: Timestamp;
}

type ConversationStatus = 'active' | 'waiting' | 'resolved' | 'spam';
```

---

## Message Document

**Collection**: `gendei_messages`

```typescript
interface Message {
  // Identity
  id: string;
  conversationId: string;
  clinicId: string;  // For queries

  // Direction and sender
  direction: 'inbound' | 'outbound';
  sender: MessageSender;
  senderName?: string;  // Staff name if applicable

  // Content
  type: MessageType;
  content: string;

  // Media (if applicable)
  mediaUrl?: string;
  mediaType?: string;
  mediaMimeType?: string;
  mediaCaption?: string;

  // WhatsApp tracking
  waMessageId?: string;
  status: MessageStatus;
  statusUpdatedAt?: Timestamp;
  errorCode?: string;
  errorMessage?: string;

  // Metadata
  replyTo?: string;  // messageId being replied to
  isForwarded?: boolean;

  // AI metadata
  aiGenerated?: boolean;
  aiConfidence?: number;

  // Timestamps
  timestamp: Timestamp;
  createdAt: Timestamp;
}

type MessageSender = 'patient' | 'ai' | 'staff' | 'system';

type MessageType =
  | 'text'
  | 'image'
  | 'audio'
  | 'video'
  | 'document'
  | 'location'
  | 'contacts'
  | 'sticker'
  | 'interactive';

type MessageStatus =
  | 'pending'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'failed';
```

---

## Quick Reply Document

**Collection**: `gendei_clinics/{clinicId}/quick_replies`

```typescript
interface QuickReply {
  id: string;
  label: string;
  content: string;
  shortcut?: string;  // e.g., '/confirm'
  variables: string[];
  category?: string;
  order: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

---

## Zod Schemas

```typescript
import { z } from 'zod';

export const conversationStatusSchema = z.enum([
  'active',
  'waiting',
  'resolved',
  'spam',
]);

export const messageSenderSchema = z.enum([
  'patient',
  'ai',
  'staff',
  'system',
]);

export const messageTypeSchema = z.enum([
  'text',
  'image',
  'audio',
  'video',
  'document',
  'location',
  'contacts',
  'sticker',
  'interactive',
]);

export const messageStatusSchema = z.enum([
  'pending',
  'sent',
  'delivered',
  'read',
  'failed',
]);

export const sendMessageSchema = z.object({
  content: z.string().min(1).max(4096),
  type: messageTypeSchema.default('text'),
  replyTo: z.string().optional(),
});

export const updateConversationSchema = z.object({
  status: conversationStatusSchema.optional(),
  assignedTo: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
});

export const quickReplySchema = z.object({
  label: z.string().min(1).max(50),
  content: z.string().min(1).max(1000),
  shortcut: z.string().max(20).optional(),
  variables: z.array(z.string()),
  category: z.string().optional(),
  order: z.number().int().min(0),
});
```

---

## Indexes

```javascript
// Conversations by clinic, sorted by last message
{
  collectionGroup: 'gendei_conversations',
  fields: [
    { fieldPath: 'clinicId', order: 'ASCENDING' },
    { fieldPath: 'lastMessageAt', order: 'DESCENDING' }
  ]
}

// Conversations with unread
{
  collectionGroup: 'gendei_conversations',
  fields: [
    { fieldPath: 'clinicId', order: 'ASCENDING' },
    { fieldPath: 'unreadCount', order: 'DESCENDING' },
    { fieldPath: 'lastMessageAt', order: 'DESCENDING' }
  ]
}

// Messages by conversation
{
  collectionGroup: 'gendei_messages',
  fields: [
    { fieldPath: 'conversationId', order: 'ASCENDING' },
    { fieldPath: 'timestamp', order: 'ASCENDING' }
  ]
}

// Messages by clinic for search
{
  collectionGroup: 'gendei_messages',
  fields: [
    { fieldPath: 'clinicId', order: 'ASCENDING' },
    { fieldPath: 'timestamp', order: 'DESCENDING' }
  ]
}
```

---

## Example Documents

### Conversation

```json
{
  "id": "conv_abc123",
  "clinicId": "clinic_xyz",
  "patientId": "patient_456",
  "patientPhone": "+5511999999999",
  "patientName": "Maria Silva",
  "status": "active",
  "priority": "normal",
  "aiEnabled": true,
  "unreadCount": 2,
  "messageCount": 15,
  "lastMessageAt": "2026-02-04T14:30:00Z",
  "lastMessagePreview": "Gostaria de agendar uma consulta",
  "lastMessageDirection": "inbound",
  "tags": ["novo-paciente"],
  "createdAt": "2026-02-04T14:00:00Z",
  "updatedAt": "2026-02-04T14:30:00Z"
}
```

### Message

```json
{
  "id": "msg_def789",
  "conversationId": "conv_abc123",
  "clinicId": "clinic_xyz",
  "direction": "inbound",
  "sender": "patient",
  "type": "text",
  "content": "Gostaria de agendar uma consulta para amanhã",
  "waMessageId": "wamid.xxx",
  "status": "delivered",
  "timestamp": "2026-02-04T14:30:00Z",
  "createdAt": "2026-02-04T14:30:00Z"
}
```
