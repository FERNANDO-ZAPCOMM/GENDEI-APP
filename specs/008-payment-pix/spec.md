# Feature Specification: Payment System

**Feature Branch**: `008-payment-pix`
**Created**: 2026-02-04
**Updated**: 2026-02-15
**Status**: Implemented

## User Scenarios & Testing

### User Story 1 - Configure Payment Settings (Priority: P1)

A clinic owner configures their payment settings: deposit percentage, PIX key (planned), and whether they accept convenio (health insurance).

**Why this priority**: Without payment configuration, deposit collection cannot work.

**Independent Test**: Can be tested by setting deposit percentage, saving, and verifying it persists after page reload.

**Acceptance Scenarios**:

1. **Given** the payment settings page, **When** the owner adjusts the deposit percentage (10-100%), **Then** the selected percentage is saved and applied to new appointments.
2. **Given** the convenio toggle, **When** enabled, **Then** a list of common Brazilian health insurance providers appears for selection.
3. **Given** the PIX configuration section, **When** displayed, **Then** it shows "Em breve" (coming soon) badge as PIX key self-service is planned.

---

### User Story 2 - Stripe Connect Onboarding (Priority: P1)

A clinic owner connects their Stripe account via Stripe Connect Express to enable split payments (card charges with automatic Gendei commission).

**Why this priority**: Stripe Connect enables card payments and automated revenue splitting.

**Independent Test**: Can be tested by clicking "Connect Stripe", completing onboarding, and verifying `chargesEnabled` and `payoutsEnabled` are true.

**Acceptance Scenarios**:

1. **Given** the payments page with Stripe section expanded, **When** the owner clicks "Conectar com Stripe", **Then** a Stripe Express onboarding account is created and the owner is redirected to Stripe's onboarding flow.
2. **Given** incomplete Stripe onboarding, **When** the owner returns to the payments page, **Then** a "Continuar configuracao" button appears to resume onboarding.
3. **Given** completed Stripe onboarding, **When** the status is refreshed, **Then** the badge shows "Pronto para split" and capabilities (`chargesEnabled`, `payoutsEnabled`, `detailsSubmitted`) are displayed.
4. **Given** Stripe is not configured on the backend (missing env vars), **When** the status is fetched, **Then** the UI gracefully shows Stripe as unavailable.

---

### User Story 3 - PagSeguro PIX Payment via WhatsApp (Priority: P1)

When an appointment requires a deposit (signal), the WhatsApp agent generates a PIX payment via PagSeguro Orders API and sends a payment link/button to the patient.

**Why this priority**: PagSeguro PIX is the primary payment method for Brazilian patients, with automatic confirmation via webhooks.

**Independent Test**: Can be tested by creating an appointment with deposit via WhatsApp and verifying a PIX payment is generated and sent as a WhatsApp button.

**Acceptance Scenarios**:

1. **Given** an appointment requiring a signal, **When** the agent processes the booking, **Then** a PagSeguro PIX order is created with the correct amount and a "copia e cola" code is generated.
2. **Given** a PIX order created, **When** the payment link is sent to the patient, **Then** it is sent as a WhatsApp button message (not plain text).
3. **Given** a patient pays via PIX, **When** PagSeguro sends a webhook notification, **Then** the signature is verified, payment status is updated, and a confirmation message is sent to the patient.
4. **Given** a PagSeguro PIX failure, **When** the Orders API is unavailable, **Then** the system falls back to PagSeguro Checkout API (full payment page link).

---

### User Story 4 - Card Payment via WhatsApp (Priority: P2)

The WhatsApp agent can send a card payment link (PagSeguro Checkout) to patients who prefer paying by card.

**Why this priority**: Some patients prefer card payments over PIX.

**Independent Test**: Can be tested by requesting card payment and verifying a checkout link is generated and sent.

**Acceptance Scenarios**:

1. **Given** an appointment requiring payment, **When** the patient requests card payment, **Then** a PagSeguro Checkout link is created and sent via WhatsApp button.
2. **Given** a card payment completed, **When** the webhook confirms it, **Then** the appointment signal is marked as paid.

---

### User Story 5 - Payment Hold Auto-Cancellation (Priority: P1)

Pending appointments with unpaid signals are automatically cancelled after a configurable hold period (default 15 minutes).

