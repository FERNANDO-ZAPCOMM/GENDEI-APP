# Feature Specification: WhatsApp Flows

**Feature Branch**: `013-whatsapp-flows`
**Created**: 2026-02-04
**Updated**: 2026-02-16
**Status**: In Progress

## Architecture Overview

The booking system uses a **two-flow architecture** with **text-based patient info collection**:

1. **Patient Info Flow** (WhatsApp Flow): Structured screens for selecting professional, payment type, and convenio info
2. **Patient Identification** (Free-text chat): Collects or confirms patient name and email via conversational messages
3. **Booking Flow** (WhatsApp Flow): Date picker and time slot selection

### Flow Variants

Three Patient Info Flow variants are deployed based on clinic payment settings:

| Variant | File | Screens | When Used |
|---------|------|---------|-----------|
| Particular-only | `patient_info_particular_flow.json` | ESPECIALIDADE → complete | Clinic accepts only particular |
| Convenio-only | `patient_info_convenio_flow.json` | ESPECIALIDADE → INFO_CONVENIO → complete | Clinic accepts only convenio |
| Both modes | `patient_info_flow.json` | ESPECIALIDADE → TIPO_ATENDIMENTO → INFO_CONVENIO → complete | Clinic accepts both |

### Booking Flow

Single variant (`booking_flow.json`): BOOKING screen with DatePicker + time Dropdown → complete

## User Scenarios & Testing

### User Story 1 - Booking Flow with Known Patient (Priority: P1)

A returning patient (who has previously booked or been registered) selects a professional via the WhatsApp Flow, confirms their identity, and picks a date/time.

**Why this priority**: Most bookings come from returning patients. Skipping data entry reduces friction.

**Independent Test**: Trigger booking flow → select professional → confirm identity → select date → select time → verify appointment created in Firestore.

**Acceptance Scenarios**:

1. **Given** a returning patient with known name and email, **When** the Patient Info Flow completes, **Then** the system sends a confirmation message: "Agendamento para [Nome] ([email])? Confirme para continuar." with Yes/No buttons.
2. **Given** the patient confirms their identity (clicks "Sim"), **When** the confirmation is received, **Then** the system proceeds directly to send the Booking Flow.
3. **Given** the patient clicks "Não" (not me), **When** the rejection is received, **Then** the system asks for name and email via free-text messages.

---

### User Story 2 - Booking Flow with New Patient (Priority: P1)

A new patient (no prior record) selects a professional via the WhatsApp Flow, then provides their name and email via free-text chat messages before picking a date/time.

**Why this priority**: New patients must provide their info to book, but collecting it via chat is more natural than form fields inside a flow.

**Independent Test**: Trigger booking flow → select professional → provide name via text → provide email via text → select date → select time → verify appointment created with patient data.

**Acceptance Scenarios**:

1. **Given** a new patient with no stored name/email, **When** the Patient Info Flow completes, **Then** the system asks "Qual é o seu nome completo?" via a text message.
2. **Given** the patient sends their name, **When** the message is received, **Then** the name is stored and the system asks "Qual é o seu e-mail?" via a text message.
3. **Given** the patient sends their email, **When** the message is received, **Then** the email is stored and the Booking Flow is sent immediately.
4. **Given** the patient sends an invalid email format, **When** the message is received, **Then** the system asks again with a helpful message.

---

### User Story 3 - Payment Type Selection (Priority: P1)

Before entering the flow, clinics that accept both particular and convenio payment types prompt the patient to choose, which determines which flow variant is sent.

**Why this priority**: Payment type determines the flow variant and affects convenio data collection.

**Acceptance Scenarios**:

1. **Given** a clinic that accepts both payment types, **When** the patient requests scheduling, **Then** buttons are shown: "Convênio" and "Particular".
2. **Given** a clinic that only accepts particular, **When** the patient requests scheduling, **Then** the particular flow is sent directly (no buttons).
3. **Given** a clinic that only accepts convenio, **When** the patient requests scheduling, **Then** the convenio flow is sent directly (no buttons).

---

### User Story 4 - Date and Time Selection (Priority: P1)

After patient info is confirmed/collected, the Booking Flow presents available dates and time slots for the selected professional.

**Why this priority**: Date/time selection is the final step before appointment creation.

**Acceptance Scenarios**:

1. **Given** the Booking Flow is sent, **When** it loads, **Then** it shows the professional name, a DatePicker (next 30 days), and available time slots.
2. **Given** the patient selects a date and time, **When** the flow completes, **Then** availability is validated server-side before creating the appointment.
3. **Given** the selected time is no longer available, **When** validation fails, **Then** an error message is shown within the flow asking to pick another time.

