# Feature Specification: Appointment Management

**Feature Branch**: `006-appointment-management`
**Created**: 2026-02-04
**Status**: Implemented

## User Scenarios & Testing

### User Story 1 - Create Appointment from Dashboard (Priority: P1)

A clinic staff member creates a new appointment by selecting a patient, professional, service, date, and time through the dashboard.

**Why this priority**: Dashboard-based booking is essential for clinics that also take phone/walk-in appointments.

**Independent Test**: Can be tested by filling the appointment form and verifying the appointment appears on the calendar.

**Acceptance Scenarios**:

1. **Given** a staff member on the agenda page, **When** they click "New Appointment", **Then** a form appears with patient, professional, service, date, and time fields.
2. **Given** the form with a selected service, **When** the staff selects a date and time, **Then** the system checks availability and warns about conflicts.
3. **Given** valid form data, **When** submitted, **Then** the appointment is created with status `pending`, deposit amount calculated, and it appears on the calendar.
4. **Given** an existing patient, **When** selected, **Then** their name and phone are auto-filled. For new patients, a quick-create form is shown.

---

### User Story 2 - View Calendar with Appointments (Priority: P1)

A clinic staff member views the 7-day calendar grid showing all appointments color-coded by status, with the ability to filter by professional.

**Why this priority**: The calendar is the primary daily workflow tool for clinic staff.

**Independent Test**: Can be tested by viewing the calendar with appointments and verifying correct display, filtering, and status colors.

**Acceptance Scenarios**:

1. **Given** a clinic with appointments, **When** the staff navigates to the agenda page, **Then** a 7-day calendar grid is shown starting from Monday, with appointments as color-coded cards.
2. **Given** multiple professionals, **When** the staff selects a professional filter, **Then** only that professional's appointments are shown.
3. **Given** appointment cards on the calendar, **When** the staff clicks a card, **Then** the appointment detail view opens with full information.

---

### User Story 3 - Manage Appointment Status (Priority: P1)

A clinic staff member transitions an appointment through the 7-state workflow: pending → awaiting_confirmation → confirmed → confirmed_presence → completed.

**Why this priority**: Status tracking is how clinics monitor their daily operations and track no-shows.

**Independent Test**: Can be tested by changing appointment status through each valid transition and verifying the status history.

**Acceptance Scenarios**:

1. **Given** a `pending` appointment, **When** the staff clicks "Confirm", **Then** the status changes to `confirmed` and the status history is updated.
2. **Given** a `confirmed` appointment, **When** the patient arrives and staff clicks "Mark Present", **Then** the status changes to `confirmed_presence`.
3. **Given** a `confirmed_presence` appointment, **When** the staff clicks "Complete", **Then** the status changes to `completed`.
4. **Given** any non-terminal appointment, **When** the staff clicks "Cancel", **Then** a confirmation dialog appears asking for a reason. On confirm, the status changes to `cancelled`.
5. **Given** an invalid transition (e.g., `completed` → `pending`), **When** attempted, **Then** the system blocks it with an error message.

---

### User Story 4 - Time Blocking (Priority: P2)

A clinic staff member can block time slots for breaks, meetings, or vacations, preventing appointments from being booked during those times.

**Why this priority**: Time blocking is needed to prevent overbooking and manage professional availability.

**Independent Test**: Can be tested by creating a time block and verifying that new appointments cannot be created during that time.

**Acceptance Scenarios**:

1. **Given** the calendar view, **When** the staff creates a time block for a professional, **Then** the blocked time appears on the calendar with a distinct visual indicator.
2. **Given** a time block exists, **When** someone tries to book an appointment during that time, **Then** the system prevents it.
3. **Given** a time block, **When** the staff deletes it, **Then** the time slot becomes available again.

---

### User Story 5 - Reschedule Appointment (Priority: P2)

A clinic staff member reschedules an existing appointment to a new date/time.

**Why this priority**: Rescheduling is a common daily operation that avoids cancellation/rebooking.

**Independent Test**: Can be tested by rescheduling an appointment and verifying the old slot is freed and the new slot is occupied.

**Acceptance Scenarios**:

1. **Given** an existing appointment, **When** the staff clicks "Reschedule", **Then** a date/time picker appears.
2. **Given** a new date/time selected, **When** confirmed, **Then** the appointment is moved, the old slot is freed, status history records the change.
3. **Given** a conflicting time slot, **When** selected for reschedule, **Then** a warning is shown.

---

### Edge Cases

- What happens when an appointment is created via WhatsApp and also appears on the dashboard? (Single source of truth in Firestore, `source` field tracks origin)
- What happens when a professional's working hours change after appointments are booked? (Existing appointments stay, new ones follow updated hours)
- What about same-day cancellations? (Allowed, but deposit may be forfeited per clinic policy)
- What happens if the deposit is paid but the appointment is cancelled? (Track `depositPaid` status, refund is handled outside the system)

## Requirements

### Functional Requirements

- **FR-001**: System MUST support a 7-state appointment workflow: pending, awaiting_confirmation, confirmed, confirmed_presence, completed, cancelled, no_show
- **FR-002**: System MUST validate status transitions (e.g., `completed` cannot go back to `pending`)
- **FR-003**: System MUST track status change history with timestamp, user, and reason
- **FR-004**: System MUST display a 7-day calendar grid starting from Monday
- **FR-005**: System MUST support filtering appointments by professional
- **FR-006**: System MUST color-code appointments by status
- **FR-007**: System MUST support creating appointments from both dashboard and WhatsApp (via `source` field)
- **FR-008**: System MUST calculate deposit amount based on service price and deposit percentage
- **FR-009**: System MUST track deposit payment status (`depositPaid`, `depositPaidAt`)
- **FR-010**: System MUST track reminder delivery (`reminder24hSent`, `reminder2hSent`)
- **FR-011**: System MUST support time blocking per professional (vacation, break, meeting)
- **FR-012**: System MUST prevent appointment creation during time blocks
- **FR-013**: System MUST support rescheduling with availability validation
- **FR-014**: System MUST denormalize patient name/phone and service name/price for fast reads

### Key Entities

- **Appointment**: Patient, professional, service, date/time, status, deposit, reminders, source, notes, status history
- **TimeBlock**: Professional, type (vacation/break/meeting), date range, time range, recurring flag

## Success Criteria

### Measurable Outcomes

- **SC-001**: Appointment creation from dashboard < 30 seconds
- **SC-002**: Calendar load time < 500ms
- **SC-003**: Status update success rate > 99%
- **SC-004**: Zero invalid status transitions in production
- **SC-005**: Time block enforcement: 100% of overlapping bookings prevented
