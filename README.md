# Gendei

WhatsApp-integrated clinic appointment scheduling platform for healthcare providers.

## Overview

Gendei enables healthcare clinics to manage appointments, patient interactions, and administrative operations through a modern admin dashboard combined with an intelligent WhatsApp chatbot. Patients can book appointments via WhatsApp messages while clinic staff manage everything through the web dashboard.

## Tech Stack

### Frontend
- **Framework**: Next.js 15 (App Router) with TypeScript
- **UI**: React 18, Tailwind CSS, shadcn/ui components
- **State**: TanStack React Query
- **Forms**: React Hook Form + Zod validation
- **Auth**: Firebase Authentication
- **Database**: Firestore (real-time sync)
- **i18n**: next-intl (Portuguese BR + English)

### Backend (Cloud Functions)
- **Runtime**: Firebase Cloud Functions (Node.js 20)
- **Framework**: Express.js with TypeScript
- **Database**: Firestore (Firebase Admin SDK)
- **APIs**: WhatsApp Cloud API, Anthropic AI, OpenAI, Resend

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
│   │   ├── components/        # React components
│   │   ├── hooks/             # Custom React hooks
│   │   └── lib/               # Utilities and configs
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

## Features

### Dashboard
- **Clinic Management**: Profile setup, team management, settings
- **Appointments**: Visual calendar grid with time blocking, scheduling, status tracking
- **Professionals**: Staff management, working hours, availability
- **Services**: Service configuration, duration, pricing
- **Patients**: Patient database, appointment history, notes
- **WhatsApp**: Connection setup, message inbox, templates
- **Reminders**: Automatic 24h and 2h appointment reminders

### WhatsApp Agent
- Natural language appointment booking
- Appointment viewing, rescheduling, and cancellation
- Availability queries
- Automated reminders via WhatsApp

## Getting Started

### Prerequisites
- Node.js 20+
- Python 3.11+
- Firebase CLI
- Google Cloud SDK

### Frontend Setup

```bash
cd apps/frontend
npm install
cp .env.example .env.local
# Configure Firebase credentials in .env.local
npm run dev
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
```
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_API_URL=
```

### Cloud Functions (.env)
```
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_BUSINESS_ACCOUNT_ID=
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
RESEND_API_KEY=
```

## Deployment

### Frontend
```bash
cd apps/frontend
npm run build
firebase deploy --only hosting
```

### Cloud Functions
```bash
cd apps/functions
npm run deploy
```

### WhatsApp Agent
```bash
cd apps/whatsapp-agent
./deploy.sh
```

## API Endpoints

### Clinics
- `GET /clinics` - Get current clinic
- `POST /clinics` - Create clinic
- `PATCH /clinics/:id` - Update clinic
- `GET /clinics/:id/time-blocks` - Get time blocks
- `POST /clinics/:id/time-blocks` - Create time block

### Professionals
- `GET /professionals?clinicId=` - List professionals
- `POST /professionals` - Create professional
- `PATCH /professionals/:id` - Update professional

### Services
- `GET /services?clinicId=` - List services
- `POST /services` - Create service
- `PATCH /services/:id` - Update service

### Appointments
- `GET /appointments?clinicId=` - List appointments
- `GET /appointments/today?clinicId=` - Today's appointments
- `POST /appointments` - Create appointment
- `PATCH /appointments/:id` - Update appointment

### Patients
- `GET /patients?clinicId=` - List patients
- `POST /patients` - Create patient
- `PATCH /patients/:id` - Update patient

### WhatsApp
- `POST /meta/webhook` - WhatsApp webhook
- `POST /meta/send-message` - Send message
- `POST /meta/verify-number` - Verify phone number

## Database Schema

### Collections (prefixed with `gendei_`)

- `clinics/{clinicId}` - Clinic profiles and settings
  - `professionals/{id}` - Healthcare professionals
  - `services/{id}` - Available services
  - `conversations/{id}` - WhatsApp conversations
  - `timeBlocks/{id}` - Calendar time blocks

- `appointments/{id}` - All appointments
- `patients/{id}` - Patient records
- `tokens/{clinicId}` - WhatsApp access tokens

## License

Proprietary - All rights reserved
