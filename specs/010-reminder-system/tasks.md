# Tasks: Reminder System

**Input**: Design documents from `/specs/010-reminder-system/`
**Prerequisites**: plan.md, spec.md, data-model.md

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Data model, types, and scheduling utilities

- [ ] T001 Define Reminder, ReminderTemplate, and ReminderSettings TypeScript interfaces in `apps/frontend/types/reminder.ts`
- [ ] T002 [P] Create Zod validation schemas for reminder creation, settings updates, and template editing
- [ ] T003 [P] Create reminder scheduling utility (calculate scheduledFor from appointment time and offset)
- [ ] T004 [P] Create quiet hours utility (check if time falls in quiet window, calculate next available send time)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Backend scheduler, reminder CRUD, and delivery pipeline — blocks all UI

- [ ] T005 Create reminders Express router in `apps/functions/src/routes/reminders.ts`
- [ ] T006 Implement Cloud Scheduler trigger (every 5 minutes) to process pending reminders
- [ ] T007 Implement reminder processing pipeline (query pending → validate appointment → send WhatsApp → update status)
- [ ] T008 [P] Implement retry logic with exponential backoff (max 3 attempts)
- [ ] T009 Implement GET /reminders endpoint (list by clinic, sorted by scheduledFor)
- [ ] T010 [P] Implement POST /reminders endpoint (create manual reminder)
- [ ] T011 [P] Implement DELETE /reminders/:id endpoint (cancel reminder)
- [ ] T012 Implement PUT /clinics/:id/settings/reminderSettings endpoint
- [ ] T013 [P] Add Firestore indexes: (status, scheduledFor), (clinicId, scheduledFor), (appointmentId, type)
- [ ] T014 Create TanStack Query hooks in `apps/frontend/hooks/useReminders.ts`

**Checkpoint**: Reminder scheduler processes and sends reminders via WhatsApp

---

## Phase 3: User Story 1 - Automated Appointment Reminders (Priority: P1)

**Goal**: System sends 24h and 2h reminders automatically before appointments.

**Independent Test**: Create appointment → verify reminders scheduled → trigger scheduler → verify WhatsApp message sent.

### Implementation

- [ ] T015 [US1] Create reminder generation on appointment creation (schedule 24h and 2h reminders)
- [ ] T016 [US1] Implement reminder cancellation on appointment cancellation/reschedule
- [ ] T017 [P] [US1] Implement quiet hours deferral logic in processing pipeline
- [ ] T018 [US1] Implement duplicate prevention (check existing reminders by appointmentId + type)
- [ ] T019 [US1] Wire delivery status updates from WhatsApp webhooks to reminder documents

**Checkpoint**: Automated 24h and 2h reminders send correctly

---

## Phase 4: User Story 2 - Confirmation Requests (Priority: P1)

**Goal**: System sends confirmation requests immediately after appointment creation.

**Independent Test**: Create appointment → verify confirmation sent immediately → patient responds → verify status update.

### Implementation

- [ ] T020 [US2] Implement immediate confirmation send on appointment creation (when enabled)
- [ ] T021 [US2] Handle confirmation responses from patients (update appointment status)
- [ ] T022 [US2] Add confirmation reminder type to scheduling pipeline

**Checkpoint**: Confirmation requests work end-to-end

---

## Phase 5: User Story 3 - No-Show Follow-ups (Priority: P2)

**Goal**: System sends re-engagement messages after missed appointments.

**Independent Test**: Mark appointment as no-show → verify follow-up scheduled → verify message sent after delay.

### Implementation

- [ ] T023 [US3] Schedule no-show follow-up when appointment marked as `no_show`
- [ ] T024 [US3] Implement configurable delay (default 24h after no-show)
- [ ] T025 [P] [US3] Route patient responses from follow-up to scheduling agent

**Checkpoint**: No-show follow-ups send and route responses correctly

---

## Phase 6: User Story 4 - Birthday and Follow-up Reminders (Priority: P3)

**Goal**: System sends birthday messages and post-visit follow-ups.

**Independent Test**: Set patient birthday → verify message sent at configured time.

### Implementation

- [ ] T026 [US4] Implement daily birthday scan (query patients with birthday matching today)
- [ ] T027 [US4] Schedule birthday reminders at configured send time
- [ ] T028 [P] [US4] Implement post-visit follow-up scheduling (X days after completed appointment)

**Checkpoint**: Birthday and follow-up reminders functional

---

## Phase 7: User Story 5 - Settings and Templates (Priority: P2)

**Goal**: Clinic owners can configure reminders and customize templates.

**Independent Test**: Open settings → toggle reminders → edit template → save → verify template used.

### Implementation

- [ ] T029 [US5] Create reminder settings page in `apps/frontend/app/[locale]/dashboard/settings/reminders/page.tsx`
- [ ] T030 [US5] Build reminder type toggles (24h, 2h, confirmation, no-show, birthday, follow-up)
- [ ] T031 [US5] Build template editor with variable substitution preview
- [ ] T032 [P] [US5] Implement template CRUD endpoints (GET/POST/PATCH/DELETE)
- [ ] T033 [US5] Build quiet hours configuration (start/end time pickers)
- [ ] T034 [US5] Wire settings form to PUT /clinics/:id/settings/reminderSettings API

**Checkpoint**: Reminder settings and templates fully configurable

---

## Phase 8: Analytics & Polish

**Purpose**: Delivery analytics and cross-cutting concerns

- [ ] T035 Implement GET /reminders/analytics endpoint (monthly stats by type)
- [ ] T036 [P] Build reminder analytics view (delivery rate, engagement metrics)
- [ ] T037 [P] Add i18n translations for reminder labels and templates
- [ ] T038 [P] Add loading states and skeletons
- [ ] T039 Run quickstart.md validation

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies
- **Foundational (Phase 2)**: Depends on Phase 1
- **US1 Auto Reminders (Phase 3)**: Depends on Phase 2
- **US2 Confirmations (Phase 4)**: Depends on Phase 2
- **US3 No-Show (Phase 5)**: Depends on Phase 3
- **US4 Birthday/Follow-up (Phase 6)**: Depends on Phase 2
- **US5 Settings (Phase 7)**: Depends on Phase 2
- **Analytics (Phase 8)**: Depends on all

### Parallel Opportunities

- T002, T003, T004 (schemas and utilities)
- T008, T010, T011, T013 (API endpoints and indexes)
- T017 (quiet hours parallel to reminder generation)
- T025 (response routing parallel to scheduling)
- T028 (follow-up parallel to birthday)
- T032 (template CRUD parallel to settings UI)
- Phase 4, Phase 6, and Phase 7 can overlap after Phase 2
