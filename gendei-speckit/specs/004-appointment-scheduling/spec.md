# Feature 004: Appointment Scheduling

## Spec

### Overview

Appointment Scheduling is the core feature that enables clinics to manage patient bookings. It includes a 7-day week grid view, status workflow management, availability checking, time blocking, and filtering options. Appointments can be created via the dashboard or WhatsApp.

---

### User Stories

#### US-001: Create Appointment

**As a** clinic staff
**I want to** create a new appointment
**So that** I can book a patient manually

**Acceptance Criteria:**
- [ ] Select patient (existing or new)
- [ ] Select professional
- [ ] Select service
- [ ] Pick date and time
- [ ] Only show available slots
- [ ] Confirmation message

#### US-002: View Agenda

**As a** clinic staff
**I want to** see the appointment calendar
**So that** I know the schedule

**Acceptance Criteria:**
- [ ] 7-day week grid view
- [ ] Navigate weeks
- [ ] Appointments color-coded by status
- [ ] Click to view details

#### US-003: Edit Appointment

**As a** clinic staff
**I want to** modify appointment details
**So that** I can make changes

**Acceptance Criteria:**
- [ ] Change date/time
- [ ] Change professional
- [ ] Add notes
- [ ] Save confirmation

#### US-004: Cancel Appointment

**As a** clinic staff
**I want to** cancel an appointment
**So that** the slot becomes available

**Acceptance Criteria:**
- [ ] Confirmation dialog
- [ ] Optional cancellation reason
- [ ] Notify patient option
- [ ] Slot freed up

#### US-005: Status Workflow

**As a** clinic staff
**I want to** update appointment status
**So that** I can track progress

**Acceptance Criteria:**
- [ ] Pending → Awaiting Confirmation
- [ ] Awaiting → Confirmed
- [ ] Confirmed → Confirmed Presence
- [ ] Confirmed Presence → Completed/No-Show
- [ ] Any → Cancelled

#### US-006: Filter Appointments

**As a** clinic staff
**I want to** filter the calendar
**So that** I see relevant appointments

**Acceptance Criteria:**
- [ ] Filter by professional
- [ ] Filter by status
- [ ] Filter by date range

#### US-007: Time Blocking

**As a** clinic staff
**I want to** block time slots
**So that** no appointments are booked during breaks

**Acceptance Criteria:**
- [ ] Create time block
- [ ] Select professional
- [ ] Set date and time range
- [ ] Add reason (lunch, meeting, etc.)
- [ ] Block shown on calendar

---

### Functional Requirements

#### FR-001: Appointment Document Structure

```python
# Collection: gendei_clinics/{clinicId}/appointments/{appointmentId}
{
    "id": "apt_123",
    "clinicId": "clinic_abc",

    "patientId": "patient_xyz",
    "patientName": "João Silva",
    "patientPhone": "+5511999999999",

    "professionalId": "prof_123",
    "professionalName": "Dra. Maria Silva",

    "serviceId": "svc_456",
    "serviceName": "Consulta Cardiológica",

    "date": "2024-01-15",
    "time": "14:00",
    "duration": 45,  # minutes

    "status": "confirmed",
    # Statuses: pending, awaiting_confirmation, confirmed,
    #           confirmed_presence, completed, cancelled, no_show

    "depositAmount": 175.00,
    "depositPaid": True,

    "reminder24hSent": True,
    "reminder2hSent": False,

    "source": "whatsapp",  # "whatsapp" | "dashboard"

    "notes": "Paciente relatou dor no peito",

    "createdAt": Timestamp,
    "confirmedAt": Timestamp,
    "cancelledAt": None,
    "completedAt": None,
}
```

#### FR-002: Time Block Document Structure

```python
# Collection: gendei_clinics/{clinicId}/timeBlocks/{blockId}
{
    "id": "block_123",
    "clinicId": "clinic_abc",
    "professionalId": "prof_123",

    "date": "2024-01-15",
    "startTime": "12:00",
    "endTime": "14:00",

    "reason": "Almoço",

    "createdAt": Timestamp,
    "updatedAt": Timestamp,
}
```

#### FR-003: Status Transitions

```typescript
const STATUS_TRANSITIONS = {
  pending: ["awaiting_confirmation", "confirmed", "cancelled"],
  awaiting_confirmation: ["confirmed", "confirmed_presence", "cancelled"],
  confirmed: ["confirmed_presence", "completed", "no_show", "cancelled"],
  confirmed_presence: ["completed", "no_show", "cancelled"],
  completed: [],  // Final state
  cancelled: [],  // Final state
  no_show: [],    // Final state
};
```

