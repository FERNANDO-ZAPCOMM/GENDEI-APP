# Feature Specification: WhatsApp Flows

**Feature Branch**: `013-whatsapp-flows`
**Created**: 2026-02-04
**Status**: Implemented

## User Scenarios & Testing

### User Story 1 - Booking Flow (Priority: P1)

A patient interacts with a structured WhatsApp Flow to book an appointment: selecting a service, professional, date, and time slot — all within the WhatsApp chat interface.

**Why this priority**: Booking via structured flows provides a guided, error-free experience that reduces friction compared to free-form text.

**Independent Test**: Trigger booking flow → select service → select professional → select date → select time → confirm → verify appointment created in Firestore.

**Acceptance Scenarios**:

1. **Given** a patient in a WhatsApp conversation, **When** the AI triggers the booking flow, **Then** a structured form appears with available services.
2. **Given** the service selection screen, **When** the patient selects a service, **Then** available professionals for that service are shown.
3. **Given** a professional selected, **When** the date screen loads, **Then** only dates with available slots are shown (up to `maxDaysAhead` days).
4. **Given** a date selected, **When** the time screen loads, **Then** only available time slots are shown (real-time availability check).
5. **Given** all selections confirmed, **When** the flow completes, **Then** an appointment is created and the patient receives a confirmation message.

---

### User Story 2 - Patient Registration Flow (Priority: P1)

A new patient completes an intake form within WhatsApp to register their information: name, phone, birthday, CPF, and address.

**Why this priority**: Patient registration is a prerequisite for booking — new patients need to be registered before their first appointment.

**Independent Test**: Trigger registration flow → fill all fields → submit → verify patient document created in Firestore.

**Acceptance Scenarios**:

1. **Given** a new patient without a profile, **When** the registration flow is triggered, **Then** a multi-screen form collects name, phone, birthday, CPF, and address.
2. **Given** all fields filled, **When** the flow completes, **Then** a patient document is created in `gendei_patients` with the submitted data.
3. **Given** an existing patient, **When** the flow is triggered, **Then** fields are pre-filled with known data.

---

### User Story 3 - Post-Appointment Satisfaction Survey (Priority: P2)

After a completed appointment, the patient receives a satisfaction survey via WhatsApp Flow to rate their experience and provide feedback.

**Why this priority**: Satisfaction data helps clinics improve but is not critical to core operations.

**Independent Test**: Complete appointment → verify survey sent after configured delay → submit rating → verify analytics updated.

**Acceptance Scenarios**:

1. **Given** a completed appointment, **When** `sendAfterHours` elapses, **Then** a satisfaction survey flow is sent to the patient.
2. **Given** the survey flow, **When** the patient submits a rating and feedback, **Then** the response is stored and analytics are updated.
3. **Given** a 5-star scale, **When** the patient rates 1-2, **Then** a follow-up question asks for improvement suggestions.

---

### User Story 4 - Reschedule/Cancellation Flow (Priority: P2)

A patient can reschedule or cancel an existing appointment through a structured WhatsApp Flow.

**Why this priority**: Self-service rescheduling reduces staff workload but is less critical than booking.

**Independent Test**: Trigger reschedule flow → see current appointment → select new date/time → confirm → verify appointment updated.

**Acceptance Scenarios**:

1. **Given** an existing appointment, **When** the reschedule flow is triggered, **Then** the current appointment details are shown.
2. **Given** the reschedule screen, **When** the patient selects a new date and time, **Then** availability is checked in real-time.
3. **Given** a confirmed reschedule, **When** the flow completes, **Then** the appointment is updated and the clinic is notified.

---

### User Story 5 - Pre-Appointment Intake Flow (Priority: P3)

Before an appointment, the patient completes a medical intake form with symptoms, medications, and allergies.

**Why this priority**: Intake forms improve appointment preparation but are optional.

**Independent Test**: Send intake flow before appointment → patient fills symptoms/medications → verify data stored on appointment.

**Acceptance Scenarios**:

1. **Given** an upcoming appointment, **When** the intake flow is sent, **Then** the patient sees forms for symptoms, current medications, and allergies.
2. **Given** a completed intake, **When** the flow completes, **Then** intake data is stored on the appointment document for the professional to review.

---

### Edge Cases

- What if the flow token expires? (Show "session expired" message and offer to restart)
- What if available slots change during flow? (Real-time availability check on final confirmation screen)
- What about abandoned flows? (Track abandonment per screen; timeout after 30 minutes)
- What about concurrent bookings for the same slot? (Validate availability on completion; show conflict error if taken)
- What if the patient closes WhatsApp mid-flow? (Resume capability within 30-minute window)

## Requirements

### Functional Requirements

- **FR-001**: System MUST support structured booking flows within WhatsApp using WhatsApp Flows API
- **FR-002**: System MUST provide real-time availability data within flow screens
- **FR-003**: System MUST support patient registration flows with multi-screen data collection
- **FR-004**: System MUST support post-appointment satisfaction surveys with configurable rating scales
- **FR-005**: System MUST support reschedule/cancellation flows with real-time slot checking
- **FR-006**: System MUST support pre-appointment intake forms (symptoms, medications, allergies)
- **FR-007**: System MUST encrypt flow tokens with session data (clinicId, patientId, flowType)
- **FR-008**: System MUST track flow completion rates and screen-level abandonment analytics
- **FR-009**: System MUST prevent double-booking via availability validation on flow completion
- **FR-010**: System MUST support prefilling flow fields with known patient data

### Key Entities

- **Flow**: Clinic ID, WhatsApp Flow ID, type, name, status (draft/published/deprecated), config, completion stats
- **FlowResponse**: Clinic ID, flow ID, patient info, session ID, encrypted token, responses, screen progress, status, related entities
- **FlowAnalytics**: Monthly stats per clinic — overall completion rates, per-type stats, screen-level drop-off, satisfaction scores

## Success Criteria

### Measurable Outcomes

- **SC-001**: Flow completion rate > 75%
- **SC-002**: Average flow completion time < 3 minutes
- **SC-003**: Zero double-bookings from flow submissions
- **SC-004**: Flow data latency < 2 seconds per screen
- **SC-005**: Abandonment tracking at screen-level granularity
