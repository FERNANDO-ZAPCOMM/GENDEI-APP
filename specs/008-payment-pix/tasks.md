# Tasks: Payment System

**Input**: Design documents from `/specs/008-payment-pix/`
**Prerequisites**: plan.md, spec.md, data-model.md
**Updated**: 2026-02-15

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Payment data model and utility types

- [x] T001 Define PaymentSettings, StripeConnectState, PaymentTransaction TypeScript interfaces in `apps/frontend/lib/clinic-types.ts`
- [x] T002 [P] Add signal fields to Appointment interface (`signalCents`, `signalPaid`, `signalPaidAt`, `signalPaymentId`, `totalCents`)
- [x] T003 [P] Maintain backward compat with legacy deposit fields (`depositAmount`, `depositPaid`, `depositPaidAt`)

---

## Phase 2: PagSeguro PIX Integration (Priority: P1)

**Purpose**: Primary payment method via PagSeguro Orders API

- [x] T004 Implement PagSeguro PIX order creation (`create_pagseguro_pix_order()`) in `apps/whatsapp-agent/src/utils/payment.py`
- [x] T005 [P] Implement PagSeguro Checkout fallback (`create_pagseguro_checkout()`)
- [x] T006 Implement WhatsApp button message sending for PIX payments (`send_pix_payment_to_customer()`)
- [x] T007 [P] Implement WhatsApp button message sending for card payments (`send_card_payment_to_customer()`)
- [x] T008 Implement PagSeguro webhook handler with signature verification
- [x] T009 Implement payment confirmation processing (`process_payment_confirmation()`)
- [x] T010 Send automatic confirmation message to patient after successful payment

**Checkpoint**: PagSeguro PIX payments work end-to-end via WhatsApp

---

## Phase 3: Payment Holds (Priority: P1)

**Purpose**: Auto-cancel pending appointments with unpaid signals

- [x] T011 Implement `needsPendingPaymentRelease()` check in `apps/functions/src/services/payment-holds.ts`
- [x] T012 Implement `cleanupExpiredPaymentHolds()` with batched writes (max 400/batch)
- [x] T013 Implement conversation context sync on cancellation (`syncCancelledAppointmentContext()`)
- [x] T014 Add Cloud Scheduler job (every 5 min) to trigger cleanup
- [x] T015 Add manual cleanup endpoint (`POST /reminders/cleanup-payment-holds`)
- [x] T016 [P] Support configurable hold period via `PAYMENT_HOLD_MINUTES` env var (default 15)

**Checkpoint**: Pending appointments with unpaid signals auto-cancel after hold period

---

## Phase 4: Stripe Connect Onboarding (Priority: P1)

**Purpose**: Enable clinic Stripe accounts for split payments

- [x] T017 Implement Stripe Express account creation in `apps/functions/src/routes/payments.ts`
- [x] T018 Implement account link generation for onboarding
- [x] T019 Implement status refresh from Stripe API with Firestore sync
- [x] T020 [P] Implement `sanitizeFrontendBaseUrl()` for URL validation
- [x] T021 [P] Add clinic-scoped access verification on all payment endpoints

**Checkpoint**: Clinic owners can start and complete Stripe Connect onboarding

---

## Phase 5: Frontend Payment Page (Priority: P1)

**Purpose**: Payment settings and transaction history UI

- [x] T022 Create `useStripeConnect` hook in `apps/frontend/hooks/use-stripe-connect.ts`
- [x] T023 [P] Create `usePayments` hook for transaction history
- [x] T024 Build payment settings page (`apps/frontend/app/[locale]/dashboard/payments/page.tsx`)
- [x] T025 Build deposit percentage selector (10-100%)
- [x] T026 Build Stripe Connect expandable card with status badges and onboarding buttons
- [x] T027 [P] Build PIX expandable card (disabled with "Em breve" badge)
- [x] T028 Build transactions table with status, method, source, transfer mode columns

**Checkpoint**: Payment settings and history fully functional in dashboard

---

## Phase 6: Polish & Cross-Cutting

- [x] T029 [P] Add i18n translations for payment labels
- [x] T030 [P] Add loading states and error handling
- [x] T031 Onboarding step integration (`getNextStepUrl('payments', locale)`)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies
- **PagSeguro (Phase 2)**: Depends on Phase 1, requires WhatsApp integration (004)
- **Payment Holds (Phase 3)**: Depends on Phase 1, requires appointments (006)
- **Stripe Connect (Phase 4)**: Depends on Phase 1
- **Frontend (Phase 5)**: Depends on Phase 4
- **Polish (Phase 6)**: Depends on all

### Parallel Opportunities

- T002, T003 (signal fields parallel to settings types)
- T005, T007 (checkout fallback parallel to PIX)
- T020, T021 (URL validation parallel to access checks)
- T023 (payments hook parallel to Stripe hook)
- Phase 2 and Phase 4 can run in parallel
