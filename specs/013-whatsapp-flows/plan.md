# Plan: WhatsApp Flows

**Feature**: 013-whatsapp-flows
**Status**: Planning
**Date**: 2026-02-04

---

## Overview

Implement WhatsApp Flows integration for structured data collection within WhatsApp conversations, including appointment booking flows, patient intake forms, and satisfaction surveys.

---

## Technical Stack

| Layer | Technology |
|-------|------------|
| Flows | WhatsApp Flows API |
| Backend | Firebase Functions |
| Storage | Firestore |
| Version | WhatsApp Cloud API v22.0 |

---

## Key Features

1. Appointment booking flow
2. Patient registration flow
3. Pre-appointment intake form
4. Post-appointment satisfaction survey
5. Reschedule/cancellation flow
6. Flow analytics and completion tracking

---

## Flow Types

| Flow | Purpose | Screens |
|------|---------|---------|
| BOOKING | Schedule appointment | Service → Professional → Date → Time → Confirm |
| REGISTRATION | New patient intake | Name → Phone → Birthday → CPF → Address |
| INTAKE | Pre-appointment form | Symptoms → Medications → Allergies |
| SATISFACTION | Post-visit survey | Rating → Feedback → Recommend |
| RESCHEDULE | Change appointment | Current → New Date → Confirm |

---

## System Architecture

```
WhatsApp User
     │
     ▼
┌─────────────┐
│  WhatsApp   │
│   Server    │
└─────────────┘
     │
     ▼ Flow Events
┌─────────────────┐
│  Webhook        │
│  (Functions)    │
└─────────────────┘
     │
     ├──▶ Flow Data Endpoint (for dynamic data)
     │
     ├──▶ Flow Completion Handler
     │
     └──▶ Firestore (store responses)
```

---

## User Flow

### Booking Flow
```
1. AI triggers booking flow
2. User sees service selection screen
3. User selects service
4. User sees professional selection
5. User selects professional
6. User sees available dates
7. User selects date
8. User sees available times
9. User selects time
10. User sees confirmation screen
11. User confirms
12. Flow completes → Appointment created
```

---

## Data Model

### Flow Response

```typescript
interface FlowResponse {
  id: string;
  clinicId: string;
  flowId: string;
  flowType: string;
  patientId?: string;
  patientPhone: string;

  // Response data
  responses: Record<string, any>;
  screens: string[];  // screens completed

  // Status
  status: 'in_progress' | 'completed' | 'abandoned';
  startedAt: Timestamp;
  completedAt?: Timestamp;

  // Related entities
  appointmentId?: string;
  conversationId?: string;
}
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /flows/data | Flow data endpoint (dynamic data) |
| POST | /flows/complete | Flow completion webhook |
| GET | /flows | List clinic flows |
| POST | /flows/trigger | Trigger flow for patient |
| GET | /flows/analytics | Flow analytics |

---

## Success Metrics

- Flow completion rate > 75%
- Average completion time < 3 minutes
- Zero data loss on flow completion
- Real-time availability in flow
