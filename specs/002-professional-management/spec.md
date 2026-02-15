# Feature Specification: Professional Management

**Feature Branch**: `002-professional-management`
**Created**: 2026-02-04
**Updated**: 2026-02-16
**Status**: Implemented

## User Scenarios & Testing

### User Story 1 - Add a Professional (Priority: P1)

A clinic owner adds a new healthcare professional to their clinic by entering their profile, specialty, appointment settings, and uploading a photo.

**Why this priority**: Without professionals, no appointments can be scheduled.

**Independent Test**: Can be tested by filling the professional form, uploading a photo, and verifying the professional appears in the list.

**Acceptance Scenarios**:

1. **Given** a clinic owner on the professionals page, **When** they click "Add Professional", **Then** a form appears with fields for name, email, phone, specialty, and photo.
2. **Given** the professional form, **When** the user fills all required fields and submits, **Then** the professional is created in Firestore as a subcollection document under the clinic.
3. **Given** the photo upload field, **When** the user selects an image, **Then** the image is uploaded to Firebase Storage and the URL is saved on the professional document.
4. **Given** a professional with all fields filled, **When** the form is submitted, **Then** the professional appears in the professionals list with their photo and specialty.

---

### User Story 2 - Configure Working Hours (Priority: P1)

A clinic owner sets the working schedule for each professional, including which days they work, their start/end times, and break periods.

**Why this priority**: Working hours are required for availability calculation during scheduling.

**Independent Test**: Can be tested by setting hours for a professional and verifying the schedule persists.

**Acceptance Scenarios**:

1. **Given** a professional's detail page, **When** the owner opens the working hours section, **Then** a weekly schedule editor appears with day toggles and time inputs.
2. **Given** a day set to "working", **When** the owner enters start/end times and optional breaks, **Then** the schedule is saved to the professional's document.
3. **Given** invalid hours (end before start), **When** the owner tries to save, **Then** a validation error is shown.

---

### User Story 3 - List and Search Professionals (Priority: P2)

A clinic owner views all professionals in their clinic with the ability to search by name and filter by specialty.

**Why this priority**: As the clinic grows, finding specific professionals quickly becomes important.

**Independent Test**: Can be tested by adding multiple professionals and verifying search/filter works.

**Acceptance Scenarios**:

1. **Given** a clinic with professionals, **When** the owner navigates to the professionals page, **Then** all active professionals are listed with photo, name, and specialty.
2. **Given** the search field, **When** the owner types a name, **Then** the list filters in real-time.
3. **Given** the specialty filter, **When** the owner selects a specialty, **Then** only professionals of that specialty are shown.

---

### User Story 4 - Edit and Deactivate Professional (Priority: P2)

A clinic owner can edit a professional's details or deactivate them (soft delete) without losing historical data.

**Why this priority**: Staff changes are common; editing and deactivation support ongoing operations.

**Independent Test**: Can be tested by editing a professional's name and verifying the change, then deactivating and verifying they no longer appear in the active list.

**Acceptance Scenarios**:

1. **Given** a professional's detail page, **When** the owner clicks "Edit", **Then** the form becomes editable with pre-filled values.
2. **Given** an active professional, **When** the owner clicks "Deactivate", **Then** a confirmation dialog appears. On confirm, the professional is set to `active: false`.
3. **Given** a deactivated professional, **When** the owner views the professionals list, **Then** the professional does not appear in the default active view but can be shown via a filter toggle.

---

### Edge Cases

- What happens when a professional is deactivated but has future appointments? (Show warning, allow deactivation, keep appointments as-is)
- What if the photo upload fails? (Professional is still created with a placeholder avatar)
- What is the maximum number of professionals per clinic? (25)
- What happens with duplicate professional names? (Allowed — names are not unique identifiers)

## Requirements

### Functional Requirements

- **FR-001**: System MUST support creating professionals as a Firestore subcollection under the clinic
- **FR-002**: System MUST support photo upload to Firebase Storage with URL stored on the professional document
- **FR-003**: System MUST support 20+ healthcare specialties with Portuguese labels
- **FR-004**: System MUST support configurable appointment duration per professional (15-120 min in 15-min increments)
- **FR-005**: System MUST support consultation price per professional (in BRL cents)
- **FR-006**: System MUST support working hours per day of week with break times
- **FR-007**: System MUST support professional deactivation (soft delete) without data loss
- **FR-008**: System MUST limit to 25 professionals per clinic
- **FR-009**: System MUST support search by name and filter by specialty
- **FR-010**: System MUST validate all inputs (name length, phone format, valid specialty)
- **FR-011**: System MUST support i18n for all labels (pt-BR and en)

### Key Entities

- **Professional**: Name, email, phone, specialties, photo URL, appointment duration, price, working hours, active status
- **ProfessionalWorkingHours**: Weekly schedule with per-day time ranges and breaks
- **TimeRange**: Start time and end time in HH:MM format

## Success Criteria

### Measurable Outcomes

- **SC-001**: Professional creation completed in under 2 minutes
- **SC-002**: Photo upload success rate > 99%
- **SC-003**: Professional list loads in under 500ms
- **SC-004**: Search returns results in under 200ms
