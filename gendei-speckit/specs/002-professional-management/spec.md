# Feature 002: Professional Management

## Spec

### Overview

Professional Management enables clinics to add, edit, and manage healthcare professionals. Each professional has their own profile with specialty, working hours, appointment duration, and pricing. The system supports 18+ healthcare specialties.

---

### User Stories

#### US-001: Add Professional

**As a** clinic admin
**I want to** add a new professional
**So that** they can receive appointments

**Acceptance Criteria:**
- [ ] Name (required)
- [ ] Specialty selection
- [ ] Contact information
- [ ] Photo upload
- [ ] Working hours configuration
- [ ] Appointment duration
- [ ] Consultation price

#### US-002: Edit Professional

**As a** clinic admin
**I want to** edit professional details
**So that** I can keep information updated

**Acceptance Criteria:**
- [ ] All fields editable
- [ ] Photo replacement
- [ ] Working hours modification
- [ ] Save confirmation

#### US-003: Delete Professional

**As a** clinic admin
**I want to** remove a professional
**So that** they no longer receive appointments

**Acceptance Criteria:**
- [ ] Confirmation dialog
- [ ] Check for existing appointments
- [ ] Soft delete (deactivate) option
- [ ] Hard delete if no appointments

#### US-004: Professional Photo

**As a** clinic admin
**I want to** upload professional photos
**So that** patients can identify them

**Acceptance Criteria:**
- [ ] Image upload
- [ ] Preview before save
- [ ] Automatic resizing
- [ ] Avatar fallback with initials

#### US-005: Working Hours

**As a** clinic admin
**I want to** set working hours per professional
**So that** only available times are bookable

**Acceptance Criteria:**
- [ ] Hours per day of week
- [ ] Multiple time slots per day
- [ ] Break time support
- [ ] Different hours per day

#### US-006: Appointment Duration

**As a** clinic admin
**I want to** set appointment duration
**So that** the system knows how to schedule

**Acceptance Criteria:**
- [ ] Duration in minutes
- [ ] Default 30 minutes
- [ ] Options: 15, 30, 45, 60, 90, 120 min

#### US-007: Active/Inactive Status

**As a** clinic admin
**I want to** deactivate a professional
**So that** they temporarily don't receive appointments

**Acceptance Criteria:**
- [ ] Toggle active status
- [ ] Inactive professional not shown in booking
- [ ] Existing appointments preserved
- [ ] Visual indicator in list

---

### Functional Requirements

#### FR-001: Professional Document Structure

```python
# Collection: gendei_clinics/{clinicId}/professionals/{professionalId}
{
    "id": "prof_123",
    "clinicId": "clinic_abc",

    "name": "Dra. Maria Silva",
    "specialty": "cardiologia",

    "email": "maria@clinica.com",
    "phone": "+5511988888888",
    "photoUrl": "https://storage.../photo.jpg",
    "bio": "Cardiologista com 15 anos de experiência...",

    "workingHours": {
        "0": [],  # Sunday - closed
        "1": [{"start": "08:00", "end": "12:00"}, {"start": "14:00", "end": "18:00"}],
        "2": [{"start": "08:00", "end": "18:00"}],
        "3": [{"start": "08:00", "end": "12:00"}, {"start": "14:00", "end": "18:00"}],
        "4": [{"start": "08:00", "end": "18:00"}],
        "5": [{"start": "08:00", "end": "12:00"}],
        "6": [],  # Saturday - closed
    },

    "appointmentDuration": 30,  # minutes
    "consultationPrice": 350.00,

    "active": True,

    "createdAt": Timestamp,
    "updatedAt": Timestamp,
}
```

#### FR-002: Specialty Definitions

```typescript
const SPECIALTIES = {
  clinico_geral: { label: "Clínico Geral", icon: "stethoscope" },
  cardiologia: { label: "Cardiologia", icon: "heart" },
  dermatologia: { label: "Dermatologia", icon: "sun" },
  endocrinologia: { label: "Endocrinologia", icon: "activity" },
  gastroenterologia: { label: "Gastroenterologia", icon: "pill" },
  ginecologia: { label: "Ginecologia", icon: "heart" },
  neurologia: { label: "Neurologia", icon: "brain" },
  oftalmologia: { label: "Oftalmologia", icon: "eye" },
  ortopedia: { label: "Ortopedia", icon: "bone" },
  otorrinolaringologia: { label: "Otorrinolaringologia", icon: "ear" },
  pediatria: { label: "Pediatria", icon: "baby" },
  psiquiatria: { label: "Psiquiatria", icon: "brain" },
  urologia: { label: "Urologia", icon: "shield" },
  fisioterapia: { label: "Fisioterapia", icon: "activity" },
  nutricao: { label: "Nutrição", icon: "apple" },
  psicologia: { label: "Psicologia", icon: "brain" },
  odontologia: { label: "Odontologia", icon: "smile" },
  outro: { label: "Outro", icon: "user" },
};
```

#### FR-003: Working Hours Conversion

