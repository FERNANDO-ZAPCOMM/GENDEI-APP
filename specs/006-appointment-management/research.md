# Research: Appointment Management

**Feature**: 006-appointment-management
**Date**: 2026-02-04

---

## Technology Decisions

### 1. Data Storage

**Decision**: Top-level collection `gendei_appointments`

**Why Top-Level**:
- Appointments queried across clinics (admin portal)
- Complex multi-field queries
- Better indexing options
- Easier to query by patient

### 2. Status Workflow

**Decision**: 7-state finite state machine

**States**:
- `pending` → Initial, just created
- `awaiting_confirmation` → Reminder sent
- `confirmed` → Patient confirmed
- `confirmed_presence` → Patient at clinic
- `completed` → Service provided
- `cancelled` → Cancelled by anyone
- `no_show` → Patient didn't show

**Why FSM**:
- Clear state transitions
- Prevents invalid states
- Audit trail built-in
- Easy to add new states

### 3. Calendar Component

**Decision**: Custom 7-day grid calendar

**Why Custom**:
- Full control over UI
- Healthcare-specific features
- Integrates with time blocks
- Mobile-responsive

### 4. Availability Calculation

**Decision**: Server-side calculation with caching

```typescript
async function getAvailableSlots(
  clinicId: string,
  professionalId: string,
  date: string,
  serviceId: string
): Promise<TimeSlot[]> {
  // 1. Get professional working hours for day
  const professional = await getProfessional(clinicId, professionalId);
  const dayOfWeek = new Date(date).getDay();
  const workingHours = professional.workingHours[dayOfWeek];

  if (!workingHours?.ranges.length) return []; // Not working this day

  // 2. Get existing appointments
  const appointments = await getAppointmentsForDay(clinicId, professionalId, date);

  // 3. Get time blocks
  const blocks = await getTimeBlocks(clinicId, professionalId, date);

  // 4. Get service duration
  const service = await getService(clinicId, serviceId);
  const duration = service.durationMinutes;

  // 5. Calculate available slots
  const slots: TimeSlot[] = [];

  for (const range of workingHours.ranges) {
    let currentTime = parseTime(range.from);
    const endTime = parseTime(range.to);

    while (currentTime + duration <= endTime) {
      const timeStr = formatTime(currentTime);

      const isBooked = appointments.some(apt =>
        apt.time === timeStr ||
        (apt.time < timeStr && parseTime(apt.endTime) > currentTime)
      );

      const isBlocked = blocks.some(block =>
        isTimeInBlock(currentTime, block)
      );

      if (!isBooked && !isBlocked) {
        slots.push({ time: timeStr, professionalId, professionalName: professional.name });
      }

      currentTime += 15; // 15-minute increments
    }
  }

  return slots;
}
```

### 5. Deposit Tracking

**Decision**: Integrated with appointment, not separate collection

**Why**:
- Simpler data model
- Always read with appointment
- Single update transaction

### 6. Denormalization

**Decision**: Store patient/professional/service names on appointment

**Why**:
- Avoid joins on every read
- Historical accuracy (names may change)
- Faster calendar rendering
- Offline support

---

## Performance Considerations

### Indexes
- Compound index on (clinicId, date, time)
- Compound index on (clinicId, professionalId, date)
- Compound index on (clinicId, status, date)

### Caching
- Cache professional working hours (5 min TTL)
- Cache service durations (5 min TTL)
- Invalidate on update

### Pagination
- Calendar: Load 7 days at a time
- List: Cursor-based pagination

---

## Security

1. **Authorization**: Only clinic members can access appointments
2. **Patient Data**: Phone masked in logs
3. **Status Transitions**: Validated server-side
4. **Audit Trail**: Full status history preserved
