# Plan: Reminder System

**Feature**: 010-reminder-system
**Status**: Planning
**Date**: 2026-02-04

---

## Overview

Implement automated appointment reminders via WhatsApp, including configurable reminder schedules, confirmation requests, no-show follow-ups, and smart retry logic.

---

## Technical Stack

| Layer | Technology |
|-------|------------|
| Scheduler | Firebase Cloud Scheduler |
| Queue | Firestore + Cloud Functions |
| Messaging | WhatsApp Cloud API |
| Processing | Cloud Functions (Node.js) |

---

## Key Features

1. Configurable reminder schedules (24h, 2h before)
2. Appointment confirmation requests
3. No-show follow-up messages
4. Birthday and follow-up reminders
5. Smart retry with exponential backoff
6. Reminder templates per clinic
7. Analytics and delivery tracking

---

## Reminder Types

| Type | Timing | Purpose |
|------|--------|---------|
| REMINDER_24H | 24 hours before | Initial reminder |
| REMINDER_2H | 2 hours before | Final reminder |
| CONFIRMATION | After scheduling | Request deposit/confirm |
| NO_SHOW | After missed appt | Re-engagement |
| FOLLOW_UP | X days after visit | Satisfaction/return |
| BIRTHDAY | On patient birthday | Engagement |

---

## System Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌───────────────┐
│ Cloud Scheduler │───▶│ Reminder Worker  │───▶│ WhatsApp API  │
│ (every 5 min)   │    │ (Cloud Function) │    │               │
└─────────────────┘    └──────────────────┘    └───────────────┘
                              │
                              ▼
                       ┌──────────────────┐
                       │    Firestore     │
                       │ gendei_reminders │
                       └──────────────────┘
```

---

## Processing Flow

```
1. Scheduler triggers every 5 minutes
2. Query reminders where scheduledFor <= now AND status = 'pending'
3. Process in batches (max 50)
4. For each reminder:
   a. Check appointment still valid
   b. Send WhatsApp message
   c. Update status to 'sent' or 'failed'
   d. Log delivery attempt
5. Retry failed with backoff
```

---

## Data Model

### Reminder Document

```typescript
interface Reminder {
  id: string;
  clinicId: string;
  appointmentId?: string;
  patientId: string;

  // Type and scheduling
  type: ReminderType;
  scheduledFor: Timestamp;

  // Status tracking
  status: 'pending' | 'sent' | 'failed' | 'cancelled';
  attempts: number;
  lastAttemptAt?: Timestamp;
  sentAt?: Timestamp;
  errorMessage?: string;

  // Message content
  templateId?: string;
  variables: Record<string, string>;

  // WhatsApp tracking
  waMessageId?: string;

  createdAt: Timestamp;
}
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /reminders | List clinic reminders |
| POST | /reminders | Create manual reminder |
| DELETE | /reminders/:id | Cancel reminder |
| PUT | /clinics/:id/settings/reminderSettings | Update settings |
| GET | /reminders/analytics | Delivery stats |

---

## Success Metrics

- 95%+ delivery rate
- < 30 second processing time
- Zero duplicate sends
- Configurable in < 2 minutes
