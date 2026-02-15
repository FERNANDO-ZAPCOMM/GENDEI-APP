# Gendei - SpecKit Plan Commands

Run each command one at a time in Claude Code to generate the full documentation (plan.md, research.md, data-model.md, quickstart.md, contracts/).

---

## 001 - Clinic Onboarding

```
/speckit.plan 001-clinic-onboarding

Tech Stack:
- Frontend: Next.js 16 (App Router), TypeScript 5.7, React 19, Tailwind CSS 4, shadcn/ui
- Backend: Firebase Functions (Node.js 20, Express.js, TypeScript)
- Auth: Firebase Authentication (Google Sign-In + email/password)
- Database: Firestore
- Forms: React Hook Form 7 + Zod 3 validation
- i18n: next-intl (pt-BR, en)

Key Features:
- Email/password or Google Sign-In registration
- Clinic profile setup (name, address, phone, CNPJ)
- Google Maps address autocomplete
- Operating hours configuration
- Business category selection (18+ healthcare categories)
- PIX payment setup (optional)
- Timezone setting (default: America/Sao_Paulo)

API Endpoints:
- POST /clinics (create clinic - auto-creates if missing)
- PATCH /clinics/me (update clinic profile)
- GET /clinics/me (get current user's clinic)
- PUT /clinics/:id/settings/:key (update settings)

Firestore Collections:
- gendei_clinics/{clinicId} (profile, settings, operating hours)
```

---

## 002 - Professional Management

```
/speckit.plan 002-professional-management

Tech Stack:
- Frontend: Next.js 16, TypeScript, React 19, Tailwind CSS 4, shadcn/ui, TanStack Query 5
- Backend: Firebase Functions (Node.js 20, Express.js)
- Storage: Firebase Storage (professional photos)

Key Features:
- Healthcare professional CRUD operations
- 18+ specialty categories (Dentist, Dermatologist, Cardiologist, etc.)
- Photo upload with preview
- Working hours per day (with breaks)
- Appointment duration setting
- Consultation price (BRL cents)
- Active/inactive status toggle

API Endpoints:
- GET /professionals (list clinic professionals)
- GET /professionals/:id (get specific professional)
- POST /professionals (create professional)
- PATCH /professionals/:id (update professional)
- DELETE /professionals/:id (delete professional)

Firestore Collections:
- gendei_clinics/{clinicId}/professionals/{professionalId}

Professional Schema:
- name, specialty, email, phone
- photo (Cloud Storage URL)
- appointmentDuration (minutes)
- consultationPrice (cents)
- workingDays: number[] (0-6)
- workingHours: {from, to} per day
- active: boolean
```

---

## 003 - Service Management

```
/speckit.plan 003-service-management

Tech Stack:
- Frontend: Next.js 16, TypeScript, React 19, Tailwind CSS 4, shadcn/ui, TanStack Query 5
- Backend: Firebase Functions (Node.js 20, Express.js)
- Database: Firestore

Key Features:
- Medical service CRUD operations
- Service pricing in BRL (cents)
- Duration configuration (minutes)
- Signal/deposit percentage (10-100%)
- Professional assignment (multi-select)
- Soft delete (deactivation)

API Endpoints:
- GET /services (list clinic services)
- GET /services/:id (get specific service)
- POST /services (create service)
- PUT /services/:id (update service)
- DELETE /services/:id (deactivate service)

Firestore Collections:
- gendei_clinics/{clinicId}/services/{serviceId}

Service Schema:
- name, description
- priceCents, signalPercentage
- durationMinutes
- professionalIds: string[]
- active: boolean
- createdAt, updatedAt
```

---

## 004 - WhatsApp Integration

