# Feature Specification: Payment PIX

**Feature Branch**: `008-payment-pix`
**Created**: 2026-02-04
**Status**: Implemented

## User Scenarios & Testing

### User Story 1 - Configure PIX Key and Payment Settings (Priority: P1)

A clinic owner configures their payment settings: PIX key type and value (with double-entry verification), deposit percentage, and whether they accept convenio (health insurance).

**Why this priority**: Without PIX configuration, deposit collection cannot work.

**Independent Test**: Can be tested by setting a PIX key, confirming it, and verifying it persists after page reload.

**Acceptance Scenarios**:

1. **Given** the payment settings page, **When** the owner selects a PIX key type (CPF, CNPJ, email, phone, random), **Then** the input mask and validation rules adapt to the selected type.
2. **Given** a PIX key entered, **When** the owner enters the confirmation field, **Then** the system verifies both entries match before saving.
3. **Given** a mismatched confirmation, **When** the owner tries to save, **Then** an error message is shown.
4. **Given** the deposit toggle, **When** enabled, **Then** a deposit percentage slider (10-100%) appears with real-time preview.
5. **Given** the convenio toggle, **When** enabled, **Then** a list of common Brazilian health insurance providers appears for selection.

---

### User Story 2 - Deposit Calculation on Appointments (Priority: P1)

When an appointment is created (via dashboard or WhatsApp), the system automatically calculates the deposit amount based on the service price and the clinic's deposit percentage.

**Why this priority**: Automatic deposit calculation is core to reducing no-shows.

**Independent Test**: Can be tested by creating an appointment and verifying the deposit amount equals service price * deposit percentage.

**Acceptance Scenarios**:

1. **Given** a clinic with 30% deposit and a R$ 200 service, **When** an appointment is created, **Then** `depositAmount` is set to R$ 60,00 (6000 cents).
2. **Given** a clinic with `requiresDeposit: false`, **When** an appointment is created, **Then** `depositAmount` is 0 and no PIX code is generated.

---

### User Story 3 - PIX Code Generation and Sending (Priority: P2)

When an appointment requires a deposit, the system generates an EMV-format PIX code and sends it to the patient via WhatsApp.

**Why this priority**: Sending the PIX code automatically via WhatsApp reduces friction for patients.

**Independent Test**: Can be tested by creating an appointment with a deposit and verifying a valid PIX code is generated and sent.

**Acceptance Scenarios**:

1. **Given** an appointment with a deposit, **When** the PIX code is generated, **Then** it follows EMV standard format with the clinic's PIX key, amount, and description.
2. **Given** a generated PIX code, **When** sent via WhatsApp, **Then** the patient can copy-paste it into their banking app.
3. **Given** the PIX code, **When** the `pixCode` and `pixCodeGeneratedAt` fields are set, **Then** the code is stored on the appointment document.

---

### Edge Cases

- What if the clinic changes their PIX key after appointments are created? (Old codes remain valid — PIX keys can be changed but existing codes still reference the old key)
- What about free services (R$ 0)? (No deposit required, no PIX code generated)
- What if the deposit percentage changes? (Only affects new appointments, existing deposits unchanged)
- What about refunds for cancelled appointments? (Tracked manually — outside system scope)

## Requirements

### Functional Requirements

- **FR-001**: System MUST support PIX key configuration with 5 key types: CPF, CNPJ, email, phone, random
- **FR-002**: System MUST require double-entry verification for PIX key (enter twice, must match)
- **FR-003**: System MUST validate PIX key format per type (CPF: ###.###.###-##, CNPJ: ##.###.###/####-##, etc.)
- **FR-004**: System MUST support configurable deposit percentage (10-100%, default 30%)
- **FR-005**: System MUST support convenio acceptance toggle with pre-populated provider list
- **FR-006**: System MUST automatically calculate deposit amount on appointment creation
- **FR-007**: System MUST generate EMV-format PIX codes with CRC16 checksum
- **FR-008**: System MUST track deposit payment status on appointments (`depositPaid`, `depositPaidAt`)
- **FR-009**: System MUST store PIX code and generation timestamp on appointment document

### Key Entities

- **PaymentSettings** (nested in Clinic): PIX key config, deposit toggle/percentage, convenio acceptance/list
- **PixKeyConfig**: Key type, key value, verified timestamp
- **Appointment Payment Fields**: Deposit amount, paid flag, paid timestamp, PIX code, transaction ID

## Success Criteria

### Measurable Outcomes

- **SC-001**: PIX key configuration < 1 minute
- **SC-002**: Deposit calculation accuracy: 100%
- **SC-003**: PIX code validity in all major banking apps
- **SC-004**: Zero payment tracking discrepancies
