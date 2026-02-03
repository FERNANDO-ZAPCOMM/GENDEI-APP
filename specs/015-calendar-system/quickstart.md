# Quickstart: Calendar System

**Feature**: 015-calendar-system
**Date**: 2026-02-04

---

## Calendar Store (Zustand)

```typescript
// apps/web/src/stores/calendarStore.ts
import { create } from 'zustand';
import { addDays, addWeeks, addMonths, startOfWeek, startOfMonth, startOfDay } from 'date-fns';

interface CalendarState {
  view: 'day' | 'week' | 'month' | 'agenda';
  currentDate: Date;
  selectedProfessionalIds: string[];
  selectedEventId: string | null;
  createSlot: {
    professionalId: string;
    start: Date;
    end: Date;
  } | null;
}

interface CalendarActions {
  setView: (view: CalendarState['view']) => void;
  setCurrentDate: (date: Date) => void;
  navigateNext: () => void;
  navigatePrev: () => void;
  goToToday: () => void;
  toggleProfessional: (id: string) => void;
  selectAllProfessionals: (ids: string[]) => void;
  selectEvent: (id: string | null) => void;
  startCreate: (slot: CalendarState['createSlot']) => void;
  cancelCreate: () => void;
}

export const useCalendarStore = create<CalendarState & CalendarActions>((set, get) => ({
  view: 'week',
  currentDate: new Date(),
  selectedProfessionalIds: [],
  selectedEventId: null,
  createSlot: null,

  setView: (view) => set({ view }),

  setCurrentDate: (date) => set({ currentDate: date }),

  navigateNext: () => {
    const { view, currentDate } = get();
    const newDate = view === 'day'
      ? addDays(currentDate, 1)
      : view === 'week'
      ? addWeeks(currentDate, 1)
      : addMonths(currentDate, 1);
    set({ currentDate: newDate });
  },

  navigatePrev: () => {
    const { view, currentDate } = get();
    const newDate = view === 'day'
      ? addDays(currentDate, -1)
      : view === 'week'
      ? addWeeks(currentDate, -1)
      : addMonths(currentDate, -1);
    set({ currentDate: newDate });
  },

  goToToday: () => set({ currentDate: new Date() }),

  toggleProfessional: (id) => {
    const { selectedProfessionalIds } = get();
    const newIds = selectedProfessionalIds.includes(id)
      ? selectedProfessionalIds.filter((i) => i !== id)
      : [...selectedProfessionalIds, id];
    set({ selectedProfessionalIds: newIds });
  },

  selectAllProfessionals: (ids) => set({ selectedProfessionalIds: ids }),

  selectEvent: (id) => set({ selectedEventId: id }),

  startCreate: (slot) => set({ createSlot: slot }),

  cancelCreate: () => set({ createSlot: null }),
}));
```

---

## Week View Component

