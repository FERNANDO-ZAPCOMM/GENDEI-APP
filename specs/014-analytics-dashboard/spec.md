# Feature Specification: Analytics Dashboard

**Feature Branch**: `014-analytics-dashboard`
**Created**: 2026-02-04
**Status**: Implemented

## User Scenarios & Testing

### User Story 1 - Dashboard Overview (Priority: P1)

A clinic owner views a dashboard with key metrics at a glance: total appointments, revenue, new patients, no-show rate, and AI performance — for a selected date range.

**Why this priority**: The overview is the landing page for analytics — it provides immediate value and drives adoption.

**Independent Test**: Open analytics → verify cards show correct totals → change date range → verify numbers update.

**Acceptance Scenarios**:

1. **Given** the analytics dashboard, **When** the owner opens it, **Then** overview cards display: total appointments, total revenue, new patients, no-show rate, and completion rate for the current month.
2. **Given** the date range selector, **When** the owner selects "Last 7 days", **Then** all metrics update to reflect the selected period.
3. **Given** the comparison toggle, **When** enabled, **Then** each metric shows the percentage change vs. the previous period.

---

### User Story 2 - Appointment Analytics (Priority: P1)

A clinic owner views detailed appointment analytics: by status, by professional, by service, by hour of day, and by day of week.

**Why this priority**: Appointment analytics are the core of clinic operations — understanding patterns drives better scheduling.

**Independent Test**: Open appointments section → verify chart shows by-status breakdown → filter by professional → verify data updates.

**Acceptance Scenarios**:

1. **Given** the appointments section, **When** the owner views it, **Then** a bar chart shows appointments by status (completed, cancelled, no-show, pending).
2. **Given** the by-professional view, **When** displayed, **Then** a comparison table shows each professional's appointment count, completion rate, and no-show rate.
3. **Given** the by-hour heatmap, **When** displayed, **Then** it shows appointment density by hour of day and day of week.

---

### User Story 3 - Revenue Analytics (Priority: P1)

A clinic owner views revenue breakdown by service, professional, payment method, and over time — with average ticket size and trends.

**Why this priority**: Revenue visibility is critical for business decisions and financial planning.

**Independent Test**: Open revenue section → verify total matches sum of parts → verify by-payment-method breakdown.

**Acceptance Scenarios**:

1. **Given** the revenue section, **When** the owner views it, **Then** total revenue, deposits collected, pending payments, and average ticket are displayed.
2. **Given** the by-service chart, **When** displayed, **Then** a pie chart shows revenue distribution across services.
3. **Given** the revenue trend, **When** displayed, **Then** a line chart shows daily/weekly/monthly revenue over time.

---

### User Story 4 - Patient and AI Analytics (Priority: P2)

A clinic owner views patient acquisition metrics (new vs. returning, by channel) and AI assistant performance (response rate, handoff rate, booking conversion).

**Why this priority**: Patient and AI metrics are valuable for optimization but secondary to appointments and revenue.

**Independent Test**: Open patients section → verify new vs. returning counts → open AI section → verify handoff rate.

**Acceptance Scenarios**:

1. **Given** the patients section, **When** displayed, **Then** new patients, returning patients, and unique patients served are shown with acquisition channel breakdown.
2. **Given** the AI section, **When** displayed, **Then** total conversations, AI-handled percentage, handoff rate, average response time, and AI-booked appointments are shown.
3. **Given** AI metrics, **When** the handoff rate is high, **Then** it's flagged with a warning indicator.

---

### User Story 5 - Data Export (Priority: P3)

A clinic owner exports analytics data as CSV or Excel for external analysis, accounting, or reporting.

**Why this priority**: Export is a utility feature for advanced users — most users consume data in the dashboard.

**Independent Test**: Select date range → choose sections → click export → verify file downloads with correct data.

**Acceptance Scenarios**:

1. **Given** the export button, **When** the owner clicks it, **Then** a dialog shows section selection (appointments, revenue, patients, professionals, AI) and format (CSV/Excel).
2. **Given** export settings configured, **When** the owner clicks "Generate", **Then** the export processes and a download link is provided within 10 seconds.
3. **Given** a generated export, **When** downloaded, **Then** the file contains all selected data with correct column headers and formatting.

---

### Edge Cases

- What about clinics with no data yet? (Show empty states with helpful tips)
- What about very large date ranges? (Aggregate at monthly level for ranges > 90 days)
- What if analytics computation is stale? (Show "Last updated: X minutes ago" indicator)
- What about timezone differences? (All analytics computed in clinic's timezone)
- What about professionals who left? (Include historical data; mark as "inactive" in comparisons)

## Requirements

### Functional Requirements

- **FR-001**: System MUST display appointment analytics by status, professional, service, hour, and day of week
- **FR-002**: System MUST display revenue analytics by service, professional, payment method, and over time
- **FR-003**: System MUST display patient metrics: new, returning, unique served, acquisition channel
- **FR-004**: System MUST display AI metrics: conversations, handled percentage, handoff rate, response time, booking conversion
- **FR-005**: System MUST support configurable date ranges with period comparison (vs. previous)
- **FR-006**: System MUST support professional and service filtering across all analytics views
- **FR-007**: System MUST support data export in CSV and Excel formats
- **FR-008**: System MUST compute daily analytics snapshots via scheduled Cloud Function
- **FR-009**: System MUST render dashboard in < 2 seconds
- **FR-010**: System MUST maintain data freshness < 5 minutes

### Key Entities

- **AnalyticsSnapshot**: Daily/weekly/monthly aggregation per clinic — appointments, revenue, patients, professional performance, AI metrics
- **AnalyticsExport**: Export request tracking — date range, sections, format, status, file URL, expiration
- **AnalyticsComparison**: Computed comparison between current and previous period with percentage changes

## Success Criteria

### Measurable Outcomes

- **SC-001**: Dashboard load time < 2 seconds
- **SC-002**: Data freshness < 5 minutes from last event
- **SC-003**: Export generation < 10 seconds
- **SC-004**: Zero calculation errors in aggregated metrics
- **SC-005**: Professional utilization calculation accuracy: 100%
