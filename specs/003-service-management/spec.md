# Feature Specification: Service Management

**Feature Branch**: `003-service-management`
**Created**: 2026-02-04
**Status**: Implemented

## User Scenarios & Testing

### User Story 1 - Create a Service (Priority: P1)

A clinic owner defines a new medical service with name, description, price, duration, deposit percentage, and assigns it to one or more professionals.

**Why this priority**: Without services, appointments cannot be booked. Services are the core offering.

**Independent Test**: Can be tested by filling the service form, selecting professionals, and verifying the service appears in the list.

**Acceptance Scenarios**:

1. **Given** a clinic with at least one professional, **When** the owner navigates to services and clicks "Add Service", **Then** a form appears with fields for name, description, price, duration, deposit %, and professional selection.
2. **Given** the service form, **When** the owner fills all fields and submits, **Then** the service is created in Firestore as a subcollection under the clinic.
3. **Given** the price input, **When** the owner types a value, **Then** it auto-formats as BRL currency (R$ XX,XX) and stores in cents.
4. **Given** the duration selector, **When** the owner selects a duration, **Then** only 15-minute increments are available (15, 30, 45, 60, 90, 120, 150, 180, 240 min).
5. **Given** the professional multi-select, **When** the owner selects professionals, **Then** only active professionals from this clinic are shown.

---

### User Story 2 - List and Search Services (Priority: P2)

A clinic owner views all services with search and filter capabilities.

**Why this priority**: Visibility into existing services is needed for management and avoids duplicates.

**Independent Test**: Can be tested by adding multiple services and verifying list, search, and filter work.

**Acceptance Scenarios**:

1. **Given** a clinic with services, **When** the owner navigates to the services page, **Then** all active services are listed as cards showing name, price, duration, and assigned professionals.
2. **Given** the search field, **When** the owner types a service name, **Then** the list filters in real-time.
3. **Given** the professional filter, **When** the owner selects a professional, **Then** only services assigned to that professional are shown.
4. **Given** no services exist, **When** the owner visits the page, **Then** an empty state prompts them to add their first service.

---

### User Story 3 - Edit and Deactivate Service (Priority: P2)

A clinic owner can edit service details or deactivate a service that is no longer offered.

**Why this priority**: Service offerings change over time; edit and deactivation support ongoing operations.

**Independent Test**: Can be tested by editing a service name/price and deactivating a service.

**Acceptance Scenarios**:

1. **Given** a service detail page, **When** the owner clicks "Edit", **Then** the form becomes editable with pre-filled values.
2. **Given** an active service, **When** the owner clicks "Deactivate", **Then** a confirmation dialog appears. On confirm, the service is set to `active: false`.
3. **Given** a service with upcoming appointments, **When** the owner tries to delete, **Then** a warning is shown and hard delete is blocked. Soft delete (deactivation) is still allowed.

---

### Edge Cases

- What happens when a service is deactivated but has future appointments? (Existing appointments stay, new bookings are prevented)
- What if the last professional assigned to a service is deactivated? (Service remains but cannot be booked until a professional is reassigned)
- What happens when price is R$ 0,00? (Allowed — free services are valid)
- Maximum services per clinic? (No hard limit, but UI should handle 100+ efficiently)

## Requirements

### Functional Requirements

- **FR-001**: System MUST support creating services as a Firestore subcollection under the clinic
- **FR-002**: System MUST store prices in BRL cents (integer) and display formatted as R$ XX,XX
- **FR-003**: System MUST support durations in 15-minute increments (15-240 minutes)
- **FR-004**: System MUST support deposit percentage configuration (10-100%, default 30%)
- **FR-005**: System MUST support assigning multiple professionals to a service
- **FR-006**: System MUST validate that at least one professional is assigned
- **FR-007**: System MUST validate that assigned professionals belong to the same clinic
- **FR-008**: System MUST support soft deletion (deactivation) without data loss
- **FR-009**: System MUST prevent hard deletion if the service has existing appointments
- **FR-010**: System MUST support search by service name and filter by professional
- **FR-011**: System MUST display enriched service cards with resolved professional names and photos
- **FR-012**: System MUST support per-service convenio and particular acceptance toggles

### Key Entities

- **Service**: Name, description, price (cents), duration (minutes), deposit %, professional IDs, active status
- **ServiceWithProfessionals**: Enriched service with resolved professional details for display

## Success Criteria

### Measurable Outcomes

- **SC-001**: Service creation completed in under 1 minute
- **SC-002**: Service list loads in under 300ms
- **SC-003**: Zero data integrity issues (prices always positive integers, valid professional references)
- **SC-004**: Deposit calculation accuracy: 100% (rounded to nearest cent)
