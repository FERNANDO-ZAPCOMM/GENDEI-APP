# Tasks: Calendar System

**Input**: Design documents from `/specs/015-calendar-system/`
**Prerequisites**: plan.md, spec.md, data-model.md

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Data model, types, view state, and calendar utilities

- [ ] T001 Define CalendarEvent, CalendarViewState, TimeBlock, and CalendarConfiguration TypeScript interfaces in `apps/frontend/types/calendar.ts`
- [ ] T002 [P] Create Zod validation schemas for quick appointment, reschedule, and calendar queries
- [ ] T003 [P] Create calendar date utility (date-fns based: week ranges, month grids, slot generation, navigation)
- [ ] T004 [P] Create Zustand calendar store (view state, filters, drag state, create slot state)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Calendar API endpoints and real-time data — blocks all calendar UI

- [ ] T005 Create calendar Express router in `apps/functions/src/routes/calendar.ts`
- [ ] T006 Implement GET /calendar/events endpoint (return appointments as CalendarEvents for date range + filters)
- [ ] T007 [P] Implement POST /calendar/quick-appointment endpoint (create appointment with minimal input)
- [ ] T008 [P] Implement PATCH /calendar/reschedule endpoint (update appointment time/professional with conflict check)
- [ ] T009 Implement GET /calendar/availability endpoint (return available slots for professional + date range)
- [ ] T010 [P] Set up Firestore onSnapshot listener for real-time calendar updates in `apps/frontend/hooks/useCalendarEvents.ts`
- [ ] T011 Create TanStack Query hooks in `apps/frontend/hooks/useCalendar.ts`

**Checkpoint**: Calendar API returns events and availability; real-time listener operational

---

## Phase 3: User Story 1 - Multi-View Calendar (Priority: P1)

**Goal**: Staff can view appointments in Day, Week, Month, and Agenda views.

**Independent Test**: Open calendar → switch views → navigate dates → verify appointments render correctly.

### Implementation

- [ ] T012 [US1] Create calendar page in `apps/frontend/app/[locale]/dashboard/calendar/page.tsx`
- [ ] T013 [US1] Build calendar header (view selector, date navigator, today button)
- [ ] T014 [US1] Build Day view component (hourly time grid, appointments positioned by time/duration)
- [ ] T015 [P] [US1] Build Week view component (7 columns, hourly rows, professional color coding)
- [ ] T016 [P] [US1] Build Month view component (month grid, appointment count badges per day)
- [ ] T017 [US1] Build Agenda view component (chronological list, mobile-friendly)
- [ ] T018 [US1] Implement professional color coding (assign colors, render colored appointment blocks)
- [ ] T019 [US1] Wire view switching and date navigation to Zustand store

**Checkpoint**: All four calendar views render appointments correctly

---

## Phase 4: User Story 2 - Quick Appointment Creation (Priority: P1)

**Goal**: Staff can click empty slots to create appointments quickly.

**Independent Test**: Click empty slot → form opens with pre-filled data → save → appointment appears.

### Implementation

- [ ] T020 [US2] Implement click-to-create interaction on Day and Week views (capture professional, date, time)
- [ ] T021 [US2] Build quick appointment form modal (pre-filled professional/date/time, patient search, service selector)
- [ ] T022 [US2] Implement auto-duration calculation based on selected service
- [ ] T023 [P] [US2] Implement patient search/select component within the form
- [ ] T024 [US2] Wire form submission to POST /calendar/quick-appointment with optimistic update

**Checkpoint**: Quick appointment creation from calendar functional

---

## Phase 5: User Story 3 - Drag-and-Drop Rescheduling (Priority: P1)

**Goal**: Staff can drag appointments to reschedule them.

**Independent Test**: Drag appointment → new time → verify update → drag to different professional → verify change.

### Implementation

- [ ] T025 [US3] Integrate @dnd-kit/core for calendar drag-and-drop
- [ ] T026 [US3] Implement drag source on appointment blocks (start drag, show ghost)
- [ ] T027 [US3] Implement drop targets on time slots (highlight valid targets)
- [ ] T028 [P] [US3] Implement conflict detection on drop (check availability before committing)
- [ ] T029 [US3] Wire drop action to PATCH /calendar/reschedule with optimistic update
- [ ] T030 [US3] Build conflict warning dialog (show conflict details, option to revert or force)

**Checkpoint**: Drag-and-drop rescheduling with conflict detection

---

## Phase 6: User Story 4 - Professional Filtering and Working Hours (Priority: P2)

**Goal**: Staff can filter by professional and see working hours overlay.

**Independent Test**: Select professional → verify filter → verify working hours overlay.

### Implementation

- [ ] T031 [US4] Build professional filter panel (multi-select with color indicators)
- [ ] T032 [US4] Build service filter dropdown
- [ ] T033 [P] [US4] Build working hours overlay (gray out non-working hours per professional)
- [ ] T034 [US4] Build "Show cancelled" toggle
- [ ] T035 [US4] Wire all filters to Zustand store and re-fetch/filter events

**Checkpoint**: Filtering and working hours visualization functional

---

## Phase 7: User Story 5 - Appointment Detail Modal (Priority: P2)

**Goal**: Staff can click appointments to view details and manage status.

**Independent Test**: Click appointment → view details → change status → add note → verify updates.

### Implementation

- [ ] T036 [US5] Build appointment detail modal (patient info, service, professional, status, deposit, notes, source)
- [ ] T037 [US5] Build status management buttons (confirm, complete, cancel, mark no-show)
- [ ] T038 [P] [US5] Build notes editor within detail modal
- [ ] T039 [US5] Build deposit status display and manual toggle
- [ ] T040 [US5] Wire status changes and notes to PATCH /appointments/:id API

**Checkpoint**: Appointment detail modal with status management

---

## Phase 8: Polish & Cross-Cutting Concerns

- [ ] T041 [P] Add loading skeleton for calendar grid
- [ ] T042 [P] Add i18n translations for calendar labels
- [ ] T043 Build calendar configuration settings (default view, slot duration, week start, show weekends)
- [ ] T044 [P] Add responsive layout (Agenda as default on mobile, disable drag-and-drop on touch)
- [ ] T045 Implement Firestore listener cleanup on component unmount
- [ ] T046 Run quickstart.md validation

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies
- **Foundational (Phase 2)**: Depends on Phase 1
- **US1 Multi-View (Phase 3)**: Depends on Phase 2
- **US2 Quick Create (Phase 4)**: Depends on Phase 3
- **US3 Drag-and-Drop (Phase 5)**: Depends on Phase 3
- **US4 Filtering (Phase 6)**: Depends on Phase 3
- **US5 Detail Modal (Phase 7)**: Depends on Phase 3
- **Polish (Phase 8)**: Depends on all

### Parallel Opportunities

- T002, T003, T004 (schemas, utilities, store)
- T007, T008, T010 (API endpoints and listener)
- T015, T016 (Week and Month views parallel)
- T023 (patient search parallel to form)
- T028 (conflict detection parallel to drop targets)
- T033 (working hours overlay parallel to filter panel)
- T038 (notes editor parallel to detail modal)
- Phase 4, Phase 5, Phase 6, and Phase 7 can all overlap after Phase 3