```typescript
// apps/web/src/components/calendar/WeekView.tsx
'use client';

import { useMemo } from 'react';
import {
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameDay,
  isToday,
  addMinutes,
  setHours,
  setMinutes,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { CalendarEvent as CalendarEventType } from '@/types/calendar';
import { CalendarEvent } from './CalendarEvent';
import { useCalendarStore } from '@/stores/calendarStore';

interface WeekViewProps {
  events: CalendarEventType[];
  professionals: { id: string; name: string; color: string }[];
  onSlotClick: (professionalId: string, time: Date) => void;
  onEventClick: (event: CalendarEventType) => void;
}

const SLOT_HEIGHT = 48; // pixels
const SLOT_DURATION = 30; // minutes
const START_HOUR = 6;
const END_HOUR = 22;

export function WeekView({
  events,
  professionals,
  onSlotClick,
  onEventClick,
}: WeekViewProps) {
  const { currentDate, selectedProfessionalIds } = useCalendarStore();

  const weekDays = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 0 });
    const end = endOfWeek(currentDate, { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  const timeSlots = useMemo(() => {
    const slots: string[] = [];
    for (let hour = START_HOUR; hour < END_HOUR; hour++) {
      for (let minute = 0; minute < 60; minute += SLOT_DURATION) {
        slots.push(`${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`);
      }
    }
    return slots;
  }, []);

  const filteredProfessionals = professionals.filter(
    (p) => selectedProfessionalIds.length === 0 || selectedProfessionalIds.includes(p.id)
  );

  const getEventsForDayAndProfessional = (day: Date, professionalId: string) => {
    return events.filter(
      (e) =>
        isSameDay(e.start, day) &&
        e.professionalId === professionalId
    );
  };

  const getEventPosition = (event: CalendarEventType) => {
    const startHour = event.start.getHours();
    const startMinute = event.start.getMinutes();
    const top = ((startHour - START_HOUR) * 60 + startMinute) * (SLOT_HEIGHT / SLOT_DURATION);
    const height = event.durationMinutes * (SLOT_HEIGHT / SLOT_DURATION);
    return { top, height };
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header - Days */}
      <div className="flex border-b">
        <div className="w-16 flex-shrink-0" /> {/* Time column spacer */}
        {weekDays.map((day) => (
          <div
            key={day.toISOString()}
            className={cn(
              'flex-1 text-center py-2 border-l',
              isToday(day) && 'bg-primary/5'
            )}
          >
            <div className="text-sm text-muted-foreground">
              {format(day, 'EEE', { locale: ptBR })}
            </div>
            <div
              className={cn(
                'text-lg font-medium',
                isToday(day) && 'bg-primary text-primary-foreground rounded-full w-8 h-8 mx-auto flex items-center justify-center'
              )}
            >
              {format(day, 'd')}
            </div>
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex">
          {/* Time column */}
          <div className="w-16 flex-shrink-0">
            {timeSlots.map((time, index) => (
              <div
                key={time}
                className="h-12 text-xs text-muted-foreground text-right pr-2 -mt-2"
                style={{ height: SLOT_HEIGHT }}
              >
                {index % 2 === 0 ? time : ''}
              </div>
            ))}
          </div>

          {/* Days columns */}
          {weekDays.map((day) => (
            <div key={day.toISOString()} className="flex-1 border-l relative">
              {/* Professional lanes */}
              {filteredProfessionals.length > 1 ? (
                <div className="flex h-full">
                  {filteredProfessionals.map((prof) => (
                    <div key={prof.id} className="flex-1 relative border-l first:border-l-0">
                      {/* Time slots */}
                      {timeSlots.map((time) => {
                        const [hours, minutes] = time.split(':').map(Number);
                        const slotTime = setMinutes(setHours(day, hours), minutes);
                        return (
                          <div
                            key={time}
                            className="h-12 border-b hover:bg-muted/30 cursor-pointer"
                            style={{ height: SLOT_HEIGHT }}
                            onClick={() => onSlotClick(prof.id, slotTime)}
                          />
                        );
                      })}

                      {/* Events */}
                      {getEventsForDayAndProfessional(day, prof.id).map((event) => {
                        const { top, height } = getEventPosition(event);
                        return (
                          <CalendarEvent
                            key={event.id}
                            event={event}
                            style={{ top, height, position: 'absolute', left: 2, right: 2 }}
                            onClick={() => onEventClick(event)}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="relative">
                  {/* Time slots */}
                  {timeSlots.map((time) => {
                    const [hours, minutes] = time.split(':').map(Number);
                    const slotTime = setMinutes(setHours(day, hours), minutes);
                    const profId = filteredProfessionals[0]?.id;
                    return (
                      <div
                        key={time}
                        className="h-12 border-b hover:bg-muted/30 cursor-pointer"
                        style={{ height: SLOT_HEIGHT }}
                        onClick={() => profId && onSlotClick(profId, slotTime)}
                      />
                    );
                  })}

                  {/* Events */}
                  {filteredProfessionals[0] &&
                    getEventsForDayAndProfessional(day, filteredProfessionals[0].id).map((event) => {
                      const { top, height } = getEventPosition(event);
                      return (
                        <CalendarEvent
                          key={event.id}
                          event={event}
                          style={{ top, height, position: 'absolute', left: 2, right: 2 }}
                          onClick={() => onEventClick(event)}
                        />
                      );
                    })}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

---

## Calendar Event Component

```typescript
// apps/web/src/components/calendar/CalendarEvent.tsx
'use client';

import { CSSProperties } from 'react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { CalendarEvent as CalendarEventType } from '@/types/calendar';

interface CalendarEventProps {
  event: CalendarEventType;
  style?: CSSProperties;
  onClick: () => void;
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 border-yellow-300 text-yellow-900',
  awaiting_confirmation: 'bg-orange-100 border-orange-300 text-orange-900',
  confirmed: 'bg-blue-100 border-blue-300 text-blue-900',
  confirmed_presence: 'bg-green-100 border-green-300 text-green-900',
  completed: 'bg-gray-100 border-gray-300 text-gray-700',
  cancelled: 'bg-red-100 border-red-300 text-red-900 line-through opacity-50',
  no_show: 'bg-red-100 border-red-300 text-red-900',
};

export function CalendarEvent({ event, style, onClick }: CalendarEventProps) {
  const colorClass = STATUS_COLORS[event.status] || STATUS_COLORS.pending;

  return (
    <div
      className={cn(
        'rounded-md border-l-4 px-2 py-1 cursor-pointer hover:shadow-md transition-shadow overflow-hidden',
        colorClass
      )}
      style={{
        ...style,
        borderLeftColor: event.professionalColor,
      }}
      onClick={onClick}
    >
      <div className="text-xs font-medium truncate">{event.patientName}</div>
      <div className="text-xs truncate opacity-75">
        {format(event.start, 'HH:mm')} - {event.serviceName}
      </div>
    </div>
  );
}
```

---

## Calendar Page

```typescript
// apps/web/src/app/[locale]/dashboard/calendar/page.tsx
'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { startOfWeek, endOfWeek, format } from 'date-fns';
import { api } from '@/lib/api';
import { useClinic } from '@/hooks/useClinic';
import { useCalendarStore } from '@/stores/calendarStore';
import { WeekView } from '@/components/calendar/WeekView';
import { DayView } from '@/components/calendar/DayView';
import { MonthView } from '@/components/calendar/MonthView';
import { CalendarHeader } from '@/components/calendar/CalendarHeader';
import { QuickAppointmentModal } from '@/components/calendar/QuickAppointmentModal';
import { EventDetailModal } from '@/components/calendar/EventDetailModal';

export default function CalendarPage() {
  const { clinic } = useClinic();
  const {
    view,
    currentDate,
    selectedProfessionalIds,
    createSlot,
    startCreate,
    cancelCreate,
    selectEvent,
    selectedEventId,
  } = useCalendarStore();

  const [eventModalOpen, setEventModalOpen] = useState(false);

  // Calculate date range based on view
  const dateRange = {
    from: startOfWeek(currentDate),
    to: endOfWeek(currentDate),
  };

  // Fetch events
  const { data, isLoading } = useQuery({
    queryKey: ['calendar', 'events', clinic.id, dateRange.from, dateRange.to],
    queryFn: () =>
      api
        .get('/calendar/events', {
          params: {
            from: dateRange.from.toISOString(),
            to: dateRange.to.toISOString(),
            professionalIds: selectedProfessionalIds,
          },
        })
        .then((r) => r.data),
  });

  const handleSlotClick = (professionalId: string, time: Date) => {
    const endTime = new Date(time);
    endTime.setMinutes(endTime.getMinutes() + 30);
    startCreate({ professionalId, start: time, end: endTime });
  };

  const handleEventClick = (event: any) => {
    selectEvent(event.id);
    setEventModalOpen(true);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <CalendarHeader professionals={data?.professionals || []} />

      <div className="flex-1 overflow-hidden">
        {view === 'week' && (
          <WeekView
            events={data?.events || []}
            professionals={data?.professionals || []}
            onSlotClick={handleSlotClick}
            onEventClick={handleEventClick}
          />
        )}
        {view === 'day' && (
          <DayView
            events={data?.events || []}
            professionals={data?.professionals || []}
            onSlotClick={handleSlotClick}
            onEventClick={handleEventClick}
          />
        )}
        {view === 'month' && (
          <MonthView
            events={data?.events || []}
            onEventClick={handleEventClick}
          />
        )}
      </div>

      <QuickAppointmentModal
        open={!!createSlot}
        slot={createSlot}
        onClose={cancelCreate}
      />

      <EventDetailModal
        open={eventModalOpen}
        eventId={selectedEventId}
        onClose={() => {
          setEventModalOpen(false);
          selectEvent(null);
        }}
      />
    </div>
  );
}
```

---

## Calendar API Controller

```typescript
// apps/functions/src/controllers/calendarController.ts
import { db, FieldValue, Timestamp } from '../lib/firebase';

const PROFESSIONAL_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
  '#8B5CF6', '#EC4899', '#06B6D4', '#F97316',
];

