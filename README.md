# Gendei

WhatsApp-integrated clinic appointment scheduling platform for healthcare providers in Brazil.

## Overview

Gendei enables healthcare clinics to manage appointments, patient interactions, and administrative operations through a modern web dashboard combined with an intelligent WhatsApp AI chatbot. Patients can book appointments via WhatsApp messages while clinic staff manage everything through the web dashboard.

### Key Features

- **WhatsApp AI Agent**: Natural language appointment booking via WhatsApp
- **Multi-Clinic Support**: Single platform supporting multiple independent clinics
- **Real-time Dashboard**: Modern React dashboard for clinic management
- **Automated Reminders**: 24h and 2h appointment reminders via WhatsApp
- **Payment Integration**: PIX key management with deposit tracking
- **Admin Portal**: Platform-wide analytics and support tools

## Tech Stack

### Frontend (Web Dashboard)
- **Framework**: Next.js 16 (App Router) with TypeScript
- **UI**: React 19, Tailwind CSS 4, shadcn/ui components
- **State**: TanStack React Query v5
- **Forms**: React Hook Form + Zod validation
- **Auth**: Firebase Authentication (Email/Password, Google OAuth)
- **Database**: Firestore (real-time sync)
- **i18n**: next-intl (Portuguese BR + English)
- **Icons**: lucide-react
- **Maps**: Google Maps API (address autocomplete)

### Admin Portal
- **Framework**: Next.js 16 (App Router) with TypeScript
- **UI**: React 19, Tailwind CSS 4, shadcn/ui components
- **State**: TanStack React Query v5
- **Auth**: Firebase Authentication (Google OAuth with email whitelist)
- **Database**: Firestore (cross-clinic queries)

### Website (Marketing)
- **Framework**: React 18 with Vite
- **UI**: Tailwind CSS
- **Routing**: React Router DOM
- **Deployment**: Vercel (SPA mode)

### Backend (Cloud Functions)
- **Runtime**: Firebase Cloud Functions (Node.js 20)
- **Framework**: Express.js with TypeScript
- **Database**: Firestore (Firebase Admin SDK)
- **APIs**: WhatsApp Cloud API, Anthropic AI, OpenAI, Resend
- **Scheduled Tasks**: Cloud Scheduler (runs every 15 minutes)

### WhatsApp Agent (Python)
- **Runtime**: Python 3.11+ on Google Cloud Run
- **Framework**: FastAPI + Uvicorn
- **AI Providers**: OpenAI Agents SDK, Anthropic Claude SDK
- **Database**: Firestore
- **Deployment**: Docker on Cloud Run (Light/Production modes)

## Project Structure

