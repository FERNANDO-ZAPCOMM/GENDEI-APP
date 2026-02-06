# Feature Specification: WhatsApp Integration

**Feature Branch**: `004-whatsapp-integration`
**Created**: 2026-02-04
**Status**: Implemented

## User Scenarios & Testing

### User Story 1 - Connect WhatsApp via Embedded Signup (Priority: P1)

A clinic owner connects their WhatsApp Business account to Gendei using Meta's Embedded Signup flow directly from the dashboard.

**Why this priority**: Without a WhatsApp connection, the entire AI agent system cannot function.

**Independent Test**: Can be tested by clicking the Embedded Signup button, completing Meta OAuth, and verifying the WhatsApp connection status shows "Connected".

**Acceptance Scenarios**:

1. **Given** a clinic owner on the WhatsApp setup page, **When** they click "Connect WhatsApp", **Then** Meta's Embedded Signup popup opens.
2. **Given** the user completes Meta authorization, **When** the OAuth callback returns, **Then** the access token is exchanged, encrypted (AES-256-GCM), and stored in Firestore.
3. **Given** a successful token exchange, **When** the WABA details are fetched, **Then** the clinic's `whatsappConnected` field is set to `true` and phone number info is saved.

---

### User Story 2 - Verify Phone Number (Priority: P1)

After connecting their account, the clinic owner verifies their WhatsApp phone number via SMS or Voice code.

**Why this priority**: Phone number verification is required before the clinic can receive messages.

**Independent Test**: Can be tested by requesting a verification code, entering it, and verifying the phone number status changes to "Verified".

**Acceptance Scenarios**:

1. **Given** a connected WhatsApp account with unverified phone, **When** the owner clicks "Verify", **Then** a verification code is sent via SMS or Voice.
2. **Given** a verification code was sent, **When** the owner enters the correct code, **Then** the phone number is registered with Meta and marked as verified.
3. **Given** an incorrect code entered, **When** the owner submits, **Then** an error message appears and they can retry.

---

### User Story 3 - Receive Webhook Messages (Priority: P1)

The system receives incoming WhatsApp messages via Meta's webhook and routes them to the AI agent for processing.

**Why this priority**: Message reception is the foundation of the entire conversational experience.

**Independent Test**: Can be tested by sending a WhatsApp message to the connected number and verifying it appears in the conversation log.

**Acceptance Scenarios**:

1. **Given** a configured webhook, **When** Meta sends a GET verification request, **Then** the system responds with the challenge token.
2. **Given** a patient sends a WhatsApp message, **When** the webhook receives the event, **Then** the message is parsed, validated (signature verification), and forwarded to the AI agent.
3. **Given** a webhook with an invalid signature, **When** the event arrives, **Then** it is rejected with a 403 status.

---

### User Story 4 - Send Test Message (Priority: P2)

A clinic owner sends a test message from the dashboard to verify the WhatsApp connection is working.

**Why this priority**: Testing gives confidence that the setup is correct before going live.

**Independent Test**: Can be tested by entering a phone number, sending a test message, and verifying delivery status.

**Acceptance Scenarios**:

1. **Given** a connected and verified WhatsApp account, **When** the owner enters a phone number and clicks "Send Test", **Then** a test message is sent via the WhatsApp Cloud API.
2. **Given** a sent test message, **When** the delivery status updates, **Then** the dashboard shows "Sent", "Delivered", or "Read" status.

---

### User Story 5 - View Connection Status (Priority: P3)

A clinic owner can view their WhatsApp connection health: status, quality rating, message limits, and last activity.

**Why this priority**: Monitoring helps clinics maintain healthy WhatsApp connections.

**Independent Test**: Can be tested by viewing the WhatsApp page and verifying all status indicators are displayed.

**Acceptance Scenarios**:

1. **Given** a connected WhatsApp account, **When** the owner visits the WhatsApp page, **Then** they see: connection status (green/red), quality rating, messaging tier, and last webhook timestamp.
2. **Given** a disconnected account, **When** the owner visits the page, **Then** a "Reconnect" button is displayed.

---

### Edge Cases

- What happens when the Meta OAuth token expires? (Refresh token flow or re-authentication prompt)
- What happens when the phone number quality drops to RED? (Show warning in dashboard)
- What if a clinic disconnects and reconnects? (Clean up old connection, create new one)
- What if two clinics try to connect the same phone number? (Block — phone number is unique per clinic)

## Requirements

### Functional Requirements

- **FR-001**: System MUST implement Meta Embedded Signup OAuth flow for WhatsApp Business API
- **FR-002**: System MUST encrypt access tokens using AES-256-GCM before storing in Firestore
- **FR-003**: System MUST verify webhook signatures using X-Hub-Signature-256 header
- **FR-004**: System MUST support phone number verification via SMS and Voice methods
- **FR-005**: System MUST forward incoming messages to the AI agent service (Cloud Run)
- **FR-006**: System MUST handle message status updates (sent, delivered, read, failed)
- **FR-007**: System MUST display connection status, quality rating, and messaging limits in dashboard
- **FR-008**: System MUST support sending test messages from the dashboard
- **FR-009**: System MUST subscribe to webhook events: messages, message_template_status_update, phone_number_quality_update
- **FR-010**: System MUST store App Secret in Google Cloud Secret Manager, not environment variables

### Key Entities

- **WhatsApp Connection** (`gendei_whatsapp/{clinicId}`): WABA ID, phone number ID, display phone, quality rating, messaging tier, webhook status
- **Encrypted Tokens** (`gendei_tokens/{clinicId}`): Encrypted access token, token type, expiration, scopes
- **Clinic WhatsApp Fields**: Connected flag, phone number ID, WABA ID, display phone, quality rating

## Success Criteria

### Measurable Outcomes

- **SC-001**: WhatsApp connection success rate > 95%
- **SC-002**: Webhook delivery rate > 99.9%
- **SC-003**: Message send latency < 2 seconds
- **SC-004**: Token encryption/decryption adds < 50ms overhead
