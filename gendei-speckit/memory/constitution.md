# Gendei - Constitution

## Project Principles

This document establishes the governing principles for Gendei development. All specifications, plans, and implementations must adhere to these guidelines.

---

## 1. Core Mission

Gendei exists to **empower Brazilian healthcare clinics to manage patient appointments through WhatsApp using AI-powered scheduling automation** that handles booking, reminders, and confirmations 24/7.

---

## 2. Product Philosophy

### 2.1 Target Market (STRICT)

| Attribute | Value |
|-----------|-------|
| **Geography** | Brazil (primary) |
| **User Type** | Healthcare clinics (medical, dental, therapy) |
| **Service Types** | Presencial appointments, online consultations |
| **Channels** | WhatsApp (primary), Web Dashboard |
| **Payments** | PIX deposits (optional) |

### 2.2 AI Agent Philosophy

**Patient Experience is Sacred:**
```
The AI must sound natural and helpful, not robotic.
- Quick responses to greetings
- Clear guidance through booking process
- Human handoff always available
```

**Specialist Agent Model:**
```python
# 4 specialized agents, each with focused expertise
AGENTS = {
    "greeting": "Welcome patient, detect intent, warm introduction",
    "scheduling": "Book appointments, check availability, collect info",
    "reminder": "Handle reminder responses, confirmations, reschedules",
    "triage": "Complex routing, unclear intents, human handoff",
}
```

**Appointment Safety (NON-NEGOTIABLE):**
```
❌ NEVER double-book time slots
❌ NEVER book outside professional's working hours
✅ ALWAYS confirm appointment details before finalizing
✅ ALWAYS send confirmation message after booking
```

### 2.3 Reminder System

**Dual Reminder Strategy:**
```
Every appointment gets TWO reminders:
- 24 hours before: "Lembrete: Seu agendamento é amanhã..."
- 2 hours before: "Seu horário é em 2 horas..."
```

**Reminder Processing:**
```python
REMINDER_WINDOWS = {
    "24h": {"min_hours": 23, "max_hours": 25},
    "2h": {"min_hours": 1.5, "max_hours": 2.5},
}
```

---

## 3. Architecture Principles

### 3.1 Technology Stack (STRICT)

| Component | Technology | Rationale |
|-----------|------------|-----------|
| **Frontend** | Next.js 16 + React 18 | App Router, SSR, TypeScript |
| **UI Components** | shadcn/ui + Radix | Accessible, customizable |
| **Styling** | Tailwind CSS 3.4 | Utility-first, responsive |
| **State** | TanStack Query v5 | Server state, caching, refetch |
| **Forms** | React Hook Form + Zod | Validation, type safety |
| **Backend API** | Firebase Functions | Serverless, auto-scaling |
| **Database** | Firestore | Real-time, NoSQL, subcollections |
| **Auth** | Firebase Auth | Google OAuth, Email/Password |
| **AI Agent** | Python 3.11+ FastAPI | Async, OpenAI/Anthropic SDKs |
| **AI Providers** | OpenAI GPT-4 + Anthropic Claude | Multi-provider flexibility |
| **Payments** | PagSeguro/PagBank | PIX, Brazilian market |
| **Maps** | Google Maps API | Address autocomplete |
| **Email** | Resend | Notifications |
| **Hosting (Web)** | Vercel | Edge, automatic deployments |
| **Hosting (Agent)** | Cloud Run | Containers, auto-scaling |
| **Scheduled Tasks** | Cloud Scheduler | Cron jobs every 15 min |
| **i18n** | next-intl | PT-BR, EN |

### 3.2 Database Architecture

