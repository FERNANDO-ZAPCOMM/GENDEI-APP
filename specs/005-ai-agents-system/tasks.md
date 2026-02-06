# Tasks: AI Agents System

**Input**: Design documents from `/specs/005-ai-agents-system/`
**Prerequisites**: plan.md, spec.md, data-model.md

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Python project and OpenAI Agents SDK configuration

- [ ] T001 Set up Python project with FastAPI and dependencies in `apps/whatsapp-agent-openai/requirements.txt`
- [ ] T002 [P] Create Dockerfile and deploy.sh for Cloud Run deployment
- [ ] T003 [P] Configure environment variables and Firestore connection in `apps/whatsapp-agent-openai/src/database/firestore.py`
- [ ] T004 [P] Create vertical config module in `apps/whatsapp-agent-openai/src/vertical_config.py`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: FastAPI app, webhook handlers, and tool framework — blocks all agent work

- [ ] T005 Create FastAPI application with webhook endpoints in `apps/whatsapp-agent-openai/src/main.py`
- [ ] T006 Implement GET /whatsapp webhook verification
- [ ] T007 Implement POST /whatsapp message handler with signature verification
- [ ] T008 [P] Create WhatsApp message parser in `apps/whatsapp-agent-openai/src/adapters/firestore.py`
- [ ] T009 [P] Create WhatsApp message sender utilities in `apps/whatsapp-agent-openai/src/utils/messaging.py`
- [ ] T010 Create Runtime context dataclass in `apps/whatsapp-agent-openai/src/runtime/context.py`
- [ ] T011 Create per-clinic runtime loader in `apps/whatsapp-agent-openai/src/runtime/creator_runtime.py`
- [ ] T012 [P] Create base tool definitions: `send_text_message`, `send_whatsapp_buttons` in `apps/whatsapp-agent-openai/src/agents/function_tools.py`

**Checkpoint**: Webhook receives messages and tools can send WhatsApp responses

---

## Phase 3: User Story 1 - Triage and Routing (Priority: P1)

**Goal**: Messages are classified by intent and routed to the correct agent.

**Independent Test**: Send "Oi" → verify routed to Greeter. Send "Quero agendar" → verify routed to Scheduling.

### Implementation

- [ ] T013 [US1] Define triage agent prompt (Portuguese) in `apps/whatsapp-agent-openai/src/agents/prompts.py`
- [ ] T014 [P] [US1] Define greeter agent prompt with {vertical_placeholders}
- [ ] T015 [P] [US1] Define clinic info agent prompt with {vertical_placeholders}
- [ ] T016 [US1] Create agent definitions with handoff configuration in `apps/whatsapp-agent-openai/src/agents/definitions.py`
- [ ] T017 [US1] Implement orchestrator with Runner.run() in `apps/whatsapp-agent-openai/src/agents/orchestrator.py`
- [ ] T018 [US1] Implement input guardrail (prompt injection blocking) in `apps/whatsapp-agent-openai/src/agents/guardrails.py`
- [ ] T019 [US1] Implement output guardrail (AI disclosure blocking)

**Checkpoint**: Messages are classified and routed to greeter/scheduling/support

---

## Phase 4: User Story 2 - Appointment Booking (Priority: P1)

**Goal**: Patients can book appointments through the full scheduling conversation flow.

**Independent Test**: "Quero agendar" → select service → select date → select time → verify appointment in Firestore.

### Implementation

- [ ] T020 [US2] Define scheduling agent prompt with service/professional/hours context
- [ ] T021 [US2] Implement `check_availability` function tool
- [ ] T022 [US2] Implement `create_appointment` function tool
- [ ] T023 [P] [US2] Implement `get_patient_appointments` function tool
- [ ] T024 [US2] Create availability checking logic in `apps/whatsapp-agent-openai/src/scheduler/availability.py`
- [ ] T025 [US2] Create appointment creation logic in `apps/whatsapp-agent-openai/src/scheduler/appointments.py`
- [ ] T026 [US2] Define appointment manager agent prompt for view/cancel/reschedule

**Checkpoint**: End-to-end appointment booking via WhatsApp functional

---

## Phase 5: User Story 3 - Reminder Responses (Priority: P2)

**Goal**: Patients can confirm, cancel, or reschedule via reminder responses.

**Independent Test**: Reply "Confirmo" to reminder → verify appointment status updated.

### Implementation

- [ ] T027 [US3] Implement `confirm_appointment` function tool
- [ ] T028 [P] [US3] Implement `cancel_appointment` function tool
- [ ] T029 [US3] Handle reschedule request (handoff to scheduling agent)
- [ ] T030 [US3] Handle interactive button replies (confirm/cancel buttons from reminders)

**Checkpoint**: Patients can respond to reminders and appointments update

---

## Phase 6: User Story 4 - Context Persistence (Priority: P2)

**Goal**: Conversations maintain context across messages.

**Independent Test**: Start scheduling → send second message → verify agent remembers prior selections.

### Implementation

- [ ] T031 [US4] Implement conversation context storage in Firestore
- [ ] T032 [US4] Load conversation history (last 50 messages) for agent context
- [ ] T033 [US4] Implement message buffering (2-5 second window) in `apps/whatsapp-agent-openai/src/main.py`
- [ ] T034 [US4] Track current agent state across messages

**Checkpoint**: Multi-turn conversations work seamlessly

---

## Phase 7: User Story 5 - Human Takeover (Priority: P3)

**Goal**: Agent can transfer conversations to human staff.

**Independent Test**: Send complaint → verify agent triggers takeover → verify conversation marked in Firestore.

### Implementation

- [ ] T035 [US5] Implement `enable_human_takeover` function tool
- [ ] T036 [US5] Mark conversation as `isHumanTakeover: true` in Firestore
- [ ] T037 [US5] Add support agent prompt for escalation handling
- [ ] T038 [US5] Skip AI processing for taken-over conversations (pass through to dashboard)

**Checkpoint**: Human takeover flow works end-to-end

---

## Phase 8: Polish & Cross-Cutting Concerns

- [ ] T039 [P] Add audio transcription support (Whisper) in `apps/whatsapp-agent-openai/src/utils/transcription.py`
- [ ] T040 [P] Add message deduplication via Firestore `processed_messages` collection
- [ ] T041 [P] Add typing indicator support in messaging utils
- [ ] T042 Implement provider abstraction in `apps/whatsapp-agent-openai/src/providers/`
- [ ] T043 Configure Cloud Run deployment (light + production modes)
- [ ] T044 Run quickstart.md validation

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies
- **Foundational (Phase 2)**: Depends on Phase 1
- **US1 Triage (Phase 3)**: Depends on Phase 2
- **US2 Booking (Phase 4)**: Depends on Phase 3 (needs routing to scheduling agent)
- **US3 Reminders (Phase 5)**: Depends on Phase 4 (needs appointment tools)
- **US4 Context (Phase 6)**: Can start parallel to Phase 4
- **US5 Takeover (Phase 7)**: Can start parallel to Phase 5
- **Polish (Phase 8)**: Depends on all user stories

### Parallel Opportunities

- T002, T003, T004 (Phase 1 setup)
- T008, T009, T012 (Phase 2 parsers, senders, tools)
- T014, T015 (agent prompts)
- T023 (get appointments parallel to create)
- T028 (cancel parallel to confirm)
- Phase 6 can overlap with Phase 4/5
