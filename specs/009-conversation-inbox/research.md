# Research: Conversation Inbox

**Feature**: 009-conversation-inbox
**Date**: 2026-02-04

---

## Technical Decisions

### 1. Real-time Architecture

**Decision**: Firestore onSnapshot listeners

**Options**:
| Approach | Pros | Cons | Decision |
|----------|------|------|----------|
| Firestore listeners | Native, real-time | Cost per read | **Selected** |
| WebSocket server | Full control | Infrastructure | Rejected |
| Polling | Simple | Latency, cost | Rejected |

**Why Firestore**:
- Native integration with existing stack
- Automatic reconnection handling
- Offline persistence support
- Security rules for access control

### 2. Message Storage

**Decision**: Top-level gendei_messages collection

**Options**:
| Approach | Pros | Cons | Decision |
|----------|------|------|----------|
| Top-level collection | Query flexibility | Index management | **Selected** |
| Subcollection | Natural grouping | Query limits | Rejected |

**Why Top-level**:
- Enables cross-conversation queries
- Better for analytics and search
- Compound queries with filters

### 3. AI Handoff Strategy

**Decision**: Per-conversation aiEnabled flag

**Flow**:
```
1. Staff clicks "Take Over"
2. aiEnabled = false on conversation
3. AI agent checks flag before responding
4. Staff sends messages manually
5. Staff clicks "Return to AI"
6. aiEnabled = true, AI resumes
```

### 4. Unread Count Management

**Decision**: Denormalized counter on conversation

**Implementation**:
```typescript
// On inbound message
await conversationRef.update({
  unreadCount: FieldValue.increment(1),
  lastMessageAt: FieldValue.serverTimestamp(),
});

// On conversation open
await conversationRef.update({
  unreadCount: 0,
});
```

---

## Component Architecture

```
InboxLayout
├── ConversationList
│   ├── ConversationSearch
│   ├── ConversationFilters
│   └── ConversationItem[]
├── ChatPanel
│   ├── ChatHeader (patient info, AI status)
│   ├── MessageList
│   │   └── MessageBubble[]
│   └── MessageInput
│       ├── QuickReplies
│       └── TextArea
└── PatientSidebar
    ├── PatientInfo
    ├── AppointmentHistory
    └── Notes
```

---

## Message Status Flow

```
WhatsApp Message Statuses:
sent → delivered → read

Firestore Updates:
1. Send message → status: 'pending'
2. WhatsApp accepts → status: 'sent', waMessageId saved
3. Webhook: delivered → status: 'delivered'
4. Webhook: read → status: 'read'
```

---

## Quick Reply Templates

```typescript
interface QuickReply {
  id: string;
  label: string;
  content: string;
  variables?: string[];  // e.g., ['patientName', 'appointmentDate']
}

const DEFAULT_QUICK_REPLIES: QuickReply[] = [
  {
    id: 'greeting',
    label: 'Saudação',
    content: 'Olá {{patientName}}! Como posso ajudar?',
    variables: ['patientName'],
  },
  {
    id: 'confirm',
    label: 'Confirmar consulta',
    content: 'Sua consulta está confirmada para {{appointmentDate}} às {{appointmentTime}}.',
    variables: ['appointmentDate', 'appointmentTime'],
  },
];
```

---

## Security Rules

```javascript
// gendei_conversations
match /gendei_conversations/{conversationId} {
  allow read: if request.auth != null &&
    resource.data.clinicId in request.auth.token.clinicIds;
  allow update: if request.auth != null &&
    resource.data.clinicId in request.auth.token.clinicIds;
}

// gendei_messages
match /gendei_messages/{messageId} {
  // Staff can read messages for their clinic's conversations
  allow read: if request.auth != null;
  // Write only through functions
  allow write: if false;
}
```

---

## Performance Optimizations

1. **Pagination**: Load 50 conversations initially, infinite scroll
2. **Message Virtualization**: Only render visible messages
3. **Optimistic Updates**: Show sent message immediately
4. **Debounced Typing**: Don't update on every keystroke

---

## References

- [Firestore Real-time Listeners](https://firebase.google.com/docs/firestore/query-data/listen)
- [WhatsApp Message Status](https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/components)