```
firestore/
├── gendei_clinics/{clinicId}/
│   ├── (clinic document)
│   │   ├── name, ownerId, adminIds[]
│   │   ├── category: "clinica_medica" | "odontologia" | ...
│   │   ├── address, addressData (with coordinates)
│   │   ├── phone, email, timezone
│   │   ├── openingHours: { mon-sun }
│   │   ├── whatsappConnected: boolean
│   │   ├── whatsappPhoneNumberId
│   │   ├── depositPercentage: 0-100
│   │   └── createdAt, updatedAt
│   │
│   ├── professionals/{professionalId}
│   │   ├── id, clinicId, name
│   │   ├── specialty: string
│   │   ├── email, phone, photoUrl, bio
│   │   ├── workingHours: { 0-6: [{start, end}] }
│   │   ├── appointmentDuration: number (minutes)
│   │   ├── consultationPrice: number
│   │   ├── active: boolean
│   │   └── createdAt, updatedAt
│   │
│   ├── services/{serviceId}
│   │   ├── id, clinicId, name, description
│   │   ├── duration, price
│   │   ├── modality: "presencial" | "online"
│   │   ├── professionalIds[]
│   │   ├── requiresDeposit: boolean
│   │   ├── active: boolean
│   │   └── createdAt, updatedAt
│   │
│   ├── appointments/{appointmentId}
│   │   ├── id, clinicId
│   │   ├── patientId, patientName, patientPhone
│   │   ├── professionalId, professionalName
│   │   ├── serviceId, serviceName
│   │   ├── date: "YYYY-MM-DD", time: "HH:MM"
│   │   ├── duration: number
│   │   ├── status: "pending" | "awaiting_confirmation" | "confirmed" | ...
│   │   ├── depositAmount, depositPaid: boolean
│   │   ├── reminder24hSent, reminder2hSent: boolean
│   │   ├── source: "whatsapp" | "dashboard"
│   │   ├── notes
│   │   └── createdAt, confirmedAt, cancelledAt, completedAt
│   │
│   ├── conversations/{conversationId}
│   │   ├── id, clinicId
│   │   ├── waUserId, waUserPhone, waUserName
│   │   ├── state: "novo" | "qualificado" | "negociando" | "checkout" | "fechado"
│   │   ├── isHumanTakeover: boolean
│   │   ├── professionalId, takenOverAt
│   │   ├── lastMessageAt
│   │   └── messages/ (subcollection)
│   │       └── {messageId}
│   │           ├── content, mediaUrl
│   │           ├── direction: "incoming" | "outgoing"
│   │           ├── isFromAI: boolean
│   │           └── timestamp
│   │
│   └── timeBlocks/{blockId}
│       ├── id, clinicId, professionalId
│       ├── date, startTime, endTime
│       ├── reason
│       └── createdAt, updatedAt
│
├── gendei_patients/{patientId}
│   ├── id, clinicIds[]
│   ├── name, phone, email
│   ├── dateOfBirth, cpf, address
│   ├── notes, tags[]
│   ├── totalAppointments, lastAppointmentAt
│   └── createdAt, updatedAt
│
├── gendei_appointments/{appointmentId}  (top-level for queries)
│   └── (duplicate of clinic appointment for global queries)
│
├── gendei_whatsapp/{id}
│   ├── clinicId, phoneNumberId, wabaId
│   ├── displayPhoneNumber, verifiedName
│   ├── qualityRating: "GREEN" | "YELLOW" | "RED" | "UNKNOWN"
│   ├── accessToken (encrypted)
│   ├── status
│   └── createdAt, updatedAt
│
├── gendei_tokens/{clinicId}  (SERVER-ONLY)
│   └── accessToken, refreshToken, expiresAt
│
└── gendei_time_blocks/{id}
    └── (time block data for global queries)
```

### 3.3 API Design

**RESTful with Firebase Functions:**
```
/api/clinics           - Clinic CRUD
/api/professionals     - Professional management
/api/services          - Service/procedure management
/api/appointments      - Appointment CRUD
/api/patients          - Patient management
/api/conversations     - WhatsApp conversation history
/api/meta              - WhatsApp OAuth, webhooks
/api/whatsapp          - WhatsApp configuration
/api/reminders         - Reminder processing (cron)
/api/team              - Team member management
```

**Python Agent Endpoints:**
```
GET  /                 - Health check
GET  /health           - Health check
POST /whatsapp         - WhatsApp webhook (messages)
POST /flows            - WhatsApp Flows data_exchange
```

### 3.4 Authentication & Authorization

**Roles:**
```python
ROLES = {
    "owner": "Full access, can delete clinic, manage team",
    "admin": "Full access except deletion",
    "support": "View conversations, manage appointments only",
}
```

**Firebase Custom Claims:**
```json
{
  "role": "owner",
  "clinicId": "abc123"
}
```

**Admin Portal Access:**
```typescript
// Email whitelist for platform admins
const ADMIN_EMAILS = ['hello@zapcomm.app'];
```

---

## 4. Security Principles

### 4.1 Token Management

```
✅ All WhatsApp OAuth tokens stored in gendei_tokens collection (server-only)
✅ Firestore rules block client access to tokens
✅ Tokens accessed only by Cloud Functions and Cloud Run
✅ Tokens encrypted at rest
```

### 4.2 Payment Security

```
✅ PagSeguro handles all sensitive payment data
✅ No credit card numbers stored in Firestore
✅ PIX keys confirmed via double-entry
✅ Webhook signatures verified
```

### 4.3 Webhook Security

```python
# Meta signature verification
def verify_meta_signature(payload: bytes, signature: str) -> bool:
    expected = hmac.new(
        APP_SECRET.encode(),
        payload,
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(f"sha256={expected}", signature)
```

### 4.4 WhatsApp Flows Encryption

