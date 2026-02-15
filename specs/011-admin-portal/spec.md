# Feature Specification: Admin Portal

**Feature Branch**: `011-admin-portal`
**Created**: 2026-02-04
**Updated**: 2026-02-16
**Status**: Partially Implemented

## User Scenarios & Testing

### User Story 1 - Clinic Overview and Monitoring (Priority: P1) — Implemented

A super-admin views the list of all clinics on the platform with basic information: name, plan, status, and usage metrics.

**Why this priority**: Clinic visibility is the core function of the admin portal — understanding the platform state.

**Independent Test**: Login as admin → view clinic list → click on a clinic → verify clinic details load.

**Acceptance Scenarios**:

1. **Given** the admin portal, **When** a super-admin views the clinic list, **Then** all clinics are shown with name, plan, status, creation date, and usage metrics.
2. **Given** a clinic in the list, **When** the admin clicks on it, **Then** the clinic detail page shows full information including appointments, revenue, and team members.

---

### User Story 2 - Appointment and Payment Overview (Priority: P1) — Implemented

A super-admin views platform-wide appointments and payment information for monitoring and support purposes.

**Why this priority**: Operational visibility helps with platform support and issue resolution.

**Independent Test**: Open appointments page → verify appointments across clinics are displayed → open payments page → verify payment data.

**Acceptance Scenarios**:

1. **Given** the appointments page, **When** the admin views it, **Then** recent appointments across all clinics are shown with status, clinic, patient, and professional.
2. **Given** the payments page, **When** the admin views it, **Then** payment transactions are shown with amounts, statuses, and Stripe references.

---

### User Story 3 - System Health Monitoring (Priority: P2) — Implemented

A super-admin monitors platform health: API status, error rates, and service connectivity.

**Why this priority**: Health monitoring enables proactive issue detection and resolution.

**Independent Test**: Open health page → verify service status indicators show current state.

**Acceptance Scenarios**:

1. **Given** the health page, **When** the admin views it, **Then** service status indicators are shown for key platform components.
2. **Given** a service issue, **When** detected, **Then** the health page highlights the affected component.

---

### User Story 4 - Support Tools (Priority: P2) — Implemented

A support admin uses the admin portal to look up clinic information and assist with customer issues.

**Why this priority**: Support tools reduce resolution time for customer issues.

**Independent Test**: Open support page → search for a clinic → verify relevant information is displayed.

**Acceptance Scenarios**:

1. **Given** the support page, **When** the admin searches for a clinic by name or ID, **Then** the clinic's information and recent activity are shown.
2. **Given** a clinic's detail page, **When** the admin reviews it, **Then** they can see recent appointments, conversations, and configuration.

---

### User Story 5 - Clinic Lifecycle Management (Priority: P1) — Planned

A super-admin manages clinic accounts: approving new clinics, suspending problematic accounts, and deleting inactive clinics.

**Acceptance Scenarios**:

1. **Given** a pending clinic, **When** the admin approves it, **Then** `admin.verified` is set to `true` and the clinic gains full access.
2. **Given** an active clinic, **When** the admin suspends it with a reason, **Then** `admin.suspended` is set to `true`, `suspendedReason` is stored, and the clinic loses access.

---

### User Story 6 - Feature Flags (Priority: P2) — Planned

A super-admin creates and manages feature flags to control feature rollouts to specific clinics, plans, or percentages of users.

**Acceptance Scenarios**:

1. **Given** the feature flags page, **When** the admin creates a flag with targeting type `clinicIds`, **Then** only specified clinics see the feature.
2. **Given** an active flag, **When** the admin disables it, **Then** all clinics immediately lose the feature.

---

### User Story 7 - Impersonation for Support (Priority: P2) — Planned

A support staff member impersonates a clinic to troubleshoot issues, seeing exactly what the clinic sees without needing their credentials.

**Acceptance Scenarios**:

1. **Given** a clinic with a support ticket, **When** the support admin clicks "Impersonate", **Then** a time-limited session starts and the admin sees the clinic's dashboard.
2. **Given** an active impersonation session, **When** the admin performs actions, **Then** all actions are logged to the audit trail.

---

### Edge Cases

- What about concurrent admin access? (Read-only operations are safe; write operations are limited)
- What about authentication for admin portal? (Separate admin authentication, not shared with clinic users)

## Requirements

### Functional Requirements (Implemented)

- **FR-001**: System MUST display a list of all clinics with name, plan, status, and usage metrics
- **FR-002**: System MUST display clinic detail pages with appointments, revenue, and team info
- **FR-003**: System MUST display platform-wide appointment data
- **FR-004**: System MUST display payment transaction overview with Stripe references
- **FR-005**: System MUST display system health monitoring indicators
- **FR-006**: System MUST support clinic search and lookup for support purposes

### Functional Requirements (Planned — Not Yet Implemented)

- **FR-P01**: System SHOULD support clinic lifecycle management (approve, suspend, unsuspend, delete)
- **FR-P02**: System SHOULD support feature flags with targeting (all, none, percentage, clinicIds, plans, rules)
- **FR-P03**: System SHOULD support clinic impersonation for support staff with time-limited sessions
- **FR-P04**: System SHOULD log all admin actions in an immutable audit trail
- **FR-P05**: System SHOULD enforce role-based access: super_admin, admin, support
- **FR-P06**: System SHOULD require 2FA for super_admin role
- **FR-P07**: System SHOULD support IP allowlisting per admin user
- **FR-P08**: System SHOULD track clinic quotas (professionals, appointments, messages, WhatsApp numbers)

### Key Entities

- **AdminUser**: Email, name, role, active flag
- **PlatformOverview**: Aggregated stats — total clinics, appointments, revenue, messages

## Success Criteria

### Measurable Outcomes

- **SC-001**: Admin portal load time < 3 seconds
- **SC-002**: Clinic list load time < 2 seconds
- **SC-003**: Clinic detail load time < 2 seconds