```
gendei/
├── apps/
│   ├── frontend/              # Next.js clinic dashboard (port 3002)
│   │   ├── app/               # App Router pages
│   │   │   └── [locale]/      # Internationalized routes
│   │   │       ├── dashboard/ # Main dashboard pages
│   │   │       │   ├── agenda/       # Appointment calendar
│   │   │       │   ├── clinic/       # Clinic settings
│   │   │       │   ├── conversations/# WhatsApp inbox
│   │   │       │   ├── patients/     # Patient management
│   │   │       │   ├── payments/     # Payment settings (PIX)
│   │   │       │   ├── professionals/# Staff management
│   │   │       │   └── whatsapp/     # WhatsApp setup
│   │   │       ├── signin/    # Authentication
│   │   │       └── signup/    # Registration
│   │   ├── components/        # React components
│   │   │   ├── ui/            # shadcn/ui components
│   │   │   ├── calendar/      # Calendar grid components
│   │   │   ├── chat/          # Chat/conversation components
│   │   │   ├── dashboard/     # Dashboard-specific components
│   │   │   └── whatsapp/      # WhatsApp integration components
│   │   ├── hooks/             # Custom React hooks
│   │   ├── lib/               # Utilities and configs
│   │   └── messages/          # i18n translation files
│   │
│   ├── admin/                 # Next.js admin portal (port 3003)
│   │   └── src/
│   │       ├── app/           # App Router pages
│   │       │   ├── login/     # Admin login (Google OAuth)
│   │       │   └── dashboard/ # Admin dashboard
│   │       │       ├── clinics/      # Clinic management
│   │       │       ├── appointments/ # All appointments + CSV export
│   │       │       ├── payments/     # Revenue analytics
│   │       │       ├── health/       # System health monitoring
│   │       │       └── support/      # Support tools
│   │       ├── components/ui/ # Shared UI components
│   │       ├── hooks/         # Data fetching hooks
│   │       └── lib/           # Firebase, auth, queries
│   │
│   ├── functions/             # Firebase Cloud Functions (API)
│   │   └── src/
│   │       ├── routes/        # API endpoints
│   │       │   ├── clinics.ts       # Clinic CRUD + time blocks
│   │       │   ├── appointments.ts  # Appointment management
│   │       │   ├── patients.ts      # Patient management
│   │       │   ├── professionals.ts # Professional management
│   │       │   ├── services.ts      # Service management
│   │       │   ├── conversations.ts # WhatsApp conversations
│   │       │   └── meta.ts          # WhatsApp/Meta webhooks
│   │       ├── services/      # Business logic
│   │       │   ├── reminders.ts     # Automated reminders
│   │       │   └── onboarding.ts    # Clinic onboarding
│   │       └── middleware/    # Auth middleware
│   │
│   ├── whatsapp-agent/        # Python WhatsApp AI Agent
│   │   ├── src/
│   │   │   ├── agents/        # AI agent definitions
│   │   │   │   ├── greeting_agent.py    # Fast greeting responses
│   │   │   │   ├── scheduling_agent.py  # Appointment booking
│   │   │   │   ├── reminder_agent.py    # Reminder handling
│   │   │   │   └── triage_agent.py      # Message routing
│   │   │   ├── providers/     # AI provider abstraction
│   │   │   │   ├── openai_provider.py   # OpenAI integration
│   │   │   │   └── anthropic_provider.py# Claude integration
│   │   │   ├── scheduler/     # Appointment scheduling logic
│   │   │   └── database/      # Firestore interface
│   │   ├── deploy.sh          # Cloud Run deployment script
│   │   ├── Dockerfile         # Container configuration
│   │   └── requirements.txt   # Python dependencies
│   │
│   └── website/               # Marketing website (Vite + React)
│       ├── src/
│       │   ├── App.jsx        # Main app with routing
│       │   ├── Home.jsx       # Landing page
│       │   ├── Terms.jsx      # Terms of service
│       │   └── Privacy.jsx    # Privacy policy
│       └── vercel.json        # SPA routing configuration
│
├── firebase.json              # Firebase configuration
├── firestore.rules            # Security rules
├── storage.rules              # Cloud Storage rules
└── package.json               # Monorepo workspace config
```

## Applications

### 1. Frontend (Clinic Dashboard)

The main web application for clinic staff to manage their operations.

**URL**: `https://app.gendei.com` (production) | `http://localhost:3002` (development)

#### Dashboard Pages

| Page | Description | Features |
|------|-------------|----------|
| **Overview** | Main dashboard | Today's appointments, stats cards, recent activity, onboarding progress |
| **Agenda** | Appointment calendar | Visual week grid, time blocking, status tracking, filtering by professional |
| **Professionals** | Staff management | Add/edit professionals, specialties, working hours, pricing, photo upload |
| **Patients** | Patient database | Search, filter by professional, appointment history, CRM tags |
| **Conversations** | WhatsApp inbox | Message list, conversation states, human takeover, AI chat history |
| **Clinic** | Clinic settings | Business profile, address (Google Maps autocomplete), operating hours, categories |
| **Payments** | Payment settings | PIX key setup with confirmation, deposit percentage, health insurance (convenio) |
| **WhatsApp** | WhatsApp setup | Embedded signup flow, phone verification, connection status |
| **Account** | User profile | Email/password management, profile settings |

#### Key Features

**Appointment Management**
- Visual 7-day calendar grid with time slots
- Status workflow: `pending` → `awaiting_confirmation` → `confirmed` → `confirmed_presence` → `completed`
- Time blocking for breaks, meetings, vacations
- Drag-and-drop rescheduling
- Deposit tracking and payment status

