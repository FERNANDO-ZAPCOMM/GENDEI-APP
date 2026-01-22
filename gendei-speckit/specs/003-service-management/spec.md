# Feature 003: Service Management

## Spec

### Overview

Service Management enables clinics to define the procedures and services they offer. Each service has a name, description, duration, price, and can be assigned to specific professionals. Services support both in-person and online modalities.

---

### User Stories

#### US-001: Add Service

**As a** clinic admin
**I want to** add a new service/procedure
**So that** patients can book it

**Acceptance Criteria:**
- [ ] Service name (required)
- [ ] Description
- [ ] Duration in minutes
- [ ] Price
- [ ] Modality (presencial/online)
- [ ] Assign to professionals

#### US-002: Edit Service

**As a** clinic admin
**I want to** edit service details
**So that** I can keep information updated

**Acceptance Criteria:**
- [ ] All fields editable
- [ ] Professional assignment changes
- [ ] Save confirmation

#### US-003: Delete Service

**As a** clinic admin
**I want to** remove a service
**So that** it's no longer offered

**Acceptance Criteria:**
- [ ] Confirmation dialog
- [ ] Check for existing appointments
- [ ] Soft delete (deactivate)

#### US-004: Assign to Professionals

**As a** clinic admin
**I want to** assign services to specific professionals
**So that** only qualified staff can provide them

**Acceptance Criteria:**
- [ ] Multi-select professionals
- [ ] Service appears for selected professionals only
- [ ] Easy to modify assignments

#### US-005: Deposit Required Toggle

**As a** clinic admin
**I want to** require deposit for specific services
**So that** I can reduce no-shows for expensive procedures

**Acceptance Criteria:**
- [ ] Toggle per service
- [ ] Use clinic's deposit percentage
- [ ] Clear indication to patient

---

### Functional Requirements

#### FR-001: Service Document Structure

```python
# Collection: gendei_clinics/{clinicId}/services/{serviceId}
{
    "id": "svc_123",
    "clinicId": "clinic_abc",

    "name": "Consulta Cardiológica",
    "description": "Avaliação cardiológica completa com eletrocardiograma",

    "duration": 45,  # minutes
    "price": 350.00,

    "modality": "presencial",  # "presencial" | "online"

    "professionalIds": ["prof_123", "prof_456"],

    "requiresDeposit": True,

    "active": True,

    "createdAt": Timestamp,
    "updatedAt": Timestamp,
}
```

#### FR-002: Modality Options

```typescript
const SERVICE_MODALITIES = {
  presencial: {
    label: "Presencial",
    description: "Atendimento na clínica",
    icon: "building",
  },
  online: {
    label: "Online",
    description: "Teleconsulta por vídeo",
    icon: "video",
  },
};
```

#### FR-003: Duration Options

```typescript
const DURATION_OPTIONS = [
  { value: 15, label: "15 minutos" },
  { value: 30, label: "30 minutos" },
  { value: 45, label: "45 minutos" },
  { value: 60, label: "1 hora" },
  { value: 90, label: "1 hora e 30 minutos" },
  { value: 120, label: "2 horas" },
];
```

---

### API Endpoints

```yaml
# Services
GET /api/services
  Query:
    clinicId: string
    active?: boolean
    professionalId?: string
  Response:
    services: Service[]

GET /api/services/:id
  Response:
    service: Service

POST /api/services
  Request:
    name: string
    description?: string
    duration: number
    price: number
    modality: "presencial" | "online"
    professionalIds: string[]
    requiresDeposit?: boolean
  Response:
    service: Service

PUT /api/services/:id
  Request:
    name?: string
    description?: string
    duration?: number
    price?: number
    modality?: string
    professionalIds?: string[]
    requiresDeposit?: boolean
    active?: boolean
  Response:
    service: Service

DELETE /api/services/:id
  Response:
    deleted: boolean
```

---

### UI Wireframes

```
┌────────────────────────────────────────────────────────────────┐
│  Serviços                                        [+ Adicionar] │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 🏥 Consulta Cardiológica                                 │  │
│  │    45 min • R$ 350,00 • Presencial                      │  │
│  │    Profissionais: Dra. Maria Silva                      │  │
│  │    💰 Requer depósito                                   │  │
│  │                                    [Editar] [Desativar]  │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 💻 Teleconsulta                                          │  │
│  │    30 min • R$ 200,00 • Online                          │  │
│  │    Profissionais: Dr. João Santos, Dra. Ana Costa       │  │
│  │                                    [Editar] [Desativar]  │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 🩺 Eletrocardiograma                                    │  │
│  │    15 min • R$ 150,00 • Presencial                      │  │
│  │    Profissionais: Dra. Maria Silva                      │  │
│  │    💰 Requer depósito                                   │  │
│  │                                    [Editar] [Desativar]  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│  Novo Serviço                                                  │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Nome do Serviço *                                             │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Consulta Cardiológica                                    │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Descrição                                                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Avaliação cardiológica completa com eletrocardiograma   │  │
│  │                                                          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Duração *                           Preço *                   │
│  ┌────────────────────────┐         ┌────────────────────────┐ │
│  │ 45 minutos           ▼ │         │ R$ 350,00              │ │
│  └────────────────────────┘         └────────────────────────┘ │
│                                                                 │
│  Modalidade *                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │ ○ Presencial    ● Online                               │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                 │
│  Profissionais que oferecem este serviço                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ ☑️ Dra. Maria Silva (Cardiologia)                       │  │
│  │ ⬜ Dr. João Santos (Clínico Geral)                      │  │
│  │ ⬜ Dra. Ana Costa (Dermatologia)                        │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ☑️ Requer depósito para agendamento                          │
│     O paciente deverá pagar 50% antecipadamente               │
│                                                                 │
│                                  [Cancelar] [Salvar Serviço]   │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

---

### Review & Acceptance Checklist

- [x] Add service with all fields
- [x] Edit service details
- [x] Delete/deactivate service
- [x] Service duration options
- [x] Service pricing
- [x] Presencial/Online modality
- [x] Professional assignment (multi-select)
- [x] Deposit required toggle
- [x] Active/inactive status
- [x] Service list with clear information
