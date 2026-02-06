# Feature Specification: Admin Portal

**Feature Branch**: `011-admin-portal`
**Created**: 2026-02-04
**Status**: Implemented

## User Scenarios & Testing

### User Story 1 - Clinic Lifecycle Management (Priority: P1)

A super-admin manages clinic accounts: approving new clinics, viewing clinic details, suspending problematic accounts, and deleting inactive clinics.

**Why this priority**: Clinic lifecycle management is the core function of the admin portal — without it, there is no way to manage the platform.

**Independent Test**: Login as admin → view clinic list → approve a pending clinic → suspend a clinic → verify status changes persist.

**Acceptance Scenarios**:

1. **Given** the admin portal, **When** a super-admin views the clinic list, **Then** all clinics are shown with name, plan, status, creation date, and usage metrics.
2. **Given** a pending clinic, **When** the admin approves it, **Then** `admin.verified` is set to `true` and the clinic gains full access.
3. **Given** an active clinic, **When** the admin suspends it with a reason, **Then** `admin.suspended` is set to `true`, `suspendedReason` is stored, and the clinic loses access.
4. **Given** a suspended clinic, **When** the admin unsuspends it, **Then** `admin.suspended` is set to `false` and the clinic regains access.

---

### User Story 2 - Platform Analytics (Priority: P1)

A super-admin views platform-wide metrics including total clinics, appointments, revenue, messages, and system health.

**Why this priority**: Analytics are essential for understanding platform growth and identifying issues.

**Independent Test**: Open analytics dashboard → verify metrics match actual data → check date range filters work.

**Acceptance Scenarios**:

1. **Given** the analytics overview, **When** the admin loads it, **Then** key metrics are displayed: total clinics (by plan, by status), total appointments, total messages, total revenue.
2. **Given** the analytics dashboard, **When** the admin selects a date range, **Then** all metrics update to reflect the selected period.
3. **Given** system health section, **When** the admin views it, **Then** API error rates, average response times, and usage trends are shown.

---

### User Story 3 - Feature Flags (Priority: P2)

A super-admin creates and manages feature flags to control feature rollouts to specific clinics, plans, or percentages of users.

**Why this priority**: Feature flags enable safe, incremental rollouts without code deploys.

**Independent Test**: Create feature flag → target specific clinic → verify clinic sees the feature → disable → verify feature hidden.

**Acceptance Scenarios**:

1. **Given** the feature flags page, **When** the admin creates a flag with targeting type `clinicIds`, **Then** only specified clinics see the feature.
2. **Given** a percentage-based flag at 50%, **When** clinics load, **Then** approximately 50% of clinics have the feature enabled.
3. **Given** an active flag, **When** the admin disables it, **Then** all clinics immediately lose the feature.

---

### User Story 4 - Impersonation for Support (Priority: P2)

A support staff member impersonates a clinic to troubleshoot issues, seeing exactly what the clinic sees without needing their credentials.

**Why this priority**: Impersonation dramatically reduces support resolution time by allowing direct investigation.

**Independent Test**: Start impersonation session → verify clinic dashboard loads with clinic data → verify audit trail created → end session.

**Acceptance Scenarios**:

1. **Given** a clinic with a support ticket, **When** the support admin clicks "Impersonate", **Then** a time-limited session starts and the admin sees the clinic's dashboard.
2. **Given** an active impersonation session, **When** the admin performs actions, **Then** all actions are logged to the audit trail with `impersonating: clinicId`.
3. **Given** a session, **When** the session expires or admin clicks "End Session", **Then** the session is terminated and logged.

---

### User Story 5 - Audit Logging (Priority: P1)

All admin actions are automatically logged with actor, action, resource, timestamp, IP address, and changes made.

**Why this priority**: Audit logging is a security and compliance requirement — every admin action must be traceable.

**Independent Test**: Perform admin action → view audit logs → verify action recorded with all metadata.

**Acceptance Scenarios**:

1. **Given** any admin action (create, update, delete, suspend), **When** the action completes, **Then** an audit log entry is created with actorId, action, resource, resourceId, description, ipAddress, and timestamp.
2. **Given** an update action, **When** fields change, **Then** the audit log includes `changes` array with field, oldValue, and newValue.
3. **Given** the audit log viewer, **When** the admin filters by action type or date range, **Then** matching logs are displayed in chronological order.

---

### Edge Cases

- What if a super-admin tries to delete themselves? (Prevent — at least one super-admin must exist)
- What about impersonation session timeout? (Sessions expire after 1 hour by default; extendable)
- What if a feature flag targets a deleted clinic? (Flag still evaluates but has no effect on deleted clinics)
- What about concurrent admin actions on the same clinic? (Last-write-wins with audit trail for reconciliation)
- What about 2FA for super-admins? (Required for super_admin role; optional for admin/support)

## Requirements

### Functional Requirements

- **FR-001**: System MUST support clinic lifecycle management (approve, suspend, unsuspend, delete)
- **FR-002**: System MUST display platform-wide analytics with configurable date ranges
- **FR-003**: System MUST support feature flags with targeting (all, none, percentage, clinicIds, plans, rules)
- **FR-004**: System MUST support clinic impersonation for support staff with time-limited sessions
- **FR-005**: System MUST log all admin actions in an immutable audit trail
- **FR-006**: System MUST enforce role-based access: super_admin, admin, support
- **FR-007**: System MUST require 2FA for super_admin role
- **FR-008**: System MUST support IP allowlisting per admin user
- **FR-009**: System MUST track clinic quotas (professionals, appointments, messages, WhatsApp numbers)
- **FR-010**: System MUST support subscription plan management (starter, professional, enterprise)

### Key Entities

- **AdminUser**: Email, name, role, permissions, active flag, 2FA requirement, IP allowlist
- **AuditLog**: Actor, action, resource, changes, IP address, user agent, timestamp
- **FeatureFlag**: Name, description, enabled, targeting rules (type, percentage, clinicIds, plans)
- **PlatformAnalytics**: Daily snapshots of clinics, appointments, messages, revenue, system health
- **ImpersonationSession**: Admin, clinic, token, start/end times, reason, actions performed

## Success Criteria

### Measurable Outcomes

- **SC-001**: Admin task completion < 30 seconds
- **SC-002**: Zero unauthorized access incidents
- **SC-003**: 100% audit trail coverage for all admin actions
- **SC-004**: Platform analytics load < 3 seconds
- **SC-005**: Feature flag propagation < 5 seconds
