# Tasks: Reminder System

**Input**: Design documents from `/specs/010-reminder-system/`
**Prerequisites**: plan.md, spec.md, data-model.md
**Updated**: 2026-02-15

## Phase 1: Setup (Vertical Config)

**Purpose**: Vertical-aware terminology for reminder messages

- [x] T001 Create `getVerticalTerms()` utility in `apps/functions/src/services/verticals.ts`
- [x] T002 Define `VerticalTerms` interface (appointmentTerm, professionalEmoji, showArriveEarlyTip)
- [x] T003 Configure terms for 5 verticals (med, dental, psi, nutri, fisio) + defaults

---

## Phase 2: Core Reminder Service (Priority: P1)

**Purpose**: Automated 24h and 2h reminder sending

- [x] T004 Implement `sendScheduledReminders()` in `apps/functions/src/services/reminders.ts`
- [x] T005 Implement time-window queries for 24h (23-25h) and 2h (1.5-2.5h) windows
- [x] T006 Implement `getAppointmentsInWindow()` with date range + status + flag filtering
- [x] T007 Implement `sendReminder()` with clinic/token lookup and WhatsApp Agent delivery
- [x] T008 Implement `formatReminderMessage()` with vertical-aware terminology
- [x] T009 Set `reminder24hSent`/`reminder2hSent` flags and timestamps after sending
- [x] T010 Transition appointment status to `awaiting_confirmation` after 24h reminder
- [x] T011 Implement `sendSingleReminder()` for manual/testing use

**Checkpoint**: 24h and 2h reminders send automatically for confirmed appointments

---

## Phase 3: API Routes (Priority: P1)

**Purpose**: HTTP endpoints for scheduler and manual triggers

- [x] T012 Create reminders Express router in `apps/functions/src/routes/reminders.ts`
- [x] T013 Implement `POST /reminders/trigger` (Cloud Scheduler entry point)
- [x] T014 Implement `POST /reminders/send/:appointmentId` (manual single reminder)
- [x] T015 Add Cloud Scheduler job (every 15 minutes) to trigger `POST /reminders/trigger`

**Checkpoint**: Cloud Scheduler automatically triggers reminders every 15 minutes

---

## Phase 4: Polish

**Purpose**: Error handling and logging

- [x] T016 Add error counting and result summary (`ReminderResult`)
- [x] T017 Add console logging for debugging (appointment counts, send results)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies
- **Core Service (Phase 2)**: Depends on Phase 1 (vertical terms)
- **API Routes (Phase 3)**: Depends on Phase 2
- **Polish (Phase 4)**: Depends on Phase 2

### Parallel Opportunities

- T001-T003 (vertical config) are independent of reminder logic
- T012-T014 (routes) can start once T004 is implemented
