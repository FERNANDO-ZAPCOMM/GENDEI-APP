# Plan: Conversation Inbox

**Feature**: 009-conversation-inbox
**Status**: Implemented
**Date**: 2026-02-04

---

## Overview

Implement a real-time conversation inbox for managing WhatsApp patient communications, including message history, quick replies, conversation status management, and handoff from AI to human agents.

---

## Technical Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16 + React 19 |
| Real-time | Firestore onSnapshot |
| Backend | Firebase Functions |
| Database | Firestore |
| Messaging | WhatsApp Cloud API |

---

## Key Features

1. Real-time message sync with Firestore listeners
2. Conversation list with unread counts
3. AI-to-human handoff workflow
4. Quick reply templates
5. Message status indicators (sent/delivered/read)
6. Patient context sidebar
7. Conversation search and filters

---

## User Flow

```
1. Staff opens inbox dashboard
2. Conversations sorted by recent activity
3. Click conversation to view messages
4. AI status shown (active/paused)
5. Take over from AI if needed
6. Send messages, use quick replies
7. Return control to AI when done
```

---

## Data Model

### Conversation Document

```typescript
interface Conversation {
  id: string;
  clinicId: string;
  patientId: string;
  patientPhone: string;
  patientName: string;

  // Status
  status: 'active' | 'waiting' | 'resolved';
  aiEnabled: boolean;
  assignedTo?: string;  // staff userId

  // Counts
  unreadCount: number;
  messageCount: number;

  // Timestamps
  lastMessageAt: Timestamp;
  lastMessagePreview: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### Message Document

```typescript
interface Message {
  id: string;
  conversationId: string;

  // Direction
  direction: 'inbound' | 'outbound';
  sender: 'patient' | 'ai' | 'staff';

  // Content
  type: 'text' | 'image' | 'audio' | 'document';
  content: string;
  mediaUrl?: string;

  // WhatsApp status
  waMessageId?: string;
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';

  // Timestamps
  timestamp: Timestamp;
}
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /conversations | List clinic conversations |
| GET | /conversations/:id | Get conversation with messages |
| POST | /conversations/:id/messages | Send message |
| PATCH | /conversations/:id | Update status/assignment |
| POST | /conversations/:id/handoff | Take over from AI |
| POST | /conversations/:id/release | Return to AI |

---

## Real-time Strategy

```typescript
// Subscribe to conversations
const unsubscribe = onSnapshot(
  query(
    collection(db, 'gendei_conversations'),
    where('clinicId', '==', clinicId),
    orderBy('lastMessageAt', 'desc'),
    limit(50)
  ),
  (snapshot) => {
    // Update state
  }
);

// Subscribe to messages
const unsubMessages = onSnapshot(
  query(
    collection(db, 'gendei_messages'),
    where('conversationId', '==', conversationId),
    orderBy('timestamp', 'asc')
  ),
  (snapshot) => {
    // Update messages
  }
);
```

---

## Success Metrics

- Message delivery < 2 seconds
- Real-time sync < 500ms
- Handoff completion < 3 clicks
- Zero missed messages
