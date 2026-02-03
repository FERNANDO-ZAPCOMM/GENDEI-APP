# Data Model: Reminder System

**Feature**: 010-reminder-system
**Date**: 2026-02-04

---

## Collections Overview

```
gendei_reminders (top-level)
├── {reminderId}

gendei_reminder_templates (subcollection)
└── gendei_clinics/{clinicId}/reminder_templates/{templateId}

gendei_reminder_analytics (top-level)
├── {clinicId}_{period}
```

---

## Reminder Document

**Collection**: `gendei_reminders`

```typescript
interface Reminder {
  // Identity
  id: string;
  clinicId: string;
  appointmentId?: string;
  patientId: string;
  patientPhone: string;

  // Type and category
  type: ReminderType;
  category: 'appointment' | 'engagement' | 'follow_up';

  // Scheduling
  scheduledFor: Timestamp;
  timezone: string;  // e.g., 'America/Sao_Paulo'

  // Status tracking
  status: ReminderStatus;
  attempts: number;
  maxAttempts: number;
  lastAttemptAt?: Timestamp;
  nextRetryAt?: Timestamp;
  sentAt?: Timestamp;

  // Error tracking
  errorCode?: string;
  errorMessage?: string;

  // Message content
  templateId?: string;
  customMessage?: string;
  variables: Record<string, string>;

  // WhatsApp tracking
  waMessageId?: string;
  deliveryStatus?: 'sent' | 'delivered' | 'read' | 'failed';
  deliveryStatusUpdatedAt?: Timestamp;

  // Metadata
  createdBy?: string;  // 'system' | userId
  cancelledBy?: string;
  cancelledAt?: Timestamp;
  cancelReason?: string;

  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

type ReminderType =
  | 'reminder_24h'
  | 'reminder_2h'
  | 'reminder_1h'
  | 'confirmation'
  | 'no_show'
  | 'follow_up'
  | 'birthday'
  | 'custom';

type ReminderStatus =
  | 'pending'
  | 'processing'
  | 'sent'
  | 'delivered'
  | 'failed'
  | 'cancelled'
  | 'skipped';
```

---

## Reminder Template Document

**Collection**: `gendei_clinics/{clinicId}/reminder_templates`

```typescript
interface ReminderTemplate {
  id: string;
  type: ReminderType;
  name: string;
  content: string;
  variables: string[];  // Available variables
  isDefault: boolean;
  active: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

---

## Reminder Settings (on Clinic)

```typescript
interface ReminderSettings {
  // Master switch
  enabled: boolean;

  // Individual reminder toggles
  reminder24h: {
    enabled: boolean;
    hoursBefore: number;  // default: 24
    templateId?: string;
  };

  reminder2h: {
    enabled: boolean;
    hoursBefore: number;  // default: 2
    templateId?: string;
  };

  confirmationReminder: {
    enabled: boolean;
    sendImmediately: boolean;
    templateId?: string;
  };

  noShowFollowup: {
    enabled: boolean;
    hoursAfter: number;  // default: 24
    templateId?: string;
  };

  birthdayReminder: {
    enabled: boolean;
    sendTime: string;  // '09:00'
    templateId?: string;
  };

  // Quiet hours (don't send during these times)
  quietHours?: {
    enabled: boolean;
    start: string;  // '22:00'
    end: string;    // '08:00'
  };
}
```

---

## Reminder Analytics Document

**Collection**: `gendei_reminder_analytics`

**Document ID**: `{clinicId}_{YYYY-MM}`

```typescript
interface ReminderAnalytics {
  clinicId: string;
  period: string;  // 'YYYY-MM'

  // Overall counts
  total: {
    scheduled: number;
    sent: number;
    delivered: number;
    failed: number;
    cancelled: number;
    skipped: number;
  };

  // By type breakdown
  byType: Record<ReminderType, {
    scheduled: number;
    sent: number;
    delivered: number;
    failed: number;
  }>;

  // Patient engagement (tracked via AI responses)
  engagement: {
    confirmations: number;
    rescheduleRequests: number;
    cancellationRequests: number;
    noResponse: number;
  };

  // Error breakdown
  errors: Record<string, number>;  // errorCode -> count

  // Timing metrics
  averageDeliveryTimeMs: number;

  updatedAt: Timestamp;
}
```

---

## Zod Schemas

```typescript
import { z } from 'zod';

export const reminderTypeSchema = z.enum([
  'reminder_24h',
  'reminder_2h',
  'reminder_1h',
  'confirmation',
  'no_show',
  'follow_up',
  'birthday',
  'custom',
]);

