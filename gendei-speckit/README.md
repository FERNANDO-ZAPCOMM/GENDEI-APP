# Gendei - Specification Kit

## Overview

Gendei is a WhatsApp-integrated clinic appointment scheduling platform designed for healthcare providers in Brazil. It enables clinics to manage appointments, patient interactions, and administrative operations through a modern web dashboard combined with an intelligent WhatsApp AI chatbot.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              GENDEI PLATFORM                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐    │
│  │   Clinic Staff   │     │     Patient      │     │  Platform Admin  │    │
│  │   (Web App)      │     │   (WhatsApp)     │     │   (Admin Portal) │    │
│  └────────┬─────────┘     └────────┬─────────┘     └────────┬─────────┘    │
│           │                        │                         │              │
│           ▼                        ▼                         ▼              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        Frontend Layer                                │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐     │   │
│  │  │  Next.js 16     │  │  Marketing Site │  │  Admin Portal   │     │   │
│  │  │  Dashboard      │  │  (React/Vite)   │  │  (Next.js 16)   │     │   │
│  │  │  Port: 3002     │  │                 │  │  Port: 3003     │     │   │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        Backend Layer                                 │   │
│  │  ┌─────────────────────────────┐  ┌──────────────────────────┐     │   │
│  │  │  Firebase Cloud Functions   │  │  WhatsApp Agent          │     │   │
│  │  │  - REST API                 │  │  (Python/FastAPI)        │     │   │
│  │  │  - Scheduled Tasks          │  │  - AI Chat (GPT/Claude)  │     │   │
│  │  │  - Webhooks                 │  │  - WhatsApp Flows        │     │   │
│  │  │  Node.js 20                 │  │  Cloud Run               │     │   │
│  │  └─────────────────────────────┘  └──────────────────────────┘     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        Data Layer                                    │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐     │   │
│  │  │  Firestore      │  │  Firebase Auth  │  │  Cloud Storage  │     │   │
│  │  │  (Database)     │  │  (OAuth/Email)  │  │  (Files)        │     │   │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        External Services                             │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │   │
│  │  │ WhatsApp API │  │  PagSeguro   │  │ Google Maps  │              │   │
│  │  │ (Meta)       │  │  (PIX)       │  │ (Addresses)  │              │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘              │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │   │
│  │  │  OpenAI      │  │  Anthropic   │  │   Resend     │              │   │
│  │  │  (GPT-4)     │  │  (Claude)    │  │   (Email)    │              │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Frontend** | Next.js 16, React 18, TypeScript | Clinic dashboard |
| **UI Components** | shadcn/ui, Radix UI, Tailwind CSS | Component library |
| **State Management** | TanStack Query v5 | Server state, caching |
| **Forms** | React Hook Form + Zod | Validation, type safety |
| **i18n** | next-intl | Portuguese BR, English |
| **Backend API** | Firebase Cloud Functions, Node.js 20 | REST API, webhooks |
| **AI Agent** | Python 3.11+, FastAPI | WhatsApp chatbot |
| **AI Providers** | OpenAI GPT-4, Anthropic Claude | Conversation AI |
| **Database** | Firestore | Real-time NoSQL |
| **Auth** | Firebase Auth | Google OAuth, Email/Password |
| **Payments** | PagSeguro/PagBank | PIX deposits |
| **Messaging** | WhatsApp Cloud API (Meta) | Patient communication |
| **Maps** | Google Maps API | Address autocomplete |
| **Email** | Resend | Notifications |
| **Hosting (Web)** | Vercel | Edge deployments |
| **Hosting (Agent)** | Cloud Run | Container scaling |
| **Scheduled Tasks** | Cloud Scheduler | Reminders every 15 min |

---

## Core Flows

