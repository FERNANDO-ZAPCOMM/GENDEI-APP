# Gendei

WhatsApp-integrated clinic appointment scheduling platform for healthcare providers.

## Overview

Gendei enables healthcare clinics to manage appointments, patient interactions, and administrative operations through a modern admin dashboard combined with an intelligent WhatsApp chatbot. Patients can book appointments via WhatsApp messages while clinic staff manage everything through the web dashboard.

## Tech Stack

### Frontend
- **Framework**: Next.js 15 (App Router) with TypeScript
- **UI**: React 18, Tailwind CSS, shadcn/ui components
- **State**: TanStack React Query v5
- **Forms**: React Hook Form + Zod validation
- **Auth**: Firebase Authentication
- **Database**: Firestore (real-time sync)
- **i18n**: next-intl (Portuguese BR + English)
- **Icons**: lucide-react

### Backend (Cloud Functions)
- **Runtime**: Firebase Cloud Functions (Node.js 20)
- **Framework**: Express.js with TypeScript
- **Database**: Firestore (Firebase Admin SDK)
- **APIs**: WhatsApp Cloud API, Anthropic AI, OpenAI, Resend
- **Scheduled Tasks**: Cloud Scheduler (runs every 15 minutes)

### WhatsApp Agent (Python)
- **Runtime**: Python 3.11+ on Google Cloud Run
- **Framework**: FastAPI + Uvicorn
- **AI**: OpenAI Agents SDK, Anthropic SDK
- **Database**: Firestore

## Project Structure

```
gendei/
├── apps/
│   ├── frontend/              # Next.js admin dashboard
│   │   ├── app/               # App Router pages
│   │   │   └── [locale]/      # Internationalized routes
│   │   │       ├── dashboard/ # Main dashboard pages
│   │   │       ├── signin/    # Authentication
│   │   │       └── signup/    # Registration
│   │   ├── components/        # React components
│   │   │   ├── ui/            # shadcn/ui components
│   │   │   ├── calendar/      # Calendar grid components
│   │   │   └── whatsapp/      # WhatsApp integration components
│   │   ├── hooks/             # Custom React hooks
│   │   ├── lib/               # Utilities and configs
│   │   └── messages/          # i18n translation files
│   │
│   ├── functions/             # Firebase Cloud Functions (API)
│   │   └── src/
│   │       ├── routes/        # API endpoints
│   │       ├── services/      # Business logic
│   │       └── middleware/    # Auth middleware
│   │
│   └── whatsapp-agent/        # Python WhatsApp AI Agent
│       └── src/
│           ├── agents/        # AI agent definitions
│           ├── providers/     # AI provider abstraction
│           ├── scheduler/     # Appointment scheduling
│           └── database/      # Firestore interface
│
├── firebase.json              # Firebase configuration
├── firestore.rules            # Security rules
└── storage.rules              # Cloud Storage rules
```

## Dashboard Features

### Pages & Functionality

| Page | Description | Features |
|------|-------------|----------|
| **Overview** | Main dashboard | Today's appointments, stats cards, recent activity, onboarding progress |
| **Agenda** | Appointment calendar | Visual week grid, time blocking, status tracking, filtering by professional |
| **Professionals** | Staff management | Add/edit professionals, specialties, working hours, pricing, photo upload |
| **Patients** | Patient database | Search, filter by professional, appointment history, CRM tags |
| **Conversations** | WhatsApp inbox | Message list, conversation states, human takeover, AI chat history |
| **Clinic** | Clinic settings | Business profile, address (Google Maps), operating hours, categories |
| **Payments** | Payment settings | PIX key setup, deposit percentage, health insurance (convenio) acceptance |
| **WhatsApp** | WhatsApp setup | Embedded signup flow, phone verification, connection status |
| **Account** | User profile | Email/password management, profile settings |

### Appointment Management

- **Calendar Grid View**: Visual week view with 7 days, all time slots visible
- **Status Workflow**:
  - `pending` → `awaiting_confirmation` → `confirmed` → `confirmed_presence` → `completed`
  - Also: `cancelled`, `no_show`
- **Time Blocking**: Block specific time slots for breaks, meetings, vacations
- **Rescheduling**: Change date/time/professional for existing appointments
- **Deposit Tracking**: Track payment status for appointments requiring deposits

### Professional Management

- Photo upload with avatar preview
- Specialty selection (18+ healthcare categories)
- Default appointment duration configuration
- Consultation pricing
- Active/inactive status toggle

### Patient Management

- Patient records with phone, email, date of birth
- Search by name, phone, or CPF
- Filter by associated professional
- Appointment history tracking
- Notes and CRM tags for segmentation
- Statistics: total, new this month, with appointments

### WhatsApp Integration

