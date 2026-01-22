# Feature 011: Admin Portal

## Spec

### Overview

The Admin Portal provides platform administrators (Gendei team) with cross-clinic visibility to manage the platform. It includes a dashboard with platform-wide statistics, clinic management, appointment overview, revenue analytics, system health monitoring, and support tools.

---

### User Stories

#### US-001: Admin Login

**As a** platform admin
**I want to** login with my Google account
**So that** I can access the admin portal

**Acceptance Criteria:**
- [ ] Google OAuth login
- [ ] Email whitelist check
- [ ] Redirect non-admins to error page
- [ ] Persistent session

#### US-002: Platform Dashboard

**As a** platform admin
**I want to** see platform-wide statistics
**So that** I understand platform health

**Acceptance Criteria:**
- [ ] Total clinics count
- [ ] Active clinics
- [ ] Total appointments (today/week/month)
- [ ] Total revenue
- [ ] WhatsApp connection rate
- [ ] No-show rate

#### US-003: Clinics List

**As a** platform admin
**I want to** see all registered clinics
**So that** I can manage them

**Acceptance Criteria:**
- [ ] Clinic name and owner
- [ ] Status (active/inactive)
- [ ] WhatsApp connection status
- [ ] Professional count
- [ ] Join date
- [ ] Search and filter

#### US-004: Clinic Detail View

**As a** platform admin
**I want to** view a specific clinic's details
**So that** I can provide support

**Acceptance Criteria:**
- [ ] Clinic information
- [ ] Statistics (professionals, patients, appointments)
- [ ] Recent appointments
- [ ] Recent conversations
- [ ] Quick actions

#### US-005: All Appointments View

**As a** platform admin
**I want to** see appointments across all clinics
**So that** I have platform-wide visibility

**Acceptance Criteria:**
- [ ] All appointments list
- [ ] Filter by clinic
- [ ] Filter by status
- [ ] Filter by date range
- [ ] CSV export

#### US-006: Revenue Analytics

**As a** platform admin
**I want to** see revenue metrics
**So that** I understand platform financials

**Acceptance Criteria:**
- [ ] Total deposits collected
- [ ] Revenue by clinic
- [ ] Revenue trends
- [ ] Payment success rate

#### US-007: System Health

**As a** platform admin
**I want to** monitor system health
**So that** I can identify issues

**Acceptance Criteria:**
- [ ] API server status
- [ ] Database status
- [ ] WhatsApp agent status
- [ ] Error rates
- [ ] Response times

#### US-008: Support Tools

**As a** platform admin
**I want to** have support utilities
**So that** I can help clinics

**Acceptance Criteria:**
- [ ] Patient lookup by phone
- [ ] Clinic quick access
- [ ] Appointment search
- [ ] Conversation viewer

---

### Functional Requirements

#### FR-001: Admin Authentication

```typescript
// Admin email whitelist
const ADMIN_EMAILS = ['hello@zapcomm.app'];

async function checkAdminAccess(user: User): Promise<boolean> {
  if (!user) return false;
  return ADMIN_EMAILS.includes(user.email);
}
```

#### FR-002: Platform Statistics

```typescript
interface AdminStats {
  totalClinics: number;
  activeClinics: number;
  totalAppointments: number;
  todayAppointments: number;
  weekAppointments: number;
  monthAppointments: number;
  totalRevenue: number;
  pendingDeposits: number;
  whatsappConnectedCount: number;
  whatsappConnectedRate: number;
  noShowRate: number;
  totalProfessionals: number;
  totalPatients: number;
}

async function getPlatformStats(): Promise<AdminStats> {
  const clinics = await db.collection('gendei_clinics').get();

  let stats: AdminStats = {
    totalClinics: clinics.size,
    activeClinics: 0,
    // ... calculate all stats
  };

  for (const clinic of clinics.docs) {
    const data = clinic.data();
    if (data.whatsappConnected) stats.activeClinics++;
    // ... aggregate other stats
  }

  return stats;
}
```

#### FR-003: Clinic With Stats

```typescript
interface ClinicWithStats extends Clinic {
  professionalCount: number;
  patientCount: number;
  appointmentCount: number;
  revenue: number;
  lastActivityAt: Timestamp;
}

async function getClinicsWithStats(): Promise<ClinicWithStats[]> {
  const clinics = await db.collection('gendei_clinics').get();

  return Promise.all(clinics.docs.map(async (doc) => {
    const clinic = doc.data() as Clinic;

    const professionals = await doc.ref.collection('professionals').get();
    const appointments = await doc.ref.collection('appointments').get();

    return {
      ...clinic,
      professionalCount: professionals.size,
      appointmentCount: appointments.size,
      // ... calculate other stats
    };
  }));
}
```

