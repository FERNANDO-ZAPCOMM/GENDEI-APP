# Feature Specification: Reminder System

**Feature Branch**: `010-reminder-system`
**Created**: 2026-02-04
**Updated**: 2026-02-15
**Status**: Implemented

## User Scenarios & Testing

### User Story 1 - Automated 24h Appointment Reminder (Priority: P1)

The system automatically sends a reminder 24 hours before each confirmed appointment via WhatsApp, with vertical-aware terminology.

**Why this priority**: The 24h reminder is the primary no-show reduction mechanism. It also transitions the appointment to `awaiting_confirmation` status so the patient can confirm.

**Independent Test**: Create confirmed appointment for tomorrow at 14:00 -> Cloud Scheduler triggers -> verify WhatsApp message sent with patient name, professional, date/time, clinic address -> verify `reminder24hSent` flag set to `true` and status changed to `awaiting_confirmation`.

**Acceptance Scenarios**:

1. **Given** a confirmed appointment scheduled for tomorrow at 14:00, **When** the scheduler runs and the appointment falls in the 23-25h window, **Then** a personalized reminder is sent via WhatsApp with vertical-aware terminology and the status changes to `awaiting_confirmation`.
2. **Given** a confirmed appointment that already has `reminder24hSent: true`, **When** the scheduler runs, **Then** no duplicate reminder is sent.
3. **Given** a cancelled appointment, **When** the scheduler runs, **Then** the appointment is skipped (only `confirmed` and `confirmed_presence` statuses trigger reminders).

---

### User Story 2 - Automated 2h Appointment Reminder (Priority: P1)

The system sends a final reminder 2 hours before each confirmed appointment, encouraging the patient to arrive on time.

**Why this priority**: The 2h reminder serves as a final nudge and includes an arrival tip for applicable verticals.

**Independent Test**: Create confirmed appointment for 2 hours from now -> scheduler triggers -> verify WhatsApp message sent with "daqui a 2 horas" and optional arrive-early tip -> verify `reminder2hSent` flag set to `true`.

**Acceptance Scenarios**:

1. **Given** a confirmed appointment in 2 hours, **When** the scheduler runs, **Then** a final reminder is sent with the appointment time and optional arrival tip.
2. **Given** a `psi` (psychology) vertical clinic, **When** the 2h reminder is sent, **Then** the message uses "sessao" instead of "consulta" and does not include the arrive-early tip.
3. **Given** a `dental` vertical clinic, **When** the 2h reminder is sent, **Then** the message uses the tooth emoji and includes the arrive-early tip.

---

### User Story 3 - Manual Reminder Trigger (Priority: P2)

Administrators can manually send a specific reminder for a single appointment, useful for testing or re-sending.

**Independent Test**: Call `POST /reminders/send/:appointmentId` with `type: "24h"` -> verify reminder sent and flags updated.

**Acceptance Scenarios**:

1. **Given** a valid appointment ID, **When** the manual send endpoint is called with type `24h`, **Then** the reminder is sent and the appointment flags are updated.
2. **Given** an invalid appointment ID, **When** the manual send endpoint is called, **Then** a 404 error is returned.

---

### Edge Cases

- What if the clinic is not connected to WhatsApp? (Reminder is silently skipped with a log message)
- What if the clinic has no access token? (Reminder is silently skipped with a log message)
- What about duplicate reminders? (Deduplicated by `reminder24hSent`/`reminder2hSent` boolean flags on the appointment)
- What if the appointment is rescheduled? (The boolean flags reset, allowing new reminders to be sent)
- What about different verticals? (`getVerticalTerms()` returns vertical-specific appointment term, emoji, and arrival tip config)
- What if the WhatsApp Agent is unreachable? (Error is thrown, logged, and counted in the result)

## Requirements

### Functional Requirements

- **FR-001**: System MUST send 24h reminders for confirmed appointments in the 23-25 hour window
- **FR-002**: System MUST send 2h reminders for confirmed appointments in the 1.5-2.5 hour window
- **FR-003**: System MUST only send reminders for `confirmed` or `confirmed_presence` status appointments
- **FR-004**: System MUST prevent duplicate sends using boolean flags (`reminder24hSent`, `reminder2hSent`) on appointment documents
- **FR-005**: System MUST use vertical-aware terminology (appointment term, professional emoji, arrive-early tip)
- **FR-006**: System MUST update appointment status to `awaiting_confirmation` after sending the 24h reminder
- **FR-007**: System MUST send reminders via the WhatsApp Agent service at `/api/send-reminder`
- **FR-008**: System MUST support manual single-reminder sending via `POST /reminders/send/:appointmentId`
- **FR-009**: System MUST return a summary result (sent24h, sent2h, errors) from each scheduler run

### Key Entities

- **Appointment flags**: `reminder24hSent`, `reminder24hAt`, `reminder2hSent`, `reminder2hAt` on existing `gendei_appointments` documents
- **VerticalTerms**: `appointmentTerm`, `professionalEmoji`, `showArriveEarlyTip` per vertical
- **ReminderResult**: `sent24h`, `sent2h`, `errors` returned from each run

## Success Criteria

### Measurable Outcomes

- **SC-001**: Reminders sent within 15-minute scheduler window
- **SC-002**: Zero duplicate reminder sends (guaranteed by boolean flags)
- **SC-003**: Vertical-correct terminology in all messages
- **SC-004**: 24h reminder transitions appointment to `awaiting_confirmation`