#### FR-004: Status Display Configuration

```typescript
const STATUS_CONFIG = {
  pending: {
    label: "Pendente",
    color: "bg-yellow-100 text-yellow-800",
    icon: "clock",
  },
  awaiting_confirmation: {
    label: "Aguardando Confirmação",
    color: "bg-blue-100 text-blue-800",
    icon: "mail",
  },
  confirmed: {
    label: "Confirmado",
    color: "bg-green-100 text-green-800",
    icon: "check",
  },
  confirmed_presence: {
    label: "Presença Confirmada",
    color: "bg-green-200 text-green-900",
    icon: "check-check",
  },
  completed: {
    label: "Concluído",
    color: "bg-gray-100 text-gray-800",
    icon: "check-circle",
  },
  cancelled: {
    label: "Cancelado",
    color: "bg-red-100 text-red-800",
    icon: "x",
  },
  no_show: {
    label: "Não Compareceu",
    color: "bg-orange-100 text-orange-800",
    icon: "user-x",
  },
};
```

#### FR-005: Availability Check

```typescript
async function checkAvailability(
  clinicId: string,
  professionalId: string,
  date: string,
  time: string,
  duration: number
): Promise<boolean> {
  // 1. Check professional's working hours
  const professional = await getProfessional(professionalId);
  const dayOfWeek = new Date(date).getDay().toString();
  const workingHours = professional.workingHours[dayOfWeek] || [];

  const requestedStart = parseTime(time);
  const requestedEnd = requestedStart + duration;

  const isWithinWorkingHours = workingHours.some(period => {
    const periodStart = parseTime(period.start);
    const periodEnd = parseTime(period.end);
    return requestedStart >= periodStart && requestedEnd <= periodEnd;
  });

  if (!isWithinWorkingHours) return false;

  // 2. Check for existing appointments
  const existingAppointments = await getAppointments({
    clinicId,
    professionalId,
    date,
    excludeStatus: ["cancelled", "no_show"],
  });

  const hasConflict = existingAppointments.some(apt => {
    const aptStart = parseTime(apt.time);
    const aptEnd = aptStart + apt.duration;
    return !(requestedEnd <= aptStart || requestedStart >= aptEnd);
  });

  if (hasConflict) return false;

  // 3. Check for time blocks
  const timeBlocks = await getTimeBlocks({ clinicId, professionalId, date });

  const hasBlockConflict = timeBlocks.some(block => {
    const blockStart = parseTime(block.startTime);
    const blockEnd = parseTime(block.endTime);
    return !(requestedEnd <= blockStart || requestedStart >= blockEnd);
  });

  return !hasBlockConflict;
}
```

---

### API Endpoints

```yaml
# Appointments
GET /api/appointments
  Query:
    clinicId: string
    professionalId?: string
    status?: string
    startDate?: string
    endDate?: string
  Response:
    appointments: Appointment[]

GET /api/appointments/today
  Query:
    clinicId: string
  Response:
    appointments: Appointment[]
    count: number

GET /api/appointments/:id
  Response:
    appointment: Appointment

POST /api/appointments
  Request:
    patientId: string
    professionalId: string
    serviceId: string
    date: string
    time: string
    notes?: string
  Response:
    appointment: Appointment

PUT /api/appointments/:id
  Request:
    date?: string
    time?: string
    professionalId?: string
    notes?: string
  Response:
    appointment: Appointment

PUT /api/appointments/:id/status
  Request:
    status: string
  Response:
    appointment: Appointment

PUT /api/appointments/:id/reschedule
  Request:
    date: string
    time: string
  Response:
    appointment: Appointment

POST /api/appointments/:id/cancel
  Request:
    reason?: string
    notifyPatient?: boolean
  Response:
    appointment: Appointment

# Time Blocks
GET /api/clinics/:id/time-blocks
  Query:
    professionalId?: string
    startDate?: string
    endDate?: string
  Response:
    timeBlocks: TimeBlock[]

POST /api/clinics/:id/time-blocks
  Request:
    professionalId: string
    date: string
    startTime: string
    endTime: string
    reason?: string
  Response:
    timeBlock: TimeBlock

DELETE /api/clinics/:id/time-blocks/:blockId
  Response:
    deleted: boolean
```