```python
# RSA-2048 encryption for flow data
def decrypt_flow_data(encrypted_data: str, private_key: str) -> dict:
    # Decrypt using RSA private key
    pass
```

---

## 5. Code Quality Standards

### 5.1 TypeScript Frontend

```typescript
// Required
- Next.js 16 with App Router
- Strict TypeScript mode
- 'use client' directive for client components
- TanStack Query for all API calls
- React Hook Form + Zod for forms
- Tailwind CSS (no custom CSS unless necessary)
- shadcn/ui components (no custom primitives)
- ESLint + Prettier enforced
- next-intl for i18n
```

### 5.2 Python Backend

```python
# Required
- Type hints on all functions
- Pydantic models for request/response
- FastAPI with async handlers
- aiohttp for external HTTP calls
- Structured logging with context
- OpenAI Agents SDK or Anthropic SDK for AI
```

### 5.3 Firestore

```javascript
// Required
- Subcollections for clinic-scoped data
- Composite indexes for complex queries
- Security rules enforce access control
- Timestamps use serverTimestamp()
- Collection names prefixed with "gendei_"
```

---

## 6. Appointment Status Workflow

### 6.1 Status Definitions

```python
APPOINTMENT_STATUSES = {
    "pending": "Appointment created, awaiting first reminder",
    "awaiting_confirmation": "24h reminder sent, waiting for patient response",
    "confirmed": "Patient confirmed (via payment or message)",
    "confirmed_presence": "Patient confirmed they will attend",
    "completed": "Appointment happened successfully",
    "cancelled": "Appointment cancelled by patient or clinic",
    "no_show": "Patient did not attend",
}
```

### 6.2 Status Transitions

```
pending
    │
    ├─── (24h before) ──────────> awaiting_confirmation
    │                                     │
    │                    ┌────────────────┼────────────────┐
    │                    │                │                │
    │                    ▼                ▼                ▼
    │              (confirms)       (reschedules)     (cancels)
    │                    │                │                │
    │                    ▼                │                ▼
    │              confirmed              │           cancelled
    │                    │                │
    │                    ▼                │
    │         confirmed_presence          │
    │                    │                │
    │         ┌─────────┴─────────┐      │
    │         │                   │      │
    │         ▼                   ▼      │
    │    completed            no_show    │
    │                                    │
    └────────────────────────────────────┘
```

---

## 7. Conversation Standards

### 7.1 AI Message Format

**Greeting:**
```
Olá! 👋
Sou a assistente virtual da [CLINIC_NAME].
Como posso ajudar você hoje?
```

**Appointment Confirmation:**
```
Consulta agendada! ✅

📅 Data: [DATE]
🕐 Horário: [TIME]
👨‍⚕️ Profissional: Dr(a). [NAME]
📍 Local: [ADDRESS]

Te envio um lembrete 24h antes.
Qualquer dúvida, estou por aqui!
```

**24h Reminder:**
```
Olá, [PATIENT_NAME]! 👋

Lembrete: Sua consulta é amanhã!

📅 [DATE] às [TIME]
👨‍⚕️ Dr(a). [PROFESSIONAL_NAME]

Você confirma sua presença?
```

**2h Reminder:**
```
[PATIENT_NAME], sua consulta é em 2 horas!

📅 Hoje às [TIME]
👨‍⚕️ Dr(a). [PROFESSIONAL_NAME]
📍 [ADDRESS]

Te esperamos! 😊
```

### 7.2 Emoji Guidelines

```
✅ Use emojis sparingly for warmth
✅ Max 1-2 emojis per message
❌ Never use emojis in formal medical contexts
❌ Never use multiple emojis in a row
```

---

## 8. Professional Specialties

### 8.1 Supported Specialties

```typescript
const SPECIALTIES = [
  "clinico_geral",
  "cardiologia",
  "dermatologia",
  "endocrinologia",
  "gastroenterologia",
  "ginecologia",
  "neurologia",
  "oftalmologia",
  "ortopedia",
  "otorrinolaringologia",
  "pediatria",
  "psiquiatria",
  "urologia",
  "fisioterapia",
  "nutricao",
  "psicologia",
  "odontologia",
  "outro",
];
```

### 8.2 Clinic Categories

```typescript
const CLINIC_CATEGORIES = [
  "clinica_medica",
  "odontologia",
  "fisioterapia",
  "psicologia",
  "nutricao",
  "estetica",
  "veterinaria",
  "outro",
];
```

---

## 9. Working Hours Format

### 9.1 Backend Format (Firestore)

```typescript
// Days indexed 0-6 (Sunday = 0)
workingHours: {
  "0": [],  // Sunday - closed
  "1": [{ start: "08:00", end: "12:00" }, { start: "14:00", end: "18:00" }],
  "2": [{ start: "08:00", end: "18:00" }],
  // ...
}
```

