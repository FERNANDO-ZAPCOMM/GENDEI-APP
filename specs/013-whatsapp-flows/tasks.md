# Tasks: WhatsApp Flows

**Input**: Design documents from `/specs/013-whatsapp-flows/`
**Prerequisites**: plan.md, spec.md, data-model.md

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Data model, types, and flow token utilities

- [ ] T001 Define Flow, FlowResponse, and FlowAnalytics TypeScript interfaces in `apps/frontend/types/flow.ts`
- [ ] T002 [P] Create Zod validation schemas for flow triggers, data exchange, and completion payloads
- [ ] T003 [P] Create flow token encryption/decryption utility (AES-256-GCM with clinicId, patientId, sessionId)
- [ ] T004 [P] Create flow type enum and configuration defaults per type

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Flow API endpoints, data exchange handler, and Firestore setup — blocks all flow types

- [ ] T005 Create flows Express router in `apps/functions/src/routes/flows.ts`
- [ ] T006 Implement POST /flows/data endpoint (WhatsApp Flows data exchange — handles ping, INIT, and data_exchange actions)
- [ ] T007 Implement POST /flows/complete endpoint (flow completion webhook — decrypt token, process response, create entities)
- [ ] T008 [P] Implement GET /flows endpoint (list clinic flows)
- [ ] T009 [P] Implement POST /flows/trigger endpoint (send flow message to patient via WhatsApp API)
- [ ] T010 [P] Add Firestore indexes: (clinicId, status, startedAt), (clinicId, patientPhone, startedAt), (status, lastInteractionAt)
- [ ] T011 Create TanStack Query hooks in `apps/frontend/hooks/useFlows.ts`

**Checkpoint**: Flow data exchange and completion pipeline operational

---

## Phase 3: User Story 1 - Booking Flow (Priority: P1)

**Goal**: Patients can book appointments through structured WhatsApp Flows.

**Independent Test**: Trigger flow → select service → professional → date → time → confirm → verify appointment created.

### Implementation

- [ ] T012 [US1] Create booking flow JSON definition (screens: service, professional, date, time, confirm)
- [ ] T013 [US1] Implement booking data exchange handler (return services, professionals, dates, time slots per screen)
- [ ] T014 [P] [US1] Implement real-time availability check for date and time screens
- [ ] T015 [US1] Implement booking completion handler (create appointment from flow response)
- [ ] T016 [US1] Add double-booking prevention (validate slot availability on completion)
- [ ] T017 [US1] Send confirmation message after successful booking

**Checkpoint**: Booking flow works end-to-end

---

## Phase 4: User Story 2 - Patient Registration Flow (Priority: P1)

**Goal**: New patients can register through a WhatsApp Flow.

**Independent Test**: Trigger registration → fill fields → submit → verify patient created.

### Implementation

- [ ] T018 [US2] Create registration flow JSON definition (screens: name/phone, birthday/CPF, address)
- [ ] T019 [US2] Implement registration data exchange handler (validate fields, check duplicates)
- [ ] T020 [US2] Implement registration completion handler (create patient document)
- [ ] T021 [P] [US2] Implement prefilling with known patient data (from phone number lookup)

**Checkpoint**: Registration flow works end-to-end

---

## Phase 5: User Story 3 - Satisfaction Survey Flow (Priority: P2)

**Goal**: Patients receive post-appointment satisfaction surveys.

**Independent Test**: Complete appointment → survey sent → submit rating → verify analytics updated.

### Implementation

- [ ] T022 [US3] Create satisfaction flow JSON definition (screens: rating, feedback, NPS, thank you)
- [ ] T023 [US3] Implement survey trigger logic (send after configurable delay post-appointment)
- [ ] T024 [US3] Implement survey completion handler (store response, update analytics)
- [ ] T025 [P] [US3] Implement conditional follow-up screen for low ratings (1-2 stars)

**Checkpoint**: Satisfaction surveys work end-to-end

---

## Phase 6: User Story 4 - Reschedule/Cancellation Flow (Priority: P2)

**Goal**: Patients can reschedule or cancel appointments through flows.

**Independent Test**: Trigger reschedule → see current appointment → select new time → confirm → verify update.

### Implementation

- [ ] T026 [US4] Create reschedule flow JSON definition (screens: current appointment, new date, new time, confirm)
- [ ] T027 [US4] Implement reschedule data exchange handler (show current details, available new slots)
- [ ] T028 [US4] Implement reschedule completion handler (update appointment, notify clinic)
- [ ] T029 [P] [US4] Implement cancellation option within reschedule flow

**Checkpoint**: Reschedule/cancellation flow functional

---

## Phase 7: User Story 5 - Pre-Appointment Intake Flow (Priority: P3)

**Goal**: Patients complete medical intake forms before appointments.

**Independent Test**: Send intake flow → fill symptoms → submit → verify data on appointment.

### Implementation

- [ ] T030 [US5] Create intake flow JSON definition (screens: symptoms, medications, allergies)
- [ ] T031 [US5] Implement intake completion handler (store data on appointment document)
- [ ] T032 [US5] Implement intake trigger logic (send X hours before appointment)

**Checkpoint**: Intake flow works end-to-end

---

## Phase 8: Analytics & Polish

**Purpose**: Flow analytics and management UI

- [ ] T033 Implement GET /flows/analytics endpoint (completion rates, drop-off by screen, satisfaction scores)
- [ ] T034 [P] Build flow analytics dashboard in `apps/frontend/app/[locale]/dashboard/flows/page.tsx`
- [ ] T035 [P] Build flow list with status and completion rate display
- [ ] T036 Implement abandoned flow timeout handler (Cloud Function, 30-minute timeout)
- [ ] T037 [P] Add i18n translations for flow labels
- [ ] T038 Run quickstart.md validation

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies
- **Foundational (Phase 2)**: Depends on Phase 1
- **US1 Booking (Phase 3)**: Depends on Phase 2
- **US2 Registration (Phase 4)**: Depends on Phase 2
- **US3 Satisfaction (Phase 5)**: Depends on Phase 2
- **US4 Reschedule (Phase 6)**: Depends on Phase 2
- **US5 Intake (Phase 7)**: Depends on Phase 2
- **Analytics (Phase 8)**: Depends on all

### Parallel Opportunities

- T002, T003, T004 (schemas and utilities)
- T008, T009, T010 (API endpoints and indexes)
- T014 (availability check parallel to data exchange)
- T021 (prefilling parallel to registration handler)
- T025 (conditional screen parallel to completion handler)
- T029 (cancellation parallel to reschedule)
- Phase 3, Phase 4, Phase 5, and Phase 6 can all overlap after Phase 2
