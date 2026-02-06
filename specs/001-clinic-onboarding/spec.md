# Feature Specification: Clinic Onboarding

**Feature Branch**: `001-clinic-onboarding`
**Created**: 2026-02-04
**Status**: Implemented

## User Scenarios & Testing

### User Story 1 - Account Registration (Priority: P1)

A healthcare provider visits Gendei and creates an account to begin setting up their clinic.

**Why this priority**: Without registration, no other feature is accessible. This is the entry point.

**Independent Test**: Can be tested by registering a new account and verifying access to the dashboard.

**Acceptance Scenarios**:

1. **Given** a new user on the signup page, **When** they enter email and password, **Then** a Firebase Auth account is created and they are redirected to the dashboard.
2. **Given** a new user on the signup page, **When** they click "Sign in with Google", **Then** they authenticate via Google OAuth and are redirected to the dashboard.
3. **Given** an authenticated user with no clinic, **When** they access the dashboard, **Then** a clinic document is auto-created in Firestore linked to their UID.

---

### User Story 2 - Clinic Profile Setup (Priority: P1)

A clinic owner fills in their clinic's basic profile: name, description, phone, CNPJ, and vertical selector (med, dental, psi, nutri, fisio).

**Why this priority**: Core identity of the clinic, required before anything else can be configured.

**Independent Test**: Can be tested by filling the profile form and verifying data persists in Firestore.

**Acceptance Scenarios**:

1. **Given** an authenticated clinic owner on the clinic settings page, **When** they fill in name and description and save, **Then** the clinic document is updated in Firestore.
2. **Given** a user entering a CNPJ, **When** they type an invalid format, **Then** a validation error is shown ("CNPJ invalido").
3. **Given** a user entering a phone number, **When** they type digits, **Then** the input auto-formats to Brazilian format (XX) XXXXX-XXXX.

---

### User Story 3 - Address with Google Maps (Priority: P2)

A clinic owner sets their clinic address using Google Maps autocomplete for accurate location data.

**Why this priority**: Address is needed for patient-facing information and future location features, but not blocking for initial setup.

**Independent Test**: Can be tested by typing an address, selecting a suggestion, and verifying structured data is saved.

**Acceptance Scenarios**:

1. **Given** the address field, **When** the user starts typing, **Then** Google Places autocomplete suggestions appear.
2. **Given** the user selects an autocomplete suggestion, **When** the selection is confirmed, **Then** street, number, neighborhood, city, state, zipCode, latitude, and longitude are parsed and stored.
3. **Given** a saved address, **When** the user returns to clinic settings, **Then** the full address is pre-populated.

---

### User Story 4 - Operating Hours Configuration (Priority: P2)

A clinic owner defines their operating hours for each day of the week, including break times.

**Why this priority**: Required for the scheduling system to know when the clinic is available.

**Independent Test**: Can be tested by setting hours for each day and verifying the schedule persists.

**Acceptance Scenarios**:

1. **Given** the operating hours form, **When** the user toggles a day to "open", **Then** start/end time inputs appear for that day.
2. **Given** an open day, **When** the user adds a break period, **Then** break start/end time inputs appear.
3. **Given** the user sets end time before start time, **When** they try to save, **Then** a validation error is shown.

---

### User Story 5 - Payment Settings (Priority: P3)

A clinic owner configures their payment settings: PIX key, deposit percentage, and accepted payment methods.

**Why this priority**: Payments are needed for booking flow but can be configured after initial setup.

**Independent Test**: Can be tested by setting a PIX key, deposit percentage, and verifying settings persist.

**Acceptance Scenarios**:

1. **Given** the payment settings form, **When** the user enters a PIX key and confirms it (double-entry), **Then** the key is saved.
2. **Given** a mismatched PIX key confirmation, **When** the user tries to save, **Then** a validation error is shown.
3. **Given** the deposit slider, **When** the user adjusts the percentage (10-100%), **Then** the deposit amount updates in real-time.
4. **Given** the convenio toggle, **When** enabled, **Then** a list of common health insurance providers appears for selection.

---

### Edge Cases

- What happens when the user refreshes mid-onboarding? (Progress should be saved incrementally)
- How does the system handle duplicate CNPJs? (Validation warning, but not blocked — multiple users may manage the same clinic)
- What happens when Google Maps API is unavailable? (Manual address entry fallback)
- What if a user tries to access the dashboard without completing onboarding? (Show onboarding progress banner)

## Requirements

### Functional Requirements

- **FR-001**: System MUST support email/password and Google OAuth registration
- **FR-002**: System MUST auto-create a clinic document on first dashboard access
- **FR-003**: System MUST validate CNPJ format (XX.XXX.XXX/XXXX-XX)
- **FR-004**: System MUST format phone numbers to Brazilian standard (XX) XXXXX-XXXX
- **FR-005**: System MUST integrate Google Maps Places API for address autocomplete
- **FR-006**: System MUST parse Google Places response into structured address fields (street, number, neighborhood, city, state, zipCode, lat, lng)
- **FR-007**: System MUST support operating hours per day of week with optional break times
- **FR-008**: System MUST validate time ranges (end > start, no overlapping breaks)
- **FR-009**: System MUST support PIX key configuration with double-entry confirmation
- **FR-010**: System MUST support deposit percentage configuration (10-100%)
- **FR-011**: System MUST support health insurance (convenio) provider selection
- **FR-012**: System MUST persist all settings to Firestore in real-time
- **FR-013**: System MUST support i18n (pt-BR and en)
- **FR-014**: System MUST protect all dashboard routes with authentication middleware

### Key Entities

- **Clinic**: Name, description, phone, CNPJ, address, operating hours, payment settings, onboarding status, vertical
- **ClinicAddress**: Street, number, complement, neighborhood, city, state, zipCode, latitude, longitude
- **OperatingHours**: Per-day schedule with time ranges and optional breaks
- **PaymentSettings**: PIX key, deposit percentage, accepted methods, convenio list

## Success Criteria

### Measurable Outcomes

- **SC-001**: Clinic onboarding completion rate > 80%
- **SC-002**: Average onboarding time < 10 minutes
- **SC-003**: Validation error rate < 5% on final submission
- **SC-004**: Google Maps address resolution accuracy > 95%
- **SC-005**: Zero data loss on page refresh during onboarding