### Patient Appointment Booking

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    APPOINTMENT BOOKING FLOW                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Patient                   WhatsApp                    System            │
│    │                         │                           │               │
│    │ "Quero agendar"        │                           │               │
│    │ ───────────────────────>│                           │               │
│    │                         │ Webhook                   │               │
│    │                         │ ──────────────────────────>│              │
│    │                         │                           │               │
│    │                         │                    Buffer Messages        │
│    │                         │                    (2-5 seconds)          │
│    │                         │                           │               │
│    │                         │                    Greeting Agent         │
│    │                         │                    Detects Intent         │
│    │                         │                           │               │
│    │                         │<─────────────────────────│               │
│    │ "Qual especialidade?"   │                           │               │
│    │<─────────────────────── │                           │               │
│    │                         │                           │               │
│    │  (WhatsApp Flow)        │                           │               │
│    │  - Specialty Selection  │                           │               │
│    │  - Service Type         │                           │               │
│    │  - Insurance Info       │                           │               │
│    │  - Patient Data         │                           │               │
│    │ ───────────────────────>│                           │               │
│    │                         │                           │               │
│    │  (WhatsApp Flow)        │                    Scheduling Agent       │
│    │  - Date Picker          │                    Checks Availability    │
│    │  - Time Selection       │                           │               │
│    │ ───────────────────────>│                           │               │
│    │                         │                           │               │
│    │                         │                    Create Appointment     │
│    │                         │                    (Firestore)            │
│    │                         │                           │               │
│    │                         │<─────────────────────────│               │
│    │ "Agendado! Confirmar?"  │                           │               │
│    │<─────────────────────── │                           │               │
│    │                         │                           │               │
│    │                         │                    If deposit required:   │
│    │                         │                    Generate PIX link      │
│    │                         │                           │               │
│    │ (PIX QR Code)           │<─────────────────────────│               │
│    │<─────────────────────── │                           │               │
│    │                         │                           │               │
└─────────────────────────────────────────────────────────────────────────┘
```

### Reminder Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      REMINDER NOTIFICATION FLOW                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Cloud Scheduler            Functions              WhatsApp              │
│       │                        │                      │                  │
│       │  Every 15 minutes     │                      │                  │
│       │ ─────────────────────>│                      │                  │
│       │                        │                      │                  │
│       │                  Query appointments          │                  │
│       │                  (24h window)                │                  │
│       │                        │                      │                  │
│       │                  Filter: reminder24hSent=false                  │
│       │                        │                      │                  │
│       │                        │  Send reminder       │                  │
│       │                        │ ────────────────────>│                  │
│       │                        │                      │                  │
│       │                  Update: reminder24hSent=true │                  │
│       │                        │                      │                  │
│       │                        │                      │  Patient         │
│       │                        │                      │     │            │
│       │                        │                      │<────│            │
│       │                        │                      │ "Confirmo"       │
│       │                        │                      │                  │
│       │                        │<────────────────────│                  │
│       │                        │  Webhook             │                  │
│       │                        │                      │                  │
│       │                  Update status:              │                  │
│       │                  confirmed_presence          │                  │
│       │                        │                      │                  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Appointment Status Workflow

```
pending
    │
    ▼ (24h reminder sent)
awaiting_confirmation
    │
    ├──────────────────────────────┐
    │                              │
    ▼ (patient confirms)           ▼ (patient cancels)
confirmed                      cancelled
    │
    ▼ (patient confirms presence)
confirmed_presence
    │
    ├──────────────────────────────┐
    │                              │
    ▼ (appointment happens)        ▼ (patient doesn't show)
completed                       no_show
```

---

## Project Structure

```
gendei/
├── apps/
│   ├── frontend/                    # Next.js clinic dashboard
│   │   ├── app/[locale]/           # App Router with i18n
│   │   │   ├── dashboard/          # Main dashboard pages
│   │   │   │   ├── agenda/         # Appointment calendar
│   │   │   │   ├── professionals/  # Staff management
│   │   │   │   ├── patients/       # Patient records
│   │   │   │   ├── conversations/  # WhatsApp inbox
│   │   │   │   ├── clinic/         # Clinic settings
│   │   │   │   ├── payments/       # Payment config
│   │   │   │   └── whatsapp/       # WhatsApp setup
│   │   │   ├── signin/
│   │   │   └── signup/
│   │   ├── components/             # React components
│   │   ├── hooks/                  # Custom hooks (15+)
│   │   ├── lib/                    # Utilities, types
│   │   └── messages/               # i18n translations
│   │
│   ├── admin/                      # Admin portal
│   │   └── src/
│   │       ├── app/dashboard/      # Admin pages
│   │       ├── components/         # Admin UI
│   │       └── hooks/              # Data fetching
│   │
│   ├── functions/                  # Firebase Cloud Functions
│   │   └── src/
│   │       ├── routes/             # API endpoints
│   │       │   ├── clinics.ts
│   │       │   ├── appointments.ts
│   │       │   ├── professionals.ts
│   │       │   ├── patients.ts
│   │       │   ├── services.ts
│   │       │   ├── conversations.ts
│   │       │   ├── meta.ts         # WhatsApp webhooks
│   │       │   └── reminders.ts    # Cron jobs
│   │       ├── services/           # Business logic
│   │       └── middleware/         # Auth middleware
│   │
│   ├── whatsapp-agent/             # Python AI agent
│   │   └── src/
│   │       ├── agents/             # AI agent definitions
│   │       │   ├── greeting.py
│   │       │   ├── scheduling.py
│   │       │   ├── reminder.py
│   │       │   └── triage.py
│   │       ├── providers/          # OpenAI/Anthropic
│   │       ├── flows/              # WhatsApp Flows
│   │       ├── scheduler/          # Appointment logic
│   │       └── main.py             # FastAPI app
│   │
│   └── website/                    # Marketing site
│
├── gendei-speckit/                 # This specification kit
│   ├── README.md
│   ├── FEATURES.md
│   ├── memory/
│   │   └── constitution.md
│   └── specs/
│       └── XXX-feature/spec.md
│
├── firebase.json
├── firestore.rules
└── package.json
```

---

## Key Documents

| Document | Purpose |
|----------|---------|
| [FEATURES.md](./FEATURES.md) | Complete feature catalog with IDs and status |
| [memory/constitution.md](./memory/constitution.md) | Project principles, database schema, security |
| [specs/](./specs/) | Detailed specifications per feature |

---

## Quick Links

- **Frontend**: `apps/frontend/` - Next.js 16 clinic dashboard
- **Admin**: `apps/admin/` - Platform admin portal
- **Functions**: `apps/functions/` - Firebase Cloud Functions API
- **Agent**: `apps/whatsapp-agent/` - Python WhatsApp AI agent
- **Website**: `apps/website/` - Marketing landing page
