# Feature Specification: Calendar System

**Feature Branch**: `015-calendar-system`
**Created**: 2026-02-04
**Status**: Implemented

## User Scenarios & Testing

### User Story 1 - Multi-View Calendar (Priority: P1)

A clinic staff member views appointments in Day, Week, Month, or Agenda views, with the ability to navigate between dates and see appointments color-coded by professional.

**Why this priority**: The calendar is the primary visual interface for managing daily clinic operations.

**Independent Test**: Open calendar → switch between Day/Week/Month/Agenda views → verify appointments render correctly → navigate dates → verify data updates.

**Acceptance Scenarios**:

1. **Given** the calendar page, **When** the staff opens it, **Then** the current week view is shown by default with all appointments for the clinic.
2. **Given** the view selector, **When** the staff switches to "Day", **Then** hourly time slots are shown with appointments positioned by start time and duration.
3. **Given** the view selector, **When** the staff switches to "Month", **Then** a full month grid is shown with appointment counts per day.
4. **Given** the view selector, **When** the staff switches to "Agenda", **Then** a mobile-friendly list view shows upcoming appointments chronologically.
5. **Given** the date navigator, **When** the staff clicks "Next"/"Previous", **Then** the calendar navigates forward/backward by the current view unit (day/week/month).

---

### User Story 2 - Quick Appointment Creation (Priority: P1)

A clinic staff member clicks on an empty time slot to create a new appointment with the professional, date, and time pre-filled.

**Why this priority**: Quick creation from the calendar eliminates context-switching and speeds up scheduling.

**Independent Test**: Click empty slot → verify form opens with pre-filled professional, date, time → select patient and service → save → verify appointment appears on calendar.

**Acceptance Scenarios**:

1. **Given** the Day or Week view, **When** the staff clicks an empty time slot, **Then** a quick appointment form opens with the professional, date, and start time pre-filled.
2. **Given** the quick form, **When** the staff selects a service, **Then** the end time auto-calculates based on service duration.
3. **Given** a valid form, **When** the staff saves, **Then** the appointment appears on the calendar in real-time without page reload.

---

### User Story 3 - Drag-and-Drop Rescheduling (Priority: P1)

A clinic staff member drags an appointment to a new time slot or different professional column to reschedule it.

**Why this priority**: Drag-and-drop is the most intuitive way to reschedule and is expected in modern calendar UIs.

**Independent Test**: Drag appointment to new time → verify time updates → drag to different professional → verify professional changes → verify patient notified.

**Acceptance Scenarios**:

1. **Given** an appointment on the calendar, **When** the staff drags it to a new time slot, **Then** the appointment's start and end time update accordingly.
2. **Given** a drag operation, **When** the staff drops on a different professional's column, **Then** the appointment's professional is updated.
3. **Given** a completed drag, **When** the appointment is dropped, **Then** availability is validated and the patient is optionally notified of the change.
4. **Given** a conflict detected on drop, **When** the time slot is occupied, **Then** a conflict warning is shown and the drag is reverted.

---

### User Story 4 - Professional Filtering and Working Hours (Priority: P2)

A clinic staff member filters the calendar by professional and/or service, and sees working hours overlaid on the calendar to distinguish available vs. unavailable times.

**Why this priority**: Filtering and working hours improve usability for clinics with multiple professionals.

**Independent Test**: Select professional filter → verify only their appointments shown → verify working hours overlay matches configuration.

**Acceptance Scenarios**:

1. **Given** the professional filter, **When** the staff selects specific professionals, **Then** only their appointments and time columns are shown.
2. **Given** the calendar view, **When** working hours are configured, **Then** non-working hours are visually dimmed/grayed out.
3. **Given** the filter panel, **When** the staff toggles "Show cancelled", **Then** cancelled appointments appear with a distinct visual style.

---

### User Story 5 - Appointment Detail and Status Management (Priority: P2)

A clinic staff member clicks on an appointment to view full details, update status, add notes, or manage deposit information.

**Why this priority**: Viewing and managing individual appointments is essential but secondary to the calendar view itself.

**Independent Test**: Click appointment → verify details modal shows all info → change status → verify update → add note → verify saved.

**Acceptance Scenarios**:

1. **Given** an appointment on the calendar, **When** the staff clicks it, **Then** a detail modal shows: patient name/phone, service, professional, status, deposit info, notes, and source.
2. **Given** the detail modal, **When** the staff changes the status (e.g., confirm, mark completed, mark no-show), **Then** the appointment updates and the calendar reflects the new status color.
3. **Given** the detail modal, **When** the staff adds a note, **Then** the note is saved on the appointment document.

---

### Edge Cases

- What about overlapping appointments? (Show side-by-side in the same time slot; configurable `allowOverlapping` setting)
- What about very long appointments? (Appointments spanning multiple hours render as tall blocks in day/week view)
- What if a professional has no working hours configured? (Default to clinic hours; show warning)
- What about timezone handling? (All times displayed in clinic's timezone)
- What about mobile usage? (Agenda view is the default on mobile; drag-and-drop disabled on touch devices)

## Requirements

### Functional Requirements

- **FR-001**: System MUST display calendar in Day, Week, Month, and Agenda views
- **FR-002**: System MUST support quick appointment creation from empty time slots
- **FR-003**: System MUST support drag-and-drop rescheduling with conflict detection
- **FR-004**: System MUST support professional filtering with multi-select
- **FR-005**: System MUST display working hours overlay per professional
- **FR-006**: System MUST update in real-time via Firestore onSnapshot listeners (< 1 second)
- **FR-007**: System MUST render calendar in < 500ms
- **FR-008**: System MUST support appointment detail modal with status management
- **FR-009**: System MUST color-code appointments by professional
- **FR-010**: System MUST support configurable settings: default view, week start day, slot duration (15/30/60 min), show weekends
- **FR-011**: System MUST prevent double-booking via availability validation on create and reschedule
- **FR-012**: System MUST support drag-and-drop response time < 100ms

### Key Entities

- **CalendarEvent**: View model transformed from Appointment — includes title, start/end, professional color, status color, patient info, service info, UI state (selected, dragging, conflict)
- **CalendarViewState**: Zustand store — current view, date, selected professionals/services, drag state, create slot
- **TimeBlock**: Working hours per professional per day — start/end times, is-working flag
- **CalendarConfiguration**: Clinic settings — default view, slot duration, calendar hours, show weekends, allow overlapping
- **QuickAppointmentInput**: Professional, start time, duration, service, patient reference
- **RescheduleInput**: Appointment ID, new start/end, optional new professional, notify patient flag

## Success Criteria

### Measurable Outcomes

- **SC-001**: Calendar render time < 500ms
- **SC-002**: Drag-and-drop response < 100ms
- **SC-003**: Real-time sync < 1 second
- **SC-004**: Zero double-booking incidents
- **SC-005**: Quick appointment creation < 30 seconds