**Professional Management**
- Photo upload with avatar preview
- 18+ healthcare specialty categories
- Configurable appointment durations
- Consultation pricing
- Active/inactive status toggle

**Patient Management**
- Patient records with phone, email, date of birth, CPF
- Search by name, phone, or CPF
- Filter by associated professional
- Complete appointment history
- Notes and CRM tags for segmentation

**Payment Settings**
- PIX key configuration with **double-entry confirmation** (prevents typos)
- Configurable deposit percentages (10-100%)
- Health insurance (convenio) acceptance with common providers
- Payment method toggles (particular/convenio)

### 2. Admin Portal

Platform-wide administration dashboard for Gendei operators.

**URL**: `http://localhost:3003` (development)

#### Admin Features

| Page | Description | Features |
|------|-------------|----------|
| **Overview** | Platform stats | Total clinics, appointments, revenue, no-show rate |
| **Clinics** | Clinic management | List all clinics, view details, professionals, patients |
| **Appointments** | All appointments | Cross-platform view with CSV export functionality |
| **Payments** | Revenue analytics | Revenue tracking, pending deposits, top clinics by revenue |
| **Health** | System monitoring | Service status, WhatsApp connection rates, error tracking |
| **Support** | Support tools | Patient lookup by phone, clinic quick access |

#### Access Control

Admin access is controlled by email whitelist in `apps/admin/src/lib/firebase.ts`:

```typescript
export const ADMIN_EMAILS = [
  'hello@zapcomm.app',
  // Add additional admin emails here
];
```

### 3. WhatsApp Agent

AI-powered WhatsApp chatbot for patient interactions.

#### Agent Architecture

| Agent | Purpose | Triggers |
|-------|---------|----------|
| **Greeting Agent** | Fast responses to greetings | "Oi", "Olá", "Bom dia" |
| **Scheduling Agent** | Appointment booking | "Quero agendar", availability queries |
| **Reminder Agent** | Handle reminder responses | "Confirmo", "Preciso remarcar" |
| **Triage Agent** | Message routing | Complex queries, human handoff |

#### AI Provider Support

The agent supports multiple AI providers:

- **OpenAI** (default): GPT-4 via Agents SDK
- **Anthropic**: Claude via Claude SDK

Configure via environment variable:
```bash
AI_PROVIDER=openai   # or "anthropic"
```

#### Deployment Modes

**Light Mode** (default) - for development/staging:
```bash
./deploy.sh
```
- 1 CPU, 512Mi memory
- 0 min instances (scale to zero)
- 3 max instances
- Lower costs for testing

**Production Mode** - for production:
```bash
PRODUCTION_MODE=true ./deploy.sh
```
- 2 CPU, 4Gi memory
- 1 min instance (always warm)
- 20 max instances
- CPU boost and no throttling

### 4. Marketing Website

Static marketing website for Gendei.

**URL**: `https://go.gendei.app` (production)

#### Pages

- **Home**: Landing page with features and pricing
- **Terms**: Terms of service
- **Privacy**: Privacy policy

## Getting Started

### Prerequisites

- Node.js 20+
- Python 3.11+
- Firebase CLI (`npm install -g firebase-tools`)
- Google Cloud SDK
- Docker (for WhatsApp Agent deployment)
- npm or pnpm

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/gendei.git
cd gendei

# Install all dependencies
npm install
```

### Frontend Setup

```bash
cd apps/frontend
cp .env.example .env.local
# Configure Firebase credentials in .env.local
npm run dev
```

The frontend runs on `http://localhost:3002`

### Admin Portal Setup

```bash
cd apps/admin
cp .env.example .env.local
# Configure Firebase credentials in .env.local
npm run dev
```

The admin portal runs on `http://localhost:3003`

### Cloud Functions Setup

```bash
cd apps/functions
npm install
cp .env.example .env
# Configure environment variables
npm run serve
```

### WhatsApp Agent Setup

```bash
cd apps/whatsapp-agent
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Configure environment variables
python -m uvicorn src.main:app --port 8081
```

### Website Setup

```bash
cd apps/website
npm install
npm run dev
```

## Environment Variables

### Frontend (.env.local)