```
/speckit.plan 004-whatsapp-integration

Tech Stack:
- Frontend: Next.js 16, TypeScript, Meta Embedded Signup SDK
- Backend: Firebase Functions (Node.js 20, Express.js)
- Agent: Python 3.11+, FastAPI, Uvicorn
- API: Meta Graph API v18.0+ (WhatsApp Business Platform)
- Webhooks: Cloud Run endpoint

Key Features:
- Meta Embedded Signup OAuth flow
- WhatsApp Business Account (WABA) connection
- Phone number selection and verification
- SMS/Voice code verification flow
- Webhook registration for messages
- Test message sending
- Connection status monitoring
- Quality rating display

API Endpoints (Functions):
- POST /meta/embedded-signup/start
- POST /meta/embedded-signup/complete
- POST /whatsapp/request-verification
- POST /whatsapp/register-number
- POST /whatsapp/test-message
- GET /meta/webhook (verification)
- POST /meta/webhook (incoming messages)

Agent Endpoints:
- POST /whatsapp (webhook receiver)
- GET /whatsapp (webhook verification)
- POST /flow-data-exchange (WhatsApp Flows)

Firestore Collections:
- gendei_clinics/{clinicId} (whatsapp* fields)
- gendei_whatsapp/{id} (connection details)
- gendei_tokens/{clinicId} (encrypted access tokens)
```

---

## 005 - AI Agents System

```
/speckit.plan 005-ai-agents-system

Tech Stack:
- Runtime: Python 3.11+, FastAPI, Uvicorn
- AI Providers: OpenAI (GPT-4o-mini default), Anthropic Claude 3.5 Sonnet (optional)
- Framework: OpenAI Agents SDK
- Database: Firestore (firebase-admin)
- Deployment: Google Cloud Run (Docker)

Key Features:
- Multi-agent architecture with triage routing
- 4 specialized agents: greeting, scheduling, reminder, triage
- Agent-specific tools and permissions
- Platform-agnostic agent logic
- Conversation context management
- Message buffering (2-5 seconds)
- AI provider switching (OpenAI/Anthropic)

Agent Architecture:
- Triage agent routes to specialized agents
- Greeting agent handles common greetings quickly
- Scheduling agent handles appointment booking
- Reminder agent handles confirmation/cancellation responses

Agent Tools:
- send_text_message (all agents)
- send_appointment_confirmation (scheduling)
- create_appointment (scheduling)
- check_availability (scheduling)
- cancel_appointment (reminder)
- confirm_appointment (reminder)
- enable_human_takeover (triage)

Provider Configuration:
- Default: OpenAI GPT-4o-mini
- Optional: Anthropic Claude per clinic setting (AI_PROVIDER env)

Files:
- src/agents/greeting_agent.py
- src/agents/scheduling_agent.py
- src/agents/reminder_agent.py
- src/agents/triage_agent.py
- src/providers/openai/, src/providers/anthropic/
```

---

## 006 - Appointment Management

```
/speckit.plan 006-appointment-management

Tech Stack:
- Frontend: Next.js 16, TypeScript, TanStack Query 5
- Backend: Firebase Functions (Node.js 20, Express.js)
- Database: Firestore

Key Features:
- 7-day calendar grid view
- Appointment CRUD operations
- 7-state status workflow (pending → awaiting_confirmation → confirmed → confirmed_presence → completed)
- Time blocking (vacations, breaks, meetings)
- Drag-and-drop rescheduling
- Patient/professional/service selection
- Source tracking (whatsapp, dashboard, api)
- Deposit tracking

Status Workflow:
- pending: Initial state
- awaiting_confirmation: Reminder sent, waiting response
- confirmed: Patient confirmed
- confirmed_presence: Patient arrived
- completed: Appointment finished
- cancelled: Cancelled by patient/clinic
- no_show: Patient didn't show up

API Endpoints:
- GET /appointments (list with filters: startDate, endDate, professionalId, status)
- GET /appointments/today
- GET /appointments/:id
- POST /appointments
- PUT /appointments/:id
- PUT /appointments/:id/status
- PUT /appointments/:id/reschedule
- DELETE /appointments/:id

Firestore Collections:
- gendei_appointments/{appointmentId}
- gendei_clinics/{clinicId}/timeBlocks/{blockId}

Appointment Schema:
- clinicId, patientId, professionalId, serviceId
- date (YYYY-MM-DD), time (HH:MM), duration
- status, patientName, patientPhone
- depositAmount, depositPaid
- reminder24hSent, reminder2hSent
- source, notes, conversationId
```

---

## 007 - Patient Management

