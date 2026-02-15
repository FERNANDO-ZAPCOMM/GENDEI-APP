# Feature Specification: Analytics Dashboard

**Feature Branch**: `014-analytics-dashboard`
**Created**: 2026-02-04
**Updated**: 2026-02-16
**Status**: Partially Implemented

## User Scenarios & Testing

### User Story 1 - Revenue Analytics (Priority: P1) — Implemented

A clinic owner views basic revenue analytics: total revenue from appointments and services.

**Why this priority**: Revenue visibility is critical for business decisions and financial planning.

**Independent Test**: Open revenue analytics → verify totals are displayed correctly.

**Acceptance Scenarios**:

1. **Given** the analytics page, **When** the owner opens it, **Then** basic revenue metrics are displayed from appointment and service data.
2. **Given** appointment data, **When** revenue is calculated, **Then** it accurately reflects completed appointment payments.

---

### User Story 2 - Dashboard Overview (Priority: P1) — Planned

A clinic owner views a dashboard with key metrics at a glance: total appointments, revenue, new patients, no-show rate, and AI performance — for a selected date range.

**Why this priority**: The overview provides immediate value and drives adoption.

**Acceptance Scenarios**:

1. **Given** the analytics dashboard, **When** the owner opens it, **Then** overview cards display: total appointments, total revenue, new patients, no-show rate, and completion rate for the current month.
2. **Given** the date range selector, **When** the owner selects "Last 7 days", **Then** all metrics update to reflect the selected period.
3. **Given** the comparison toggle, **When** enabled, **Then** each metric shows the percentage change vs. the previous period.

---

### User Story 3 - Appointment Analytics (Priority: P1) — Planned

A clinic owner views detailed appointment analytics: by status, by professional, by service, by hour of day, and by day of week.

**Acceptance Scenarios**:

1. **Given** the appointments section, **When** the owner views it, **Then** a bar chart shows appointments by status (completed, cancelled, no-show, pending).
2. **Given** the by-professional view, **When** displayed, **Then** a comparison table shows each professional's appointment count, completion rate, and no-show rate.

---

### User Story 4 - Patient and AI Analytics (Priority: P2) — Planned

A clinic owner views patient acquisition metrics and AI assistant performance.

**Acceptance Scenarios**:

1. **Given** the patients section, **When** displayed, **Then** new patients, returning patients, and unique patients served are shown.
2. **Given** the AI section, **When** displayed, **Then** total conversations, AI-handled percentage, and handoff rate are shown.

---

### User Story 5 - Data Export (Priority: P3) — Planned

A clinic owner exports analytics data as CSV or Excel for external analysis.

**Acceptance Scenarios**:

1. **Given** the export button, **When** the owner clicks it, **Then** a dialog shows section selection and format (CSV/Excel).
2. **Given** a generated export, **When** downloaded, **Then** the file contains all selected data with correct column headers.

---

### Edge Cases

- What about clinics with no data yet? (Show empty states with helpful tips)
- What about very large date ranges? (Aggregate at monthly level for ranges > 90 days)
- What about timezone differences? (All analytics computed in clinic's timezone)
- What about professionals who left? (Include historical data; mark as "inactive" in comparisons)

## Requirements

### Functional Requirements (Implemented)

- **FR-001**: System MUST display basic revenue analytics from appointment and service data

### Functional Requirements (Planned — Not Yet Implemented)

- **FR-P01**: System SHOULD display appointment analytics by status, professional, service, hour, and day of week
- **FR-P02**: System SHOULD display patient metrics: new, returning, unique served, acquisition channel
- **FR-P03**: System SHOULD display AI metrics: conversations, handled percentage, handoff rate, response time, booking conversion
- **FR-P04**: System SHOULD support configurable date ranges with period comparison (vs. previous)
- **FR-P05**: System SHOULD support professional and service filtering across all analytics views
- **FR-P06**: System SHOULD support data export in CSV and Excel formats
- **FR-P07**: System SHOULD compute daily analytics snapshots via scheduled Cloud Function
- **FR-P08**: System SHOULD render full dashboard in < 2 seconds
- **FR-P09**: System SHOULD maintain data freshness < 5 minutes

### Key Entities

- **AnalyticsSnapshot** (Planned): Daily/weekly/monthly aggregation per clinic — appointments, revenue, patients, professional performance, AI metrics
- **AnalyticsExport** (Planned): Export request tracking — date range, sections, format, status, file URL, expiration

## Success Criteria

### Measurable Outcomes

- **SC-001**: Revenue analytics load time < 2 seconds
- **SC-002**: Zero calculation errors in revenue metrics
