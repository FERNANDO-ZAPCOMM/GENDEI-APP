# Data Model: Analytics Dashboard

**Feature**: 014-analytics-dashboard
**Date**: 2026-02-04

---

## Collections Overview

```
gendei_analytics_snapshots (top-level)
├── {clinicId}_{date}_{period}

gendei_analytics_exports (top-level)
├── {exportId}
```

---

## Analytics Snapshot Document

**Collection**: `gendei_analytics_snapshots`

**Document ID**: `{clinicId}_{YYYY-MM-DD}_{period}`

```typescript
interface AnalyticsSnapshot {
  // Identity
  clinicId: string;
  date: string;      // YYYY-MM-DD
  period: 'daily' | 'weekly' | 'monthly';

  // Appointment metrics
  appointments: {
    total: number;
    byStatus: {
      pending: number;
      awaiting_confirmation: number;
      confirmed: number;
      confirmed_presence: number;
      completed: number;
      cancelled: number;
      no_show: number;
    };
    byProfessional: Record<string, number>;
    byService: Record<string, number>;
    byHour: Record<string, number>;  // '09' -> count
    byDayOfWeek: Record<string, number>;  // '0' (Sunday) -> count
    totalDurationMinutes: number;
    completionRate: number;
    noShowRate: number;
    cancellationRate: number;
  };

  // Revenue metrics
  revenue: {
    totalCents: number;
    depositsCents: number;
    pendingCents: number;
    collectedCents: number;
    byService: Record<string, number>;
    byProfessional: Record<string, number>;
    byPaymentMethod: {
      pix: number;
      card: number;
      cash: number;
      convenio: number;
      other: number;
    };
    averageTicketCents: number;
  };

  // Patient metrics
  patients: {
    totalActive: number;
    newPatients: number;
    returningPatients: number;
    uniquePatientsServed: number;
    averageVisitsPerPatient: number;
    byAcquisitionChannel: {
      whatsapp: number;
      whatsapp_flow: number;
      web: number;
      manual: number;
      referral: number;
    };
  };

  // Professional metrics
  professionals: Record<string, {
    appointments: number;
    completed: number;
    cancelled: number;
    noShow: number;
    revenueCents: number;
    totalWorkingMinutes: number;
    totalBookedMinutes: number;
    utilizationRate: number;
    averageRating?: number;
    ratingCount?: number;
  }>;

  // AI metrics
  ai: {
    totalConversations: number;
    messagesReceived: number;
    messagesHandledByAI: number;
    messagesHandledByHuman: number;
    handoffs: number;
    handoffRate: number;
    averageResponseTimeSeconds: number;
    appointmentsBookedByAI: number;
    appointmentConversionRate: number;
  };

  // Timestamps
  computedAt: Timestamp;
  updatedAt: Timestamp;
}
```

---

## Analytics Export Document

**Collection**: `gendei_analytics_exports`

```typescript
interface AnalyticsExport {
  id: string;
  clinicId: string;

  // Request
  requestedBy: string;
  requestedAt: Timestamp;

  // Parameters
  dateRange: {
    from: string;  // YYYY-MM-DD
    to: string;
  };
  sections: string[];  // ['appointments', 'revenue', 'patients']
  format: 'csv' | 'xlsx';
  includeRawData: boolean;

  // Status
  status: 'pending' | 'processing' | 'completed' | 'failed';
  processedAt?: Timestamp;
  completedAt?: Timestamp;
  errorMessage?: string;

  // Output
  fileUrl?: string;
  fileSizeBytes?: number;
  expiresAt?: Timestamp;

  createdAt: Timestamp;
}
```

---

## Comparison Metrics (Computed)

```typescript
interface AnalyticsComparison {
  current: AnalyticsSnapshot;
  previous: AnalyticsSnapshot;

  changes: {
    appointments: {
      total: number;  // percentage change
      completed: number;
      noShowRate: number;
    };
    revenue: {
      total: number;
      averageTicket: number;
    };
    patients: {
      new: number;
      returning: number;
    };
  };
}
```

---

## Zod Schemas

```typescript
import { z } from 'zod';

export const dateRangeSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const analyticsQuerySchema = z.object({
  dateRange: dateRangeSchema,
  professionalId: z.string().optional(),
  serviceId: z.string().optional(),
  granularity: z.enum(['daily', 'weekly', 'monthly']).default('daily'),
  compareWithPrevious: z.boolean().default(true),
});

export const exportRequestSchema = z.object({
  dateRange: dateRangeSchema,
  sections: z.array(z.enum([
    'appointments',
    'revenue',
    'patients',
    'professionals',
    'ai',
  ])),
  format: z.enum(['csv', 'xlsx']).default('csv'),
  includeRawData: z.boolean().default(false),
});
```