---

### UI Wireframes

```
┌────────────────────────────────────────────────────────────────────────────┐
│  Agenda                                     ◀ Jan 15-21, 2024 ▶           │
├────────────────────────────────────────────────────────────────────────────┤
│  Profissional: [Todos ▼]     Status: [Todos ▼]      [+ Novo Agendamento]  │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│       │ Seg 15 │ Ter 16 │ Qua 17 │ Qui 18 │ Sex 19 │ Sáb 20 │ Dom 21 │   │
│  ─────┼────────┼────────┼────────┼────────┼────────┼────────┼────────┤   │
│  08:00│        │ ██████ │        │        │ ██████ │        │        │   │
│       │        │ João S │        │        │ Maria  │        │        │   │
│  ─────┼────────┼────────┼────────┼────────┼────────┼────────┼────────┤   │
│  09:00│ ██████ │        │ ██████ │ ██████ │        │ ██████ │        │   │
│       │ Ana L  │        │ Pedro  │ Ana L  │        │ João S │        │   │
│  ─────┼────────┼────────┼────────┼────────┼────────┼────────┼────────┤   │
│  10:00│        │ ░░░░░░ │        │        │ ██████ │        │        │   │
│       │        │ ALMOÇO │        │        │ Carlos │        │        │   │
│  ─────┼────────┼────────┼────────┼────────┼────────┼────────┼────────┤   │
│  11:00│ ██████ │ ░░░░░░ │ ██████ │        │        │        │        │   │
│       │ Maria  │ ALMOÇO │ João S │        │        │        │        │   │
│  ─────┼────────┼────────┼────────┼────────┼────────┼────────┼────────┤   │
│  ...                                                                       │
│                                                                            │
│  ██████ Confirmado    ▓▓▓▓▓▓ Pendente    ░░░░░░ Bloqueado                │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│  Detalhes do Agendamento                                   [X] │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Status: ✅ Confirmado                                         │
│                                                                 │
│  📅 Segunda, 15 de Janeiro de 2024                            │
│  🕐 14:00 - 14:45 (45 min)                                    │
│                                                                 │
│  👤 Paciente: João Silva                                       │
│     📞 (11) 99999-9999                                         │
│                                                                 │
│  👩‍⚕️ Profissional: Dra. Maria Silva                           │
│     Cardiologia                                                │
│                                                                 │
│  🏥 Serviço: Consulta Cardiológica                            │
│     R$ 350,00                                                  │
│                                                                 │
│  💰 Depósito: R$ 175,00 ✅ Pago                               │
│                                                                 │
│  📝 Notas:                                                     │
│  Paciente relatou dor no peito                                 │
│                                                                 │
│  ──────────────────────────────────────────────────────────   │
│                                                                 │
│  Atualizar Status:                                             │
│  [Presença Confirmada] [Concluído] [Não Compareceu]           │
│                                                                 │
│                         [Editar] [Remarcar] [Cancelar]         │
│                                                                 │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│  Novo Agendamento                                              │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Paciente *                                                    │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 🔍 Buscar paciente...                                    │  │
│  └──────────────────────────────────────────────────────────┘  │
│  [+ Novo Paciente]                                             │
│                                                                 │
│  Profissional *                                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Dra. Maria Silva (Cardiologia)                         ▼ │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Serviço *                                                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Consulta Cardiológica - R$ 350,00                      ▼ │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Data *                                                        │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 📅 15/01/2024                                            │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Horário Disponível *                                          │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐      │
│  │ 08:00  │ │ 09:00  │ │ 10:00  │ │ 14:00  │ │ 15:00  │      │
│  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘      │
│                                                                 │
│  Notas                                                         │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Observações sobre o agendamento...                       │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│                                    [Cancelar] [Criar Agendamento] │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

---

### Review & Acceptance Checklist

- [x] Create appointment with patient, professional, service, date/time
- [x] View 7-day week grid calendar
- [x] Navigate between weeks
- [x] Edit appointment details
- [x] Cancel appointment with notification option
- [x] Status workflow with valid transitions
- [x] Filter by professional
- [x] Filter by status
- [x] Time block creation
- [x] Availability checking (working hours + existing appointments + blocks)
- [x] Appointment source tracking (WhatsApp/Dashboard)
- [x] Notes field
- [x] Today's appointments view
