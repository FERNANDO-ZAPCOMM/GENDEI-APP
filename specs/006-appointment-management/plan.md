# Plan: Appointment Management

**Feature**: 006-appointment-management
**Status**: Planning
**Date**: 2026-02-04

---

## Overview

Implement a comprehensive appointment management system with a 7-state workflow, calendar views, time blocking, and full CRUD operations. Appointments can be created from multiple sources (WhatsApp, dashboard, API) and support deposit tracking.

---

## Technical Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16, React 19, TypeScript, TanStack Query 5 |
| Backend | Firebase Functions (Node.js 20, Express.js) |
| Database | Firestore |
| Calendar | Custom calendar grid component |

---

## Status Workflow

```
pending → awaiting_confirmation → confirmed → confirmed_presence → completed
    ↓              ↓                  ↓
cancelled      cancelled          cancelled
    ↓              ↓                  ↓
               no_show             no_show
```

| Status | Description |
|--------|-------------|
| `pending` | Initial state after creation |
| `awaiting_confirmation` | Reminder sent, waiting response |
| `confirmed` | Patient confirmed attendance |
| `confirmed_presence` | Patient arrived at clinic |
| `completed` | Appointment finished |
| `cancelled` | Cancelled by patient or clinic |
| `no_show` | Patient didn't show up |

---

## Implementation Phases

### Phase 1: Data Model & API
- [ ] Define Appointment interface
- [ ] Create Firestore collection
- [ ] Implement CRUD endpoints
- [ ] Add status transition validation
- [ ] Build availability checking

### Phase 2: Calendar UI
- [ ] Create 7-day grid calendar
- [ ] Build time slot visualization
- [ ] Add appointment cards
- [ ] Implement professional filtering
- [ ] Add status color coding

### Phase 3: Appointment Form
- [ ] Patient selection/creation
- [ ] Professional selection
- [ ] Service selection
- [ ] Date/time picker
- [ ] Deposit tracking

### Phase 4: Time Blocking
- [ ] Create time block model
- [ ] Build block management UI
- [ ] Integrate with calendar
- [ ] Validate against blocks

### Phase 5: Status Management
- [ ] Build status update UI
- [ ] Implement transition logic
- [ ] Add confirmation dialogs
- [ ] Track status history

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /appointments | List with filters |
| GET | /appointments/today | Today's appointments |
| GET | /appointments/:id | Single appointment |
| POST | /appointments | Create appointment |
| PUT | /appointments/:id | Update appointment |
| PUT | /appointments/:id/status | Update status |
| PUT | /appointments/:id/reschedule | Reschedule |
| DELETE | /appointments/:id | Cancel appointment |

---

## Data Model

```typescript
interface Appointment {
  id: string;
  clinicId: string;
  patientId: string;
  professionalId: string;
  serviceId: string;

  // Scheduling
  date: string;  // YYYY-MM-DD
  time: string;  // HH:MM
  duration: number;  // minutes

  // Status
  status: AppointmentStatus;
  statusHistory: StatusChange[];

  // Patient info (denormalized)
  patientName: string;
  patientPhone: string;

  // Deposit
  depositAmount: number;  // cents
  depositPaid: boolean;

  // Reminders
  reminder24hSent: boolean;
  reminder2hSent: boolean;

  // Source
  source: 'whatsapp' | 'dashboard' | 'api';
  conversationId?: string;

  // Notes
  notes?: string;

  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

---

## Success Metrics

- Appointment creation < 30 seconds
- Calendar load time < 500ms
- Status update success rate > 99%
- No-show prediction accuracy > 80%