```typescript
// Convert frontend format (named days) to backend format (numbered days)
function convertWorkingHoursToBackend(frontendHours: Record<string, TimeSlot[]>): Record<string, TimeSlot[]> {
  const dayMapping = {
    sunday: "0",
    monday: "1",
    tuesday: "2",
    wednesday: "3",
    thursday: "4",
    friday: "5",
    saturday: "6",
  };

  const result: Record<string, TimeSlot[]> = {};
  for (const [day, slots] of Object.entries(frontendHours)) {
    result[dayMapping[day]] = slots;
  }
  return result;
}
```

#### FR-004: Availability Calculation

```typescript
function getAvailableSlots(
  professional: Professional,
  date: Date,
  existingAppointments: Appointment[]
): TimeSlot[] {
  const dayOfWeek = date.getDay().toString();
  const workingHours = professional.workingHours[dayOfWeek] || [];

  if (workingHours.length === 0) {
    return []; // Professional doesn't work this day
  }

  const slots: TimeSlot[] = [];
  const duration = professional.appointmentDuration;

  for (const period of workingHours) {
    let current = parseTime(period.start);
    const end = parseTime(period.end);

    while (current + duration <= end) {
      const slotStart = formatTime(current);
      const slotEnd = formatTime(current + duration);

      // Check if slot conflicts with existing appointments
      const isBooked = existingAppointments.some(apt =>
        apt.time === slotStart && apt.professionalId === professional.id
      );

      if (!isBooked) {
        slots.push({ start: slotStart, end: slotEnd });
      }

      current += duration;
    }
  }

  return slots;
}
```

---

### API Endpoints

```yaml
# Professionals
GET /api/professionals
  Query:
    clinicId: string
    active?: boolean
  Response:
    professionals: Professional[]

GET /api/professionals/:id
  Response:
    professional: Professional

POST /api/professionals
  Request:
    name: string
    specialty: string
    email?: string
    phone?: string
    workingHours: Record<string, TimeSlot[]>
    appointmentDuration: number
    consultationPrice?: number
  Response:
    professional: Professional

PATCH /api/professionals/:id
  Request:
    name?: string
    specialty?: string
    email?: string
    phone?: string
    photoUrl?: string
    bio?: string
    workingHours?: Record<string, TimeSlot[]>
    appointmentDuration?: number
    consultationPrice?: number
    active?: boolean
  Response:
    professional: Professional

DELETE /api/professionals/:id
  Response:
    deleted: boolean
```

---

### UI Wireframes

```
┌────────────────────────────────────────────────────────────────┐
│  Profissionais                                    [+ Adicionar]│
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 👩‍⚕️ Dra. Maria Silva                                    │  │
│  │    Cardiologia                                           │  │
│  │    ✅ Ativo • R$ 350,00/consulta                        │  │
│  │    Seg-Sex 08:00-18:00                                  │  │
│  │                                    [Editar] [Desativar]  │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 👨‍⚕️ Dr. João Santos                                     │  │
│  │    Clínico Geral                                        │  │
│  │    ✅ Ativo • R$ 200,00/consulta                        │  │
│  │    Seg-Qua 08:00-12:00, 14:00-18:00                    │  │
│  │                                    [Editar] [Desativar]  │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 👩‍⚕️ Dra. Ana Costa                                      │  │
│  │    Dermatologia                                         │  │
│  │    ⚪ Inativo                                           │  │
│  │                                      [Editar] [Ativar]   │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│  Novo Profissional                                             │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Foto                                                          │
│  ┌────────┐                                                    │
│  │  📷    │  [Escolher Foto]                                  │
│  │        │                                                    │
│  └────────┘                                                    │
│                                                                 │
│  Nome Completo *                                               │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Dra. Maria Silva                                         │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Especialidade *                                               │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Cardiologia                                            ▼ │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  E-mail                                                        │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ maria@clinica.com                                        │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Telefone                                                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ (11) 98888-8888                                          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Bio                                                           │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Cardiologista com 15 anos de experiência...             │  │
│  │                                                          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ──────────────────────────────────────────────────────────   │
│                                                                 │
│  Horários de Trabalho                                          │
│                                                                 │
│  Segunda-feira                                                 │
│  ┌─────────────────┐  ┌─────────────────┐                     │
│  │ 08:00 - 12:00   │  │ 14:00 - 18:00   │  [+ Adicionar]     │
│  └─────────────────┘  └─────────────────┘                     │
│                                                                 │
│  Terça-feira                                                   │
│  ┌─────────────────┐                                          │
│  │ 08:00 - 18:00   │                       [+ Adicionar]     │
│  └─────────────────┘                                          │
│                                                                 │
│  ... (outros dias)                                             │
│                                                                 │
│  ──────────────────────────────────────────────────────────   │
│                                                                 │
│  Configurações de Consulta                                     │
│                                                                 │
│  Duração da Consulta *                                         │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 30 minutos                                             ▼ │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Valor da Consulta                                             │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ R$ 350,00                                                │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│                              [Cancelar] [Salvar Profissional]  │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

---

### Review & Acceptance Checklist

- [x] Add professional with all fields
- [x] Edit professional details
- [x] Delete/deactivate professional
- [x] Photo upload with preview
- [x] 18+ healthcare specialties
- [x] Working hours per day with multiple slots
- [x] Break time support
- [x] Appointment duration configuration
- [x] Consultation pricing
- [x] Active/inactive status toggle
- [x] Professional list with status indicators