export async function getCalendarEvents(req: Request, res: Response) {
  const clinicId = req.clinicId!;
  const { from, to, professionalIds, includeCancelled } = req.query;

  const fromDate = new Date(from as string);
  const toDate = new Date(to as string);

  let query = db
    .collection('gendei_appointments')
    .where('clinicId', '==', clinicId)
    .where('startTime', '>=', Timestamp.fromDate(fromDate))
    .where('startTime', '<=', Timestamp.fromDate(toDate));

  if (professionalIds) {
    const ids = Array.isArray(professionalIds) ? professionalIds : [professionalIds];
    if (ids.length > 0 && ids.length <= 10) {
      query = query.where('professionalId', 'in', ids);
    }
  }

  if (!includeCancelled) {
    query = query.where('status', 'not-in', ['cancelled']);
  }

  const [appointmentsSnapshot, professionalsSnapshot] = await Promise.all([
    query.get(),
    db.collection('gendei_clinics').doc(clinicId).collection('professionals').get(),
  ]);

  // Build professional map
  const professionalsMap = new Map();
  professionalsSnapshot.docs.forEach((doc, index) => {
    professionalsMap.set(doc.id, {
      id: doc.id,
      name: doc.data().name,
      color: PROFESSIONAL_COLORS[index % PROFESSIONAL_COLORS.length],
      workingHours: doc.data().workingHours,
    });
  });

  // Transform appointments to calendar events
  const events = appointmentsSnapshot.docs.map((doc) => {
    const data = doc.data();
    const professional = professionalsMap.get(data.professionalId);

    return {
      id: doc.id,
      appointmentId: doc.id,
      title: `${data.serviceName} - ${data.patientName}`,
      subtitle: professional?.name,
      start: data.startTime.toDate().toISOString(),
      end: data.endTime.toDate().toISOString(),
      durationMinutes: data.durationMinutes,
      allDay: false,
      status: data.status,
      statusColor: getStatusColor(data.status),
      professionalId: data.professionalId,
      professionalName: professional?.name,
      professionalColor: professional?.color,
      patientId: data.patientId,
      patientName: data.patientName,
      patientPhone: data.patientPhone,
      serviceId: data.serviceId,
      serviceName: data.serviceName,
      notes: data.notes,
      depositPaid: data.depositPaid,
      source: data.source,
    };
  });

  return res.json({
    events,
    professionals: Array.from(professionalsMap.values()),
  });
}

