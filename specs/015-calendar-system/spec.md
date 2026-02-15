# Feature Specification: Calendar System

**Feature Branch**: `015-calendar-system`
**Created**: 2026-02-04
**Updated**: 2026-02-16
**Status**: Partially Implemented

## User Scenarios & Testing

### User Story 1 - Weekly Calendar View (Priority: P1) — Implemented

A clinic staff member views a 7-day calendar grid showing appointments with the ability to navigate between weeks and filter by professional.

**Why this priority**: The calendar is the primary visual interface for managing daily clinic operations.

**Independent Test**: Open calendar → verify 7-day grid displays → navigate weeks → filter by professional.

**Acceptance Scenarios**:

1. **Given** the calendar page, **When** the staff opens it, **Then** a 7-day calendar grid is shown starting from Monday with all appointments for the clinic.
2. **Given** the date navigator, **When** the staff clicks "Next"/"Previous", **Then** the calendar navigates forward/backward by week.
3. **Given** the professional filter, **When** the staff selects a professional, **Then** only their appointments are shown.

---

### User Story 2 - Appointment Creation from Calendar (Priority: P1) — Implemented

A clinic staff member creates an appointment directly from the calendar by selecting a date, time, patient, professional, and service.

**Why this priority**: Quick creation from the calendar eliminates context-switching and speeds up scheduling.

**Independent Test**: Click "New Appointment" → fill form → save → verify appointment appears on calendar.

**Acceptance Scenarios**:

1. **Given** the calendar view, **When** the staff clicks "New Appointment", **Then** a form opens with professional, date, time, patient, and service fields.
2. **Given** a valid form, **When** the staff saves, **Then** the appointment appears on the calendar in real-time without page reload.

---

### User Story 3 - Appointment Status Management (Priority: P1) — Implemented

A clinic staff member clicks on an appointment to view details and update its status through the workflow.

**Why this priority**: Status tracking is essential for daily clinic operations.

**Independent Test**: Click appointment → verify details shown → change status → verify update reflected on calendar.

**Acceptance Scenarios**:

1. **Given** an appointment on the calendar, **When** the staff clicks it, **Then** appointment details are shown: patient name/phone, service, professional, status, and notes.
2. **Given** the appointment detail, **When** the staff changes the status (confirm, mark completed, mark no-show), **Then** the appointment updates and the calendar reflects the new status color.

---

### User Story 4 - Multi-View Calendar (Priority: P2) — Planned

A clinic staff member switches between Day, Week, Month, and Agenda views.

**Acceptance Scenarios**:

1. **Given** the view selector, **When** the staff switches to "Day", **Then** hourly time slots are shown with appointments positioned by start time and duration.
2. **Given** the view selector, **When** the staff switches to "Month", **Then** a full month grid is shown with appointment counts per day.
3. **Given** the view selector, **When** the staff switches to "Agenda", **Then** a mobile-friendly list view shows upcoming appointments chronologically.

---

### User Story 5 - Drag-and-Drop Rescheduling (Priority: P2) — Planned

A clinic staff member drags an appointment to a new time slot or different professional column to reschedule it.

**Acceptance Scenarios**:

1. **Given** an appointment on the calendar, **When** the staff drags it to a new time slot, **Then** the appointment's start and end time update accordingly.
2. **Given** a drag operation, **When** the staff drops on a different professional's column, **Then** the appointment's professional is updated.
3. **Given** a conflict detected on drop, **When** the time slot is occupied, **Then** a conflict warning is shown and the drag is reverted.

---

### User Story 6 - Working Hours Overlay (Priority: P3) — Planned

The calendar shows working hours overlaid to distinguish available vs. unavailable times.

**Acceptance Scenarios**:

1. **Given** the calendar view, **When** working hours are configured, **Then** non-working hours are visually dimmed/grayed out.

---

### Edge Cases

- What about overlapping appointments? (Show side-by-side in the same time slot)
- What if a professional has no working hours configured? (Default to clinic hours; show warning)
- What about timezone handling? (All times displayed in clinic's timezone)
- What about mobile usage? (Agenda view planned as default on mobile; drag-and-drop disabled on touch devices)

## Requirements

### Functional Requirements (Implemented)

- **FR-001**: System MUST display a 7-day calendar grid starting from Monday
- **FR-002**: System MUST support appointment creation with patient, professional, service, date, and time
- **FR-003**: System MUST support professional filtering
- **FR-004**: System MUST color-code appointments by status
- **FR-005**: System MUST support appointment detail view with status management
- **FR-006**: System MUST update in real-time via Firestore onSnapshot listeners

### Functional Requirements (Planned — Not Yet Implemented)

- **FR-P01**: System SHOULD display calendar in Day, Month, and Agenda views (in addition to Week)
- **FR-P02**: System SHOULD support drag-and-drop rescheduling with conflict detection
- **FR-P03**: System SHOULD display working hours overlay per professional
- **FR-P04**: System SHOULD support configurable settings: default view, week start day, slot duration (15/30/60 min), show weekends
- **FR-P05**: System SHOULD support quick appointment creation from clicking empty time slots
- **FR-P06**: System SHOULD color-code appointments by professional (in addition to status)

### Key Entities

- **CalendarEvent**: View model transformed from Appointment — includes title, start/end, status color, patient info, service info
- **TimeBlock**: Working hours per professional per day — start/end times, is-working flag (used for availability checks)

## Success Criteria

### Measurable Outcomes

- **SC-001**: Calendar render time < 500ms
- **SC-002**: Real-time sync < 1 second
- **SC-003**: Appointment creation from calendar < 30 seconds
