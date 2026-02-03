# Data Model: Calendar System

**Feature**: 015-calendar-system
**Date**: 2026-02-04

---

## Overview

The calendar system primarily works with existing data models (appointments, professionals, services) but adds view-specific transformations and local state management.

---

## Calendar Event (View Model)

```typescript
// Transformed from gendei_appointments for calendar display
interface CalendarEvent {
  // Identity
  id: string;
  appointmentId: string;

  // Display info
  title: string;
  subtitle?: string;

  // Timing
  start: Date;
  end: Date;
  durationMinutes: number;
  allDay: boolean;

  // Status
  status: AppointmentStatus;
  statusColor: string;

  // Professional
  professionalId: string;
  professionalName: string;
  professionalColor: string;

  // Patient
  patientId: string;
  patientName: string;
  patientPhone: string;

  // Service
  serviceId: string;
  serviceName: string;

  // Additional
  notes?: string;
  depositPaid: boolean;
  source: string;

  // UI state
  isSelected?: boolean;
  isDragging?: boolean;
  isConflict?: boolean;
}
```

---

## Calendar View State

```typescript
// Zustand store for calendar state
interface CalendarState {
  // Current view
  view: 'day' | 'week' | 'month' | 'agenda';
  currentDate: Date;

  // Filters
  selectedProfessionalIds: string[];
  selectedServiceIds: string[];
  showCancelled: boolean;

  // UI state
  selectedEventId: string | null;
  isCreating: boolean;
  createSlot: {
    professionalId: string;
    start: Date;
    end: Date;
  } | null;

  // Drag state
  draggedEventId: string | null;
  dropTarget: {
    professionalId: string;
    time: Date;
  } | null;

  // Actions
  setView: (view: CalendarState['view']) => void;
  setCurrentDate: (date: Date) => void;
  navigateNext: () => void;
  navigatePrev: () => void;
  goToToday: () => void;
  toggleProfessional: (id: string) => void;
  selectEvent: (id: string | null) => void;
  startCreate: (slot: CalendarState['createSlot']) => void;
  cancelCreate: () => void;
  startDrag: (eventId: string) => void;
  updateDropTarget: (target: CalendarState['dropTarget']) => void;
  endDrag: () => void;
}
```

---

## Time Block (Working Hours)

```typescript
// Represents a working hours block for display
interface TimeBlock {
  professionalId: string;
  dayOfWeek: number;  // 0-6
  start: string;      // 'HH:mm'
  end: string;        // 'HH:mm'
  isWorking: boolean;
}

// Convert professional working hours to time blocks
function getTimeBlocks(
  professional: Professional,
  dateRange: { start: Date; end: Date }
): TimeBlock[] {
  const blocks: TimeBlock[] = [];

  eachDayOfInterval(dateRange).forEach((date) => {
    const dayOfWeek = getDay(date);
    const hours = professional.workingHours[dayOfWeek];

    if (hours?.enabled) {
      blocks.push({
        professionalId: professional.id,
        dayOfWeek,
        start: hours.start,
        end: hours.end,
        isWorking: true,
      });
    }
  });

  return blocks;
}
```

---

## Quick Appointment Input

```typescript
interface QuickAppointmentInput {
  // Required
  professionalId: string;
  startTime: string;  // ISO string
  durationMinutes: number;

  // Patient (one of these)
  patientId?: string;
  patientPhone?: string;
  newPatient?: {
    name: string;
    phone: string;
  };

  // Service
  serviceId: string;

  // Optional
  notes?: string;
}
```

---

## Reschedule Input

```typescript
interface RescheduleInput {
  appointmentId: string;
  newStartTime: string;  // ISO string
  newEndTime: string;
  newProfessionalId?: string;  // If changing professional
  reason?: string;
  notifyPatient: boolean;
}
```

---

## Zod Schemas

```typescript
import { z } from 'zod';

export const calendarViewSchema = z.enum(['day', 'week', 'month', 'agenda']);

export const calendarQuerySchema = z.object({
  view: calendarViewSchema,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  professionalIds: z.array(z.string()).optional(),
  serviceIds: z.array(z.string()).optional(),
  includeCancelled: z.boolean().default(false),
});

export const quickAppointmentSchema = z.object({
  professionalId: z.string(),
  startTime: z.string().datetime(),
  durationMinutes: z.number().min(15).max(480),
  patientId: z.string().optional(),
  patientPhone: z.string().optional(),
  newPatient: z.object({
    name: z.string().min(2),
    phone: z.string(),
  }).optional(),
  serviceId: z.string(),
  notes: z.string().max(500).optional(),
}).refine(
  (data) => data.patientId || data.patientPhone || data.newPatient,
  { message: 'Patient information required' }
);

export const rescheduleSchema = z.object({
  appointmentId: z.string(),
  newStartTime: z.string().datetime(),
  newEndTime: z.string().datetime(),
  newProfessionalId: z.string().optional(),
  reason: z.string().max(500).optional(),
  notifyPatient: z.boolean().default(true),
});
```

---

## Calendar Configuration

```typescript
// Stored in clinic settings
interface CalendarSettings {
  // Display
  defaultView: 'day' | 'week' | 'month';
  weekStartsOn: 0 | 1;  // 0 = Sunday, 1 = Monday
  slotDuration: 15 | 30 | 60;  // minutes

  // Hours
  calendarStartHour: number;  // 0-23
  calendarEndHour: number;    // 0-23

  // Behavior
  allowOverlapping: boolean;
  requireServiceSelection: boolean;
  autoSelectDuration: boolean;

  // Appearance
  showWeekends: boolean;
  compactView: boolean;
}

const DEFAULT_CALENDAR_SETTINGS: CalendarSettings = {
  defaultView: 'week',
  weekStartsOn: 0,
  slotDuration: 30,
  calendarStartHour: 6,
  calendarEndHour: 22,
  allowOverlapping: false,
  requireServiceSelection: true,
  autoSelectDuration: true,
  showWeekends: true,
  compactView: false,
};
```

---

## Availability Slot

```typescript
// Represents an available time slot
interface AvailabilitySlot {
  professionalId: string;
  professionalName: string;
  date: string;  // YYYY-MM-DD
  startTime: string;  // HH:mm
  endTime: string;  // HH:mm
  durationMinutes: number;
}

// Query available slots
interface AvailabilityQuery {
  clinicId: string;
  professionalId?: string;  // Optional filter
  serviceId?: string;  // To get required duration
  dateFrom: string;
  dateTo: string;
  preferredTime?: 'morning' | 'afternoon' | 'evening';
}
```

---

## Example Transformed Event

```json
{
  "id": "event_abc123",
  "appointmentId": "appt_xyz789",
  "title": "Consulta - Maria Silva",
  "subtitle": "Dr. João Santos",
  "start": "2026-02-04T14:00:00.000Z",
  "end": "2026-02-04T14:30:00.000Z",
  "durationMinutes": 30,
  "allDay": false,
  "status": "confirmed",
  "statusColor": "#10B981",
  "professionalId": "prof_001",
  "professionalName": "Dr. João Santos",
  "professionalColor": "#3B82F6",
  "patientId": "patient_456",
  "patientName": "Maria Silva",
  "patientPhone": "+5511999999999",
  "serviceId": "service_001",
  "serviceName": "Consulta Geral",
  "depositPaid": true,
  "source": "whatsapp",
  "isSelected": false,
  "isDragging": false,
  "isConflict": false
}
```