#### FR-004: Cross-Clinic Queries

```typescript
// Get all appointments across clinics
async function getAllAppointments(filters: {
  clinicId?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
}): Promise<Appointment[]> {
  let query = db.collection('gendei_appointments');

  if (filters.clinicId) {
    query = query.where('clinicId', '==', filters.clinicId);
  }
  if (filters.status) {
    query = query.where('status', '==', filters.status);
  }
  if (filters.startDate) {
    query = query.where('date', '>=', filters.startDate);
  }
  if (filters.endDate) {
    query = query.where('date', '<=', filters.endDate);
  }

  return (await query.orderBy('date', 'desc').get()).docs.map(d => d.data());
}
```

---

### API Endpoints

```yaml
# Admin Dashboard
GET /api/admin/stats
  Response:
    stats: AdminStats

# Clinics
GET /api/admin/clinics
  Query:
    search?: string
    whatsappConnected?: boolean
  Response:
    clinics: ClinicWithStats[]

GET /api/admin/clinics/:id
  Response:
    clinic: ClinicWithStats
    professionals: Professional[]
    recentAppointments: Appointment[]
    recentConversations: Conversation[]

# Appointments
GET /api/admin/appointments
  Query:
    clinicId?: string
    status?: string
    startDate?: string
    endDate?: string
    limit?: number
  Response:
    appointments: Appointment[]
    total: number

GET /api/admin/appointments/export
  Query:
    (same as above)
  Response:
    (CSV file download)

# Revenue
GET /api/admin/revenue
  Query:
    startDate?: string
    endDate?: string
    groupBy?: "day" | "week" | "month"
  Response:
    total: number
    byClinic: { clinicId, clinicName, revenue }[]
    byPeriod: { period, revenue }[]

# Health
GET /api/admin/health
  Response:
    api: { status, latency }
    database: { status }
    whatsappAgent: { status }

# Support
GET /api/admin/support/patient-lookup
  Query:
    phone: string
  Response:
    patients: PatientWithClinic[]

GET /api/admin/support/clinic-search
  Query:
    query: string
  Response:
    clinics: Clinic[]
```

---

### UI Wireframes