export async function rescheduleAppointment(req: Request, res: Response) {
  const clinicId = req.clinicId!;
  const { appointmentId, newStartTime, newEndTime, newProfessionalId, notifyPatient } = req.body;

  const appointmentRef = db.collection('gendei_appointments').doc(appointmentId);
  const appointmentDoc = await appointmentRef.get();

  if (!appointmentDoc.exists || appointmentDoc.data()?.clinicId !== clinicId) {
    return res.status(404).json({ error: 'Appointment not found' });
  }

  const professionalId = newProfessionalId || appointmentDoc.data()!.professionalId;

  // Check for conflicts
  const hasConflict = await checkConflicts(
    clinicId,
    professionalId,
    new Date(newStartTime),
    new Date(newEndTime),
    appointmentId
  );

  if (hasConflict) {
    return res.status(409).json({ error: 'Time slot conflict' });
  }

  // Update appointment
  await appointmentRef.update({
    startTime: Timestamp.fromDate(new Date(newStartTime)),
    endTime: Timestamp.fromDate(new Date(newEndTime)),
    professionalId,
    updatedAt: FieldValue.serverTimestamp(),
  });

  // Notify patient if requested
  if (notifyPatient) {
    // Send WhatsApp notification
  }

  return res.json({ success: true });
}

async function checkConflicts(
  clinicId: string,
  professionalId: string,
  startTime: Date,
  endTime: Date,
  excludeId?: string
): Promise<boolean> {
  const conflictQuery = await db
    .collection('gendei_appointments')
    .where('clinicId', '==', clinicId)
    .where('professionalId', '==', professionalId)
    .where('status', 'not-in', ['cancelled'])
    .where('startTime', '<', Timestamp.fromDate(endTime))
    .get();

  const conflicts = conflictQuery.docs.filter((doc) => {
    if (doc.id === excludeId) return false;
    const data = doc.data();
    const apptEnd = data.endTime.toDate();
    return apptEnd > startTime;
  });

  return conflicts.length > 0;
}

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    pending: '#EAB308',
    awaiting_confirmation: '#F97316',
    confirmed: '#3B82F6',
    confirmed_presence: '#10B981',
    completed: '#6B7280',
    cancelled: '#EF4444',
    no_show: '#EF4444',
  };
  return colors[status] || colors.pending;
}
```
