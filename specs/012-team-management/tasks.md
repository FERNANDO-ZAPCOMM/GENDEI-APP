# Tasks: Team Management

**Input**: Design documents from `/specs/012-team-management/`
**Prerequisites**: plan.md, spec.md, data-model.md

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Data model, types, and permission utilities

- [ ] T001 Define TeamMember, Invitation, and ActivityLog TypeScript interfaces in `apps/frontend/types/team.ts`
- [ ] T002 [P] Create Zod validation schemas for invitation creation, role updates, and permission changes
- [ ] T003 [P] Create permission utility (role → default permissions mapping, permission check functions)
- [ ] T004 [P] Create invitation token generation and hashing utility

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Team API, invitation system, and custom claims — blocks all UI

- [ ] T005 Create team Express router in `apps/functions/src/routes/team.ts`
- [ ] T006 Implement POST /team/invite endpoint (create invitation + send email + generate token)
- [ ] T007 [P] Implement POST /team/accept endpoint (validate token → create TeamMember → update custom claims)
- [ ] T008 Implement GET /team endpoint (list team members by clinicId with status filter)
- [ ] T009 [P] Implement PATCH /team/:id endpoint (update role, permissions, denied permissions)
- [ ] T010 [P] Implement DELETE /team/:id endpoint (remove member + update custom claims)
- [ ] T011 Implement POST /team/:id/suspend endpoint (set status to suspended + update custom claims)
- [ ] T012 [P] Implement POST /team/:id/reactivate endpoint
- [ ] T013 Implement Firebase custom claims update utility (clinicIds, roles mapping)
- [ ] T014 [P] Add Firestore indexes: (clinicId, status), (userId, status), (clinicId, createdAt DESC)
- [ ] T015 Create TanStack Query hooks in `apps/frontend/hooks/useTeam.ts`

**Checkpoint**: Team CRUD + invitation flow operational

---

## Phase 3: User Story 1 - Invite Team Members (Priority: P1)

**Goal**: Owners/admins can send email invitations with role assignment.

**Independent Test**: Invite member → verify email sent → verify pending invitation appears in list.

### Implementation

- [ ] T016 [US1] Create team settings page in `apps/frontend/app/[locale]/dashboard/settings/team/page.tsx`
- [ ] T017 [US1] Build invite member dialog (email input, role selector, optional message)
- [ ] T018 [P] [US1] Build pending invitations list with resend and revoke actions
- [ ] T019 [US1] Implement invitation email template (clinic name, role, accept link)
- [ ] T020 [US1] Add duplicate email validation (check existing members + pending invitations)

**Checkpoint**: Invitations can be sent and managed

---

## Phase 4: User Story 2 - Accept Invitation (Priority: P1)

**Goal**: Invitees can accept invitations and join clinics.

**Independent Test**: Click invitation link → create/link account → verify clinic access with correct role.

### Implementation

- [ ] T021 [US2] Create invitation acceptance page in `apps/frontend/app/[locale]/invite/[token]/page.tsx`
- [ ] T022 [US2] Build acceptance flow (validate token → show clinic info + role → create account or link existing)
- [ ] T023 [P] [US2] Handle expired invitation display (error page with message)
- [ ] T024 [US2] Update clinic switcher component to support multi-clinic users
- [ ] T025 [US2] Implement post-acceptance redirect to new clinic dashboard

**Checkpoint**: Invitation acceptance works end-to-end

---

## Phase 5: User Story 3 - Role-Based Access Control (Priority: P1)

**Goal**: UI adapts to user role, restricting access to authorized features only.

**Independent Test**: Login as Reception → verify limited menu → login as Owner → verify full menu.

### Implementation

- [ ] T026 [US3] Create permission context provider in `apps/frontend/lib/permission-provider.tsx`
- [ ] T027 [US3] Build `usePermission(permission)` hook for component-level access checks
- [ ] T028 [P] [US3] Build `<RequirePermission>` wrapper component for conditional rendering
- [ ] T029 [US3] Update dashboard sidebar to show/hide menu items based on role
- [ ] T030 [US3] Add server-side permission checks to all existing API endpoints
- [ ] T031 [US3] Build "Access Denied" page for unauthorized route access

**Checkpoint**: RBAC enforced on both frontend and backend

---

## Phase 6: User Story 4 - Manage Team Members (Priority: P2)

**Goal**: Admins can view, edit roles, suspend, and remove team members.

**Independent Test**: View team → change role → verify update → suspend → verify access lost.

### Implementation

- [ ] T032 [US4] Build team member list component (name, email, role, status, last active)
- [ ] T033 [US4] Build role change dropdown with confirmation
- [ ] T034 [P] [US4] Build permission override UI (grant additional / deny specific permissions)
- [ ] T035 [US4] Build suspend/reactivate actions with confirmation dialogs
- [ ] T036 [US4] Build remove member action with confirmation (prevent last owner removal)
- [ ] T037 [P] [US4] Build professional linking selector (link staff member to Professional entity)

**Checkpoint**: Team member management fully functional

---

## Phase 7: User Story 5 - Activity Logging (Priority: P3)

**Goal**: Admins can view activity logs for accountability.

**Independent Test**: Perform actions → view log → verify entries with correct attribution.

### Implementation

- [ ] T038 [US5] Implement activity logging middleware (auto-capture on mutations)
- [ ] T039 [US5] Implement GET /team/:id/activity endpoint (paginated, filterable)
- [ ] T040 [US5] Create activity log page in `apps/frontend/app/[locale]/dashboard/settings/team/activity/page.tsx`
- [ ] T041 [P] [US5] Build activity log table with filters (user, action type, date range)
- [ ] T042 [US5] Build activity detail view (show changes diff)

**Checkpoint**: Activity logging viewable and filterable

---

## Phase 8: Polish & Cross-Cutting Concerns

- [ ] T043 [P] Add i18n translations for team management labels
- [ ] T044 [P] Add loading states and skeletons
- [ ] T045 [P] Add empty states (no team members, no activity)
- [ ] T046 Implement optimistic updates for role changes and suspensions
- [ ] T047 Run quickstart.md validation

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies
- **Foundational (Phase 2)**: Depends on Phase 1
- **US1 Invite (Phase 3)**: Depends on Phase 2
- **US2 Accept (Phase 4)**: Depends on Phase 3
- **US3 RBAC (Phase 5)**: Depends on Phase 2
- **US4 Manage (Phase 6)**: Depends on Phase 3 + Phase 5
- **US5 Activity (Phase 7)**: Depends on Phase 2
- **Polish (Phase 8)**: Depends on all

### Parallel Opportunities

- T002, T003, T004 (schemas and utilities)
- T007, T009, T010, T012, T014 (API endpoints and indexes)
- T018 (pending invitations parallel to invite dialog)
- T023 (expired handling parallel to accept flow)
- T028 (wrapper component parallel to permission hook)
- T034, T037 (permission override and professional linking parallel)
- T041 (table parallel to activity page)
- Phase 3 and Phase 5 can overlap after Phase 2
- Phase 7 can start parallel to Phase 6