**Why this priority**: Prevents slot hoarding by patients who don't complete payment.

**Independent Test**: Can be tested by creating a pending appointment with unpaid signal and verifying it is cancelled after the hold period.

**Acceptance Scenarios**:

1. **Given** a pending appointment with `signalCents > 0` and `signalPaid: false`, **When** 15 minutes elapse without payment, **Then** the appointment status is set to `cancelled` with reason "Reserva expirada por falta de pagamento do sinal".
2. **Given** an expired hold, **When** cancelled, **Then** the conversation context is updated to reflect the cancellation.
3. **Given** a paid signal, **When** the hold timer runs, **Then** the appointment is skipped (not cancelled).

---

### User Story 6 - Payment Transaction History (Priority: P2)

Clinic owners can view a table of all payment transactions with status, method, source, and transfer mode.

**Why this priority**: Visibility into payment activity is essential for clinic operations.

**Independent Test**: Can be tested by viewing the payments page and verifying transaction history is displayed correctly.

**Acceptance Scenarios**:

1. **Given** the payments page, **When** loaded, **Then** a transactions table shows recent orders sorted by date descending.
2. **Given** a transaction, **When** displayed, **Then** it shows: date, amount (formatted as BRL), payment method (PIX/Card), source (PagSeguro/Stripe), transfer mode (Automatic/Manual), and status badge.

---

### Edge Cases

- What if PagSeguro Orders API is unavailable? (Fall back to Checkout API for a full payment page)
- What about free services (R$ 0)? (No signal required, no payment generated)
- What if the deposit percentage changes? (Only affects new appointments, existing signals unchanged)
- What about refunds for cancelled appointments? (Tracked manually -- outside system scope for now)
- What if Stripe onboarding is incomplete? (Continue/refresh onboarding link is provided)
- What if a patient doesn't pay within the hold period? (Auto-cancelled by Cloud Scheduler job every 5 minutes)

## Requirements

### Functional Requirements

- **FR-001**: System MUST support configurable deposit percentage (10-100%, default 30%)
- **FR-002**: System MUST support convenio acceptance toggle with provider list
- **FR-003**: System MUST calculate signal amount on appointment creation (`signalCents = totalCents * depositPercentage / 100`)
- **FR-004**: System MUST integrate with PagSeguro Orders API for PIX payment generation
- **FR-005**: System MUST fall back to PagSeguro Checkout API when Orders API fails
- **FR-006**: System MUST verify PagSeguro webhook signatures before processing payment confirmations
- **FR-007**: System MUST send payment links as WhatsApp button messages
- **FR-008**: System MUST auto-cancel pending appointments with unpaid signals after configurable hold period (default 15 minutes)
- **FR-009**: System MUST support Stripe Connect Express onboarding for clinic accounts
- **FR-010**: System MUST refresh Stripe account capabilities from Stripe API on status check
- **FR-011**: System MUST track payment transactions in clinic-scoped `orders` subcollection
- **FR-012**: System MUST display payment transaction history with status, method, source, and transfer mode
- **FR-013**: System MUST support both PIX and card payment methods
- **FR-014**: System MUST track signal payment status on appointments (`signalCents`, `signalPaid`, `signalPaidAt`, `signalPaymentId`)

### Key Entities

- **PaymentSettings** (nested in Clinic): Deposit toggle/percentage, convenio config, PIX key, Stripe Connect state
- **StripeConnectState** (nested in PaymentSettings): Account ID, onboarding status, capabilities
- **Appointment Signal Fields**: `signalCents`, `signalPaid`, `signalPaidAt`, `signalPaymentId`, `paymentType`
- **PaymentTransaction** (orders subcollection): Amount, status, method, source, transfer mode
- **Legacy Fields** (backward compat): `depositAmount`, `depositPaid`, `depositPaidAt`

## Success Criteria

### Measurable Outcomes

- **SC-001**: Payment settings configuration < 1 minute
- **SC-002**: Signal calculation accuracy: 100%
- **SC-003**: PagSeguro webhook processing < 5 seconds
- **SC-004**: Payment hold enforcement: 100% of expired holds cancelled
- **SC-005**: Stripe Connect onboarding completion rate trackable via dashboard
- **SC-006**: Zero payment tracking discrepancies between orders and appointments