---

## Firestore Indexes

```javascript
// Snapshots by clinic and date
{
  collectionGroup: 'gendei_analytics_snapshots',
  fields: [
    { fieldPath: 'clinicId', order: 'ASCENDING' },
    { fieldPath: 'period', order: 'ASCENDING' },
    { fieldPath: 'date', order: 'DESCENDING' }
  ]
}

// Exports by clinic
{
  collectionGroup: 'gendei_analytics_exports',
  fields: [
    { fieldPath: 'clinicId', order: 'ASCENDING' },
    { fieldPath: 'requestedAt', order: 'DESCENDING' }
  ]
}
```

---

## Example Documents

### Daily Snapshot

```json
{
  "clinicId": "clinic_xyz",
  "date": "2026-02-03",
  "period": "daily",
  "appointments": {
    "total": 25,
    "byStatus": {
      "pending": 0,
      "awaiting_confirmation": 0,
      "confirmed": 2,
      "confirmed_presence": 0,
      "completed": 20,
      "cancelled": 2,
      "no_show": 1
    },
    "byProfessional": {
      "prof_001": 12,
      "prof_002": 8,
      "prof_003": 5
    },
    "byService": {
      "service_001": 15,
      "service_002": 10
    },
    "byHour": {
      "08": 2, "09": 4, "10": 5, "11": 4,
      "14": 3, "15": 4, "16": 2, "17": 1
    },
    "byDayOfWeek": { "1": 25 },
    "totalDurationMinutes": 750,
    "completionRate": 0.8,
    "noShowRate": 0.04,
    "cancellationRate": 0.08
  },
  "revenue": {
    "totalCents": 500000,
    "depositsCents": 150000,
    "pendingCents": 50000,
    "collectedCents": 450000,
    "byService": {
      "service_001": 300000,
      "service_002": 200000
    },
    "byProfessional": {
      "prof_001": 240000,
      "prof_002": 160000,
      "prof_003": 100000
    },
    "byPaymentMethod": {
      "pix": 300000,
      "card": 100000,
      "cash": 50000,
      "convenio": 50000,
      "other": 0
    },
    "averageTicketCents": 20000
  },
  "patients": {
    "totalActive": 450,
    "newPatients": 5,
    "returningPatients": 15,
    "uniquePatientsServed": 20,
    "averageVisitsPerPatient": 1.25,
    "byAcquisitionChannel": {
      "whatsapp": 3,
      "whatsapp_flow": 1,
      "web": 0,
      "manual": 1,
      "referral": 0
    }
  },
  "professionals": {
    "prof_001": {
      "appointments": 12,
      "completed": 10,
      "cancelled": 1,
      "noShow": 1,
      "revenueCents": 240000,
      "totalWorkingMinutes": 480,
      "totalBookedMinutes": 360,
      "utilizationRate": 0.75,
      "averageRating": 4.8,
      "ratingCount": 8
    }
  },
  "ai": {
    "totalConversations": 35,
    "messagesReceived": 120,
    "messagesHandledByAI": 100,
    "messagesHandledByHuman": 20,
    "handoffs": 5,
    "handoffRate": 0.14,
    "averageResponseTimeSeconds": 3.5,
    "appointmentsBookedByAI": 8,
    "appointmentConversionRate": 0.23
  },
  "computedAt": "2026-02-04T01:00:00Z",
  "updatedAt": "2026-02-04T01:00:00Z"
}
```

### Export Document

```json
{
  "id": "export_abc123",
  "clinicId": "clinic_xyz",
  "requestedBy": "user_456",
  "requestedAt": "2026-02-04T10:00:00Z",
  "dateRange": {
    "from": "2026-01-01",
    "to": "2026-01-31"
  },
  "sections": ["appointments", "revenue", "patients"],
  "format": "xlsx",
  "includeRawData": false,
  "status": "completed",
  "processedAt": "2026-02-04T10:00:05Z",
  "completedAt": "2026-02-04T10:00:10Z",
  "fileUrl": "https://storage.googleapis.com/...",
  "fileSizeBytes": 245760,
  "expiresAt": "2026-02-11T10:00:00Z",
  "createdAt": "2026-02-04T10:00:00Z"
}
```
