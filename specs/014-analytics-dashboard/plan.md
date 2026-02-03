# Plan: Analytics Dashboard

**Feature**: 014-analytics-dashboard
**Status**: Planning
**Date**: 2026-02-04

---

## Overview

Implement a comprehensive analytics dashboard for clinics to track appointments, revenue, patient metrics, professional performance, and AI assistant effectiveness.

---

## Technical Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16 + React 19 |
| Charts | Recharts / Tremor |
| Backend | Firebase Functions |
| Aggregation | Firestore + scheduled jobs |
| Export | CSV/Excel generation |

---

## Key Features

1. Real-time appointment metrics
2. Revenue tracking and forecasting
3. Patient acquisition and retention metrics
4. Professional performance comparison
5. AI assistant effectiveness metrics
6. Custom date range selection
7. Data export capabilities

---

## Dashboard Sections

| Section | Metrics |
|---------|---------|
| Overview | Total appointments, revenue, new patients |
| Appointments | By status, by professional, by service |
| Revenue | Daily/monthly, by service, projections |
| Patients | New vs returning, demographics, retention |
| Professionals | Utilization, ratings, no-show rates |
| AI Performance | Response rate, handoff rate, satisfaction |

---

## User Flow

```
1. User opens Analytics page
2. Dashboard loads with current month data
3. User can:
   - Select different date ranges
   - Filter by professional/service
   - Drill down into specific metrics
   - Export data as CSV/Excel
4. Charts update in real-time
```

---

## Data Model

### Analytics Snapshot

```typescript
interface AnalyticsSnapshot {
  clinicId: string;
  period: string;  // 'daily' | 'weekly' | 'monthly'
  date: string;    // YYYY-MM-DD or YYYY-MM or YYYY-Www

  appointments: AppointmentMetrics;
  revenue: RevenueMetrics;
  patients: PatientMetrics;
  professionals: ProfessionalMetrics;
  ai: AIMetrics;

  updatedAt: Timestamp;
}
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /analytics/overview | Get overview metrics |
| GET | /analytics/appointments | Appointment analytics |
| GET | /analytics/revenue | Revenue analytics |
| GET | /analytics/patients | Patient analytics |
| GET | /analytics/professionals | Professional analytics |
| GET | /analytics/ai | AI performance metrics |
| GET | /analytics/export | Export data |

---

## Success Metrics

- Dashboard load time < 2 seconds
- Data freshness < 5 minutes
- Export generation < 10 seconds
- Zero calculation errors
