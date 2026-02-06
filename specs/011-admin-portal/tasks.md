# Tasks: Admin Portal

**Input**: Design documents from `/specs/011-admin-portal/`
**Prerequisites**: plan.md, spec.md, data-model.md

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Data model, types, and admin auth utilities

- [ ] T001 Define AdminUser, AuditLog, FeatureFlag, PlatformAnalytics, and ImpersonationSession TypeScript interfaces in `apps/frontend/types/admin.ts`
- [ ] T002 [P] Create Zod validation schemas for admin user creation, feature flag targeting, and audit log queries
- [ ] T003 [P] Create admin auth middleware (verify admin role + permissions from Firebase custom claims)
- [ ] T004 [P] Create audit logging utility (auto-capture IP, user agent, actor info on every admin action)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Admin auth, API routes, and Firestore setup — blocks all UI

- [ ] T005 Create admin Express router in `apps/functions/src/routes/admin.ts`
- [ ] T006 Implement admin authentication guard (check `gendei_admin_users` document + role)
- [ ] T007 [P] Implement GET /admin/clinics endpoint (list all clinics with subscription and admin metadata)
- [ ] T008 [P] Implement GET /admin/clinics/:id endpoint (full clinic detail with quotas and usage)
- [ ] T009 Implement PATCH /admin/clinics/:id endpoint (update clinic fields)
- [ ] T010 [P] Implement POST /admin/clinics/:id/suspend endpoint (set suspended flag + reason + audit log)
- [ ] T011 [P] Implement POST /admin/clinics/:id/unsuspend endpoint
- [ ] T012 Implement DELETE /admin/clinics/:id endpoint (soft delete with audit log)
- [ ] T013 [P] Add Firestore indexes and security rules for admin collections
- [ ] T014 Create TanStack Query hooks in `apps/frontend/hooks/useAdmin.ts`

**Checkpoint**: Admin auth and clinic CRUD operational

---

## Phase 3: User Story 1 - Clinic Lifecycle Management (Priority: P1)

**Goal**: Admins can manage clinic accounts from the admin portal.

**Independent Test**: Login → view clinics → approve → suspend → verify status changes.

### Implementation

- [ ] T015 [US1] Create admin layout in `apps/frontend/app/[locale]/admin/layout.tsx`
- [ ] T016 [US1] Create clinic list page in `apps/frontend/app/[locale]/admin/clinics/page.tsx`
- [ ] T017 [P] [US1] Build clinic list table with search, filter by status/plan, and pagination
- [ ] T018 [US1] Build clinic detail page in `apps/frontend/app/[locale]/admin/clinics/[id]/page.tsx`
- [ ] T019 [US1] Build suspend/unsuspend/delete action buttons with confirmation dialogs
- [ ] T020 [US1] Display clinic quotas and usage metrics on detail page

**Checkpoint**: Clinic lifecycle management fully functional

---

## Phase 4: User Story 2 - Platform Analytics (Priority: P1)

**Goal**: Admins can view platform-wide metrics and trends.

**Independent Test**: Open analytics → verify metrics → change date range → verify update.

### Implementation

- [ ] T021 [US2] Implement GET /admin/analytics/overview endpoint (aggregate from `gendei_platform_analytics`)
- [ ] T022 [P] [US2] Implement daily analytics computation Cloud Function (scheduled)
- [ ] T023 [US2] Create analytics dashboard page in `apps/frontend/app/[locale]/admin/analytics/page.tsx`
- [ ] T024 [US2] Build overview cards (total clinics, appointments, messages, revenue)
- [ ] T025 [P] [US2] Build trend charts (clinic growth, appointment volume, revenue over time)
- [ ] T026 [US2] Build date range selector and filters

**Checkpoint**: Platform analytics dashboard functional

---

## Phase 5: User Story 3 - Feature Flags (Priority: P2)

**Goal**: Admins can create and manage feature flags with various targeting options.

**Independent Test**: Create flag → target clinic → verify clinic sees feature → disable → verify hidden.

### Implementation

- [ ] T027 [US3] Implement feature flag CRUD endpoints (GET/POST/PATCH/DELETE /admin/feature-flags)
- [ ] T028 [US3] Implement feature flag evaluation logic (check targeting type, percentage, clinicIds, plans, rules)
- [ ] T029 [US3] Create feature flags page in `apps/frontend/app/[locale]/admin/feature-flags/page.tsx`
- [ ] T030 [P] [US3] Build flag creation form with targeting type selector
- [ ] T031 [US3] Build flag list with enable/disable toggles
- [ ] T032 [P] [US3] Create client-side feature flag hook `useFeatureFlag(flagName)` for frontend evaluation

**Checkpoint**: Feature flags work end-to-end

---

## Phase 6: User Story 4 - Impersonation (Priority: P2)

**Goal**: Support staff can impersonate clinics to troubleshoot issues.

**Independent Test**: Start impersonation → see clinic dashboard → actions logged → end session.

### Implementation

- [ ] T033 [US4] Implement POST /admin/impersonate/:clinicId endpoint (create session + token)
- [ ] T034 [P] [US4] Implement POST /admin/impersonate/end endpoint (terminate session)
- [ ] T035 [US4] Build impersonation banner component (shows "Impersonating: Clinic Name" with end button)
- [ ] T036 [US4] Implement session timeout (1h default, auto-terminate)
- [ ] T037 [US4] Log all actions during impersonation with `impersonating` field in audit log

**Checkpoint**: Impersonation flow functional with audit trail

---

## Phase 7: User Story 5 - Audit Logging (Priority: P1)

**Goal**: All admin actions are logged with full metadata.

**Independent Test**: Perform action → view audit logs → verify entry with all fields.

### Implementation

- [ ] T038 [US5] Implement GET /admin/audit-logs endpoint (paginated, filterable by action, resource, actor, date range)
- [ ] T039 [US5] Create audit logs page in `apps/frontend/app/[locale]/admin/audit-logs/page.tsx`
- [ ] T040 [P] [US5] Build audit log table with filters (action type, resource, date range, actor)
- [ ] T041 [US5] Build audit log detail view (show changes diff, metadata)
- [ ] T042 [US5] Wire audit logging into all admin endpoints (middleware approach)

**Checkpoint**: Audit logging comprehensive and viewable

---

## Phase 8: Polish & Cross-Cutting Concerns

- [ ] T043 [P] Add admin portal navigation sidebar
- [ ] T044 [P] Add i18n translations for admin labels
- [ ] T045 [P] Add loading states and skeletons
- [ ] T046 Implement 2FA requirement check for super_admin role
- [ ] T047 Run quickstart.md validation

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies
- **Foundational (Phase 2)**: Depends on Phase 1
- **US1 Clinic Management (Phase 3)**: Depends on Phase 2
- **US2 Analytics (Phase 4)**: Depends on Phase 2
- **US3 Feature Flags (Phase 5)**: Depends on Phase 2
- **US4 Impersonation (Phase 6)**: Depends on Phase 3
- **US5 Audit Logging (Phase 7)**: Depends on Phase 2 (wired into all endpoints)
- **Polish (Phase 8)**: Depends on all

### Parallel Opportunities

- T002, T003, T004 (schemas and utilities)
- T007, T008, T010, T011, T013 (API endpoints and indexes)
- T017 (clinic table parallel to list page)
- T022 (analytics computation parallel to API endpoint)
- T025 (charts parallel to overview cards)
- T030, T032 (flag form and client hook parallel)
- T034 (end session parallel to start)
- T040 (table parallel to page)
- Phase 3, Phase 4, and Phase 5 can overlap after Phase 2
