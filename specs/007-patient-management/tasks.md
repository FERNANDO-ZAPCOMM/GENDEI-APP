# Tasks: Patient Management

**Input**: Design documents from `/specs/007-patient-management/`
**Prerequisites**: plan.md, spec.md, data-model.md

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Data model and validation

- [ ] T001 Define Patient TypeScript interface in `apps/frontend/types/patient.ts`
- [ ] T002 [P] Create Zod validation schemas (create, update) in `apps/frontend/lib/schemas/patient.schema.ts`
- [ ] T003 [P] Create CPF formatting/validation utility

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Backend CRUD API with search — blocks all UI

- [ ] T004 Create patients Express router in `apps/functions/src/routes/patients.ts`
- [ ] T005 Implement GET /patients endpoint with search and clinicId filtering
- [ ] T006 [P] Implement GET /patients/:id endpoint
- [ ] T007 Implement POST /patients endpoint (includes clinicId in clinicIds array)
- [ ] T008 [P] Implement PATCH /patients/:id endpoint
- [ ] T009 [P] Implement DELETE /patients/:id (soft delete)
- [ ] T010 Implement phone prefix search using Firestore range queries
- [ ] T011 [P] Implement name prefix search using `nameLower` field
- [ ] T012 Add Firestore security rules and composite indexes
- [ ] T013 Create TanStack Query hooks in `apps/frontend/hooks/usePatients.ts`

**Checkpoint**: Patient CRUD + search API operational

---

## Phase 3: User Story 1 - Create and List Patients (Priority: P1)

**Goal**: Staff can create patients and view them in a list.

**Independent Test**: Create patient → verify in list → verify Firestore document.

### Implementation

- [ ] T014 [US1] Create patient form component in `apps/frontend/components/patients/patient-form.tsx`
- [ ] T015 [P] [US1] Build phone input with Brazilian format mask
- [ ] T016 [P] [US1] Build CPF input with format mask (###.###.###-##)
- [ ] T017 [US1] Create patients list page in `apps/frontend/app/[locale]/dashboard/patients/page.tsx`
- [ ] T018 [US1] Create patient card/row component for list display
- [ ] T019 [US1] Wire form submission to POST /patients API

**Checkpoint**: Patients can be created and listed

---

## Phase 4: User Story 2 - Search Patients (Priority: P1)

**Goal**: Staff can search by name, phone, or filter by tags.

**Independent Test**: Search by phone prefix → verify results in < 200ms.

### Implementation

- [ ] T020 [US2] Implement search input with debounced query
- [ ] T021 [US2] Wire search to GET /patients with query parameter
- [ ] T022 [US2] Implement tag filter dropdown (array-contains query)
- [ ] T023 [US2] Add empty state and no-results state

**Checkpoint**: Search and filter functional

---

## Phase 5: User Story 3 - Patient Detail (Priority: P2)

**Goal**: Staff can view patient profile, appointment history, notes, and tags.

**Independent Test**: Open patient detail → verify profile, history, notes, tags all display correctly.

### Implementation

- [ ] T024 [US3] Create patient detail page in `apps/frontend/app/[locale]/dashboard/patients/[id]/page.tsx`
- [ ] T025 [US3] Display appointment history (last 20 appointments)
- [ ] T026 [P] [US3] Build notes editor with save functionality
- [ ] T027 [P] [US3] Build tag management component (add/remove tags)
- [ ] T028 [US3] Display appointment statistics (total, completed, cancelled, no-show)

**Checkpoint**: Patient detail page fully functional

---

## Phase 6: User Story 4 - Edit and Delete (Priority: P2)

**Goal**: Staff can edit patient details and soft-delete records.

### Implementation

- [ ] T029 [US4] Implement edit mode on patient detail page (reuse patient form)
- [ ] T030 [US4] Add delete button with confirmation dialog
- [ ] T031 [US4] Wire edit to PATCH /patients/:id and delete to DELETE /patients/:id

**Checkpoint**: Patients can be edited and deleted

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T032 [P] Add loading skeletons to list and detail
- [ ] T033 [P] Add i18n translations
- [ ] T034 Implement optimistic updates for mutations
- [ ] T035 Run quickstart.md validation

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies
- **Foundational (Phase 2)**: Depends on Phase 1
- **US1 Create/List (Phase 3)**: Depends on Phase 2
- **US2 Search (Phase 4)**: Depends on Phase 3
- **US3 Detail (Phase 5)**: Depends on Phase 3
- **US4 Edit/Delete (Phase 6)**: Depends on Phase 5
- **Polish (Phase 7)**: Depends on all

### Parallel Opportunities

- T002, T003 (schemas and utils)
- T006, T008, T009, T011 (API endpoints)
- T015, T016 (input components)
- T026, T027 (notes and tags components)
- Phase 4 and Phase 5 can overlap after Phase 3
