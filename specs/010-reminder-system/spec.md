# Feature Specification: Reminder System

**Feature Branch**: `010-reminder-system`
**Created**: 2026-02-04
**Status**: Implemented

## User Scenarios & Testing

### User Story 1 - Automated 24h and 2h Appointment Reminders (Priority: P1)

The system automatically sends reminders at 24 hours and 2 hours before each appointment via WhatsApp, reducing no-shows.

**Why this priority**: Automated reminders are the primary mechanism for reducing no-shows and improving appointment attendance.

**Independent Test**: Create appointment → verify 24h reminder scheduled → wait for trigger → verify WhatsApp message sent with correct content.

**Acceptance Scenarios**:

1. **Given** an appointment scheduled for tomorrow at 10:00, **When** the scheduler runs, **Then** a reminder is sent 24 hours before with patient name, service, professional, date, and time.
2. **Given** an appointment in 2 hours, **When** the scheduler runs, **Then** a final reminder is sent with appointment details and location.
3. **Given** a cancelled appointment, **When** the reminder is due, **Then** the reminder is skipped and status set to `skipped`.
4. **Given** quiet hours enabled (22:00-08:00), **When** a reminder is scheduled during quiet hours, **Then** it is deferred to the next available time (08:00).

---

### User Story 2 - Confirmation Requests (Priority: P1)

After an appointment is created, the system sends a confirmation request to the patient via WhatsApp, allowing them to confirm or reschedule.

**Why this priority**: Confirmation requests close the loop on appointment booking and give patients a chance to respond early.

**Independent Test**: Create appointment → verify confirmation message sent immediately → patient responds → verify appointment status updated.

**Acceptance Scenarios**:

1. **Given** a new appointment is created, **When** `confirmationReminder.enabled` is true, **Then** a confirmation message is sent immediately via WhatsApp.
2. **Given** a confirmation sent, **When** the patient responds with confirmation, **Then** the appointment status updates to `confirmed`.

---

### User Story 3 - No-Show Follow-ups (Priority: P2)

After a patient misses an appointment (no-show), the system sends a re-engagement message encouraging them to reschedule.

**Why this priority**: Re-engaging no-show patients recovers lost revenue and maintains patient relationships.

**Independent Test**: Mark appointment as no-show → verify follow-up message sent 24h later → verify message contains reschedule option.

**Acceptance Scenarios**:

1. **Given** an appointment marked as `no_show`, **When** `noShowFollowup.hoursAfter` elapses (default 24h), **Then** a re-engagement message is sent.
2. **Given** a no-show follow-up sent, **When** the patient responds, **Then** the conversation is routed to the scheduling agent.

---

### User Story 4 - Birthday and Follow-up Reminders (Priority: P3)

The system sends automated birthday messages and post-visit follow-up reminders to improve patient engagement and retention.

**Why this priority**: Engagement reminders are nice-to-have features that improve patient loyalty but are not critical.

**Independent Test**: Set patient birthday → verify birthday message sent at configured time → verify follow-up sent X days after visit.

**Acceptance Scenarios**:

1. **Given** a patient with a birthday today, **When** `birthdayReminder.enabled` is true, **Then** a birthday message is sent at the configured time (e.g., 09:00).
2. **Given** a completed appointment, **When** `followUp.daysAfter` elapses, **Then** a satisfaction/return reminder is sent.

---

### User Story 5 - Configurable Reminder Settings and Templates (Priority: P2)

Clinic owners can configure which reminders are active, customize timing, and edit message templates with variable substitution.

**Why this priority**: Configurability allows clinics to tailor reminders to their workflow without code changes.

**Independent Test**: Open reminder settings → toggle reminders on/off → edit template → save → verify new template used in next reminder.

**Acceptance Scenarios**:

1. **Given** the reminder settings page, **When** the owner toggles `reminder24h.enabled` off, **Then** 24h reminders stop being scheduled.
2. **Given** a reminder template, **When** the owner edits it with `{patientName}` and `{appointmentDate}`, **Then** sent messages substitute the actual values.
3. **Given** multiple template types, **When** the owner assigns a custom template to `reminder_2h`, **Then** that template is used for all 2h reminders.

---

### Edge Cases

- What if a reminder fails to send? (Retry up to 3 times with exponential backoff; mark as `failed` after max attempts)
- What about duplicate reminders? (Deduplicate by appointmentId + type — never send the same reminder twice)
- What if the appointment is rescheduled after a reminder is scheduled? (Cancel existing reminders and create new ones)
- What about timezone differences? (All scheduling respects `America/Sao_Paulo` timezone by default, configurable per clinic)
- What if quiet hours span midnight? (Handle wrap-around: 22:00-08:00 means no sends after 22:00 or before 08:00)

## Requirements

### Functional Requirements

- **FR-001**: System MUST send automated reminders at configurable intervals before appointments (default: 24h, 2h)
- **FR-002**: System MUST support confirmation requests sent immediately after appointment creation
- **FR-003**: System MUST support no-show follow-up messages after missed appointments
- **FR-004**: System MUST support birthday and post-visit follow-up reminders
- **FR-005**: System MUST respect quiet hours (default 22:00-08:00) and defer reminders accordingly
- **FR-006**: System MUST retry failed sends up to 3 times with exponential backoff
- **FR-007**: System MUST track delivery status (sent/delivered/read/failed) via WhatsApp webhooks
- **FR-008**: System MUST support customizable message templates with variable substitution ({patientName}, {date}, {time}, {professionalName}, {serviceName})
- **FR-009**: System MUST prevent duplicate reminders for the same appointment and type
- **FR-010**: System MUST cancel pending reminders when appointments are cancelled or rescheduled
- **FR-011**: System MUST aggregate delivery analytics per clinic per month

### Key Entities

- **Reminder**: Clinic ID, appointment ID, patient info, type, scheduled time, status, attempts, delivery status, template reference
- **ReminderTemplate**: Type, name, content with placeholders, active flag, default flag
- **ReminderSettings**: Per-clinic configuration for each reminder type (enabled, timing, template)
- **ReminderAnalytics**: Monthly aggregated delivery stats by type, engagement metrics, error counts

## Success Criteria

### Measurable Outcomes

- **SC-001**: Reminder delivery rate > 95%
- **SC-002**: Processing latency < 30 seconds from scheduled time
- **SC-003**: Zero duplicate reminder sends
- **SC-004**: Reminder configuration time < 2 minutes
- **SC-005**: No-show rate reduction measurable via analytics