---

### Edge Cases

- What if the flow token expires? (Show "session expired" message and offer to restart)
- What if available slots change during flow? (Real-time availability check on booking flow completion)
- What about concurrent bookings for the same slot? (Validate availability on completion; show conflict error if taken)
- What if the patient sends a non-name response when asked for name? (Accept any text as name — no strict validation)
- What if the patient sends a non-email response when asked for email? (Basic email format validation, ask again if invalid)
- What if the patient abandons after flow but before providing name? (Conversation state tracks `awaiting_patient_name`; next message resumes)
- What if a known patient's stored email is empty? (Ask for email even if name is known)

## Requirements

### Functional Requirements

- **FR-001**: System MUST support structured booking flows within WhatsApp using WhatsApp Flows API
- **FR-002**: System MUST provide real-time availability data within booking flow screens
- **FR-003**: Patient Info Flow MUST NOT collect name or email — these MUST be collected via free-text chat messages
- **FR-004**: System MUST detect known patients (via conversation state `waUserName` or patient DB lookup) and offer identity confirmation instead of re-collecting data
- **FR-005**: System MUST support three Patient Info Flow variants: particular-only, convenio-only, both-modes
- **FR-006**: System MUST track conversation state through the multi-step booking process: `awaiting_payment_type` → `in_patient_info_flow` → `awaiting_patient_name` → `awaiting_patient_email` → `in_booking_flow` → `idle`
- **FR-007**: System MUST validate email format before accepting patient email
- **FR-008**: System MUST prevent double-booking via availability validation on booking flow completion
- **FR-009**: System MUST support payment signal collection after appointment creation (card/PIX)
- **FR-010**: System MUST store patient name and email in conversation state for use by the Booking Flow

### Key Entities

- **ConversationState**: Current state (awaiting_payment_type, in_patient_info_flow, awaiting_patient_name, awaiting_patient_email, in_booking_flow, awaiting_payment_method, idle), professional info, patient name/email, payment type, convenio name
- **Patient Info Flow Response**: professional_id, professional_name, specialty_name, tipo_pagamento, convenio_nome (NO nome/email)
- **Booking Flow Response**: date, time, professional_id, doctor_name, patient_name, patient_email

## Implementation Details

### Flow Completion Handling (`orchestrator.py`)

When Patient Info Flow completes (has professional_id but no date/time):
1. Extract professional and payment info from flow response
2. Look up patient: check conversation state for `waUserName` and patient DB via `get_patient(phone, clinic_id)`
3. **Known patient** (has name AND email): Send confirmation buttons, store data in state, set state to `awaiting_patient_confirmation`
4. **Unknown patient** (missing name or email): Send "Qual é o seu nome completo?" message, set state to `awaiting_patient_name`

### Text-Based Collection (`processor.py`)

New state handlers in the message processor:
- `awaiting_patient_name`: Accept text as name → ask for email → set state to `awaiting_patient_email`
- `awaiting_patient_email`: Validate email format → store both → send Booking Flow → set state to `in_booking_flow`
- `awaiting_patient_confirmation`: Handle "Sim"/"Não" button responses

### Files Changed

| File | Change |
|------|--------|
| `flows/patient_info_particular_flow.json` | Remove DADOS_PACIENTE screen; make ESPECIALIDADE terminal |
| `flows/patient_info_convenio_flow.json` | Remove DADOS_PACIENTE screen; make INFO_CONVENIO terminal |
| `flows/patient_info_flow.json` | Remove DADOS_PACIENTE screen; make INFO_CONVENIO terminal |
| `flows/handler.py` | Remove `_handle_dados_paciente`; update routing in `_handle_especialidade_selection` and `_handle_info_convenio` |
| `flows/orchestrator.py` | Update `handle_flow_completion` to not expect nome/email; add patient lookup and text-based collection trigger |
| `messages/processor.py` | Add state handlers for `awaiting_patient_name`, `awaiting_patient_email`, `awaiting_patient_confirmation` |

## Success Criteria

### Measurable Outcomes

- **SC-001**: Flow completion rate > 80% (improved by removing text input friction)
- **SC-002**: Average flow-to-booking time < 3 minutes
- **SC-003**: Zero double-bookings from flow submissions
- **SC-004**: Known patient identification rate > 90% for returning patients
- **SC-005**: Patient info collection success rate > 95% (name + email via text)
