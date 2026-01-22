# Feature 001: Platform Onboarding

## Spec

### Overview

Platform Onboarding enables clinics to register, set up their profile, and configure their business information. It includes Google OAuth and email/password authentication, clinic profile setup with Google Maps integration, and an onboarding checklist to guide new users.

---

### User Stories

#### US-001: Clinic Registration

**As a** clinic owner
**I want to** register my clinic on the platform
**So that** I can start managing appointments

**Acceptance Criteria:**
- [ ] Sign up with Google OAuth
- [ ] Sign up with email/password
- [ ] Automatic clinic creation on first login
- [ ] Redirect to dashboard after registration

#### US-002: Google OAuth Sign-in

**As a** clinic owner
**I want to** sign in with my Google account
**So that** I don't need to remember passwords

**Acceptance Criteria:**
- [ ] "Continue with Google" button
- [ ] Firebase Auth integration
- [ ] Clinic created if first time
- [ ] Redirect to previous page or dashboard

#### US-003: Email/Password Sign-up

**As a** clinic owner
**I want to** create an account with email
**So that** I have a dedicated clinic account

**Acceptance Criteria:**
- [ ] Email validation
- [ ] Password requirements (min 6 chars)
- [ ] Confirmation message
- [ ] Automatic sign-in after registration

#### US-004: Clinic Profile Setup

**As a** clinic owner
**I want to** set up my clinic profile
**So that** patients know who we are

**Acceptance Criteria:**
- [ ] Clinic name (required)
- [ ] Category selection
- [ ] Phone number
- [ ] Email address
- [ ] Address with autocomplete
- [ ] Operating hours

#### US-005: Address with Google Maps

**As a** clinic owner
**I want to** enter my address with autocomplete
**So that** I can quickly find my location

**Acceptance Criteria:**
- [ ] Google Places autocomplete
- [ ] Address components extracted
- [ ] Coordinates saved for maps
- [ ] Manual entry fallback

#### US-006: Operating Hours Configuration

**As a** clinic owner
**I want to** set my clinic's operating hours
**So that** patients know when we're open

**Acceptance Criteria:**
- [ ] Hours per day of week
- [ ] Multiple time slots per day
- [ ] Closed days support
- [ ] Timezone setting

#### US-007: Clinic Categories

**As a** clinic owner
**I want to** select my clinic category
**So that** the system knows my specialty

**Acceptance Criteria:**
- [ ] Medical clinic
- [ ] Dental clinic
- [ ] Physical therapy
- [ ] Psychology
- [ ] Nutrition
- [ ] Aesthetics
- [ ] Veterinary
- [ ] Other

#### US-008: Onboarding Checklist

**As a** new clinic owner
**I want to** see what I need to set up
**So that** I know my progress

**Acceptance Criteria:**
- [ ] Clinic information step
- [ ] Add professional step
- [ ] Configure payments step
- [ ] Connect WhatsApp step
- [ ] Visual progress indicator

---

### Functional Requirements

#### FR-001: Clinic Document Structure

```python
# Collection: gendei_clinics/{clinicId}
{
    "id": "clinic_abc",
    "name": "Clínica Saúde Total",
    "ownerId": "user_123",  # Firebase UID
    "adminIds": ["user_123"],

    "category": "clinica_medica",

    "phone": "+5511999999999",
    "email": "contato@clinica.com",

    "address": "Av. Paulista, 1000 - São Paulo, SP",
    "addressData": {
        "street": "Av. Paulista",
        "number": "1000",
        "neighborhood": "Bela Vista",
        "city": "São Paulo",
        "state": "SP",
        "postalCode": "01310-100",
        "country": "Brazil",
        "lat": -23.5505,
        "lng": -46.6333,
    },

    "openingHours": {
        "monday": [{"start": "08:00", "end": "18:00"}],
        "tuesday": [{"start": "08:00", "end": "18:00"}],
        "wednesday": [{"start": "08:00", "end": "18:00"}],
        "thursday": [{"start": "08:00", "end": "18:00"}],
        "friday": [{"start": "08:00", "end": "18:00"}],
        "saturday": [{"start": "08:00", "end": "12:00"}],
        "sunday": [],
    },

    "timezone": "America/Sao_Paulo",

    "whatsappConnected": False,
    "whatsappPhoneNumberId": None,

    "depositPercentage": 0,

    "createdAt": Timestamp,
    "updatedAt": Timestamp,
}
```