```env
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX

# Backend API
NEXT_PUBLIC_API_URL=https://us-central1-your-project.cloudfunctions.net/api

# Google Maps (for address autocomplete)
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_maps_api_key

# Meta/Facebook SDK (for WhatsApp Embedded Signup)
NEXT_PUBLIC_META_APP_ID=your_meta_app_id
NEXT_PUBLIC_META_CONFIG_ID=your_meta_config_id
```

### Admin Portal (.env.local)

```env
# Firebase Configuration (same project as frontend)
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Admin access controlled by email whitelist in src/lib/firebase.ts
```

### Cloud Functions (.env)

```env
# WhatsApp Cloud API
WHATSAPP_ACCESS_TOKEN=your_whatsapp_token
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_BUSINESS_ACCOUNT_ID=your_waba_id

# AI Providers
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key

# Email (Resend)
RESEND_API_KEY=your_resend_key
```

### WhatsApp Agent (.env)

```env
# Required
WHATSAPP_TOKEN=your_whatsapp_token
WHATSAPP_VERIFY_TOKEN=your_verify_token
OPENAI_API_KEY=your_openai_key

# Optional - Anthropic (if using Claude)
AI_PROVIDER=openai  # or "anthropic"
ANTHROPIC_API_KEY=your_anthropic_key

# Google Cloud
GOOGLE_CLOUD_PROJECT=your_project_id
STORAGE_BUCKET=your_storage_bucket

# Multi-tenant
TEST_CREATOR_ID=  # Leave empty for multi-clinic mode
DEFAULT_CREATOR_ID=default_creator
```

## API Endpoints

### Clinics

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/clinics/me` | Get current user's clinic |
| PATCH | `/clinics/me` | Update current user's clinic |
| GET | `/clinics/:id` | Get specific clinic |
| POST | `/clinics` | Create new clinic |
| PUT | `/clinics/:id` | Update clinic profile |
| GET | `/clinics/:id/stats` | Get clinic statistics |
| GET | `/clinics/:id/time-blocks` | Get calendar time blocks |
| POST | `/clinics/:id/time-blocks` | Create time block |
| DELETE | `/clinics/:id/time-blocks/:blockId` | Remove time block |
| GET | `/clinics/:id/settings` | Get clinic settings |
| PUT | `/clinics/:id/settings/:key` | Update clinic setting |

#### Allowed Update Fields (PATCH/PUT)

```javascript
[
  'name', 'phone', 'email', 'address', 'city', 'state',
  'zipCode', 'cnpj', 'categories', 'signalPercentage', 'timezone',
  'paymentSettings', 'pixKey', 'depositPercentage', 'requiresDeposit'
]
```

### Professionals

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/professionals` | List clinic professionals |
| GET | `/professionals/:id` | Get specific professional |
| POST | `/professionals` | Create professional |
| PATCH | `/professionals/:id` | Update professional |
| DELETE | `/professionals/:id` | Delete professional |

### Services

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/services` | List clinic services |
| GET | `/services/:id` | Get specific service |
| POST | `/services` | Create service |
| PUT | `/services/:id` | Update service |
| DELETE | `/services/:id` | Deactivate service (soft delete) |

### Appointments

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/appointments` | Get appointments (with filters) |
| GET | `/appointments/today` | Get today's appointments |
| GET | `/appointments/:id` | Get specific appointment |
| POST | `/appointments` | Create appointment |
| PUT | `/appointments/:id` | Update appointment |
| PUT | `/appointments/:id/status` | Update status |
| PUT | `/appointments/:id/reschedule` | Reschedule |
| DELETE | `/appointments/:id` | Cancel appointment |

### Patients

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/patients` | List patients (with search/filter) |
| GET | `/patients/:id` | Get specific patient |
| POST | `/patients` | Create patient |
| PATCH | `/patients/:id` | Update patient |
| DELETE | `/patients/:id` | Delete patient |

### WhatsApp/Meta

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/meta/embedded-signup/start` | Start embedded signup |
| POST | `/meta/embedded-signup/complete` | Complete signup |
| GET | `/meta/webhook` | Webhook verification |
| POST | `/meta/webhook` | Incoming messages |
| POST | `/meta/send-message` | Send WhatsApp message |
| POST | `/meta/verify-number` | Verify phone number |

