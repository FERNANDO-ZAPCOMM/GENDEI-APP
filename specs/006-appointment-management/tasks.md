# Tasks: Appointment Management

**Input**: Design documents from `/specs/006-appointment-management/`
**Prerequisites**: plan.md, spec.md, data-model.md

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Data model and status workflow definition

- [ ] T001 Define Appointment TypeScript interface with all fields in `apps/frontend/types/appointment.ts`
- [ ] T002 [P] Define TimeBlock TypeScript interface in `apps/frontend/types/time-block.ts`
- [ ] T003 [P] Create Zod validation schemas (create, update, reschedule, status) in `apps/frontend/lib/schemas/appointment.schema.ts`
- [ ] T004 [P] Define status transition rules and validation function in `apps/frontend/lib/appointment-status.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Backend CRUD API and status engine — blocks all UI work

- [ ] T005 Create appointments Express router in `apps/functions/src/routes/appointments.ts`
- [ ] T006 Implement GET /appointments endpoint with date range and professional filters
- [ ] T007 [P] Implement GET /appointments/today endpoint
- [ ] T008 [P] Implement GET /appointments/:id endpoint
- [ ] T009 Implement POST /appointments endpoint with availability validation
- [ ] T010 Implement PUT /appointments/:id endpoint
- [ ] T011 Implement PUT /appointments/:id/status endpoint with transition validation
- [ ] T012 [P] Implement PUT /appointments/:id/reschedule endpoint
- [ ] T013 [P] Implement DELETE /appointments/:id (cancel with reason)
- [ ] T014 Add Firestore security rules and composite indexes
- [ ] T015 Create TanStack Query hooks in `apps/frontend/hooks/useAppointments.ts`

**Checkpoint**: Full appointment CRUD + status API operational

---

## Phase 3: User Story 1 - Create Appointment (Priority: P1)

**Goal**: Staff can create appointments from the dashboard with patient, professional, service, date/time.

**Independent Test**: Fill form → submit → verify appointment on calendar.

### Implementation

- [ ] T016 [US1] Create appointment form component in `apps/frontend/components/appointments/appointment-form.tsx`
- [ ] T017 [P] [US1] Build patient selector with search and quick-create
- [ ] T018 [P] [US1] Build professional selector dropdown
- [ ] T019 [US1] Build service selector with auto-duration and price
- [ ] T020 [US1] Build date picker and time slot selector with availability checking
- [ ] T021 [US1] Calculate and display deposit amount based on service price
- [ ] T022 [US1] Wire form to POST /appointments API

**Checkpoint**: Appointments can be created from the dashboard

---

## Phase 4: User Story 2 - Calendar View (Priority: P1)

**Goal**: Staff can view the 7-day calendar with color-coded appointment cards.

**Independent Test**: Navigate to agenda → verify appointments displayed → filter by professional → click card to view detail.

### Implementation

- [ ] T023 [US2] Create 7-day calendar grid component in `apps/frontend/components/calendar/calendar-grid.tsx`
- [ ] T024 [P] [US2] Create appointment card component with status color coding
- [ ] T025 [US2] Implement professional filter dropdown on calendar
- [ ] T026 [US2] Implement date navigation (previous/next week)
- [ ] T027 [US2] Create appointment detail panel/modal
- [ ] T028 [US2] Create agenda page in `apps/frontend/app/[locale]/dashboard/agenda/page.tsx`

**Checkpoint**: Calendar displays appointments correctly with filtering

---

## Phase 5: User Story 3 - Status Management (Priority: P1)

**Goal**: Staff can transition appointments through the 7-state workflow.

**Independent Test**: Change status pending → confirmed → confirmed_presence → completed. Try invalid transition → verify blocked.

### Implementation

- [ ] T029 [US3] Build status update buttons component (context-aware based on current status)
- [ ] T030 [US3] Implement status transition validation (client-side + server-side)
- [ ] T031 [US3] Add cancel confirmation dialog with reason input
- [ ] T032 [US3] Display status history timeline on appointment detail
- [ ] T033 [US3] Add no-show marking with reason

**Checkpoint**: Status workflow operates correctly with full validation

---

## Phase 6: User Story 4 - Time Blocking (Priority: P2)

**Goal**: Staff can block time slots to prevent bookings.

**Independent Test**: Create time block → verify it appears on calendar → try to book during that time → verify blocked.

### Implementation

- [ ] T034 [US4] Create time block API endpoints in `apps/functions/src/routes/appointments.ts` (or separate router)
- [ ] T035 [P] [US4] Create time block form component
- [ ] T036 [US4] Display time blocks on calendar with distinct visual style
- [ ] T037 [US4] Integrate time block validation into appointment creation
- [ ] T038 [US4] Add delete time block functionality

**Checkpoint**: Time blocks prevent overlapping appointments

---

## Phase 7: User Story 5 - Reschedule (Priority: P2)

**Goal**: Staff can reschedule appointments to a new date/time.

**Independent Test**: Reschedule appointment → verify old slot freed → new slot occupied → status history updated.

### Implementation

- [ ] T039 [US5] Build reschedule UI (date/time picker with availability check)
- [ ] T040 [US5] Wire reschedule to PUT /appointments/:id/reschedule API
- [ ] T041 [US5] Update status history with reschedule record

**Checkpoint**: Rescheduling works with proper validation

---

## Phase 8: Polish & Cross-Cutting Concerns

- [ ] T042 [P] Add loading skeletons to calendar and forms
- [ ] T043 [P] Add i18n translations for all appointment-related UI
- [ ] T044 Implement optimistic updates for status changes
- [ ] T045 [P] Add Firestore composite indexes for efficient queries
- [ ] T046 Run quickstart.md validation

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies
- **Foundational (Phase 2)**: Depends on Phase 1
- **US1 Create (Phase 3)**: Depends on Phase 2 + requires professionals (002) and services (003)
- **US2 Calendar (Phase 4)**: Depends on Phase 3 (needs appointments to display)
- **US3 Status (Phase 5)**: Depends on Phase 4 (needs calendar to see appointments)
- **US4 Time Blocks (Phase 6)**: Can start parallel to Phase 5
- **US5 Reschedule (Phase 7)**: Can start parallel to Phase 6
- **Polish (Phase 8)**: Depends on all user stories

### Parallel Opportunities

- T002, T003, T004 (Phase 1 types and schemas)
- T007, T008, T012, T013 (Phase 2 API endpoints)
- T017, T018 (patient and professional selectors)
- T024 (card component parallel to grid)
- T035 (time block form parallel to API)
- Phase 6 and Phase 7 can overlap
