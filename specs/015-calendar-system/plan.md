# Plan: Calendar System

**Feature**: 015-calendar-system
**Status**: Planning
**Date**: 2026-02-04

---

## Overview

Implement a comprehensive calendar system for appointment visualization and management, including day/week/month views, drag-and-drop scheduling, professional filtering, and real-time updates.

---

## Technical Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16 + React 19 |
| Calendar | Custom built with date-fns |
| Drag & Drop | @dnd-kit/core |
| Real-time | Firestore onSnapshot |
| State | TanStack Query + Zustand |

---

## Key Features

1. Day, Week, and Month calendar views
2. Professional-based filtering
3. Drag-and-drop appointment scheduling
4. Real-time appointment updates
5. Time slot availability visualization
6. Quick appointment creation
7. Appointment details modal
8. Working hours overlay

---

## Calendar Views

| View | Display | Use Case |
|------|---------|----------|
| Day | Single day, hourly slots | Detailed scheduling |
| Week | 7 days, hourly slots | Weekly overview |
| Month | Full month, event indicators | Monthly planning |
| Agenda | List view | Mobile-friendly |

---

## User Flow

```
1. User opens Calendar page
2. Default view shows current week
3. User can:
   - Switch between views (day/week/month)
   - Navigate dates (prev/next, today)
   - Filter by professional
   - Click empty slot to create appointment
   - Click appointment to view/edit
   - Drag appointment to reschedule
4. Calendar updates in real-time
```

---

## Data Model

### Calendar Event (derived from Appointment)

```typescript
interface CalendarEvent {
  id: string;
  appointmentId: string;
  title: string;
  start: Date;
  end: Date;
  status: AppointmentStatus;
  professionalId: string;
  professionalName: string;
  professionalColor: string;
  patientName: string;
  serviceName: string;
  notes?: string;
}
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /calendar/events | Get events for date range |
| POST | /calendar/quick-appointment | Create appointment quickly |
| PATCH | /calendar/reschedule | Reschedule via drag-drop |
| GET | /calendar/availability | Get available slots |

---

## Success Metrics

- Calendar render < 500ms
- Drag-drop response < 100ms
- Real-time sync < 1 second
- Zero double-booking incidents
