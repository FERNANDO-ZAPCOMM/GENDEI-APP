# Tasks: Payment PIX

**Input**: Design documents from `/specs/008-payment-pix/`
**Prerequisites**: plan.md, spec.md, data-model.md

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Payment data model and PIX utilities

- [ ] T001 Define PaymentSettings and PixKeyConfig TypeScript interfaces in `apps/frontend/types/payment.ts`
- [ ] T002 [P] Create Zod validation schemas for payment settings and PIX key verification
- [ ] T003 [P] Create PIX key validation utility (per-type format checking)
- [ ] T004 [P] Create PIX EMV code generation utility in `apps/functions/src/services/pix.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Payment settings API — blocks UI and appointment integration

- [ ] T005 Add payment settings fields to clinic model
- [ ] T006 Implement PUT /clinics/:id/settings/paymentSettings endpoint
- [ ] T007 [P] Add deposit fields to Appointment interface (depositAmount, depositPaid, depositPaidAt, pixCode)
- [ ] T008 Implement deposit calculation logic in appointment creation

**Checkpoint**: Payment settings save and deposit calculates on appointment creation

---

## Phase 3: User Story 1 - PIX Key Configuration (Priority: P1)

**Goal**: Clinic owners can configure PIX key with double-entry verification and payment settings.

**Independent Test**: Set PIX key → confirm → save → reload → verify settings persist.

### Implementation

- [ ] T009 [US1] Build PIX key type selector (CPF/CNPJ/email/phone/random)
- [ ] T010 [US1] Build PIX key input with adaptive mask per type
- [ ] T011 [US1] Implement double-entry verification (key + confirmation must match)
- [ ] T012 [US1] Build deposit percentage slider (10-100%)
- [ ] T013 [P] [US1] Build convenio toggle with pre-populated provider list
- [ ] T014 [US1] Create payment settings page in `apps/frontend/app/[locale]/dashboard/payments/page.tsx`
- [ ] T015 [US1] Wire form to PUT /clinics/:id/settings/paymentSettings API

**Checkpoint**: Payment settings fully configurable from dashboard

---

## Phase 4: User Story 2 - Deposit Calculation (Priority: P1)

**Goal**: Deposits auto-calculate on appointment creation.

**Independent Test**: Create appointment → verify depositAmount = service price * deposit %.

### Implementation

- [ ] T016 [US2] Integrate deposit calculation into POST /appointments endpoint
- [ ] T017 [US2] Display deposit amount on appointment form (preview before submission)
- [ ] T018 [US2] Track depositPaid status with manual toggle on appointment detail

**Checkpoint**: Deposits calculate and track correctly

---

## Phase 5: User Story 3 - PIX Code Generation (Priority: P2)

**Goal**: Generate EMV-format PIX codes and send to patients via WhatsApp.

**Independent Test**: Create appointment with deposit → verify PIX code generated → verify code is valid EMV format.

### Implementation

- [ ] T019 [US3] Implement EMV-format PIX code generation with CRC16 checksum
- [ ] T020 [US3] Implement POST /payments/generate-pix endpoint
- [ ] T021 [US3] Store pixCode and pixCodeGeneratedAt on appointment document
- [ ] T022 [US3] Send PIX code to patient via WhatsApp after appointment creation
- [ ] T023 [US3] Display PIX code on appointment detail in dashboard

**Checkpoint**: PIX codes generate and send correctly

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T024 [P] Add i18n translations for payment labels
- [ ] T025 [P] Add loading states to payment settings form
- [ ] T026 Add common convenio providers list (Unimed, Bradesco Saude, SulAmerica, Amil, etc.)
- [ ] T027 Run quickstart.md validation

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies
- **Foundational (Phase 2)**: Depends on Phase 1
- **US1 PIX Config (Phase 3)**: Depends on Phase 2
- **US2 Deposit Calc (Phase 4)**: Depends on Phase 2 + requires appointments (006)
- **US3 PIX Code (Phase 5)**: Depends on Phase 3 + Phase 4
- **Polish (Phase 6)**: Depends on all

### Parallel Opportunities

- T002, T003, T004 (schemas and utils)
- T007 (deposit fields parallel to settings API)
- T013 (convenio parallel to PIX key input)
- Phase 3 and Phase 4 can partially overlap