```
/speckit.plan 007-patient-management

Tech Stack:
- Frontend: Next.js 16, TypeScript, TanStack Query 5
- Backend: Firebase Functions (Node.js 20, Express.js)
- Database: Firestore

Key Features:
- Patient CRUD operations
- Search by name, phone, email
- Appointment history view
- CRM tags for segmentation
- Multi-clinic patient support (same patient, multiple clinics)
- Total appointments tracking
- Last appointment date tracking

API Endpoints:
- GET /patients (list with search/filter)
- GET /patients/:id
- POST /patients
- PATCH /patients/:id
- DELETE /patients/:id (soft delete recommended)
- GET /patients/:id/appointments

Firestore Collections:
- gendei_patients/{patientId}

Patient Schema:
- name, phone, email, dateOfBirth, cpf
- address, city, state, zipCode
- clinicIds: string[] (multi-clinic support)
- notes, tags: string[]
- totalAppointments, lastAppointmentAt
- whatsappPhone
- createdAt, updatedAt
```

---

## 008 - Payment System (PIX + Stripe Connect)

```
/speckit.plan 008-payment-pix

Tech Stack:
- Backend: Firebase Functions (Node.js 20, Express.js)
- Agent: Python 3.11+, FastAPI (Cloud Run)
- Database: Firestore
- Payment Providers: PagSeguro (PIX + Checkout), Stripe Connect Express
- Scheduler: Cloud Scheduler (every 5 min for payment hold cleanup)
- Currency: BRL (Brazilian Real)

Key Features:
- PagSeguro PIX order creation (Orders API) with auto-confirm via webhook
- PagSeguro Checkout fallback for card payments
- Stripe Connect Express onboarding for split payments
- Payment hold auto-cancellation (15-min default)
- Deposit (signal) percentage setting (10-100%)
- Health insurance (convenio) support
- WhatsApp button messages for payment links
- Transaction history (orders subcollection)
- Vertical-aware deposit visibility (has_deposit feature flag)

Payment Flows:
1. PagSeguro PIX: create order -> send copia-e-cola via WhatsApp button -> webhook confirms -> update appointment
2. PagSeguro Card: create checkout -> send checkout URL via WhatsApp button -> webhook confirms
3. Payment Hold: pending appointment + signalCents > 0 + !signalPaid -> auto-cancel after 15 min
4. Stripe Connect: create Express account -> generate onboarding link -> clinic completes onboarding

API Endpoints (Functions):
- GET /payments/clinic/:clinicId (list transactions from orders subcollection)
- GET /payments/stripe-connect/:clinicId/status (Stripe Connect state with refresh)
- POST /payments/stripe-connect/:clinicId/start (create account + onboarding URL)
- POST /payments/stripe-connect/:clinicId/refresh (new onboarding link)
- POST /reminders/cleanup-payment-holds (manual hold cleanup)

Agent Endpoints:
- POST /pagseguro/webhook (PagSeguro payment confirmation with HMAC verification)

Firestore Collections:
- gendei_clinics/{clinicId} (paymentSettings with stripeConnect)
- gendei_clinics/{clinicId}/orders/{orderId} (PaymentTransaction)
- gendei_appointments/{id} (signalCents, signalPaid, signalPaidAt, signalPaymentId, totalCents)

Clinic Payment Settings:
- acceptsConvenio, convenioList, acceptsParticular
- requiresDeposit, depositPercentage (10-100%)
- pixKey, pixKeyType (cpf/cnpj/email/phone/random)
- stripeConnect: { accountId, onboardingComplete, chargesEnabled, payoutsEnabled, ... }
```

---

## 009 - Conversation Inbox

