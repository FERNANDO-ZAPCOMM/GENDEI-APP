# Tasks: WhatsApp Integration

**Input**: Design documents from `/specs/004-whatsapp-integration/`
**Prerequisites**: plan.md, spec.md, data-model.md

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Meta App configuration and encryption setup

- [ ] T001 Create Meta Business App and configure WhatsApp Business API permissions
- [ ] T002 [P] Set up App Secret in Google Cloud Secret Manager
- [ ] T003 [P] Create encryption module (AES-256-GCM) in `apps/functions/src/lib/encryption.ts`
- [ ] T004 [P] Define WhatsApp TypeScript interfaces in `apps/frontend/types/whatsapp.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Backend OAuth and token management — blocks all message features

- [ ] T005 Create meta Express router in `apps/functions/src/routes/meta.ts`
- [ ] T006 Implement POST /meta/embedded-signup/start endpoint
- [ ] T007 Implement POST /meta/embedded-signup/complete endpoint (token exchange + encryption)
- [ ] T008 [P] Create Meta Graph API service in `apps/functions/src/services/metaService.ts`
- [ ] T009 [P] Create Firestore collections: `gendei_whatsapp` and `gendei_tokens`
- [ ] T010 Add Firestore security rules for WhatsApp and token collections

**Checkpoint**: OAuth flow operational — tokens can be exchanged and stored securely

---

## Phase 3: User Story 1 - Embedded Signup (Priority: P1)

**Goal**: Clinic owners can connect WhatsApp via Meta's Embedded Signup.

**Independent Test**: Click "Connect WhatsApp" → complete OAuth → verify connection status shows "Connected".

### Implementation

- [ ] T011 [US1] Create Meta SDK loader in `apps/frontend/lib/meta-sdk.ts`
- [ ] T012 [US1] Build Embedded Signup component in `apps/frontend/components/whatsapp/embedded-signup.tsx`
- [ ] T013 [US1] Create WhatsApp setup page in `apps/frontend/app/[locale]/dashboard/whatsapp/page.tsx`
- [ ] T014 [US1] Handle OAuth callback and token exchange flow
- [ ] T015 [US1] Fetch WABA details and update clinic document with WhatsApp fields
- [ ] T016 [US1] Build phone number selector component in `apps/frontend/components/whatsapp/phone-selector.tsx`

**Checkpoint**: WhatsApp accounts can be connected from the dashboard

---

## Phase 4: User Story 2 - Phone Verification (Priority: P1)

**Goal**: Clinic owners can verify their phone number via SMS/Voice code.

**Independent Test**: Request code → enter code → verify phone status changes to "Verified".

### Implementation

- [ ] T017 [US2] Implement POST /whatsapp/request-verification endpoint
- [ ] T018 [US2] Implement POST /whatsapp/register-number endpoint (code verification)
- [ ] T019 [US2] Build verification code input UI in `apps/frontend/components/whatsapp/verification-code.tsx`
- [ ] T020 [US2] Wire verification flow to API with error handling and retry

**Checkpoint**: Phone numbers can be verified

---

## Phase 5: User Story 3 - Webhook Message Reception (Priority: P1)

**Goal**: System receives and processes incoming WhatsApp messages.

**Independent Test**: Send WhatsApp message → verify it reaches the AI agent.

### Implementation

- [ ] T021 [US3] Implement GET /whatsapp webhook verification endpoint (challenge response)
- [ ] T022 [US3] Implement POST /whatsapp webhook handler with signature verification
- [ ] T023 [US3] Create message parser in `apps/whatsapp-agent-openai/src/adapters/firestore.py`
- [ ] T024 [P] [US3] Implement message status update handler (sent/delivered/read/failed)
- [ ] T025 [US3] Configure webhook subscription in Meta App dashboard
- [ ] T026 [US3] Forward parsed messages to AI agent for processing

**Checkpoint**: Messages flow from WhatsApp to AI agent

---

## Phase 6: User Story 4 - Test Message (Priority: P2)

**Goal**: Clinic owners can send test messages from the dashboard.

**Independent Test**: Enter phone → send test → verify delivery status displayed.

### Implementation

- [ ] T027 [US4] Implement POST /whatsapp/test-message endpoint
- [ ] T028 [US4] Build test message UI in `apps/frontend/components/whatsapp/test-message.tsx`
- [ ] T029 [US4] Display delivery status feedback (sent/delivered/read)

**Checkpoint**: Test messages can be sent and status tracked

---

## Phase 7: User Story 5 - Connection Status (Priority: P3)

**Goal**: Dashboard shows WhatsApp connection health.

**Independent Test**: Visit WhatsApp page → verify all status indicators displayed.

### Implementation

- [ ] T030 [US5] Build connection status component in `apps/frontend/components/whatsapp/connection-status.tsx`
- [ ] T031 [P] [US5] Build quality rating display component
- [ ] T032 [US5] Implement reconnect flow for disconnected accounts
- [ ] T033 [US5] Add disconnect option with confirmation

**Checkpoint**: Full WhatsApp management dashboard functional

---

## Phase 8: Polish & Cross-Cutting Concerns

- [ ] T034 [P] Add i18n translations for all WhatsApp-related UI
- [ ] T035 [P] Add loading and error states to all components
- [ ] T036 Add audit logging for all Meta API calls
- [ ] T037 Run quickstart.md validation

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies
- **Foundational (Phase 2)**: Depends on Phase 1
- **US1 Embedded Signup (Phase 3)**: Depends on Phase 2
- **US2 Phone Verification (Phase 4)**: Depends on Phase 3
- **US3 Webhooks (Phase 5)**: Depends on Phase 4 (needs verified phone)
- **US4 Test Message (Phase 6)**: Depends on Phase 5
- **US5 Status (Phase 7)**: Can run parallel to Phase 6
- **Polish (Phase 8)**: Depends on all user stories

### Parallel Opportunities

- T002, T003, T004 (Phase 1 setup)
- T008, T009 (Phase 2 service and Firestore setup)
- T024 (status handler parallel to message handler)
- T031 (quality rating parallel to connection status)
- Phase 6 and Phase 7 can partially overlap
