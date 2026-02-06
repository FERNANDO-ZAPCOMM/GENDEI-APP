# Tasks: Professional Management

**Input**: Design documents from `/specs/002-professional-management/`
**Prerequisites**: plan.md, spec.md, data-model.md

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Data model and API foundation

- [ ] T001 Define Professional TypeScript interface in `apps/frontend/types/professional.ts`
- [ ] T002 [P] Create Zod validation schemas in `apps/frontend/lib/schemas/professional.schema.ts`
- [ ] T003 [P] Create specialty constants with Portuguese labels in `apps/frontend/lib/specialties.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Backend CRUD API — blocks all UI work

- [ ] T004 Create professionals Express router in `apps/functions/src/routes/professionals.ts`
- [ ] T005 Implement GET /professionals endpoint (list all for clinic)
- [ ] T006 [P] Implement GET /professionals/:id endpoint
- [ ] T007 Implement POST /professionals endpoint with validation
- [ ] T008 [P] Implement PATCH /professionals/:id endpoint
- [ ] T009 [P] Implement DELETE /professionals/:id (soft delete, set active: false)
- [ ] T010 Add Firestore security rules for professionals subcollection
- [ ] T011 Create TanStack Query hooks in `apps/frontend/hooks/useProfessionals.ts`

**Checkpoint**: Full CRUD API operational

---

## Phase 3: User Story 1 - Add a Professional (Priority: P1)

**Goal**: Clinic owners can add professionals with photo, specialty, and appointment settings.

**Independent Test**: Fill form → upload photo → submit → verify professional in list.

### Implementation

- [ ] T012 [US1] Create professional form component in `apps/frontend/components/professionals/professional-form.tsx`
- [ ] T013 [P] [US1] Build photo upload component with Firebase Storage in `apps/frontend/components/professionals/photo-upload.tsx`
- [ ] T014 [US1] Implement specialty dropdown with search
- [ ] T015 [US1] Implement appointment duration selector (15-120 min)
- [ ] T016 [US1] Implement consultation price input with BRL formatting
- [ ] T017 [US1] Wire form submission to POST /professionals API
- [ ] T018 [US1] Add "Add Professional" button/page in `apps/frontend/app/[locale]/dashboard/professionals/new/page.tsx`

**Checkpoint**: Professionals can be created with all fields

---

## Phase 4: User Story 2 - Configure Working Hours (Priority: P1)

**Goal**: Clinic owners can set working schedules per professional.

**Independent Test**: Set hours → save → reload → verify schedule persists.

### Implementation

- [ ] T019 [US2] Create working hours editor component in `apps/frontend/components/professionals/working-hours-editor.tsx`
- [ ] T020 [P] [US2] Create day toggle + time range inputs component
- [ ] T021 [US2] Implement break time add/remove within each day
- [ ] T022 [US2] Add time validation (end > start, no overlapping breaks)
- [ ] T023 [US2] Integrate working hours editor into professional form/detail page
- [ ] T024 [US2] Wire working hours save to PATCH /professionals/:id

**Checkpoint**: Working hours configured and saved per professional

---

## Phase 5: User Story 3 - List and Search (Priority: P2)

**Goal**: Clinic owners can view, search, and filter professionals.

**Independent Test**: Navigate to professionals page → verify list → search by name → filter by specialty.

### Implementation

- [ ] T025 [P] [US3] Create professionals list page in `apps/frontend/app/[locale]/dashboard/professionals/page.tsx`
- [ ] T026 [P] [US3] Create professional card component with photo, name, specialty
- [ ] T027 [US3] Implement search-by-name functionality (client-side filter)
- [ ] T028 [US3] Implement filter-by-specialty dropdown
- [ ] T029 [US3] Add empty state when no professionals exist

**Checkpoint**: Professional list with search and filter functional

---

## Phase 6: User Story 4 - Edit and Deactivate (Priority: P2)

**Goal**: Clinic owners can edit professionals and deactivate them.

**Independent Test**: Edit name → save → verify change. Deactivate → verify hidden from active list.

### Implementation

- [ ] T030 [US4] Create professional detail/edit page in `apps/frontend/app/[locale]/dashboard/professionals/[id]/page.tsx`
- [ ] T031 [US4] Implement view/edit mode toggle reusing professional form
- [ ] T032 [US4] Add deactivation button with confirmation dialog
- [ ] T033 [US4] Add active/inactive filter toggle to list view
- [ ] T034 [US4] Show warning when deactivating professional with future appointments

**Checkpoint**: Professionals can be edited and deactivated

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T035 [P] Add loading skeletons to list and form
- [ ] T036 [P] Add i18n translations for all labels and messages
- [ ] T037 Implement optimistic updates for mutations
- [ ] T038 Add Firestore indexes for specialty and active status queries
- [ ] T039 Run quickstart.md validation

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies
- **Foundational (Phase 2)**: Depends on Phase 1
- **US1 Add Professional (Phase 3)**: Depends on Phase 2
- **US2 Working Hours (Phase 4)**: Depends on Phase 3 (needs professional form)
- **US3 List/Search (Phase 5)**: Depends on Phase 3 (needs professionals to exist)
- **US4 Edit/Deactivate (Phase 6)**: Depends on Phase 5 (needs list to navigate from)
- **Polish (Phase 7)**: Depends on all user stories

### Parallel Opportunities

- T002, T003 (Phase 1 schemas and constants)
- T006, T008, T009 (Phase 2 API endpoints)
- T013 (photo upload can be built in parallel)
- T025, T026 (list page and card component)
- Phase 4 and Phase 5 can partially overlap after Phase 3
