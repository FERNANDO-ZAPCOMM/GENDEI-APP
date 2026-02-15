# Research: Reminder System

**Feature**: 010-reminder-system
**Date**: 2026-02-04
**Updated**: 2026-02-15

---

## Technical Decisions

### 1. Storage Strategy

**Decision**: Boolean flags on appointment documents (no separate collection)

**Options**:
| Approach | Pros | Cons | Decision |
|----------|------|------|----------|
| Separate `gendei_reminders` collection | Rich tracking, analytics | Complex queries, cross-collection sync | Rejected |
| Flags on appointment documents | Simple, natural dedup, no cross-collection issues | Limited tracking | **Selected** |
| Cloud Tasks per reminder | Exact timing, built-in retry | Complex setup, costly | Rejected |

**Why flags on appointments**:
- Deduplication is automatic (flag already set = skip)
- No need for cross-collection joins
- Appointment status transitions are co-located with reminder state
- Simpler query: just filter by date window + status + flag

### 2. Scheduling Architecture

**Decision**: Cloud Scheduler every 15 minutes with time-window queries

**Flow**:
```
1. Cloud Scheduler fires POST /reminders/trigger every 15 minutes
2. Service calculates two time windows:
   - 24h: appointments between now+23h and now+25h
   - 2h: appointments between now+1.5h and now+2.5h
3. Query appointments by date range + confirmed status
4. Filter: only those without the reminder flag set
5. Send each via WhatsApp Agent, update flags
```

**Why 15 minutes (not 5)**:
- 2-hour overlap windows (23-25h and 1.5-2.5h) are wide enough to catch all appointments
- Reduces Cloud Function invocations and costs
- No urgency requiring sub-15-minute precision

### 3. Message Content

**Decision**: Hardcoded vertical-aware message formatting (no template system)

**Why no templates**:
- Only 2 message types (24h and 2h)
- Vertical terminology handled by `getVerticalTerms()` function
- Template system adds complexity without proportional benefit at this stage
- Messages are professional and consistent across all clinics

**Variables used**:
- `firstName`: Patient first name
- `appointmentTerm`: "consulta" or "sessao" (from vertical config)
- `professionalEmoji`: Vertical-specific emoji
- `professionalName`: Doctor/therapist name
- `formattedDate`: DD/MM format
- `dayName`: Portuguese day of week
- `time`: HH:MM
- `address`: Clinic address (optional)
- `showArriveEarlyTip`: Whether to show arrival tip (from vertical config)

### 4. Delivery Channel

**Decision**: Send via WhatsApp Agent service (not direct WhatsApp API)

**Why via WhatsApp Agent**:
- Agent already handles WhatsApp Cloud API authentication
- Centralizes WhatsApp message sending in one service
- Agent runs on Cloud Run with proper credentials
- Endpoint: `POST /api/send-reminder`

### 5. Status Transition

**Decision**: 24h reminder changes appointment status to `awaiting_confirmation`

**Why**:
- Signals that the patient has been notified and should confirm
- Enables the WhatsApp agent to understand the appointment's current state
- Only the 24h reminder triggers this (2h reminder does not change status)

---

## Vertical Configuration

The reminder service uses a minimal vertical config (`verticals.ts`) with only the fields needed for message formatting:

```typescript
// 5 verticals configured, others use defaults
med:    { appointmentTerm: 'consulta', professionalEmoji: 'doctor', showArriveEarlyTip: true }
dental: { appointmentTerm: 'consulta', professionalEmoji: 'tooth',  showArriveEarlyTip: true }
psi:    { appointmentTerm: 'sessao',   professionalEmoji: 'brain',  showArriveEarlyTip: false }
nutri:  { appointmentTerm: 'consulta', professionalEmoji: 'salad',  showArriveEarlyTip: false }
fisio:  { appointmentTerm: 'sessao',   professionalEmoji: 'muscle', showArriveEarlyTip: true }
```

---

## Future Considerations

Features that were considered but deferred:
- **Template system**: Clinic-customizable message templates
- **No-show follow-ups**: Re-engagement messages after missed appointments
- **Birthday reminders**: Automated birthday greetings
- **Analytics**: Delivery rate tracking and engagement metrics
- **Quiet hours**: Don't-disturb time windows
- **Retry logic**: Exponential backoff on failures

These may be added when there's clear demand from clinics.

---

## References

- [Cloud Scheduler Documentation](https://cloud.google.com/scheduler/docs)
- [WhatsApp Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api)
