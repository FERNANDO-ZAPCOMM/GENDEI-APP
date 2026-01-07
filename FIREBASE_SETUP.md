# Gendei Firebase Project Setup

## 1. Create New Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click "Add Project"
3. Name it `gendei-prod` (or your preferred name)
4. Enable Google Analytics (optional)
5. Create the project

## 2. Enable Required Services

### Authentication
1. Go to Authentication > Sign-in method
2. Enable:
   - Email/Password
   - Google (optional)

### Firestore Database
1. Go to Firestore Database
2. Create database in **production mode**
3. Select **us-central1** region

### Cloud Functions
1. Upgrade to Blaze (pay-as-you-go) plan to use Cloud Functions
2. Functions will be deployed to `us-central1`

### Storage
1. Go to Storage
2. Set up storage in **us-central1**

## 3. Get Firebase Config

1. Go to Project Settings (gear icon)
2. Under "Your apps", click "Web" (</>)
3. Register app with nickname "Gendei Web"
4. Copy the config values to your `.env` file:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=gendei-prod.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=gendei-prod
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=gendei-prod.firebasestorage.app
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

## 4. Set Up Service Account

1. Go to Project Settings > Service Accounts
2. Click "Generate new private key"
3. Save as `gendei-prod-service-account.json`
4. Set environment variable:
   ```bash
   export GOOGLE_APPLICATION_CREDENTIALS=/path/to/gendei-prod-service-account.json
   ```

## 5. Deploy Firestore Rules

```bash
cd /Users/fernandomaximoferreira/Desktop/gendei
firebase deploy --only firestore:rules --project gendei-prod
```

## 6. Deploy Cloud Functions

```bash
cd /Users/fernandomaximoferreira/Desktop/gendei
firebase deploy --only functions --project gendei-prod
```

## 7. Create Meta App for WhatsApp

1. Go to [Meta for Developers](https://developers.facebook.com)
2. Create new app
3. Add WhatsApp product
4. Configure Embedded Signup
5. Get App ID and Config ID for `.env`

## Firestore Collections (auto-created)

The following collections will be created with `gendei_` prefix:
- `gendei_clinics` - Clinic profiles
- `gendei_professionals` - Healthcare professionals
- `gendei_services` - Medical services/procedures
- `gendei_appointments` - Appointment bookings
- `gendei_patients` - Patient records
- `gendei_tokens` - WhatsApp access tokens
- `gendei_conversations` - WhatsApp conversations
- `gendei_orders` - Payment orders
- `gendei_payments` - PIX payments
