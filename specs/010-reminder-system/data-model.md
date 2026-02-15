# Data Model: Reminder System

**Feature**: 010-reminder-system
**Date**: 2026-02-04
**Updated**: 2026-02-15

---

## Design Decision: Flags on Appointments (No Separate Collection)

Instead of a separate `gendei_reminders` collection, reminder tracking uses boolean flags directly on `gendei_appointments` documents. This is simpler, avoids cross-collection queries, and guarantees deduplication naturally.

---

## Appointment Reminder Flags

Added to existing `gendei_appointments` documents:

```typescript
interface AppointmentReminderFields {
  // 24h reminder
  reminder24hSent?: boolean;       // true when 24h reminder sent
  reminder24hAt?: Timestamp;       // when it was sent

  // 2h reminder
  reminder2hSent?: boolean;        // true when 2h reminder sent
  reminder2hAt?: Timestamp;        // when it was sent
}
```

> These fields are set by the reminder service after successful delivery. They serve as both tracking and deduplication mechanisms.

---

## Vertical Terms Configuration

```typescript
// apps/functions/src/services/verticals.ts

interface VerticalTerms {
  appointmentTerm: string;       // 'consulta' | 'sessao'
  professionalEmoji: string;     // vertical-specific emoji
  showArriveEarlyTip: boolean;   // whether to show "arrive 15min early"
}
```

| Vertical | appointmentTerm | professionalEmoji | showArriveEarlyTip |
|----------|----------------|-------------------|--------------------|
| med | consulta | doctor | true |
| dental | consulta | tooth | true |
| psi | sessao | brain | false |
| nutri | consulta | salad | false |
| fisio | sessao | muscle | true |
| (default) | consulta | doctor | true |

---

## Reminder Result

```typescript
interface ReminderResult {
  sent24h: number;    // count of 24h reminders sent
  sent2h: number;     // count of 2h reminders sent
  errors: number;     // count of failures
}
```

---

## WhatsApp Agent Reminder Payload

Sent to `POST /api/send-reminder`:

```typescript
interface SendReminderPayload {
  clinicId: string;
  phoneNumberId: string;
  accessToken: string;
  patientPhone: string;
  message: string;           // pre-formatted message
  reminderType: '24h' | '2h';
  appointmentId: string;
}
```

---

## Example: Appointment Before and After Reminder

### Before 24h reminder:

```json
{
  "id": "apt_456",
  "clinicId": "clinic_xyz",
  "patientPhone": "+5511999998888",
  "patientName": "Maria Silva",
  "professionalName": "Dr. Joao",
  "date": "2026-02-16",
  "time": "14:00",
  "status": "confirmed"
}
```

### After 24h reminder:

```json
{
  "id": "apt_456",
  "clinicId": "clinic_xyz",
  "patientPhone": "+5511999998888",
  "patientName": "Maria Silva",
  "professionalName": "Dr. Joao",
  "date": "2026-02-16",
  "time": "14:00",
  "status": "awaiting_confirmation",
  "reminder24hSent": true,
  "reminder24hAt": "2026-02-15T14:15:00Z"
}
```

### After 2h reminder:

```json
{
  "id": "apt_456",
  "status": "awaiting_confirmation",
  "reminder24hSent": true,
  "reminder24hAt": "2026-02-15T14:15:00Z",
  "reminder2hSent": true,
  "reminder2hAt": "2026-02-16T12:00:00Z"
}
```
