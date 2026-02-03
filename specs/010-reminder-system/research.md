# Research: Reminder System

**Feature**: 010-reminder-system
**Date**: 2026-02-04

---

## Technical Decisions

### 1. Scheduling Architecture

**Decision**: Firestore document-based queue with Cloud Scheduler trigger

**Options**:
| Approach | Pros | Cons | Decision |
|----------|------|------|----------|
| Firestore queue | Simple, queryable, audit trail | Poll-based | **Selected** |
| Cloud Tasks | Exact timing, retry built-in | Complex setup | Future |
| Pub/Sub | Scalable, decoupled | Overkill for MVP | Rejected |

**Why Firestore Queue**:
- Reminders are queryable and auditable
- Easy to cancel or reschedule
- Natural integration with existing stack
- 5-minute polling acceptable for reminder use case

### 2. Reminder Creation Strategy

**Decision**: Create reminders when appointment is confirmed

**Flow**:
```
1. Appointment created → status: 'pending'
2. Deposit paid or confirmed → status: 'confirmed'
3. On confirmation → create reminder documents:
   - 24h reminder (if > 24h away)
   - 2h reminder (if > 2h away)
4. Appointment cancelled → mark reminders as 'cancelled'
```

### 3. Message Templates

**Decision**: Clinic-configurable templates with variable interpolation

**Variables Available**:
```typescript
interface ReminderVariables {
  patientName: string;
  patientFirstName: string;
  clinicName: string;
  professionalName: string;
  serviceName: string;
  appointmentDate: string;  // "05 de fevereiro"
  appointmentTime: string;  // "14:30"
  appointmentDay: string;   // "amanhã" | "hoje"
  confirmationLink?: string;
  pixCode?: string;
}
```

### 4. Retry Strategy

**Decision**: Exponential backoff with max 3 attempts

```typescript
const RETRY_DELAYS = [
  5 * 60 * 1000,   // 5 minutes
  30 * 60 * 1000,  // 30 minutes
  2 * 60 * 60 * 1000, // 2 hours
];

function getNextRetryTime(attempts: number): Date | null {
  if (attempts >= RETRY_DELAYS.length) return null;
  return new Date(Date.now() + RETRY_DELAYS[attempts]);
}
```

---

## Default Message Templates

### 24-Hour Reminder (Portuguese)

```
Olá {{patientFirstName}}! 👋

Lembrete da sua consulta *{{appointmentDay}}*:

📅 {{appointmentDate}}
⏰ {{appointmentTime}}
👨‍⚕️ {{professionalName}}
📍 {{clinicName}}

Para confirmar, responda *SIM*.
Para reagendar, responda *REAGENDAR*.

Até amanhã! 😊
```

### 2-Hour Reminder

```
{{patientFirstName}}, sua consulta é em *2 horas*! ⏰

📅 Hoje, {{appointmentTime}}
👨‍⚕️ {{professionalName}}

Lembre-se de chegar com 10 minutos de antecedência.

Até já! 🏥
```

### No-Show Follow-up

```
Olá {{patientFirstName}},

Sentimos sua falta na consulta de {{appointmentDate}}. 😔

Gostaria de reagendar? Responda com *REAGENDAR* e encontraremos um novo horário.

{{clinicName}}
```

---

## Duplicate Prevention

```typescript
async function createReminderIfNotExists(
  appointmentId: string,
  type: ReminderType,
  scheduledFor: Date
): Promise<boolean> {
  const existingQuery = await db.collection('gendei_reminders')
    .where('appointmentId', '==', appointmentId)
    .where('type', '==', type)
    .where('status', 'in', ['pending', 'sent'])
    .limit(1)
    .get();

  if (!existingQuery.empty) {
    return false; // Already exists
  }

  await db.collection('gendei_reminders').add({
    appointmentId,
    type,
    scheduledFor: Timestamp.fromDate(scheduledFor),
    status: 'pending',
    attempts: 0,
    createdAt: FieldValue.serverTimestamp(),
  });

  return true;
}
```

---

## Timezone Handling

```typescript
// All times stored in UTC
// Display converted to clinic timezone

function calculateReminderTime(
  appointmentTime: Date,
  hoursBeforeUtc: number
): Date {
  return new Date(appointmentTime.getTime() - hoursBeforeUtc * 60 * 60 * 1000);
}

// Example: Appointment at 14:00 BRT (17:00 UTC)
// 24h reminder: 17:00 UTC - 24h = previous day 17:00 UTC (14:00 BRT)
```

---

## Clinic Settings Schema

```typescript
interface ReminderSettings {
  enabled: boolean;

  // Which reminders to send
  reminder24h: boolean;
  reminder2h: boolean;
  noShowFollowup: boolean;
  birthdayReminder: boolean;

  // Timing customization
  reminder24hHoursBefore: number;  // default: 24
  reminder2hHoursBefore: number;   // default: 2
  noShowFollowupHours: number;     // default: 24

  // Custom templates (optional)
  templates?: {
    reminder24h?: string;
    reminder2h?: string;
    noShow?: string;
    birthday?: string;
  };
}
```

---

## Analytics Tracking

```typescript
interface ReminderAnalytics {
  clinicId: string;
  period: string;  // '2026-02' (monthly)

  // Counts
  totalScheduled: number;
  totalSent: number;
  totalFailed: number;
  totalCancelled: number;

  // By type
  byType: Record<ReminderType, {
    scheduled: number;
    sent: number;
    failed: number;
  }>;

  // Engagement (from AI responses)
  confirmations: number;
  reschedules: number;
  cancellations: number;
}
```

---

## References

- [Cloud Scheduler Documentation](https://cloud.google.com/scheduler/docs)
- [WhatsApp Message Templates](https://developers.facebook.com/docs/whatsapp/message-templates)
