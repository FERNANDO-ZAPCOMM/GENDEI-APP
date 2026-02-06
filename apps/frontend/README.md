# Gendei Frontend - Clinic Dashboard

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

### Vertical SaaS System
Each clinic belongs to a **vertical** that customizes the entire UI experience:

| Subdomain | Vertical | Platform Name |
|-----------|----------|---------------|
| `med.gendei.app` | Medical | Gendei Med |
| `dental.gendei.app` | Dentistry | Gendei Dental |
| `psi.gendei.app` | Psychology | Gendei Psi |
| `nutri.gendei.app` | Nutrition | Gendei Nutri |
| `fisio.gendei.app` | Physiotherapy | Gendei Fisio |

Verticals control: terminology, feature flags, default services, pricing ranges, theme colors, and specialty lists.

- **Subdomain detection**: `middleware.ts` reads the `host` header and sets `x-gendei-vertical`
- **React context**: `lib/vertical-provider.tsx` exposes `useVertical()` hook
- **Config**: `lib/verticals.ts` defines all vertical configurations
- **Dev override**: Use `?vertical=dental` query param on localhost

### Technical Features
- **Firebase Authentication**: Secure clinic admin login
- **Firestore Database**: Real-time data sync
- **Multi-language**: Portuguese (BR) and English support
- **Responsive Design**: Mobile-first with Tailwind CSS

## Tech Stack

- **Framework**: Next.js 16 (App Router)
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

To test a specific vertical locally:
```
http://localhost:3002?vertical=dental
```

## Environment Variables

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
NEXT_PUBLIC_API_URL=https://us-central1-gendei-prod.cloudfunctions.net/api
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_maps_api_key
NEXT_PUBLIC_META_APP_ID=your_meta_app_id
NEXT_PUBLIC_META_CONFIG_ID=your_meta_config_id
```

## Project Structure

```
app/
└── [locale]/
    ├── dashboard/
    │   ├── page.tsx          # Overview with stats
    │   ├── agenda/           # Appointment calendar
    │   ├── clinic/           # Clinic settings (profile, hours, vertical)
    │   ├── professionals/    # Professional management
    │   ├── services/         # Service configuration
    │   ├── patients/         # Patient list
    │   ├── conversations/    # WhatsApp inbox
    │   ├── payments/         # Payment settings (PIX, deposits)
    │   └── whatsapp/         # WhatsApp connection
    ├── signin/
    └── signup/
lib/
├── verticals.ts              # Vertical configurations (5 active + geral)
├── vertical-provider.tsx     # React context provider for useVertical()
├── clinic-categories.ts      # Service templates per category
└── ...
middleware.ts                 # Subdomain → vertical detection
messages/
├── pt-BR.json                # Portuguese translations
└── en.json                   # English translations
```

## License

Proprietary - All rights reserved
