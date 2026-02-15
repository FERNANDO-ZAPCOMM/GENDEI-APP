# Feature Specification: Conversation Inbox

**Feature Branch**: `009-conversation-inbox`
**Created**: 2026-02-04
**Updated**: 2026-02-16
**Status**: Implemented

## User Scenarios & Testing

### User Story 1 - View Conversation List (Priority: P1)

A clinic staff member views all WhatsApp conversations in a real-time inbox, sorted by most recent activity, with unread badges and patient context.

**Why this priority**: The inbox is the primary interface for monitoring patient communications.

**Independent Test**: Can be tested by verifying conversations appear in order with correct unread counts and real-time updates.

**Acceptance Scenarios**:

1. **Given** a clinic with conversations, **When** the staff opens the inbox, **Then** conversations are listed sorted by `lastMessageAt` descending with patient name, last message preview, and unread count.
2. **Given** a new message arrives, **When** Firestore triggers the listener, **Then** the conversation moves to the top and the unread count increments in real-time (< 500ms).
3. **Given** the status filter, **When** the staff selects a status (novo, em_atendimento, agendando, confirmando, concluido), **Then** only matching conversations are shown.

---

### User Story 2 - View and Send Messages (Priority: P1)

A clinic staff member opens a conversation to view the full message history and sends replies manually, respecting the 24-hour messaging window.

**Why this priority**: Reading and replying to messages is the core function of the inbox.

**Independent Test**: Can be tested by opening a conversation, scrolling through history, and sending a reply.

**Acceptance Scenarios**:

1. **Given** a conversation is selected, **When** the staff opens it, **Then** the full message thread is displayed with sender indicators (patient/AI/staff), timestamps, and delivery status (sent/delivered/read).
2. **Given** the message input, **When** the staff types and sends a message within the 24h window, **Then** it appears optimistically in the thread and is sent via WhatsApp Cloud API.
3. **Given** a sent message, **When** delivery status updates (delivered/read), **Then** the status indicator updates in real-time.
4. **Given** the 24h messaging window has expired, **When** the staff tries to send a message, **Then** the message is queued and a re-engagement template is used to re-open the window.

---

### User Story 3 - AI-to-Human Handoff (Priority: P2)

A clinic staff member takes over a conversation from the AI agent, manually responds, and can return control to the AI.

**Why this priority**: Human takeover is the safety net for complex cases the AI cannot handle.

**Independent Test**: Can be tested by clicking "Take Over" on a conversation, sending a manual reply, then clicking "Return to AI".

**Acceptance Scenarios**:

1. **Given** an AI-managed conversation, **When** the staff clicks "Take Over", **Then** `aiEnabled` is set to `false`, `assignedTo` is set to the staff's user ID, and the AI stops processing messages.
2. **Given** a taken-over conversation, **When** the staff sends messages, **Then** they are sent as `sender: 'staff'` with the staff member's name.
3. **Given** a taken-over conversation, **When** the staff clicks "Return to AI", **Then** `aiEnabled` is set to `true` and the AI resumes processing new messages.

---

### User Story 4 - Conversation Management (Priority: P2)

A clinic staff member archives, unarchives, or deletes conversations to keep the inbox organized.

**Why this priority**: Inbox management prevents clutter and improves daily workflow efficiency.

**Independent Test**: Can be tested by archiving a conversation and verifying it disappears from the main list.

**Acceptance Scenarios**:

1. **Given** a conversation, **When** the staff clicks "Archive", **Then** the conversation is moved to the archive and no longer appears in the main inbox.
2. **Given** an archived conversation, **When** a new message arrives, **Then** the conversation is automatically unarchived and appears in the main inbox.
3. **Given** a conversation, **When** the staff clicks "Delete", **Then** a confirmation dialog appears. On confirm, the conversation is soft-deleted.

---

### Edge Cases

- What happens when a conversation has hundreds of messages? (Paginated or lazy-loaded, show most recent first)
- What if a staff member and AI both try to reply simultaneously? (AI checks `aiEnabled` before sending — staff takes precedence)
- What about media messages (images, audio, documents)? (Displayed inline in thread with appropriate previews)
- What if the patient is not yet a registered patient? (Conversation still shows with phone number, patient can be linked later)
- What about the 24h messaging window? (Track window expiry, queue messages when window is closed, use re-engagement templates)

## Requirements

### Functional Requirements

- **FR-001**: System MUST display conversations in real-time using Firestore onSnapshot listeners
- **FR-002**: System MUST show unread count badges on conversations
- **FR-003**: System MUST support conversation states: novo, em_atendimento, agendando, confirmando, concluido
- **FR-004**: System MUST support message sending via WhatsApp Cloud API with delivery status tracking
- **FR-005**: System MUST support AI-to-human handoff (`aiEnabled` toggle, `assignedTo` field)
- **FR-006**: System MUST support returning control to AI after human intervention
- **FR-007**: System MUST display message sender type: patient, AI, staff, system
- **FR-008**: System MUST track 24-hour messaging window and queue messages when window is closed
- **FR-009**: System MUST support re-engagement templates to re-open expired messaging windows
- **FR-010**: System MUST support media messages (images, audio, documents) inline display
- **FR-011**: System MUST update in real-time (< 500ms latency via Firestore listeners)
- **FR-012**: System MUST support conversation archive/unarchive/delete operations
- **FR-013**: System MUST store messages in `chat_history` single document per conversation with metadata

### Key Entities

- **Conversation**: Clinic ID, patient info, status (novo/em_atendimento/agendando/confirmando/concluido), AI enabled flag, assigned staff, unread count, last message preview, messaging window expiry
- **Message** (in chat_history): Direction, sender type, content, media, WhatsApp message ID, delivery status, timestamps

## Success Criteria

### Measurable Outcomes

- **SC-001**: Message delivery < 2 seconds
- **SC-002**: Real-time sync < 500ms
- **SC-003**: AI-to-human handoff < 3 clicks
- **SC-004**: Zero missed messages in inbox
- **SC-005**: Unread count accuracy: 100%
