# Tasks: Service Management

**Input**: Design documents from `/specs/003-service-management/`
**Prerequisites**: plan.md, spec.md, data-model.md

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Data model and schemas

- [ ] T001 Define Service TypeScript interface in `apps/frontend/types/service.ts`
- [ ] T002 [P] Create Zod validation schemas (create/update) in `apps/frontend/lib/schemas/service.schema.ts`
- [ ] T003 [P] Create price/duration/deposit utility functions in `apps/frontend/lib/utils/service-utils.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Backend CRUD API — blocks all UI work

- [ ] T004 Create services Express router in `apps/functions/src/routes/services.ts`
- [ ] T005 Implement GET /services endpoint (list all active for clinic)
- [ ] T006 [P] Implement GET /services/:id endpoint
- [ ] T007 Implement POST /services endpoint with professional validation
- [ ] T008 [P] Implement PUT /services/:id endpoint
- [ ] T009 [P] Implement DELETE /services/:id (soft delete, set active: false)
- [ ] T010 Add Firestore security rules for services subcollection
- [ ] T011 Create TanStack Query hooks in `apps/frontend/hooks/useServices.ts`

**Checkpoint**: Full CRUD API operational

---

## Phase 3: User Story 1 - Create a Service (Priority: P1)

**Goal**: Clinic owners can define services with price, duration, deposit, and assigned professionals.

**Independent Test**: Fill form → select professionals → submit → verify service in list.

### Implementation

- [ ] T012 [US1] Create service form component in `apps/frontend/components/services/service-form.tsx`
- [ ] T013 [P] [US1] Build price input with BRL formatting (R$ XX,XX ↔ cents)
- [ ] T014 [P] [US1] Build duration selector (15-min increments dropdown)
- [ ] T015 [US1] Build deposit percentage slider (10-100%)
- [ ] T016 [US1] Build professional multi-select component in `apps/frontend/components/services/professional-multi-select.tsx`
- [ ] T017 [US1] Wire form submission to POST /services API
- [ ] T018 [US1] Add "Add Service" page in `apps/frontend/app/[locale]/dashboard/services/new/page.tsx`

**Checkpoint**: Services can be created with all fields

---

## Phase 4: User Story 2 - List and Search Services (Priority: P2)

**Goal**: Clinic owners can view, search, and filter services.

**Independent Test**: Navigate to services page → verify list → search → filter by professional.

### Implementation

- [ ] T019 [P] [US2] Create services list page in `apps/frontend/app/[locale]/dashboard/services/page.tsx`
- [ ] T020 [P] [US2] Create service card component with name, price, duration, professionals
- [ ] T021 [US2] Implement search-by-name functionality
- [ ] T022 [US2] Implement filter-by-professional dropdown
- [ ] T023 [US2] Add empty state when no services exist
- [ ] T024 [US2] Resolve professional names/photos for service cards (enriched display)

**Checkpoint**: Service list with search and filter functional

---

## Phase 5: User Story 3 - Edit and Deactivate Service (Priority: P2)

**Goal**: Clinic owners can edit and deactivate services.

**Independent Test**: Edit price → save → verify change. Deactivate → verify hidden from active list.

### Implementation

- [ ] T025 [US3] Create service detail/edit page in `apps/frontend/app/[locale]/dashboard/services/[id]/page.tsx`
- [ ] T026 [US3] Implement view/edit mode toggle reusing service form
- [ ] T027 [US3] Add deactivation button with confirmation dialog
- [ ] T028 [US3] Show warning when deactivating service with future appointments
- [ ] T029 [US3] Add active/inactive filter toggle to list view

**Checkpoint**: Services can be edited and deactivated

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T030 [P] Add loading skeletons to list and form
- [ ] T031 [P] Add i18n translations for all labels and messages
- [ ] T032 Implement optimistic updates for mutations
- [ ] T033 Add Firestore indexes for active status and professional queries
- [ ] T034 Run quickstart.md validation

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies
- **Foundational (Phase 2)**: Depends on Phase 1
- **US1 Create Service (Phase 3)**: Depends on Phase 2 + professionals must exist (002 dependency)
- **US2 List/Search (Phase 4)**: Depends on Phase 3 (needs services to list)
- **US3 Edit/Deactivate (Phase 5)**: Depends on Phase 4 (needs list to navigate from)
- **Polish (Phase 6)**: Depends on all user stories

### Parallel Opportunities

- T002, T003 (Phase 1 schemas and utils)
- T006, T008, T009 (Phase 2 API endpoints)
- T013, T014 (price input and duration selector)
- T019, T020 (list page and card component)
