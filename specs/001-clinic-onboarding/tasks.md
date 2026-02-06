# Tasks: Clinic Onboarding

**Input**: Design documents from `/specs/001-clinic-onboarding/`
**Prerequisites**: plan.md, spec.md, data-model.md, research.md

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Firebase project and authentication configuration

- [ ] T001 Configure Firebase project with Authentication and Firestore enabled
- [ ] T002 [P] Install frontend dependencies (firebase, next-intl, react-hook-form, zod)
- [ ] T003 [P] Install backend dependencies (firebase-admin, express)
- [ ] T004 [P] Configure environment variables (.env.local for frontend, .env for functions)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Auth system and protected routing — blocks all user stories

- [ ] T005 Create Firebase client configuration in `apps/frontend/lib/firebase.ts`
- [ ] T006 [P] Create Firebase admin configuration in `apps/functions/src/lib/firebase.ts`
- [ ] T007 Implement authentication context provider in `apps/frontend/lib/auth-context.tsx`
- [ ] T008 Build protected route middleware in `apps/frontend/middleware.ts`
- [ ] T009 [P] Create authentication middleware for API routes in `apps/functions/src/middleware/auth.ts`
- [ ] T010 [P] Set up next-intl with pt-BR and en locale files in `apps/frontend/messages/`

**Checkpoint**: Auth system ready — user story implementation can begin

---

## Phase 3: User Story 1 - Account Registration (Priority: P1)

**Goal**: Users can register via email/password or Google and access the dashboard.

**Independent Test**: Register a new account → verify redirect to dashboard → verify clinic auto-created in Firestore.

### Implementation

- [ ] T011 [P] [US1] Create sign-up page UI in `apps/frontend/app/[locale]/signup/page.tsx`
- [ ] T012 [P] [US1] Create sign-in page UI in `apps/frontend/app/[locale]/signin/page.tsx`
- [ ] T013 [US1] Implement email/password registration flow with Firebase Auth
- [ ] T014 [US1] Implement Google OAuth sign-in flow with Firebase Auth
- [ ] T015 [US1] Create auto-clinic-creation logic on first dashboard access in `apps/functions/src/routes/clinics.ts`
- [ ] T016 [US1] Create dashboard overview page in `apps/frontend/app/[locale]/dashboard/page.tsx`

**Checkpoint**: Users can register and reach the dashboard with an auto-created clinic

---

## Phase 4: User Story 2 - Clinic Profile Setup (Priority: P1)

**Goal**: Clinic owners can fill in and save their clinic profile.

**Independent Test**: Fill profile form → save → reload page → verify data persists.

### Implementation

- [ ] T017 [P] [US2] Create Clinic TypeScript interface in `apps/frontend/types/clinic.ts`
- [ ] T018 [P] [US2] Create Zod validation schema for clinic profile in `apps/frontend/lib/schemas/clinic.schema.ts`
- [ ] T019 [US2] Create clinic settings page in `apps/frontend/app/[locale]/dashboard/clinic/page.tsx`
- [ ] T020 [US2] Implement CNPJ input with mask and validation
- [ ] T021 [US2] Implement phone input with Brazilian format mask
- [ ] T022 [US2] Create PATCH /clinics/me API endpoint in `apps/functions/src/routes/clinics.ts`
- [ ] T023 [US2] Create GET /clinics/me API endpoint in `apps/functions/src/routes/clinics.ts`
- [ ] T024 [US2] Wire form to API with TanStack Query hooks in `apps/frontend/hooks/useClinic.ts`

**Checkpoint**: Clinic profile form saves and loads correctly

---

## Phase 5: User Story 3 - Address with Google Maps (Priority: P2)

**Goal**: Clinic owners can set their address using Google Maps autocomplete.

**Independent Test**: Type address → select suggestion → reload → verify structured address persists.

### Implementation

- [ ] T025 [US3] Integrate Google Maps Places API in `apps/frontend/components/google-maps-address.tsx`
- [ ] T026 [US3] Parse Google Places response into structured ClinicAddress fields
- [ ] T027 [US3] Add address section to clinic settings page
- [ ] T028 [US3] Create Zod validation schema for address in `apps/frontend/lib/schemas/clinic.schema.ts`

**Checkpoint**: Address autocomplete works and structured data is saved

---

## Phase 6: User Story 4 - Operating Hours Configuration (Priority: P2)

**Goal**: Clinic owners can define operating hours per day with break times.

**Independent Test**: Set hours for each day → add breaks → save → reload → verify schedule persists.

### Implementation

- [ ] T029 [P] [US4] Create OperatingHours TypeScript interface
- [ ] T030 [P] [US4] Create Zod validation schema for operating hours
- [ ] T031 [US4] Build operating hours form component in `apps/frontend/components/operating-hours-form.tsx`
- [ ] T032 [US4] Implement day toggle (open/closed) with time range inputs
- [ ] T033 [US4] Implement break time add/remove within each day
- [ ] T034 [US4] Add time range validation (end > start, no overlap)
- [ ] T035 [US4] Add operating hours section to clinic settings page

**Checkpoint**: Operating hours form saves and loads correctly

---

## Phase 7: User Story 5 - Payment Settings (Priority: P3)

**Goal**: Clinic owners can configure PIX key, deposit percentage, and convenio acceptance.

**Independent Test**: Set PIX key with double-entry → set deposit % → toggle convenio → save → reload → verify.

### Implementation

- [ ] T036 [P] [US5] Create PaymentSettings TypeScript interface
- [ ] T037 [P] [US5] Create Zod validation schema for payment settings
- [ ] T038 [US5] Build PIX key input with double-entry confirmation
- [ ] T039 [US5] Build deposit percentage slider (10-100%)
- [ ] T040 [US5] Build convenio provider selector with common Brazilian providers
- [ ] T041 [US5] Add payment settings section to clinic settings page (or dedicated payments page)
- [ ] T042 [US5] Wire payment settings to API

**Checkpoint**: Payment settings save and load correctly

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Onboarding UX and final improvements

- [ ] T043 [P] Create onboarding progress indicator (stepper component)
- [ ] T044 [P] Add loading/error states to all forms
- [ ] T045 Add i18n translations for all form labels and validation messages
- [ ] T046 [P] Add Firestore security rules for clinic documents
- [ ] T047 Run quickstart.md validation

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies
- **Foundational (Phase 2)**: Depends on Phase 1
- **US1 Registration (Phase 3)**: Depends on Phase 2
- **US2 Profile (Phase 4)**: Depends on Phase 3 (needs clinic to exist)
- **US3 Address (Phase 5)**: Depends on Phase 4 (adds to clinic settings page)
- **US4 Hours (Phase 6)**: Can run parallel to Phase 5
- **US5 Payments (Phase 7)**: Can run parallel to Phase 5/6
- **Polish (Phase 8)**: Depends on all user stories

### Parallel Opportunities

- T002, T003, T004 (Phase 1 setup tasks)
- T005/T006, T007, T009, T010 (Phase 2 foundational tasks)
- T011, T012 (signup/signin pages)
- T017, T018 (types and schemas)
- Phase 5, 6, 7 can partially overlap after Phase 4
