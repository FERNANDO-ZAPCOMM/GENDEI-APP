# Feature Specification: Patient Management

**Feature Branch**: `007-patient-management`
**Created**: 2026-02-04
**Status**: Implemented

## User Scenarios & Testing

### User Story 1 - Create and View Patients (Priority: P1)

A clinic staff member creates patient records with name, phone, email, date of birth, and CPF, and views all patients in a searchable list.

**Why this priority**: Patients are referenced by appointments, conversations, and the AI agent. Core entity.

**Independent Test**: Can be tested by creating a patient and verifying they appear in the patient list.

**Acceptance Scenarios**:

1. **Given** a staff member on the patients page, **When** they click "Add Patient", **Then** a form appears with fields for name, phone, email, date of birth, CPF, address, and notes.
2. **Given** valid patient data, **When** the form is submitted, **Then** the patient is created in `gendei_patients` with the clinic's ID in `clinicIds`.
3. **Given** patients exist, **When** the staff navigates to the patient list, **Then** all patients for their clinic are shown sorted by name.

---

### User Story 2 - Search Patients (Priority: P1)

A clinic staff member searches for patients by name, phone, or CPF to quickly find records.

**Why this priority**: With growing patient lists, search is essential for daily operations.

**Independent Test**: Can be tested by searching for a patient by phone number and verifying correct results.

**Acceptance Scenarios**:

1. **Given** the search field, **When** the staff types a phone number, **Then** patients matching that prefix are shown in under 200ms.
2. **Given** the search field, **When** the staff types a name, **Then** patients matching that name prefix are shown.
3. **Given** the tag filter, **When** the staff selects a tag (e.g., "vip"), **Then** only patients with that tag are displayed.

---

### User Story 3 - Patient Detail with Appointment History (Priority: P2)

A clinic staff member views a patient's full profile, appointment history, and can add notes and CRM tags.

**Why this priority**: Comprehensive patient view enables better care and relationship management.

**Independent Test**: Can be tested by viewing a patient's detail page and verifying appointment history and notes display correctly.

**Acceptance Scenarios**:

1. **Given** a patient's detail page, **When** the staff opens it, **Then** the full profile, last 20 appointments, notes, and tags are displayed.
2. **Given** the notes field, **When** the staff adds a note and saves, **Then** the note persists on the patient record.
3. **Given** the tags field, **When** the staff adds a tag (e.g., "recorrente"), **Then** the tag is saved and filterable from the list.

---

### User Story 4 - Edit and Delete Patient (Priority: P2)

A clinic staff member can edit patient details or soft-delete a patient record.

**Why this priority**: Patient information changes over time; edit supports data accuracy.

**Independent Test**: Can be tested by editing a patient's phone number and verifying the change persists.

**Acceptance Scenarios**:

1. **Given** a patient's detail page, **When** the staff edits any field and saves, **Then** the changes persist in Firestore.
2. **Given** a patient record, **When** the staff clicks "Delete", **Then** a confirmation dialog appears. On confirm, the patient is soft-deleted.

---

### Edge Cases

- What happens when the same patient visits multiple clinics? (`clinicIds` array supports multi-clinic membership)
- What if two patients have the same phone number? (Allowed — phone is not a unique key)
- What about CPF validation? (Format validation only: ###.###.###-##, no check-digit verification)
- What happens when a patient is deleted but has appointments? (Soft delete — historical data preserved)

## Requirements

### Functional Requirements

- **FR-001**: System MUST support patient CRUD with Firestore `gendei_patients` collection
- **FR-002**: System MUST support multi-clinic membership via `clinicIds` array
- **FR-003**: System MUST enforce clinic isolation (staff can only access patients from their clinic)
- **FR-004**: System MUST support search by phone prefix and name prefix in under 200ms
- **FR-005**: System MUST support CRM tags (array of strings) with `array-contains` filtering
- **FR-006**: System MUST track appointment statistics (total, completed, cancelled, no-show)
- **FR-007**: System MUST display last 20 appointments on patient detail page
- **FR-008**: System MUST validate CPF format (###.###.###-##) and phone (10+ digits)
- **FR-009**: System MUST support soft deletion without losing historical data
- **FR-010**: System MUST store `nameLower` field for case-insensitive name search

### Key Entities

- **Patient**: Name, phone, email, date of birth, CPF, address, notes, tags, clinicIds, appointment stats

## Success Criteria

### Measurable Outcomes

- **SC-001**: Search response time < 200ms
- **SC-002**: Patient creation < 15 seconds
- **SC-003**: Zero data duplication across clinics
- **SC-004**: 100% clinic access isolation enforcement