- **Embedded Signup**: Direct Meta Business integration via Facebook SDK
- **Phone Number Linking**: Connect clinic's WhatsApp number
- **Message Templates**: Pre-configured reminder templates (24h, 2h before)
- **Human Takeover**: Staff can take over AI conversations
- **Conversation States**: novo → qualificado → negociando → checkout → fechado

## Automated Reminders

The system sends automatic WhatsApp reminders:

| Reminder | Timing | Purpose |
|----------|--------|---------|
| **24h Reminder** | 24 hours before | "Your appointment is tomorrow" - asks for confirmation |
| **2h Reminder** | 2 hours before | "Your appointment is in 2 hours" - operational reminder |

Reminders are processed via Cloud Scheduler running every 15 minutes with deduplication to prevent duplicate sends.

## WhatsApp AI Agent

The Python-based AI agent handles:

- **Natural Language Booking**: "I want to book on Tuesday at 3 PM"
- **Availability Queries**: "What times are available next week?"
- **Appointment Management**: View, reschedule, or cancel appointments
- **Context Awareness**: Remembers patient information and conversation history
- **Human Handoff**: Seamlessly transfers to human support when needed

## Getting Started

### Prerequisites

- Node.js 20+
- Python 3.11+
- Firebase CLI
- Google Cloud SDK
- pnpm (recommended) or npm

### Frontend Setup

```bash
cd apps/frontend
pnpm install
cp .env.example .env.local
# Configure Firebase credentials in .env.local
pnpm dev
```

The frontend runs on `http://localhost:3002`

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
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Configure environment variables
python -m uvicorn src.main:app --port 8081
```

## Environment Variables

### Frontend (.env.local)

```env
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_API_URL=
```

### Cloud Functions (.env)

```env
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_BUSINESS_ACCOUNT_ID=
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
RESEND_API_KEY=
```

## API Endpoints

### Clinics

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/clinics` | Get current user's clinic |
| GET | `/clinics/:id` | Get specific clinic |
| POST | `/clinics` | Create new clinic |
| PATCH | `/clinics/:id` | Update clinic profile |
| GET | `/clinics/:id/time-blocks` | Get calendar time blocks |
| POST | `/clinics/:id/time-blocks` | Create time block |
| DELETE | `/clinics/:id/time-blocks/:blockId` | Remove time block |

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

### Team Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/team` | List team members |
| POST | `/team/invite` | Invite team member |
| DELETE | `/team/:id` | Remove team member |

### Reminders

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/reminders/send-reminder` | Manually trigger reminder |

## Database Schema

### Collections (prefixed with `gendei_`)

```
gendei_clinics/{clinicId}
├── name, slug, description
├── address (street, number, city, state, zipCode, lat, lng)
├── businessCategory
├── operatingHours (per day with breaks)
├── phone, email, website
├── paymentSettings (depositPercentage, pixKey, acceptsConvenio)
├── whatsappConnected, whatsappPhoneId
├── professionals/{id}          # Subcollection
├── services/{id}               # Subcollection
├── conversations/{id}          # Subcollection
│   └── messages/{id}           # Nested subcollection
├── availability/{id}           # Subcollection
└── timeBlocks/{id}             # Subcollection

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

gendei_templates/{id}           # WhatsApp message templates
└── name, language, components, status
```

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

## Internationalization

Supported languages:
- **Portuguese (BR)** - Default
- **English**

Routes are locale-prefixed: `/{locale}/dashboard/*`

Translation files located in `apps/frontend/messages/`:
- `pt-BR.json`
- `en.json`

## Deployment

### Frontend (Firebase Hosting)

```bash
cd apps/frontend
pnpm build
firebase deploy --only hosting
```

### Cloud Functions

```bash
cd apps/functions
npm run build
firebase deploy --only functions
```

### WhatsApp Agent (Cloud Run)

```bash
cd apps/whatsapp-agent
./deploy.sh
```

## Development Commands

```bash
# Install all dependencies
pnpm install

# Run frontend development server
cd apps/frontend && pnpm dev

# Run functions emulator
cd apps/functions && npm run serve

# Build for production
pnpm build

# Lint code
pnpm lint

# Type check
pnpm typecheck
```

## UI Components

Built with [shadcn/ui](https://ui.shadcn.com/) components:

- Button, Card, Dialog, Dropdown Menu
- Input, Label, Select, Textarea
- Table, Tabs, Badge, Avatar
- Toast (Sonner), Tooltip, Skeleton
- Calendar, Command, Popover

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
- Status legend showing 4 main statuses

### Navigation Structure

Sidebar organized in collapsible sections:
- Overview
- Agenda (Schedule)
- Professionals
- Patients (Patients, Conversations)
- Configuration (Clinic, Payments, WhatsApp, Account)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run linting and type checks
5. Submit a pull request

## License

Proprietary - All rights reserved