```
/speckit.plan 009-conversation-inbox

Tech Stack:
- Frontend: Next.js 16, TypeScript, TanStack Query 5
- Real-time: Firestore onSnapshot listeners
- Backend: Firebase Functions

Key Features:
- Conversation list with filters
- Full message history view
- Human takeover mode
- Return to AI mode
- Conversation states (novo, qualificado, negociando, checkout, fechado)
- Unread indicators
- Professional assignment
- Search by patient name/phone

API Endpoints:
- GET /conversations (list with filters: state, isHumanTakeover, professionalId, search)
- GET /conversations/:id
- PATCH /conversations/:id (update state, human takeover)
- GET /conversations/:id/messages
- GET /conversations/stats

Firestore Collections:
- gendei_clinics/{clinicId}/conversations/{phone}
- gendei_clinics/{clinicId}/conversations/{phone}/messages/{messageId}

Conversation Schema:
- clinicId, professionalId
- waUserPhone, waUserName
- state: enum(novo|qualificado|negociando|checkout|fechado)
- isHumanTakeover: boolean
- takenOverAt
- lastMessageAt, createdAt, updatedAt
```

---

## 010 - Reminder System

```
/speckit.plan 010-reminder-system

Tech Stack:
- Backend: Firebase Functions (Node.js 20, Express.js)
- Scheduler: Google Cloud Scheduler (every 15 minutes)
- Agent: WhatsApp Agent (Python FastAPI on Cloud Run) at /api/send-reminder
- Database: Firestore (flags on appointment documents, no separate collection)
- Vertical Config: getVerticalTerms() for terminology per vertical

Key Features:
- 24h reminder (23-25h window) with confirmation request
- 2h reminder (1.5-2.5h window) with optional arrive-early tip
- Vertical-aware terminology (consulta/sessao, emoji, arrival tips)
- Deduplication via boolean flags (reminder24hSent, reminder2hSent)
- Status transition to awaiting_confirmation after 24h reminder
- Manual single-reminder endpoint for testing
- Sends via WhatsApp Agent (not direct WhatsApp API)

Reminder Flow:
1. Cloud Scheduler triggers POST /reminders/trigger every 15 minutes
2. Calculate time windows: 24h (now+23h to now+25h), 2h (now+1.5h to now+2.5h)
3. Query gendei_appointments by date range + status in [confirmed, confirmed_presence]
4. Filter: skip appointments where reminder flag already set
5. For each: get clinic info, format message with getVerticalTerms(), send via WhatsApp Agent
6. Update: set reminder flag + timestamp (+ status for 24h -> awaiting_confirmation)

API Endpoints:
- POST /reminders/trigger (Cloud Scheduler entry point, every 15 min)
- POST /reminders/send/:appointmentId (manual send, body: { type: '24h' | '2h' })

Firestore Fields (on gendei_appointments):
- reminder24hSent: boolean
- reminder24hAt: Timestamp
- reminder2hSent: boolean
- reminder2hAt: Timestamp
- status: 'awaiting_confirmation' (set after 24h reminder)

Vertical Terms (5 configured + defaults):
- med: consulta, doctor emoji, arrive early
- dental: consulta, tooth emoji, arrive early
- psi: sessao, brain emoji, no arrive tip
- nutri: consulta, salad emoji, no arrive tip
- fisio: sessao, muscle emoji, arrive early
```

---

## 011 - Admin Portal

```
/speckit.plan 011-admin-portal

Tech Stack:
- Frontend: Next.js 16 (App Router), TypeScript, React 19, Tailwind CSS 4, shadcn/ui
- Data: TanStack Query 5, direct Firestore reads
- Auth: Firebase Authentication (Google OAuth with email whitelist)
- Charts: Recharts
- Port: 3003 (development)

Key Features:
- Platform-wide dashboard (clinics, appointments, revenue)
- Clinic management (list, search, view details)
- Appointments view with CSV export
- Revenue analytics (total, pending deposits, top clinics)
- System health monitoring (WhatsApp connection rates)
- Support tools (patient lookup by phone)
- Admin-only access via email whitelist

Dashboard Widgets:
- Total clinics count
- Total appointments count
- Revenue summary (this month)
- No-show rate
- Top clinics by appointments
- WhatsApp connection status

Firestore Security Rules:
- isAdmin() function checks email whitelist
- Direct reads for dashboards
- Read-only for most admin operations

Files:
- apps/admin/src/lib/firebase.ts (email whitelist)
- apps/admin/src/app/dashboard/ (all admin pages)
```

---

## 012 - Team Management

