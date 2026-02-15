# Feature Specification: Team Management

**Feature Branch**: `012-team-management`
**Created**: 2026-02-04
**Updated**: 2026-02-16
**Status**: Implemented

## User Scenarios & Testing

### User Story 1 - Invite Team Members (Priority: P1)

A clinic owner or admin invites team members by email, assigning them a role (admin, manager, professional, view-only) that determines their access level.

**Why this priority**: Inviting team members is the entry point to the entire team management feature — nothing else works without it.

**Independent Test**: Open team settings → click "Invite Member" → enter email and role → verify invitation email sent → verify invitation appears in pending list.

**Acceptance Scenarios**:

1. **Given** the team settings page, **When** the owner enters an email and selects a role, **Then** an invitation is sent via email with a 7-day expiration link.
2. **Given** an invitation sent, **When** it appears in the team list, **Then** it shows as `pending` with the invitee's email, role, and expiration date.
3. **Given** a duplicate email, **When** the owner tries to invite them again, **Then** an error is shown ("This email already has a pending invitation").

---

### User Story 2 - Accept Invitation and Join Clinic (Priority: P1)

An invitee receives an email, clicks the link, creates or links their account, and gains access to the clinic with the assigned role.

**Why this priority**: Invitation acceptance completes the invite flow — without it, invitations are useless.

**Independent Test**: Receive invitation email → click link → create account → verify access to clinic dashboard with correct permissions.

**Acceptance Scenarios**:

1. **Given** a valid invitation link, **When** the invitee clicks it, **Then** they are taken to a signup/login page with the clinic name and role pre-filled.
2. **Given** an existing user, **When** they accept an invitation, **Then** the clinicId is added to their `clinicIds` custom claim and they can switch to the new clinic.
3. **Given** an expired invitation (>7 days), **When** the invitee clicks the link, **Then** an error page is shown ("This invitation has expired").

---

### User Story 3 - Role-Based Access Control (Priority: P1)

Team members see different UI elements and have different permissions based on their assigned role (admin > manager > professional > view-only).

**Why this priority**: RBAC is fundamental to multi-user clinics — it prevents unauthorized access to sensitive data.

**Independent Test**: Login as view-only → verify limited access → login as admin → verify full settings access.

**Acceptance Scenarios**:

1. **Given** a view-only user, **When** they login, **Then** they can view appointments and basic information, but cannot create, edit, or delete anything.
2. **Given** a professional user, **When** they login, **Then** they can manage their own appointments and patients, access conversations, but cannot manage team or settings.
3. **Given** a manager user, **When** they login, **Then** they can manage appointments, patients, and conversations, and view analytics, but cannot manage team roles or billing.
4. **Given** an admin user, **When** they login, **Then** they have full access including team management, settings, billing, and all other features.

---

### User Story 4 - Manage Team Members (Priority: P2)

A clinic admin can view team members, change roles, suspend access, or remove members.

**Why this priority**: Ongoing team management is needed after initial setup, but less frequent than invitations.

**Independent Test**: View team list → change member role → verify permissions update → suspend member → verify they lose access.

**Acceptance Scenarios**:

1. **Given** the team list, **When** the admin views it, **Then** all members are shown with name, email, role, status, and last active time.
2. **Given** a team member, **When** the admin changes their role from professional to manager, **Then** their permissions update immediately and custom claims are refreshed.
3. **Given** a team member, **When** the admin suspends them, **Then** the member's status changes to `suspended` and they cannot access the clinic.
4. **Given** a suspended member, **When** the admin reactivates them, **Then** their access is restored with their previous role.

---

### Edge Cases

- What if the only admin tries to leave? (Prevent — at least one admin must exist per clinic)
- What if a user is a member of multiple clinics? (Different roles per clinic; clinic switcher in UI)
- What if the invited email is already a member? (Show error: "This person is already a team member")
- What about professional linking? (Team members with "professional" role can be linked to a Professional entity for scheduling)

## Requirements

### Functional Requirements

- **FR-001**: System MUST support email-based team invitations with 7-day expiration
- **FR-002**: System MUST support 4 roles: admin, manager, professional, view-only with hierarchical permissions
- **FR-003**: System MUST update Firebase custom claims on role changes for real-time permission enforcement
- **FR-004**: System MUST support multi-clinic membership (users can belong to multiple clinics with different roles)
- **FR-005**: System MUST support member suspension and reactivation without data loss
- **FR-006**: System MUST prevent removal of the last admin from a clinic
- **FR-007**: System MUST support linking team members to Professional entities for scheduling
- **FR-008**: System MUST track last active time per team member
- **FR-009**: System MUST implement `PermissionGuard` component and `use-permissions` hook for frontend access control

### Key Entities

- **TeamMember**: Clinic ID, user ID, email, name, role (admin/manager/professional/view-only), status, invited/accepted timestamps, professional link
- **Invitation**: Clinic ID, email, role, token (hashed), expiration, status, inviter info, optional personal message

## Success Criteria

### Measurable Outcomes

- **SC-001**: Invitation acceptance rate > 80%
- **SC-002**: Role setup time < 2 minutes
- **SC-003**: Zero unauthorized access incidents
- **SC-004**: Permission changes take effect < 5 seconds
