# Gendei Frontend - Admin Dashboard

Production-ready admin dashboard for the Gendei clinic appointment scheduling platform.

## Features

### Clinic Admin Dashboard
- **WhatsApp Connection**: Embedded Signup with Meta Business integration
- **Professional Management**: Add and manage up to 25 healthcare professionals
- **Service Management**: Configure services, durations, and pricing
- **Appointment Calendar**: View and manage daily appointments
- **Patient Management**: Track patients and appointment history
- **Payment Settings**: Configure PIX payments for deposits
- **Reminder System**: Automatic 24h and 2h appointment reminders

### Technical Features
- **Firebase Authentication**: Secure clinic admin login
- **Firestore Database**: Real-time data sync
- **Multi-language**: Portuguese (BR) and English support
- **Responsive Design**: Mobile-first with Tailwind CSS

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript 5.7
- **Styling**: Tailwind CSS 3.4
- **Data Fetching**: TanStack Query 5
- **Forms**: React Hook Form 7 + Zod
- **Components**: shadcn/ui
- **i18n**: next-intl

## Quick Start

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

Visit http://localhost:3002

## Environment Variables

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
NEXT_PUBLIC_API_URL=https://us-central1-gendei-prod.cloudfunctions.net/api
```

## Project Structure

```
app/
└── [locale]/
    ├── dashboard/
    │   ├── page.tsx          # Overview with stats
    │   ├── professionals/    # Professional management
    │   ├── services/         # Service configuration
    │   ├── appointments/     # Appointment calendar
    │   ├── patients/         # Patient list
    │   ├── conversations/    # WhatsApp inbox
    │   └── whatsapp/         # WhatsApp connection
    ├── signin/
    └── signup/
```

## License

MIT
