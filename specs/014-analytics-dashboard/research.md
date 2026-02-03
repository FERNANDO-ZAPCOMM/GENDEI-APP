# Research: Analytics Dashboard

**Feature**: 014-analytics-dashboard
**Date**: 2026-02-04

---

## Technical Decisions

### 1. Data Aggregation Strategy

**Decision**: Pre-computed daily snapshots with real-time overlay

**Options**:
| Approach | Pros | Cons | Decision |
|----------|------|------|----------|
| Real-time queries | Always fresh | Expensive, slow | Rejected |
| Pre-computed only | Fast, cheap | Stale data | Rejected |
| Hybrid | Fast + fresh | Complexity | **Selected** |

**Implementation**:
```typescript
// Scheduled job runs at midnight
// Computes previous day's aggregates
// Stores in gendei_analytics_snapshots

// Real-time: for current day only
// Query raw data and merge with snapshots
async function getAnalytics(clinicId: string, from: Date, to: Date) {
  const snapshots = await getSnapshots(clinicId, from, to);

  // If range includes today, add real-time data
  if (isToday(to)) {
    const todayData = await computeTodayMetrics(clinicId);
    snapshots.push(todayData);
  }

  return aggregateSnapshots(snapshots);
}
```

### 2. Chart Library

**Decision**: Recharts with Tremor components

**Options**:
| Library | Pros | Cons | Decision |
|---------|------|------|----------|
| Recharts | React native, flexible | Learning curve | **Selected** |
| Chart.js | Popular, many examples | Not React native | Rejected |
| Tremor | Beautiful, Tailwind | Less customizable | Components only |

### 3. Date Range Handling

**Decision**: Predefined ranges + custom picker

**Ranges**:
- Today
- Yesterday
- Last 7 days
- Last 30 days
- This month
- Last month
- This quarter
- Custom range

### 4. Data Export Format

**Decision**: CSV with optional Excel

**Implementation**:
```typescript
interface ExportOptions {
  format: 'csv' | 'xlsx';
  sections: ('appointments' | 'revenue' | 'patients')[];
  dateRange: { from: Date; to: Date };
  includeRawData: boolean;
}
```

---

## Key Metrics Definitions

### Appointment Metrics

```typescript
interface AppointmentMetrics {
  total: number;
  byStatus: {
    pending: number;
    confirmed: number;
    completed: number;
    cancelled: number;
    noShow: number;
  };
  byProfessional: Record<string, number>;
  byService: Record<string, number>;
  byHour: Record<string, number>;
  byDayOfWeek: Record<string, number>;
  averageDurationMinutes: number;
  completionRate: number;
  noShowRate: number;
  cancellationRate: number;
}
```

### Revenue Metrics

```typescript
interface RevenueMetrics {
  totalCents: number;
  depositsCents: number;
  pendingCents: number;
  byService: Record<string, number>;
  byProfessional: Record<string, number>;
  byPaymentMethod: {
    pix: number;
    card: number;
    cash: number;
    convenio: number;
  };
  averageTicketCents: number;
  projectedMonthCents: number;
}
```

### Patient Metrics

```typescript
interface PatientMetrics {
  total: number;
  new: number;
  returning: number;
  retentionRate: number;
  averageVisitsPerPatient: number;
  topPatients: { id: string; name: string; visits: number }[];
  byAcquisitionChannel: {
    whatsapp: number;
    web: number;
    manual: number;
    referral: number;
  };
}
```

### Professional Metrics

```typescript
interface ProfessionalMetrics {
  byProfessional: Record<string, {
    appointments: number;
    completed: number;
    cancelled: number;
    noShow: number;
    revenue: number;
    averageRating: number;
    utilizationRate: number;
  }>;
}
```

### AI Metrics

```typescript
interface AIMetrics {
  totalConversations: number;
  messagesHandled: number;
  handoffRate: number;
  averageResponseTimeSeconds: number;
  appointmentsBooked: number;
  appointmentConversionRate: number;
  satisfactionScore?: number;
}
```

---

## Dashboard Layout

```
┌─────────────────────────────────────────────────────┐
│  Date Range Picker  │  Professional Filter  │ Export │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
│  │ Consultas │  │ Receita  │  │ Pacientes │          │
│  │   125     │  │ R$25.000 │  │    45     │          │
│  │   +12%    │  │   +8%    │  │   +15%    │          │
│  └──────────┘  └──────────┘  └──────────┘          │
│                                                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌─────────────────────────────────────────┐       │
│  │         Appointments Over Time           │       │
│  │  [Line Chart]                            │       │
│  └─────────────────────────────────────────┘       │
│                                                     │
├─────────────┬───────────────────────────────────────┤
│             │                                       │
│  By Status  │  By Service                           │
│  [Pie]      │  [Bar Chart]                          │
│             │                                       │
├─────────────┴───────────────────────────────────────┤
│                                                     │
│  Professional Performance Table                     │
│  ┌─────────┬────────┬─────────┬──────────┐        │
│  │ Name    │ Appts  │ Revenue │ Rating   │        │
│  ├─────────┼────────┼─────────┼──────────┤        │
│  │ Dr. Ana │ 45     │ R$9.000 │ 4.8 ⭐   │        │
│  └─────────┴────────┴─────────┴──────────┘        │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## Caching Strategy

```typescript
// Client-side: TanStack Query with stale-while-revalidate
const { data } = useQuery({
  queryKey: ['analytics', clinicId, dateRange],
  queryFn: () => fetchAnalytics(clinicId, dateRange),
  staleTime: 5 * 60 * 1000,  // 5 minutes
  cacheTime: 30 * 60 * 1000,  // 30 minutes
});

// Server-side: Redis cache for expensive queries
async function getAnalytics(clinicId: string, range: DateRange) {
  const cacheKey = `analytics:${clinicId}:${range.from}:${range.to}`;
  const cached = await redis.get(cacheKey);

  if (cached) return JSON.parse(cached);

  const data = await computeAnalytics(clinicId, range);
  await redis.setex(cacheKey, 300, JSON.stringify(data));  // 5 min TTL

  return data;
}
```

---

## References

- [Recharts Documentation](https://recharts.org/)
- [Tremor Components](https://www.tremor.so/)
- [Dashboard Design Best Practices](https://www.nngroup.com/articles/dashboard-design/)
