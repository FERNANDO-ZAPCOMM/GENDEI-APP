# Tasks: Conversation Inbox

**Input**: Design documents from `/specs/009-conversation-inbox/`
**Prerequisites**: plan.md, spec.md, data-model.md

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Data model and real-time infrastructure

- [ ] T001 Define Conversation and Message TypeScript interfaces in `apps/frontend/types/conversation.ts`
- [ ] T002 [P] Define QuickReply TypeScript interface
- [ ] T003 [P] Create Zod validation schemas for messages, conversation updates, and quick replies
- [ ] T004 [P] Set up Firestore onSnapshot listener utilities in `apps/frontend/hooks/useRealtimeConversations.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Backend API and real-time listeners — blocks all UI

- [ ] T005 Create conversations Express router in `apps/functions/src/routes/conversations.ts`
- [ ] T006 Implement GET /conversations endpoint (list by clinic, sorted by lastMessageAt)
- [ ] T007 [P] Implement GET /conversations/:id endpoint with messages
- [ ] T008 [P] Implement PATCH /conversations/:id endpoint (status, assignedTo, tags, priority)
- [ ] T009 Implement POST /conversations/:id/messages endpoint (send message via WhatsApp API)
- [ ] T010 [P] Add Firestore security rules and indexes for conversations and messages
- [ ] T011 Create TanStack Query hooks in `apps/frontend/hooks/useConversations.ts`

**Checkpoint**: Conversation CRUD + real-time listeners operational

---

## Phase 3: User Story 1 - Conversation List (Priority: P1)

**Goal**: Staff can view all conversations in a real-time inbox.

**Independent Test**: Open inbox → verify conversations listed → send new WhatsApp message → verify list updates in real-time.

### Implementation

- [ ] T012 [US1] Create inbox page in `apps/frontend/app/[locale]/dashboard/conversations/page.tsx`
- [ ] T013 [US1] Build conversation list component with real-time Firestore listener
- [ ] T014 [P] [US1] Build conversation item component (patient name, preview, unread badge, timestamp)
- [ ] T015 [US1] Implement status filter (active/waiting/resolved/spam)
- [ ] T016 [US1] Handle unread count decrement when conversation is opened

**Checkpoint**: Real-time conversation list functional

---

## Phase 4: User Story 2 - Message Thread (Priority: P1)

**Goal**: Staff can view full message history and send replies.

**Independent Test**: Open conversation → view messages with status indicators → send reply → verify delivery.

### Implementation

- [ ] T017 [US2] Build message thread component with Firestore listener
- [ ] T018 [P] [US2] Build message bubble component with sender type indicator (patient/AI/staff)
- [ ] T019 [P] [US2] Build delivery status indicators (pending/sent/delivered/read)
- [ ] T020 [US2] Build message input with send button
- [ ] T021 [US2] Wire send to POST /conversations/:id/messages API with optimistic update
- [ ] T022 [US2] Support media message display (images, audio, documents inline)

**Checkpoint**: Full message thread with sending functional

---

## Phase 5: User Story 3 - AI Handoff (Priority: P2)

**Goal**: Staff can take over from AI, respond manually, and return control to AI.

**Independent Test**: Click "Take Over" → verify AI stops → send reply as staff → click "Return to AI" → verify AI resumes.

### Implementation

- [ ] T023 [US3] Implement POST /conversations/:id/handoff endpoint
- [ ] T024 [P] [US3] Implement POST /conversations/:id/release endpoint
- [ ] T025 [US3] Build AI status indicator (active/paused) on conversation header
- [ ] T026 [US3] Build "Take Over" / "Return to AI" toggle buttons
- [ ] T027 [US3] Display assigned staff member name when AI is paused

**Checkpoint**: Human takeover and AI return flow functional

---

## Phase 6: User Story 4 - Quick Replies (Priority: P3)

**Goal**: Staff can use template quick replies with variable substitution.

**Independent Test**: Open quick reply picker → select template → verify variables substituted → send.

### Implementation

- [ ] T028 [US4] Create quick reply management endpoints (GET/POST/PATCH/DELETE)
- [ ] T029 [US4] Build quick reply picker component
- [ ] T030 [US4] Implement variable substitution ({patientName}, {date}, etc.)
- [ ] T031 [US4] Build quick reply settings page for template management

**Checkpoint**: Quick replies work with variable substitution

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T032 [P] Add loading skeletons to conversation list and thread
- [ ] T033 [P] Add i18n translations
- [ ] T034 Handle WebSocket/listener cleanup on component unmount
- [ ] T035 Run quickstart.md validation

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies
- **Foundational (Phase 2)**: Depends on Phase 1
- **US1 Conversation List (Phase 3)**: Depends on Phase 2
- **US2 Message Thread (Phase 4)**: Depends on Phase 3
- **US3 AI Handoff (Phase 5)**: Depends on Phase 4
- **US4 Quick Replies (Phase 6)**: Can start parallel to Phase 5
- **Polish (Phase 7)**: Depends on all

### Parallel Opportunities

- T002, T003, T004 (interfaces, schemas, listeners)
- T007, T008, T010 (API endpoints and Firestore setup)
- T014 (conversation item parallel to list)
- T018, T019 (message bubble and status parallel)
- T024 (release parallel to handoff)
- Phase 5 and Phase 6 can overlap
