# Feature 012: Analytics & Dashboard

## Spec

### Overview

Analytics & Dashboard provides clinic staff with an overview of their clinic's performance. The main dashboard includes stats cards, today's appointments, onboarding progress, and setup checklist. It helps clinics understand their activity and track key metrics.

---

### User Stories

#### US-001: Dashboard Overview

**As a** clinic staff
**I want to** see a dashboard overview
**So that** I understand my clinic's activity

**Acceptance Criteria:**
- [ ] Stats cards with key metrics
- [ ] Today's appointments list
- [ ] Quick actions
- [ ] Visual, easy to scan

#### US-002: Stats Cards

**As a** clinic staff
**I want to** see key metrics at a glance
**So that** I track performance

**Acceptance Criteria:**
- [ ] Today's appointments count
- [ ] Week's appointments count
- [ ] Total patients
- [ ] Pending confirmations
- [ ] Comparison to previous period

#### US-003: Today's Appointments Widget

**As a** clinic staff
**I want to** see today's appointments
**So that** I know the schedule

**Acceptance Criteria:**
- [ ] List of today's appointments
- [ ] Time, patient, professional
- [ ] Status indicator
- [ ] Quick actions (view, confirm)

#### US-004: Onboarding Progress

**As a** new clinic owner
**I want to** see my setup progress
**So that** I know what's left

**Acceptance Criteria:**
- [ ] Progress bar (0-100%)
- [ ] Completed vs pending steps
- [ ] Clear next action

#### US-005: Setup Checklist

**As a** new clinic owner
**I want to** see a setup checklist
**So that** I complete the configuration

**Acceptance Criteria:**
- [ ] Clinic information step
- [ ] Add professional step
- [ ] Configure payments step
- [ ] Connect WhatsApp step
- [ ] Checkmarks for completed

#### US-006: No-Show Tracking

**As a** clinic staff
**I want to** track no-show rates
**So that** I can reduce missed appointments

**Acceptance Criteria:**
- [ ] No-show count
- [ ] No-show rate percentage
- [ ] By professional (optional)
- [ ] Trend over time

---

### Functional Requirements

#### FR-001: Dashboard Stats Structure

```typescript
interface DashboardStats {
  appointments: {
    today: number;
    week: number;
    month: number;
    pendingConfirmation: number;
  };
  patients: {
    total: number;
    newThisMonth: number;
  };
  noShows: {
    count: number;
    rate: number;  // Percentage
  };
  revenue: {
    thisMonth: number;
    pendingDeposits: number;
  };
}
```

#### FR-002: Stats Calculation

```typescript
async function getDashboardStats(clinicId: string): Promise<DashboardStats> {
  const today = new Date();
  const startOfWeek = getStartOfWeek(today);
  const startOfMonth = getStartOfMonth(today);

  // Get appointments
  const appointments = await getAppointments(clinicId);

  const todayAppointments = appointments.filter(a => a.date === formatDate(today));
  const weekAppointments = appointments.filter(a => new Date(a.date) >= startOfWeek);
  const monthAppointments = appointments.filter(a => new Date(a.date) >= startOfMonth);

  const pendingConfirmation = appointments.filter(
    a => a.status === 'awaiting_confirmation'
  );

  // Get patients
  const patients = await getPatients(clinicId);
  const newPatients = patients.filter(
    p => new Date(p.createdAt) >= startOfMonth
  );

  // Calculate no-shows
  const completedOrNoShow = monthAppointments.filter(
    a => a.status === 'completed' || a.status === 'no_show'
  );
  const noShows = monthAppointments.filter(a => a.status === 'no_show');
  const noShowRate = completedOrNoShow.length > 0
    ? (noShows.length / completedOrNoShow.length) * 100
    : 0;

  // Calculate revenue
  const paidAppointments = monthAppointments.filter(a => a.depositPaid);
  const revenue = paidAppointments.reduce((sum, a) => sum + a.depositAmount, 0);
  const pendingDeposits = appointments
    .filter(a => a.status !== 'cancelled' && !a.depositPaid && a.depositAmount > 0)
    .reduce((sum, a) => sum + a.depositAmount, 0);

  return {
    appointments: {
      today: todayAppointments.length,
      week: weekAppointments.length,
      month: monthAppointments.length,
      pendingConfirmation: pendingConfirmation.length,
    },
    patients: {
      total: patients.length,
      newThisMonth: newPatients.length,
    },
    noShows: {
      count: noShows.length,
      rate: Math.round(noShowRate * 10) / 10,
    },
    revenue: {
      thisMonth: revenue,
      pendingDeposits: pendingDeposits,
    },
  };
}
```

#### FR-003: Onboarding Progress Calculation

```typescript
interface OnboardingProgress {
  percentage: number;
  steps: {
    id: string;
    title: string;
    description: string;
    completed: boolean;
    action?: string;
  }[];
}

function calculateOnboardingProgress(clinic: Clinic): OnboardingProgress {
  const steps = [
    {
      id: 'clinic_info',
      title: 'Informações da clínica',
      description: 'Nome, endereço e contato',
      completed: Boolean(clinic.name && clinic.address && clinic.phone),
      action: '/dashboard/clinic',
    },
    {
      id: 'professionals',
      title: 'Adicionar profissionais',
      description: 'Cadastre os profissionais da clínica',
      completed: clinic.professionalCount > 0,
      action: '/dashboard/professionals',
    },
    {
      id: 'payments',
      title: 'Configurar pagamentos',
      description: 'Defina sua chave PIX',
      completed: Boolean(clinic.pixKey),
      action: '/dashboard/payments',
    },
    {
      id: 'whatsapp',
      title: 'Conectar WhatsApp',
      description: 'Permita agendamentos pelo WhatsApp',
      completed: clinic.whatsappConnected,
      action: '/dashboard/whatsapp',
    },
  ];

  const completed = steps.filter(s => s.completed).length;
  const percentage = Math.round((completed / steps.length) * 100);

  return { percentage, steps };
}
```