#### FR-002: Onboarding Progress Calculation

```typescript
function calculateOnboardingProgress(clinic: Clinic): number {
  let completed = 0;
  const total = 4;

  // Step 1: Clinic information
  if (clinic.name && clinic.phone && clinic.address) {
    completed++;
  }

  // Step 2: At least one professional
  if (clinic.professionalCount > 0) {
    completed++;
  }

  // Step 3: Payment configured
  if (clinic.pixKey) {
    completed++;
  }

  // Step 4: WhatsApp connected
  if (clinic.whatsappConnected) {
    completed++;
  }

  return (completed / total) * 100;
}
```

#### FR-003: Category Definitions

```typescript
const CLINIC_CATEGORIES = {
  clinica_medica: {
    label: "Clínica Médica",
    icon: "stethoscope",
  },
  odontologia: {
    label: "Odontologia",
    icon: "tooth",
  },
  fisioterapia: {
    label: "Fisioterapia",
    icon: "activity",
  },
  psicologia: {
    label: "Psicologia",
    icon: "brain",
  },
  nutricao: {
    label: "Nutrição",
    icon: "apple",
  },
  estetica: {
    label: "Estética",
    icon: "sparkles",
  },
  veterinaria: {
    label: "Veterinária",
    icon: "paw",
  },
  outro: {
    label: "Outro",
    icon: "building",
  },
};
```

---

### API Endpoints

```yaml
# Clinic Management
GET /api/clinics/me
  Response:
    clinic: Clinic
    stats: { professionalCount, patientCount, appointmentCount }

PATCH /api/clinics/me
  Request:
    name?: string
    category?: string
    phone?: string
    email?: string
    address?: string
    addressData?: AddressData
    openingHours?: OpeningHours
    timezone?: string
  Response:
    clinic: Clinic

POST /api/clinics
  Request:
    name: string
    ownerId: string
  Response:
    clinic: Clinic

GET /api/clinics/:id/stats
  Response:
    professionalCount: number
    patientCount: number
    appointmentCount: number
    todayAppointments: number
```

---

### UI Wireframes

```
┌────────────────────────────────────────────────────────────────┐
│  Criar Conta                                                   │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  🏥  Gendei                                              │  │
│  │                                                          │  │
│  │  Crie sua conta para começar a gerenciar                │  │
│  │  seus agendamentos                                       │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  🔵 Continuar com Google                                 │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ─────────────────── ou ────────────────────                   │
│                                                                 │
│  E-mail                                                        │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ email@clinica.com                                        │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Senha                                                         │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ ••••••••                                                 │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Criar Conta                                 │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Já tem uma conta? Entrar                                      │
│                                                                 │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│  Configurações da Clínica                                      │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Informações Básicas                                           │
│                                                                 │
│  Nome da Clínica *                                             │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Clínica Saúde Total                                      │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Categoria *                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Clínica Médica                                         ▼ │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Telefone                                                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ (11) 99999-9999                                          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  E-mail                                                        │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ contato@clinica.com                                      │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Endereço                                                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 🔍 Av. Paulista, 1000 - São Paulo, SP                   │  │
│  └──────────────────────────────────────────────────────────┘  │
│  📍 Powered by Google Maps                                     │
│                                                                 │
│                                              [Salvar Alterações]│
│                                                                 │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│  Dashboard                                                     │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Bem-vindo à Clínica Saúde Total! 👋                          │
│                                                                 │
│  Complete a configuração para começar:                         │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ ☑️ Informações da clínica                                │  │
│  │    Nome, endereço e contato configurados                 │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ ⬜ Adicionar profissionais                               │  │
│  │    Cadastre os profissionais da clínica                  │  │
│  │                                         [Adicionar →]    │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ ⬜ Configurar pagamentos                                 │  │
│  │    Defina sua chave PIX para receber depósitos          │  │
│  │                                         [Configurar →]   │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ ⬜ Conectar WhatsApp                                     │  │
│  │    Permita que pacientes agendem pelo WhatsApp          │  │
│  │                                         [Conectar →]     │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Progresso: ████░░░░░░░░░░░░ 25%                              │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

---

### Review & Acceptance Checklist

- [x] Google OAuth authentication
- [x] Email/password registration
- [x] Clinic profile with all fields
- [x] Google Maps address autocomplete
- [x] Operating hours configuration
- [x] Clinic category selection
- [x] Onboarding checklist with progress
- [x] Dashboard welcome experience