```
┌────────────────────────────────────────────────────────────────────────────┐
│  🏥 Gendei Admin                                         admin@gendei.com  │
├────────────────────────────────────────────────────────────────────────────┤
│  ┌────────────┐                                                            │
│  │ Dashboard  │  Dashboard Overview                                        │
│  │ Clinics    │                                                            │
│  │ Appoitmnts │  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌──────────┐│
│  │ Revenue    │  │ 45         │ │ 38         │ │ 127        │ │ 84%      ││
│  │ Health     │  │ Clínicas   │ │ WhatsApp   │ │ Consultas  │ │ WA       ││
│  │ Support    │  │ Total      │ │ Conectado  │ │ Hoje       │ │ Conectado││
│  └────────────┘  └────────────┘ └────────────┘ └────────────┘ └──────────┘│
│                                                                            │
│                  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌──────────┐│
│                  │ R$ 45.230  │ │ R$ 8.500   │ │ 12%        │ │ 892      ││
│                  │ Receita    │ │ Pendente   │ │ No-Show    │ │ Pacientes││
│                  │ Total      │ │ Depósitos  │ │ Rate       │ │ Total    ││
│                  └────────────┘ └────────────┘ └────────────┘ └──────────┘│
│                                                                            │
│                  ───────────────────────────────────────────────────────   │
│                                                                            │
│                  Clínicas Recentes                                         │
│                  ┌──────────────────────────────────────────────────────┐  │
│                  │ Clínica Saúde Total      ✅ WA │ 3 profs │ 15/01/24 │  │
│                  │ Odonto Plus               ✅ WA │ 5 profs │ 14/01/24 │  │
│                  │ Fisio Center              ❌ WA │ 2 profs │ 13/01/24 │  │
│                  │ Psico Vida                ✅ WA │ 1 prof  │ 12/01/24 │  │
│                  └──────────────────────────────────────────────────────┘  │
│                                                                            │
│                  Consultas de Hoje (127)                                   │
│                  ┌──────────────────────────────────────────────────────┐  │
│                  │ 08:00 │ João Silva     │ Clínica Saúde │ Confirmado  │  │
│                  │ 08:30 │ Maria Santos   │ Odonto Plus   │ Pendente    │  │
│                  │ 09:00 │ Pedro Lima     │ Fisio Center  │ Confirmado  │  │
│                  │ ...                                                   │  │
│                  └──────────────────────────────────────────────────────┘  │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────┐
│  Clinics                                               🔍 Buscar clínica   │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  [Todas] [WhatsApp Conectado] [WhatsApp Desconectado]                     │
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ Clínica             │ Owner          │ Status │ Profs │ Apts │ Data  │  │
│  ├──────────────────────────────────────────────────────────────────────┤  │
│  │ Clínica Saúde Total │ maria@...      │ ✅ WA  │ 3     │ 245  │ 15/01 │  │
│  │ Odonto Plus         │ joao@...       │ ✅ WA  │ 5     │ 189  │ 14/01 │  │
│  │ Fisio Center        │ ana@...        │ ❌ WA  │ 2     │ 67   │ 13/01 │  │
│  │ Psico Vida          │ pedro@...      │ ✅ WA  │ 1     │ 34   │ 12/01 │  │
│  │ Nutri Saúde         │ carla@...      │ ✅ WA  │ 2     │ 156  │ 11/01 │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│  Mostrando 5 de 45 clínicas               [← Anterior] [Próximo →]       │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────┐
│  Clinic: Clínica Saúde Total                                    [Voltar]  │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  ┌────────────────────────────────────────────────────────────────────┐   │
│  │ 📍 Av. Paulista, 1000 - São Paulo, SP                              │   │
│  │ 📞 (11) 99999-9999 • 📧 contato@clinica.com                        │   │
│  │ 📅 Cadastrado em: 15/01/2024                                        │   │
│  │ 🟢 WhatsApp: Conectado • Qualidade: Verde                          │   │
│  └────────────────────────────────────────────────────────────────────┘   │
│                                                                            │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐             │
│  │ 3          │ │ 156        │ │ 245        │ │ R$ 12.450  │             │
│  │ Profs      │ │ Pacientes  │ │ Consultas  │ │ Receita    │             │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘             │
│                                                                            │
│  Profissionais                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ 👩‍⚕️ Dra. Maria Silva    │ Cardiologia  │ R$ 350,00 │ 89 apts    │  │
│  │ 👨‍⚕️ Dr. João Santos     │ Clínico Geral│ R$ 200,00 │ 112 apts   │  │
│  │ 👩‍⚕️ Dra. Ana Costa      │ Dermatologia │ R$ 300,00 │ 44 apts    │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│  Consultas Recentes                                                       │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ 15/01 14:00 │ João Silva   │ Dra. Maria   │ ✅ Confirmado      │  │
│  │ 15/01 15:00 │ Maria Santos │ Dr. João     │ ⏳ Pendente        │  │
│  │ 15/01 16:00 │ Pedro Lima   │ Dra. Ana     │ ✅ Confirmado      │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────┐
│  System Health                                                             │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  Services                                                                  │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ 🟢 API Server        │ Healthy   │ 45ms latency                     │  │
│  │ 🟢 Firestore         │ Healthy   │ Connected                        │  │
│  │ 🟢 WhatsApp Agent    │ Healthy   │ 2 instances running              │  │
│  │ 🟢 Cloud Scheduler   │ Healthy   │ Last run: 5 min ago              │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│  WhatsApp Connections                                                      │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ Connected: 38 / 45 (84%)                                             │  │
│  │ ████████████████████████████░░░░░░                                   │  │
│  │                                                                      │  │
│  │ Disconnected Clinics:                                                │  │
│  │ • Fisio Center (ana@...)                                            │  │
│  │ • Nutri Bem (carlos@...)                                            │  │
│  │ • Clínica Nova (julia@...)                                          │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────┐
│  Support Tools                                                             │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  Patient Lookup                                                           │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ 🔍 Enter phone number: (11) 99999-9999           [Search]           │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│  Results:                                                                  │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ 👤 João Silva                                                        │  │
│  │    📞 (11) 99999-9999                                               │  │
│  │    🏥 Clínicas: Clínica Saúde Total, Odonto Plus                    │  │
│  │    📊 8 consultas                                                    │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│  ───────────────────────────────────────────────────────────────────────   │
│                                                                            │
│  Clinic Quick Access                                                       │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ 🔍 Search clinic by name or email...              [Search]          │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

---

### Review & Acceptance Checklist

- [x] Admin login with email whitelist
- [x] Platform dashboard with stats
- [x] Clinics list with filters
- [x] Clinic detail view
- [x] All appointments view with export
- [x] Revenue analytics
- [x] System health monitoring
- [x] Support tools (patient lookup, clinic search)
- [x] CSV export functionality