#### FR-004: Today's Appointments Query

```typescript
async function getTodayAppointments(clinicId: string): Promise<Appointment[]> {
  const today = formatDate(new Date());

  return await db.collection(`gendei_clinics/${clinicId}/appointments`)
    .where('date', '==', today)
    .where('status', 'not-in', ['cancelled'])
    .orderBy('time', 'asc')
    .get()
    .then(snapshot => snapshot.docs.map(d => d.data() as Appointment));
}
```

---

### API Endpoints

```yaml
# Dashboard
GET /api/clinics/:id/stats
  Response:
    stats: DashboardStats
    onboarding: OnboardingProgress

GET /api/appointments/today
  Query:
    clinicId: string
  Response:
    appointments: Appointment[]
    count: number

# Analytics (Future)
GET /api/analytics/appointments
  Query:
    clinicId: string
    startDate: string
    endDate: string
    groupBy: "day" | "week" | "month"
  Response:
    data: { period: string, count: number }[]

GET /api/analytics/revenue
  Query:
    clinicId: string
    startDate: string
    endDate: string
  Response:
    total: number
    byPeriod: { period: string, amount: number }[]

GET /api/analytics/no-shows
  Query:
    clinicId: string
    startDate: string
    endDate: string
  Response:
    count: number
    rate: number
    byProfessional: { professionalId, name, rate }[]
```

---

### UI Wireframes

```
┌────────────────────────────────────────────────────────────────┐
│  Dashboard                                                     │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Olá, Maria! 👋                                                │
│  Bem-vinda à Clínica Saúde Total                               │
│                                                                 │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐  │
│  │ 8          │ │ 45         │ │ 156        │ │ 3          │  │
│  │ Consultas  │ │ Esta       │ │ Pacientes  │ │ Aguardando │  │
│  │ Hoje       │ │ Semana     │ │ Total      │ │ Confirm.   │  │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘  │
│                                                                 │
│  ──────────────────────────────────────────────────────────   │
│                                                                 │
│  Consultas de Hoje                            [Ver Agenda →]   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 08:00 │ João Silva      │ Dra. Maria    │ ✅ Confirmado │  │
│  │ 09:00 │ Maria Santos    │ Dr. João      │ ⏳ Pendente   │  │
│  │ 10:00 │ Pedro Lima      │ Dra. Maria    │ ✅ Confirmado │  │
│  │ 11:00 │ Ana Costa       │ Dra. Ana      │ ⏳ Pendente   │  │
│  │ 14:00 │ Carlos Oliveira │ Dra. Maria    │ ✅ Confirmado │  │
│  │ 15:00 │ Julia Santos    │ Dr. João      │ ⏳ Pendente   │  │
│  │ 16:00 │ Bruno Lima      │ Dra. Ana      │ ✅ Confirmado │  │
│  │ 17:00 │ Fernanda Costa  │ Dra. Maria    │ ⏳ Pendente   │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│  Dashboard - Onboarding                                        │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Complete a configuração para começar:                         │
│                                                                 │
│  Progresso: ████████████░░░░░░░░ 50%                          │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ ☑️ Informações da clínica                                │  │
│  │    Nome, endereço e contato configurados                 │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ ☑️ Adicionar profissionais                               │  │
│  │    3 profissionais cadastrados                           │  │
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
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│  Dashboard - Stats Detail                                      │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Métricas do Mês                               Janeiro 2024   │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 📊 Consultas                                             │  │
│  │                                                          │  │
│  │    Total: 189                                            │  │
│  │    Concluídas: 156 (83%)                                │  │
│  │    Canceladas: 21 (11%)                                 │  │
│  │    No-Show: 12 (6%)                                     │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 👥 Pacientes                                             │  │
│  │                                                          │  │
│  │    Total: 156                                            │  │
│  │    Novos este mês: 23                                   │  │
│  │    Retornos: 133                                        │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 💰 Receita                                               │  │
│  │                                                          │  │
│  │    Depósitos recebidos: R$ 12.450,00                    │  │
│  │    Pendentes: R$ 2.650,00                               │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ ⚠️ No-Show Rate                                          │  │
│  │                                                          │  │
│  │    Taxa: 6.3%                                           │  │
│  │    ████░░░░░░░░░░░░░░░░░░░░░░░░░░                       │  │
│  │                                                          │  │
│  │    Por Profissional:                                    │  │
│  │    • Dra. Maria Silva: 4.2%                             │  │
│  │    • Dr. João Santos: 8.1%                              │  │
│  │    • Dra. Ana Costa: 7.5%                               │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

---

### Review & Acceptance Checklist

- [x] Dashboard overview with stats cards
- [x] Stats cards (appointments, patients, pending)
- [x] Today's appointments widget
- [x] Onboarding progress bar
- [x] Setup checklist with actions
- [x] Appointment statistics
- [x] No-show tracking
- [ ] Patient growth charts (Planned)
- [ ] Revenue reports (Planned)