### 9.2 Frontend Format (Display)

```typescript
// Days as named keys for i18n
workingHours: {
  monday: [{ start: "08:00", end: "12:00" }, { start: "14:00", end: "18:00" }],
  tuesday: [{ start: "08:00", end: "18:00" }],
  // ...
}
```

---

## 10. Monitoring & Observability

### 10.1 Logging

```python
# Structured logging
{
    "timestamp": "2024-01-15T10:30:00Z",
    "level": "INFO",
    "service": "whatsapp-agent",
    "clinic_id": "abc123",
    "conversation_id": "conv456",
    "event": "message_received",
    "data": {...}
}
```

### 10.2 Metrics

```
- Message response time (p50, p95, p99)
- AI agent success rate
- Appointment conversion rate
- Reminder delivery rate
- No-show rate
- Webhook processing time
```

### 10.3 Alerts

```
- Webhook errors > 5/minute
- Reminder failures > 10/hour
- AI response time > 5 seconds
- WhatsApp quality rating < GREEN
```

---

## 11. Environment Variables

### 11.1 Frontend (.env.local)

```env
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=gendei-prod.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=gendei-prod
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_API_URL=https://us-central1-gendei-prod.cloudfunctions.net/api
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=
NEXT_PUBLIC_META_APP_ID=
NEXT_PUBLIC_META_CONFIG_ID=
```

### 11.2 Cloud Functions (.env)

```env
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_BUSINESS_ACCOUNT_ID=
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
RESEND_API_KEY=
WHATSAPP_AGENT_URL=
```

### 11.3 WhatsApp Agent (.env)

```env
AI_PROVIDER=openai  # or "anthropic"
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GOOGLE_CLOUD_PROJECT=gendei-prod
META_BISU_ACCESS_TOKEN=
META_WEBHOOK_VERIFY_TOKEN=
DOMAIN=
PAGSEGURO_TOKEN=
PAGSEGURO_EMAIL=
CLINICA_MEDICA_FORMULARIO_FLOW_ID=
CLINICA_MEDICA_AGENDAMENTO_FLOW_ID=
FLOWS_PRIVATE_KEY=
```

---

## 12. Deployment

### 12.1 Frontend (Vercel)

```
- Automatic deploys from main branch
- Preview deploys for PRs
- Environment variables in Vercel dashboard
- Port: 3002 (development)
```

### 12.2 Admin Portal (Vercel)

```
- Same infrastructure as frontend
- Email whitelist for access control
- Port: 3003 (development)
```

### 12.3 Firebase Functions

```bash
cd apps/functions
npm run deploy
```

### 12.4 WhatsApp Agent (Cloud Run)

```bash
cd apps/whatsapp-agent
./deploy.sh  # or ./deploy-light.sh for staging
```

**Production Config:**
```
- 2 CPU, 4Gi memory
- 1 min instance (always warm)
- 20 max instances
```

**Staging Config:**
```
- 1 CPU, 512Mi memory
- 0 min instances (scale to zero)
- 3 max instances
```

---

## 13. Testing Requirements

### 13.1 Unit Tests

```
- Jest for TypeScript/React
- pytest for Python
- Mock external APIs (OpenAI, Meta, PagSeguro)
- Mock Firestore with emulator
```

### 13.2 Manual Testing Checklist

```
□ New patient can book via WhatsApp
□ AI responds to greetings correctly
□ Availability checking works
□ Appointment created in correct clinic
□ 24h reminder sends at right time
□ 2h reminder sends at right time
□ Patient can confirm via WhatsApp
□ Patient can reschedule via WhatsApp
□ PIX deposit generated correctly
□ Dashboard shows new appointments
```

---

## 14. i18n Standards

### 14.1 Supported Languages

```typescript
const LOCALES = ['pt-BR', 'en'];
const DEFAULT_LOCALE = 'pt-BR';
```

### 14.2 Translation Files

```
messages/
├── pt-BR.json
└── en.json
```

### 14.3 Usage Pattern

```typescript
// In components
const t = useTranslations('dashboard');
return <h1>{t('title')}</h1>;
```

---

## 15. UI Layout Standards

### 15.1 Dashboard Two-Column Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Header (fixed)                                              │
├───────────────────────────────────┬─────────────────────────┤
│  Main Content                     │  Sidebar                │
│  (max-w-2xl, h-[420px])          │  (w-[360px], h-[420px]) │
│                                   │                         │
│  - Scrollable                     │  - Filters              │
│  - Card-based                     │  - Actions              │
│                                   │  - Summary              │
└───────────────────────────────────┴─────────────────────────┘
```

### 15.2 Component Heights

```css
/* Standard card heights */
.card-fixed { height: 420px; }
.card-scrollable { flex: 1; overflow-y: auto; }
```