export const reminderStatusSchema = z.enum([
  'pending',
  'processing',
  'sent',
  'delivered',
  'failed',
  'cancelled',
  'skipped',
]);

export const createReminderSchema = z.object({
  appointmentId: z.string().optional(),
  patientId: z.string(),
  patientPhone: z.string(),
  type: reminderTypeSchema,
  scheduledFor: z.string().datetime(),
  customMessage: z.string().max(1000).optional(),
  variables: z.record(z.string()).optional(),
});

export const reminderSettingsSchema = z.object({
  enabled: z.boolean(),
  reminder24h: z.object({
    enabled: z.boolean(),
    hoursBefore: z.number().min(1).max(72),
    templateId: z.string().optional(),
  }),
  reminder2h: z.object({
    enabled: z.boolean(),
    hoursBefore: z.number().min(1).max(12),
    templateId: z.string().optional(),
  }),
  confirmationReminder: z.object({
    enabled: z.boolean(),
    sendImmediately: z.boolean(),
    templateId: z.string().optional(),
  }),
  noShowFollowup: z.object({
    enabled: z.boolean(),
    hoursAfter: z.number().min(1).max(72),
    templateId: z.string().optional(),
  }),
  birthdayReminder: z.object({
    enabled: z.boolean(),
    sendTime: z.string().regex(/^\d{2}:\d{2}$/),
    templateId: z.string().optional(),
  }),
  quietHours: z.object({
    enabled: z.boolean(),
    start: z.string().regex(/^\d{2}:\d{2}$/),
    end: z.string().regex(/^\d{2}:\d{2}$/),
  }).optional(),
});

export const reminderTemplateSchema = z.object({
  type: reminderTypeSchema,
  name: z.string().min(1).max(100),
  content: z.string().min(1).max(2000),
  variables: z.array(z.string()),
  active: z.boolean(),
});
```

---

## Firestore Indexes

```javascript
// Reminders to process
{
  collectionGroup: 'gendei_reminders',
  fields: [
    { fieldPath: 'status', order: 'ASCENDING' },
    { fieldPath: 'scheduledFor', order: 'ASCENDING' }
  ]
}

// Reminders by clinic
{
  collectionGroup: 'gendei_reminders',
  fields: [
    { fieldPath: 'clinicId', order: 'ASCENDING' },
    { fieldPath: 'scheduledFor', order: 'DESCENDING' }
  ]
}

// Reminders by appointment
{
  collectionGroup: 'gendei_reminders',
  fields: [
    { fieldPath: 'appointmentId', order: 'ASCENDING' },
    { fieldPath: 'type', order: 'ASCENDING' }
  ]
}
```

---

## Example Documents

### Pending Reminder

```json
{
  "id": "rem_abc123",
  "clinicId": "clinic_xyz",
  "appointmentId": "appt_456",
  "patientId": "patient_789",
  "patientPhone": "+5511999999999",
  "type": "reminder_24h",
  "category": "appointment",
  "scheduledFor": "2026-02-05T14:00:00Z",
  "timezone": "America/Sao_Paulo",
  "status": "pending",
  "attempts": 0,
  "maxAttempts": 3,
  "variables": {
    "patientFirstName": "Maria",
    "appointmentDate": "06 de fevereiro",
    "appointmentTime": "11:00",
    "appointmentDay": "amanhã",
    "professionalName": "Dr. João Silva",
    "clinicName": "Clínica Saúde Total"
  },
  "createdBy": "system",
  "createdAt": "2026-02-04T10:00:00Z",
  "updatedAt": "2026-02-04T10:00:00Z"
}
```

### Sent Reminder

```json
{
  "id": "rem_def456",
  "clinicId": "clinic_xyz",
  "patientId": "patient_123",
  "patientPhone": "+5511888888888",
  "type": "birthday",
  "category": "engagement",
  "scheduledFor": "2026-02-04T12:00:00Z",
  "timezone": "America/Sao_Paulo",
  "status": "delivered",
  "attempts": 1,
  "maxAttempts": 3,
  "lastAttemptAt": "2026-02-04T12:00:15Z",
  "sentAt": "2026-02-04T12:00:15Z",
  "waMessageId": "wamid.xxx",
  "deliveryStatus": "delivered",
  "deliveryStatusUpdatedAt": "2026-02-04T12:00:18Z",
  "variables": {
    "patientFirstName": "João",
    "clinicName": "Clínica Saúde Total"
  },
  "createdBy": "system",
  "createdAt": "2026-02-04T09:00:00Z",
  "updatedAt": "2026-02-04T12:00:18Z"
}
```
