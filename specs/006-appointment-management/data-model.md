# Data Model: Appointment Management

**Feature**: 006-appointment-management
**Date**: 2026-02-04

---

## Firestore Collections

### Collection: `gendei_appointments`

**Path**: `gendei_appointments/{appointmentId}`

---

## TypeScript Interfaces

```typescript
import { Timestamp } from 'firebase/firestore';

type AppointmentStatus =
  | 'pending'
  | 'awaiting_confirmation'
  | 'confirmed'
  | 'confirmed_presence'
  | 'completed'
  | 'cancelled'
  | 'no_show';

type AppointmentSource = 'whatsapp' | 'dashboard' | 'api';

interface StatusChange {
  from: AppointmentStatus;
  to: AppointmentStatus;
  changedAt: string;
  changedBy?: string;
  reason?: string;
}

interface Appointment {
  id: string;
  clinicId: string;

  // References
  patientId: string;
  professionalId: string;
  serviceId: string;

  // Scheduling
  date: string;  // YYYY-MM-DD
  time: string;  // HH:MM
  duration: number;  // minutes
  endTime: string;  // Computed: HH:MM

  // Status
  status: AppointmentStatus;
  statusHistory: StatusChange[];

  // Denormalized patient info
  patientName: string;
  patientPhone: string;

  // Denormalized service info
  serviceName: string;
  servicePrice: number;  // cents

  // Denormalized professional info
  professionalName: string;

  // Deposit
  depositAmount: number;  // cents
  depositPaid: boolean;
  depositPaidAt?: Timestamp;

  // Reminders
  reminder24hSent: boolean;
  reminder24hSentAt?: Timestamp;
  reminder2hSent: boolean;
  reminder2hSentAt?: Timestamp;

  // Source
  source: AppointmentSource;
  conversationId?: string;

  // Notes
  notes?: string;
  internalNotes?: string;

  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy?: string;
}
```

---

### Time Block Model

```typescript
interface TimeBlock {
  id: string;
  clinicId: string;
  professionalId: string;

  // Type
  type: 'vacation' | 'break' | 'meeting' | 'other';
  title: string;

  // Time range
  startDate: string;  // YYYY-MM-DD
  endDate: string;    // YYYY-MM-DD
  startTime?: string; // HH:MM (null = all day)
  endTime?: string;   // HH:MM

  // Recurrence
  isRecurring: boolean;
  recurrenceRule?: string;  // RRULE format

  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

**Path**: `gendei_clinics/{clinicId}/timeBlocks/{blockId}`

---

## Zod Schemas

```typescript
import { z } from 'zod';

const appointmentStatusSchema = z.enum([
  'pending',
  'awaiting_confirmation',
  'confirmed',
  'confirmed_presence',
  'completed',
  'cancelled',
  'no_show',
]);

const appointmentSourceSchema = z.enum(['whatsapp', 'dashboard', 'api']);

export const createAppointmentSchema = z.object({
  patientId: z.string().min(1),
  professionalId: z.string().min(1),
  serviceId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  patientName: z.string().min(1),
  patientPhone: z.string().min(10),
  notes: z.string().optional(),
  source: appointmentSourceSchema.default('dashboard'),
});

export const updateAppointmentSchema = createAppointmentSchema.partial();

export const rescheduleSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  reason: z.string().optional(),
});

export const updateStatusSchema = z.object({
  status: appointmentStatusSchema,
  reason: z.string().optional(),
});
```

---

## Status Transitions

```typescript
const VALID_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  pending: ['awaiting_confirmation', 'confirmed', 'cancelled'],
  awaiting_confirmation: ['confirmed', 'cancelled', 'no_show'],
  confirmed: ['confirmed_presence', 'cancelled', 'no_show'],
  confirmed_presence: ['completed', 'no_show'],
  completed: [],
  cancelled: [],
  no_show: [],
};

function canTransition(from: AppointmentStatus, to: AppointmentStatus): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}
```

---

## Indexes

```json
{
  "indexes": [
    {
      "collectionGroup": "gendei_appointments",
      "fields": [
        { "fieldPath": "clinicId", "order": "ASCENDING" },
        { "fieldPath": "date", "order": "ASCENDING" },
        { "fieldPath": "time", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "gendei_appointments",
      "fields": [
        { "fieldPath": "clinicId", "order": "ASCENDING" },
        { "fieldPath": "professionalId", "order": "ASCENDING" },
        { "fieldPath": "date", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "gendei_appointments",
      "fields": [
        { "fieldPath": "clinicId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "date", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "gendei_appointments",
      "fields": [
        { "fieldPath": "patientId", "order": "ASCENDING" },
        { "fieldPath": "date", "order": "DESCENDING" }
      ]
    }
  ]
}
```

---

## Example Document

```json
{
  "id": "apt_abc123",
  "clinicId": "clinic_xyz",
  "patientId": "patient_001",
  "professionalId": "prof_002",
  "serviceId": "svc_003",
  "date": "2026-02-05",
  "time": "09:00",
  "duration": 30,
  "endTime": "09:30",
  "status": "confirmed",
  "statusHistory": [
    {"from": "pending", "to": "awaiting_confirmation", "changedAt": "2026-02-04T10:00:00Z"},
    {"from": "awaiting_confirmation", "to": "confirmed", "changedAt": "2026-02-04T15:00:00Z"}
  ],
  "patientName": "João Silva",
  "patientPhone": "+5511999998888",
  "serviceName": "Consulta Geral",
  "servicePrice": 15000,
  "professionalName": "Dr. Carlos",
  "depositAmount": 4500,
  "depositPaid": true,
  "depositPaidAt": "2026-02-04T15:05:00Z",
  "reminder24hSent": true,
  "reminder24hSentAt": "2026-02-04T09:00:00Z",
  "reminder2hSent": false,
  "source": "whatsapp",
  "conversationId": "conv_789",
  "notes": "Primeira consulta",
  "createdAt": "2026-02-01T10:00:00Z",
  "updatedAt": "2026-02-04T15:05:00Z"
}
```

---

## Query Patterns

### Get appointments for date range
```typescript
const appointments = await db.collection('gendei_appointments')
  .where('clinicId', '==', clinicId)
  .where('date', '>=', startDate)
  .where('date', '<=', endDate)
  .orderBy('date')
  .orderBy('time')
  .get();
```

### Get today's appointments by professional
```typescript
const today = new Date().toISOString().split('T')[0];
const appointments = await db.collection('gendei_appointments')
  .where('clinicId', '==', clinicId)
  .where('professionalId', '==', professionalId)
  .where('date', '==', today)
  .orderBy('time')
  .get();
```

### Get appointments needing 24h reminder
```typescript
const tomorrow = /* calculate tomorrow's date */;
const appointments = await db.collection('gendei_appointments')
  .where('date', '==', tomorrow)
  .where('reminder24hSent', '==', false)
  .where('status', 'in', ['pending', 'awaiting_confirmation', 'confirmed'])
  .get();
```
