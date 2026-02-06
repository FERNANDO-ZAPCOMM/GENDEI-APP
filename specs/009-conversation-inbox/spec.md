# Feature Specification: Conversation Inbox

**Feature Branch**: `009-conversation-inbox`
**Created**: 2026-02-04
**Status**: Implemented

## User Scenarios & Testing

### User Story 1 - View Conversation List (Priority: P1)

A clinic staff member views all WhatsApp conversations in a real-time inbox, sorted by most recent activity, with unread badges and patient context.

**Why this priority**: The inbox is the primary interface for monitoring patient communications.

**Independent Test**: Can be tested by verifying conversations appear in order with correct unread counts and real-time updates.

**Acceptance Scenarios**:

1. **Given** a clinic with conversations, **When** the staff opens the inbox, **Then** conversations are listed sorted by `lastMessageAt` descending with patient name, last message preview, and unread count.
2. **Given** a new message arrives, **When** Firestore triggers the listener, **Then** the conversation moves to the top and the unread count increments in real-time (< 500ms).
3. **Given** the status filter, **When** the staff selects "active", **Then** only active conversations are shown.

---

### User Story 2 - View and Send Messages (Priority: P1)

A clinic staff member opens a conversation to view the full message history and sends replies manually.

**Why this priority**: Reading and replying to messages is the core function of the inbox.

**Independent Test**: Can be tested by opening a conversation, scrolling through history, and sending a reply.

**Acceptance Scenarios**:

1. **Given** a conversation is selected, **When** the staff opens it, **Then** the full message thread is displayed with sender indicators (patient/AI/staff), timestamps, and delivery status (sent/delivered/read).
2. **Given** the message input, **When** the staff types and sends a message, **Then** it appears optimistically in the thread and is sent via WhatsApp Cloud API.
3. **Given** a sent message, **When** delivery status updates (delivered/read), **Then** the status indicator updates in real-time.

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

### User Story 4 - Quick Replies (Priority: P3)

A clinic staff member uses pre-configured quick reply templates to respond faster, with variable substitution for patient name, date, etc.

**Why this priority**: Quick replies improve response time but are an optimization, not a requirement.

**Independent Test**: Can be tested by selecting a quick reply template and verifying it populates the message input with substituted variables.

**Acceptance Scenarios**:

1. **Given** a conversation open, **When** the staff clicks the quick reply button, **Then** available templates are shown.
2. **Given** a selected template with variables, **When** applied, **Then** `{patientName}` and `{date}` are substituted with actual values.
3. **Given** the settings page, **When** the staff creates a new quick reply template, **Then** it becomes available in all conversations.

---

### Edge Cases

- What happens when a conversation has hundreds of messages? (Paginated or lazy-loaded, show most recent first)
- What if a staff member and AI both try to reply simultaneously? (AI checks `aiEnabled` before sending — staff takes precedence)
- What about media messages (images, audio, documents)? (Displayed inline in thread with appropriate previews)
- What if the patient is not yet a registered patient? (Conversation still shows with phone number, patient can be linked later)

## Requirements

### Functional Requirements

- **FR-001**: System MUST display conversations in real-time using Firestore onSnapshot listeners
- **FR-002**: System MUST show unread count badges on conversations
- **FR-003**: System MUST support conversation status management: active, waiting, resolved, spam
- **FR-004**: System MUST support message sending via WhatsApp Cloud API with delivery status tracking
- **FR-005**: System MUST support AI-to-human handoff (`aiEnabled` toggle, `assignedTo` field)
- **FR-006**: System MUST support returning control to AI after human intervention
- **FR-007**: System MUST display message sender type: patient, AI, staff, system
- **FR-008**: System MUST support quick reply templates with variable substitution
- **FR-009**: System MUST support media messages (images, audio, documents) inline display
- **FR-010**: System MUST update in real-time (< 500ms latency via Firestore listeners)

### Key Entities

- **Conversation**: Clinic ID, patient info, status, AI enabled flag, assigned staff, unread count, last message preview
- **Message**: Direction, sender type, content, media, WhatsApp message ID, delivery status, timestamps
- **QuickReply**: Label, content template, shortcut, variables, category

## Success Criteria

### Measurable Outcomes

- **SC-001**: Message delivery < 2 seconds
- **SC-002**: Real-time sync < 500ms
- **SC-003**: AI-to-human handoff < 3 clicks
- **SC-004**: Zero missed messages in inbox
- **SC-005**: Unread count accuracy: 100%