### Conversations

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/conversations` | List conversations |
| GET | `/conversations/:id` | Get specific conversation |
| PATCH | `/conversations/:id` | Update conversation status |
| GET | `/conversations/:id/messages` | Get conversation messages |

### Reminders

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/reminders/send-reminder` | Manually trigger reminder |
| POST | `/reminders/process` | Process scheduled reminders (cron) |

## Database Schema

### Collections (prefixed with `gendei_`)

```
gendei_clinics/{clinicId}
├── name, slug, description
├── address (street, number, city, state, zipCode, lat, lng)
├── businessCategory
├── operatingHours (per day with breaks)
├── phone, email, website
├── paymentSettings
│   ├── acceptsConvenio: boolean
│   ├── convenioList: string[]
│   ├── acceptsParticular: boolean
│   ├── requiresDeposit: boolean
│   ├── depositPercentage: number
│   └── pixKey: string
├── whatsappConnected, whatsappPhoneId
├── createdAt, updatedAt
└── Subcollections:
    ├── professionals/{id}
    ├── services/{id}
    ├── conversations/{id}
    │   └── messages/{id}
    ├── availability/{id}
    └── timeBlocks/{id}

gendei_appointments/{id}
├── clinicId, patientId, professionalId, serviceId
├── date (YYYY-MM-DD), time (HH:MM), duration
├── status: pending|confirmed|awaiting_confirmation|confirmed_presence|completed|cancelled|no_show
├── patientName, patientPhone, professionalName, serviceName
├── depositAmount, depositPaid
├── reminder24hSent, reminder2hSent
├── notes, source (whatsapp|dashboard)
└── createdAt, confirmedAt, cancelledAt, completedAt

gendei_patients/{id}
├── clinicIds (array - patients can belong to multiple clinics)
├── name, phone, email, dateOfBirth, cpf
├── address, notes, tags
├── totalAppointments, lastAppointmentAt
└── createdAt, updatedAt

gendei_whatsapp/{id}
├── clinicId
├── phoneNumberId, wabaId, displayPhoneNumber
├── accessToken (encrypted)
├── qualityRating, status
└── createdAt, updatedAt

gendei_tokens/{clinicId}        # Server-only collection
└── accessToken, refreshToken, expiresAt

gendei_time_blocks/{id}
├── clinicId, professionalId
├── date, startTime, endTime
├── reason
└── createdAt, updatedAt
```

## Automated Reminders

The system sends automatic WhatsApp reminders via Cloud Scheduler:

| Reminder | Timing | Purpose |
|----------|--------|---------|
| **24h Reminder** | 24 hours before | "Your appointment is tomorrow" - asks for confirmation |
| **2h Reminder** | 2 hours before | "Your appointment is in 2 hours" - operational reminder |

Reminders are processed every 15 minutes with deduplication (`reminder24hSent`, `reminder2hSent` flags).

## Authentication & Authorization

### Auth Methods

- **Email/Password**: Traditional sign up/sign in
- **Google OAuth**: One-click Google authentication

### Role-Based Access Control

| Role | Permissions |
|------|-------------|
| **Owner** | Full access to all features |
| **Admin** | Manage appointments, professionals, services, conversations |
| **Support** | View & manage conversations and appointments only |

### Security Features

- Firebase Authentication with ID token verification
- Firestore Security Rules enforcing access control
- Server-only collections for sensitive data (tokens, OAuth)
- Encrypted WhatsApp access tokens
- CORS configuration for trusted origins only
- Admin portal email whitelist

## Internationalization

Supported languages:
- **Portuguese (BR)** - Default
- **English**

Routes are locale-prefixed: `/{locale}/dashboard/*`

Translation files: `apps/frontend/messages/{locale}.json`

## Development Commands

### Root (Monorepo)

```bash
# Install all dependencies
npm install

# Run frontend + functions concurrently
npm run dev

# Run individual apps
npm run dev:frontend    # Frontend on port 3002
npm run dev:admin       # Admin on port 3003
npm run dev:functions   # Firebase emulator

# Build all apps
npm run build
npm run build:frontend
npm run build:admin
npm run build:functions

# Lint and type check
npm run lint
npm run typecheck

# Format code
npm run format

# Clean all build artifacts
npm run clean
```

