# Quickstart: Appointment Management

**Feature**: 006-appointment-management
**Date**: 2026-02-04

---

## Key Code Examples

### Appointment Controller

```typescript
// apps/functions/src/controllers/appointmentController.ts
export async function createAppointment(req: Request, res: Response) {
  const clinicId = req.clinicId!;
  const { patientId, professionalId, serviceId, date, time, notes } = req.body;

  // Validate availability
  const isAvailable = await checkSlotAvailable(clinicId, professionalId, date, time);
  if (!isAvailable) {
    return res.status(409).json({ error: 'Time slot not available' });
  }

  // Get denormalized data
  const [patient, professional, service] = await Promise.all([
    getPatient(patientId),
    getProfessional(clinicId, professionalId),
    getService(clinicId, serviceId),
  ]);

  // Calculate deposit
  const depositAmount = Math.round((service.priceCents * service.signalPercentage) / 100);

  // Create appointment
  const appointment = {
    clinicId,
    patientId,
    professionalId,
    serviceId,
    date,
    time,
    duration: service.durationMinutes,
    endTime: calculateEndTime(time, service.durationMinutes),
    status: 'pending',
    statusHistory: [],
    patientName: patient.name,
    patientPhone: patient.phone,
    serviceName: service.name,
    servicePrice: service.priceCents,
    professionalName: professional.name,
    depositAmount,
    depositPaid: false,
    reminder24hSent: false,
    reminder2hSent: false,
    source: req.body.source || 'dashboard',
    notes,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  const docRef = await db.collection('gendei_appointments').add(appointment);

  return res.status(201).json({ id: docRef.id, ...appointment });
}

export async function updateStatus(req: Request, res: Response) {
  const { id } = req.params;
  const { status, reason } = req.body;

  const appointmentRef = db.collection('gendei_appointments').doc(id);
  const doc = await appointmentRef.get();

  if (!doc.exists) {
    return res.status(404).json({ error: 'Appointment not found' });
  }

  const currentStatus = doc.data()!.status;

  // Validate transition
  if (!canTransition(currentStatus, status)) {
    return res.status(400).json({ error: `Cannot transition from ${currentStatus} to ${status}` });
  }

  // Update with history
  await appointmentRef.update({
    status,
    statusHistory: FieldValue.arrayUnion({
      from: currentStatus,
      to: status,
      changedAt: new Date().toISOString(),
      changedBy: req.user!.uid,
      reason,
    }),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return res.json({ success: true });
}
```

### Calendar Component

```typescript
// apps/web/src/components/calendar/CalendarGrid.tsx
'use client';

import { useState } from 'react';
import { useAppointments } from '@/hooks/useAppointments';
import { addDays, format, startOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function CalendarGrid({ professionalId }: { professionalId?: string }) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const { data: appointments, isLoading } = useAppointments({
    startDate: format(days[0], 'yyyy-MM-dd'),
    endDate: format(days[6], 'yyyy-MM-dd'),
    professionalId,
  });

  const timeSlots = generateTimeSlots('08:00', '18:00', 30);

  return (
    <div className="grid grid-cols-8 gap-1">
      {/* Header */}
      <div className="col-span-1" />
      {days.map(day => (
        <div key={day.toISOString()} className="text-center font-medium py-2">
          <div>{format(day, 'EEE', { locale: ptBR })}</div>
          <div className="text-2xl">{format(day, 'd')}</div>
        </div>
      ))}

      {/* Time slots */}
      {timeSlots.map(time => (
        <>
          <div key={time} className="text-right pr-2 text-sm text-muted-foreground">
            {time}
          </div>
          {days.map(day => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const apt = appointments?.find(a => a.date === dateStr && a.time === time);

            return (
              <div
                key={`${dateStr}-${time}`}
                className="border rounded min-h-[40px] relative"
              >
                {apt && <AppointmentCard appointment={apt} />}
              </div>
            );
          })}
        </>
      ))}
    </div>
  );
}
```

### Availability Check

```typescript
// apps/functions/src/services/availability.ts
export async function getAvailableSlots(
  clinicId: string,
  serviceId: string,
  date: string,
  professionalId?: string
): Promise<AvailableSlot[]> {
  const service = await getService(clinicId, serviceId);
  const duration = service.durationMinutes;

  // Get professionals who offer this service
  let professionals = service.professionalIds;
  if (professionalId) {
    professionals = professionals.filter(id => id === professionalId);
  }

  const slots: AvailableSlot[] = [];
  const dayOfWeek = new Date(date).getDay();

  for (const profId of professionals) {
    const professional = await getProfessional(clinicId, profId);

    // Check if working this day
    const workingHours = professional.workingHours[dayOfWeek];
    if (!workingHours?.ranges.length) continue;

    // Get booked appointments
    const appointments = await db.collection('gendei_appointments')
      .where('clinicId', '==', clinicId)
      .where('professionalId', '==', profId)
      .where('date', '==', date)
      .where('status', 'not-in', ['cancelled', 'no_show'])
      .get();

    const bookedTimes = appointments.docs.map(d => d.data().time);

    // Calculate available slots
    for (const range of workingHours.ranges) {
      let current = timeToMinutes(range.from);
      const end = timeToMinutes(range.to);

      while (current + duration <= end) {
        const timeStr = minutesToTime(current);

        if (!bookedTimes.includes(timeStr)) {
          slots.push({
            time: timeStr,
            professionalId: profId,
            professionalName: professional.name,
          });
        }

        current += 15; // 15-minute increments
      }
    }
  }

  // Sort by time, then by professional
  return slots.sort((a, b) => a.time.localeCompare(b.time));
}
```

### Query Hooks

```typescript
// apps/web/src/hooks/useAppointments.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export function useAppointments(params: {
  startDate?: string;
  endDate?: string;
  professionalId?: string;
  status?: string;
}) {
  return useQuery({
    queryKey: ['appointments', params],
    queryFn: () => api.appointments.list(params),
  });
}

export function useCreateAppointment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.appointments.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
  });
}

export function useUpdateStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status, reason }: { id: string; status: string; reason?: string }) =>
      api.appointments.updateStatus(id, status, reason),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['appointment', id] });
    },
  });
}
```

---

## Status Transition Helper

```typescript
const VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ['awaiting_confirmation', 'confirmed', 'cancelled'],
  awaiting_confirmation: ['confirmed', 'cancelled', 'no_show'],
  confirmed: ['confirmed_presence', 'cancelled', 'no_show'],
  confirmed_presence: ['completed', 'no_show'],
  completed: [],
  cancelled: [],
  no_show: [],
};

export function canTransition(from: string, to: string): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}
```

---

## Routes

```typescript
// apps/functions/src/routes/appointments.ts
import { Router } from 'express';
import * as controller from '../controllers/appointmentController';

const router = Router();

router.get('/', controller.listAppointments);
router.get('/today', controller.getTodayAppointments);
router.get('/:id', controller.getAppointment);
router.post('/', controller.createAppointment);
router.put('/:id', controller.updateAppointment);
router.put('/:id/status', controller.updateStatus);
router.put('/:id/reschedule', controller.reschedule);
router.delete('/:id', controller.cancelAppointment);

export default router;
```
