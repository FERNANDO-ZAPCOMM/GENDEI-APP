# Tasks: Analytics Dashboard

**Input**: Design documents from `/specs/014-analytics-dashboard/`
**Prerequisites**: plan.md, spec.md, data-model.md

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Data model, types, and aggregation utilities

- [ ] T001 Define AnalyticsSnapshot, AnalyticsExport, and AnalyticsComparison TypeScript interfaces in `apps/frontend/types/analytics.ts`
- [ ] T002 [P] Create Zod validation schemas for analytics queries, date ranges, and export requests
- [ ] T003 [P] Create date range utility (period calculation, previous period comparison, timezone handling)
- [ ] T004 [P] Create analytics aggregation utility (sum, average, percentage change between periods)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Analytics computation pipeline and API — blocks all dashboard UI

- [ ] T005 Create analytics Express router in `apps/functions/src/routes/analytics.ts`
- [ ] T006 Implement daily analytics snapshot computation Cloud Function (scheduled, runs end-of-day)
- [ ] T007 [P] Implement weekly and monthly rollup computation from daily snapshots
- [ ] T008 Implement GET /analytics/overview endpoint (return snapshot for date range with comparison)
- [ ] T009 [P] Implement GET /analytics/appointments endpoint (by status, professional, service, hour, day)
- [ ] T010 [P] Implement GET /analytics/revenue endpoint (by service, professional, payment method, over time)
- [ ] T011 [P] Implement GET /analytics/patients endpoint (new, returning, unique, by channel)
- [ ] T012 Implement GET /analytics/professionals endpoint (per-professional metrics: appointments, revenue, utilization)
- [ ] T013 [P] Implement GET /analytics/ai endpoint (conversations, handled %, handoffs, response time, conversions)
- [ ] T014 [P] Add Firestore indexes: (clinicId, period, date DESC)
- [ ] T015 Create TanStack Query hooks in `apps/frontend/hooks/useAnalytics.ts`

**Checkpoint**: Analytics API returns computed data for all sections

---

## Phase 3: User Story 1 - Dashboard Overview (Priority: P1)

**Goal**: Owners see key metrics at a glance with date range selection and period comparison.

**Independent Test**: Open analytics → verify cards → change date range → verify update.

### Implementation

- [ ] T016 [US1] Create analytics page in `apps/frontend/app/[locale]/dashboard/analytics/page.tsx`
- [ ] T017 [US1] Build date range selector component (presets: today, 7 days, 30 days, this month, custom)
- [ ] T018 [US1] Build overview metric cards (appointments, revenue, new patients, no-show rate, completion rate)
- [ ] T019 [P] [US1] Build comparison indicators (percentage change vs. previous period, up/down arrows)

**Checkpoint**: Dashboard overview functional with date range and comparison

---

## Phase 4: User Story 2 - Appointment Analytics (Priority: P1)

**Goal**: Owners view detailed appointment breakdown.

**Independent Test**: View appointment charts → filter by professional → verify data.

### Implementation

- [ ] T020 [US2] Build appointment status bar chart (completed, cancelled, no-show, pending)
- [ ] T021 [US2] Build by-professional comparison table (count, completion rate, no-show rate)
- [ ] T022 [P] [US2] Build by-hour/day-of-week heatmap
- [ ] T023 [US2] Build professional and service filter dropdowns
- [ ] T024 [US2] Wire filters to re-fetch analytics data

**Checkpoint**: Appointment analytics with charts and filters

---

## Phase 5: User Story 3 - Revenue Analytics (Priority: P1)

**Goal**: Owners view revenue breakdown and trends.

**Independent Test**: View revenue charts → verify totals match → verify by-service breakdown.

### Implementation

- [ ] T025 [US3] Build revenue summary cards (total, deposits, pending, average ticket)
- [ ] T026 [US3] Build by-service pie chart
- [ ] T027 [P] [US3] Build by-payment-method breakdown (PIX, card, cash, convenio)
- [ ] T028 [US3] Build revenue trend line chart (daily/weekly/monthly granularity)

**Checkpoint**: Revenue analytics with charts and trends

---

## Phase 6: User Story 4 - Patient and AI Analytics (Priority: P2)

**Goal**: Owners view patient acquisition and AI performance metrics.

**Independent Test**: View patient metrics → verify new vs. returning → view AI metrics → verify handoff rate.

### Implementation

- [ ] T029 [US4] Build patient metrics cards (new, returning, unique served)
- [ ] T030 [US4] Build acquisition channel breakdown chart (WhatsApp, flow, web, manual, referral)
- [ ] T031 [P] [US4] Build AI performance cards (conversations, AI-handled %, handoff rate, avg response time)
- [ ] T032 [US4] Build AI booking conversion metric (appointments booked by AI / total conversations)
- [ ] T033 [P] [US4] Add warning indicators for high handoff rates or low AI handling

**Checkpoint**: Patient and AI analytics functional

---

## Phase 7: User Story 5 - Data Export (Priority: P3)

**Goal**: Owners can export analytics data as CSV or Excel.

**Independent Test**: Select sections → export → download → verify file contents.

### Implementation

- [ ] T034 [US5] Implement POST /analytics/export endpoint (queue export job)
- [ ] T035 [US5] Implement export processing Cloud Function (generate CSV/Excel file, upload to storage)
- [ ] T036 [US5] Build export dialog (section selection, format picker, date range)
- [ ] T037 [P] [US5] Build export status tracking with download link
- [ ] T038 [US5] Implement export file expiration (auto-delete after 24 hours)

**Checkpoint**: Data export works end-to-end

---

## Phase 8: Polish & Cross-Cutting Concerns

- [ ] T039 [P] Add loading skeletons for all chart components
- [ ] T040 [P] Add empty states for clinics with no data
- [ ] T041 [P] Add i18n translations for analytics labels
- [ ] T042 Add responsive layout for mobile view
- [ ] T043 Run quickstart.md validation

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies
- **Foundational (Phase 2)**: Depends on Phase 1
- **US1 Overview (Phase 3)**: Depends on Phase 2
- **US2 Appointments (Phase 4)**: Depends on Phase 3
- **US3 Revenue (Phase 5)**: Depends on Phase 3
- **US4 Patient/AI (Phase 6)**: Depends on Phase 3
- **US5 Export (Phase 7)**: Depends on Phase 2
- **Polish (Phase 8)**: Depends on all

### Parallel Opportunities

- T002, T003, T004 (schemas and utilities)
- T007, T009, T010, T011, T013, T014 (API endpoints and indexes)
- T019 (comparison indicators parallel to metric cards)
- T022 (heatmap parallel to bar chart)
- T027 (payment method parallel to service chart)
- T031, T033 (AI cards and warnings parallel)
- T037 (status tracking parallel to export processing)
- Phase 4, Phase 5, and Phase 6 can overlap after Phase 3
- Phase 7 can start parallel to Phase 4