### Frontend

```bash
cd apps/frontend
npm run dev       # Development server
npm run build     # Production build
npm run start     # Start production server
npm run lint      # ESLint
npm run typecheck # TypeScript check
```

### Admin

```bash
cd apps/admin
npm run dev       # Development server (port 3003)
npm run build     # Production build
npm run start     # Start production server
```

### Functions

```bash
cd apps/functions
npm run build       # Compile TypeScript
npm run serve       # Start emulator
npm run deploy      # Deploy to Firebase
npm run logs        # View function logs
```

### WhatsApp Agent

```bash
cd apps/whatsapp-agent
source venv/bin/activate

# Local development
python -m uvicorn src.main:app --port 8081 --reload

# Deploy to Cloud Run (Light mode)
./deploy.sh

# Deploy to Cloud Run (Production mode)
PRODUCTION_MODE=true ./deploy.sh
```

## Deployment

### Frontend (Vercel)

```bash
cd apps/frontend
vercel --prod
```

Or connect to Vercel via GitHub for automatic deployments.

### Admin Portal (Vercel)

```bash
cd apps/admin
vercel --prod
```

### Cloud Functions (Firebase)

```bash
cd apps/functions
npm run build
firebase deploy --only functions
```

### WhatsApp Agent (Cloud Run)

```bash
cd apps/whatsapp-agent

# Light mode (dev/staging)
./deploy.sh

# Production mode
PRODUCTION_MODE=true ./deploy.sh
```

### Website (Vercel)

```bash
cd apps/website
vercel --prod
```

Configured with SPA routing via `vercel.json`.

## UI Components

Built with [shadcn/ui](https://ui.shadcn.com/) components:

- **Layout**: Card, Dialog, Dropdown Menu, Tabs, Collapsible
- **Forms**: Input, Label, Select, Textarea, Checkbox, Switch, Radio Group
- **Data**: Table, Badge, Avatar, Skeleton, Progress
- **Feedback**: Toast (Sonner), Tooltip, Alert, Alert Dialog
- **Navigation**: Button, Popover

### Design System

**Colors** (Green theme):
- Primary: `#16a34a` (green-600)
- Primary Hover: `#15803d` (green-700)
- Background: `#f9fafb` (gray-50)

**Typography**:
- Logo font: Borel (Google Fonts)
- Body: System fonts (Inter fallback)

**Checkboxes**: Square corners (`rounded-none`)

## Key Design Decisions

### Two-Column Layout

Dashboard pages use a consistent two-column layout:
- **Left column**: Main content card (max-w-2xl, h-[420px])
- **Right column**: Sidebar filter/actions (w-[360px], h-[420px])

### Fixed Card Heights

Content cards have fixed heights (420px) with:
- `flex flex-col` on Card
- `flex-shrink-0` on CardHeader
- `flex-1 overflow-y-auto` on CardContent

### Calendar Grid

- 7-day week view starting on Monday
- Compact date format (dd/MM)
- 70px minimum column width
- Color-coded status indicators

### Navigation Structure

Sidebar organized in collapsible sections:
- Overview
- Agenda (Schedule)
- Professionals
- Patients (Patients, Conversations)
- Configuration (Clinic, Payments, WhatsApp, Account)

## Troubleshooting

### PIX Key Not Saving

Ensure the backend allows the `paymentSettings` field. Check `apps/functions/src/routes/clinics.ts` `allowedFields` array.

### WhatsApp Connection Issues

1. Verify Meta App webhook URL is configured correctly
2. Check WhatsApp verify token matches
3. Ensure phone number is properly linked via Embedded Signup

### Cold Start Latency

For production, use `PRODUCTION_MODE=true` to keep at least 1 instance warm.

### Admin Portal Access Denied

Add your email to the `ADMIN_EMAILS` array in `apps/admin/src/lib/firebase.ts`.

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run linting and type checks (`npm run lint && npm run typecheck`)
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## License

Proprietary - All rights reserved

## Support

- **Issues**: [GitHub Issues](https://github.com/your-org/gendei/issues)
- **Email**: support@gendei.com
