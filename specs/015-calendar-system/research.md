# Research: Calendar System

**Feature**: 015-calendar-system
**Date**: 2026-02-04

---

## Technical Decisions

### 1. Calendar Library

**Decision**: Custom implementation with date-fns

**Options**:
| Library | Pros | Cons | Decision |
|---------|------|------|----------|
| FullCalendar | Feature-rich | Large bundle, complex | Rejected |
| react-big-calendar | Popular | Limited customization | Rejected |
| Custom + date-fns | Full control, lightweight | Development time | **Selected** |

**Why Custom**:
- Complete control over UI/UX
- Tailwind CSS integration
- Optimized bundle size
- Healthcare-specific requirements

### 2. Drag and Drop

**Decision**: @dnd-kit/core

**Options**:
| Library | Pros | Cons | Decision |
|---------|------|------|----------|
| @dnd-kit | Modern, accessible, flexible | Newer | **Selected** |
| react-dnd | Mature, popular | Complex setup | Rejected |
| Native HTML5 | No dependencies | Limited features | Rejected |

### 3. Time Slot Configuration

**Decision**: 15-minute granularity with configurable slot duration

```typescript
const CALENDAR_CONFIG = {
  slotDuration: 15,  // minutes
  startHour: 6,
  endHour: 22,
  workingHoursStart: 8,
  workingHoursEnd: 18,
};

// Generate time slots
function generateTimeSlots(
  start: number,
  end: number,
  slotDuration: number
): string[] {
  const slots: string[] = [];
  for (let hour = start; hour < end; hour++) {
    for (let minute = 0; minute < 60; minute += slotDuration) {
      slots.push(
        `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
      );
    }
  }
  return slots;
}
```

### 4. Professional Colors

**Decision**: Predefined color palette with auto-assignment

```typescript
const PROFESSIONAL_COLORS = [
  '#3B82F6', // blue
  '#10B981', // green
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // purple
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#F97316', // orange
];

function getColorForProfessional(index: number): string {
  return PROFESSIONAL_COLORS[index % PROFESSIONAL_COLORS.length];
}
```

---

## Calendar Layout

### Week View Structure

```
┌─────────────────────────────────────────────────────────┐
│  < Prev  │   Fevereiro 2026   │  Next >  │ Day Week Month │
├─────────────────────────────────────────────────────────┤
│  [Prof Filter]  [Service Filter]  [Today Button]        │
├──────┬──────┬──────┬──────┬──────┬──────┬──────┬───────┤
│      │ Dom  │ Seg  │ Ter  │ Qua  │ Qui  │ Sex  │ Sáb   │
│      │  2   │  3   │  4   │  5   │  6   │  7   │   8   │
├──────┼──────┴──────┴──────┴──────┴──────┴──────┴───────┤
│ 08:00│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│ 08:30│ ░░░░░ [Consulta - João] ░░░░░░░░░░░░░░░░░░░░░░░░ │
│ 09:00│ ░░░░░ [                ] [Consulta - Maria] ░░░░ │
│ 09:30│ ░░░░░░░░░░░░░░░░░░░░░░░ [                 ] ░░░░ │
│ 10:00│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│  ... │                                                  │
└──────┴──────────────────────────────────────────────────┘

░░░ = Working hours background
[  ] = Appointment block
```

### Day View Structure

```
┌─────────────────────────────────────────────────────────┐
│  < Prev  │   Ter, 4 de Fevereiro   │  Next >           │
├─────────────────────────────────────────────────────────┤
│  Dr. Ana Silva  │  Dr. João Santos  │  Dra. Maria      │
├─────────────────┼───────────────────┼──────────────────┤
│ 08:00 ░░░░░░░░░│░░░░░░░░░░░░░░░░░░│░░░░░░░░░░░░░░░░░ │
│ 08:30 ░░░░░░░░░│[Consulta]         │░░░░░░░░░░░░░░░░░ │
│ 09:00 ░░░░░░░░░│[        ]         │[Avaliação]       │
│ 09:30 ░░░░░░░░░│░░░░░░░░░░░░░░░░░░│[          ]      │
│ 10:00 [Retorno]│░░░░░░░░░░░░░░░░░░│░░░░░░░░░░░░░░░░░ │
│  ... │         │                   │                  │
└─────────────────┴───────────────────┴──────────────────┘
```

---

## Real-time Updates

```typescript
// Subscribe to appointments in date range
function useCalendarEvents(
  clinicId: string,
  startDate: Date,
  endDate: Date
) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(
        collection(db, 'gendei_appointments'),
        where('clinicId', '==', clinicId),
        where('startTime', '>=', Timestamp.fromDate(startDate)),
        where('startTime', '<=', Timestamp.fromDate(endDate)),
        where('status', 'not-in', ['cancelled'])
      ),
      (snapshot) => {
        const newEvents = snapshot.docs.map((doc) =>
          appointmentToCalendarEvent(doc)
        );
        setEvents(newEvents);
      }
    );

    return () => unsubscribe();
  }, [clinicId, startDate.toISOString(), endDate.toISOString()]);

  return events;
}
```

---

## Drag and Drop Reschedule

```typescript
// Handle drop event
async function handleDrop(
  appointmentId: string,
  newStart: Date,
  newEnd: Date,
  newProfessionalId?: string
) {
  // Optimistic update
  setEvents((prev) =>
    prev.map((e) =>
      e.appointmentId === appointmentId
        ? { ...e, start: newStart, end: newEnd }
        : e
    )
  );

  try {
    await api.patch('/calendar/reschedule', {
      appointmentId,
      newStartTime: newStart.toISOString(),
      newEndTime: newEnd.toISOString(),
      newProfessionalId,
    });
  } catch (error) {
    // Revert on error
    refetch();
    toast.error('Não foi possível reagendar');
  }
}
```

---

## Conflict Detection

```typescript
async function checkConflicts(
  clinicId: string,
  professionalId: string,
  startTime: Date,
  endTime: Date,
  excludeAppointmentId?: string
): Promise<boolean> {
  const conflictQuery = await db
    .collection('gendei_appointments')
    .where('clinicId', '==', clinicId)
    .where('professionalId', '==', professionalId)
    .where('status', 'not-in', ['cancelled'])
    .where('startTime', '<', Timestamp.fromDate(endTime))
    .where('endTime', '>', Timestamp.fromDate(startTime))
    .get();

  const conflicts = conflictQuery.docs.filter(
    (doc) => doc.id !== excludeAppointmentId
  );

  return conflicts.length > 0;
}
```

---

## Quick Appointment Modal

```typescript
interface QuickAppointmentData {
  professionalId: string;
  startTime: Date;
  endTime: Date;
  // Auto-populated or selected
  patientId?: string;
  patientPhone?: string;
  patientName?: string;
  serviceId?: string;
}

// Triggered when clicking empty time slot
function handleSlotClick(
  professionalId: string,
  time: Date
) {
  setQuickAppointment({
    professionalId,
    startTime: time,
    endTime: addMinutes(time, 30),
  });
  setQuickModalOpen(true);
}
```

---

## Mobile Considerations

1. **Agenda View**: Primary view on mobile
2. **Touch Gestures**: Swipe to navigate dates
3. **Bottom Sheet**: Appointment details
4. **Floating Button**: Quick create

---

## References

- [date-fns Documentation](https://date-fns.org/)
- [@dnd-kit Documentation](https://dndkit.com/)
- [Calendar UI Patterns](https://www.nngroup.com/articles/calendar-displays/)