```
/speckit.plan 012-team-management

Tech Stack:
- Frontend: Next.js 16, TypeScript, React Hook Form
- Backend: Firebase Functions (Node.js 20, Express.js)
- Auth: Firebase Authentication
- Email: Resend (invitation emails)

Key Features:
- Invite team members by email
- Role-based permissions (owner, admin)
- Invitation expiration
- Accept invitation flow
- Change member role
- Remove team member
- Multi-admin support per clinic

Roles & Permissions:
- Owner: Full access, can delete clinic, manage billing
- Admin: Manage professionals, services, appointments, patients

API Endpoints:
- GET /team/my-role (get current user's role)
- GET /team/members (list team members)
- GET /team/invitations (list pending invitations)
- POST /team/invite (send invitation)
- DELETE /team/members/:memberId (remove member)
- PUT /team/members/:memberId/role (change role)

Firestore Collections:
- gendei_clinics/{clinicId}.ownerId
- gendei_clinics/{clinicId}.adminIds: string[]
```

---

## 013 - WhatsApp Flows

```
/speckit.plan 013-whatsapp-flows

Tech Stack:
- Agent: Python 3.11+, FastAPI
- API: Meta WhatsApp Flows API
- Encryption: RSA (for encrypted flows)
- Database: Firestore

Key Features:
- Two-flow booking system
- Flow 1: Patient information collection (name, phone, birth date)
- Flow 2: Appointment booking (professional, service, date, time)
- Flow data exchange endpoint
- RSA encryption/decryption for encrypted flows
- Flow versioning support

Architecture:
- Flows defined in Meta Business Manager
- Agent handles flow_data_exchange webhook
- Decrypts incoming flow data
- Processes and returns next screen or completion

Agent Endpoints:
- POST /flow-data-exchange (handles flow actions)

Flow Types:
- PATIENT_INFO_FLOW: Collects patient details
- BOOKING_FLOW: Professional/service/slot selection

Files:
- src/flows/handler.py
- src/flows/manager.py
- src/flows/crypto.py (RSA encryption)
```

---

## 014 - Analytics Dashboard

```
/speckit.plan 014-analytics-dashboard

Tech Stack:
- Frontend: Next.js 16, TypeScript, TanStack Query 5
- Charts: Recharts (or similar)
- Backend: Firebase Functions (aggregation queries)

Key Features:
- Appointment statistics (total, by status, by professional)
- Revenue metrics (total, by period, pending deposits)
- Patient metrics (new vs returning, total)
- Conversion metrics (scheduled vs completed)
- No-show rates
- Dashboard widgets with quick actions
- Date range filters

API Endpoints:
- GET /clinics/:id/stats (clinic statistics)
- GET /conversations/stats (conversation statistics)
- GET /appointments (with aggregation)

Dashboard Widgets:
- Appointments today
- Revenue this month
- Pending deposits
- No-show rate
- Top services by appointments
- Appointments by status chart
- Revenue trend chart
```

---

## 015 - Calendar System

```
/speckit.plan 015-calendar-system

Tech Stack:
- Frontend: Next.js 16, TypeScript, React 19
- State: TanStack Query 5
- Backend: Firebase Functions

Key Features:
- 7-day grid calendar view
- Time slot visualization (30-min increments)
- Professional filtering
- Appointment status colors
- Time block display (vacations, breaks)
- Click-to-create appointment
- Drag-and-drop rescheduling (planned)
- Today navigation button

Time Blocking:
- Vacations (full days)
- Breaks (time ranges)
- Meetings (time ranges)
- Custom blocks

API Endpoints:
- GET /clinics/:id/time-blocks
- POST /clinics/:id/time-blocks
- DELETE /clinics/:id/time-blocks/:blockId

UI Components:
- CalendarGrid (7-day view)
- TimeSlot (individual slot)
- AppointmentCard (appointment display)
- TimeBlockOverlay (blocked times)
- ProfessionalFilter (dropdown)
```

---

## Running the Commands

1. Open Claude Code in the gendei project
2. Run each command one at a time
3. Wait for the plan to be generated
4. Review and approve the generated files
5. Move to the next spec

The commands will generate:
- `plan.md` - Implementation plan
- `research.md` - Technology research
- `data-model.md` - Data models
- `quickstart.md` - Implementation guide
- `contracts/` - API specifications
