# Quickstart: Clinic Onboarding

**Feature**: 001-clinic-onboarding
**Date**: 2026-02-04

---

## Prerequisites

- Node.js 20+
- Firebase CLI installed (`npm i -g firebase-tools`)
- Firebase project created
- Google Cloud project with Maps API enabled

---

## Environment Setup

### 1. Firebase Configuration

```bash
# Login to Firebase
firebase login

# Initialize Firebase in project
firebase init

# Select: Firestore, Functions, Hosting, Emulators
```

### 2. Environment Variables

```bash
# apps/web/.env.local
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=gendei-dev.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=gendei-dev
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=gendei-dev.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123

NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_maps_api_key
```

```bash
# apps/functions/.env
FIREBASE_PROJECT_ID=gendei-dev
```

---

## Installation

### 1. Install Dependencies

```bash
# Root
npm install

# Web app
cd apps/web
npm install firebase react-hook-form zod @hookform/resolvers next-intl @react-google-maps/api

# Functions
cd ../functions
npm install firebase-admin express cors zod
```

### 2. Install shadcn/ui

```bash
cd apps/web

# Initialize shadcn/ui
npx shadcn@latest init

# Add required components
npx shadcn@latest add button input label form select card dialog toast
```

---

## Code Implementation

### 1. Firebase Client Setup

```typescript
// apps/web/src/lib/firebase.ts
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase (singleton)
let app: FirebaseApp;
let auth: Auth;
let db: Firestore;

if (typeof window !== 'undefined') {
  app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
}

export { app, auth, db };
export const googleProvider = new GoogleAuthProvider();
```

### 2. Authentication Context

```typescript
// apps/web/src/contexts/AuthContext.tsx
'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signInWithGoogle = async () => {
    await signInWithPopup(auth, googleProvider);
  };

  const signUp = async (email: string, password: string) => {
    await createUserWithEmailAndPassword(auth, email, password);
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signInWithGoogle, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
```

### 3. Clinic Validation Schema

```typescript
// apps/web/src/schemas/clinic.schema.ts
import { z } from 'zod';

export const CLINIC_CATEGORIES = [
  'general_clinic',
  'dentistry',
  'dermatology',
  'cardiology',
  'orthopedics',
  'gynecology',
  'pediatrics',
  'ophthalmology',
  'psychiatry',
  'psychology',
  'physiotherapy',
  'nutrition',
  'endocrinology',
  'urology',
  'neurology',
  'otolaryngology',
  'veterinary',
  'aesthetics',
  'other',
] as const;

// CNPJ validation with check digits
function validateCNPJ(cnpj: string): boolean {
  const numbers = cnpj.replace(/\D/g, '');
  if (numbers.length !== 14) return false;
  if (/^(\d)\1+$/.test(numbers)) return false;

  // First check digit
  let sum = 0;
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  for (let i = 0; i < 12; i++) {
    sum += parseInt(numbers[i]) * weights1[i];
  }
  let digit1 = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (parseInt(numbers[12]) !== digit1) return false;

  // Second check digit
  sum = 0;
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  for (let i = 0; i < 13; i++) {
    sum += parseInt(numbers[i]) * weights2[i];
  }
  let digit2 = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  return parseInt(numbers[13]) === digit2;
}

export const clinicProfileSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  description: z.string().max(500, 'Descrição muito longa').optional(),
  cnpj: z.string()
    .regex(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/, 'Formato: XX.XXX.XXX/XXXX-XX')
    .refine(validateCNPJ, 'CNPJ inválido')
    .optional()
    .or(z.literal('')),
  phone: z.string().min(10, 'Telefone deve ter pelo menos 10 dígitos'),
  email: z.string().email('Email inválido'),
  category: z.enum(CLINIC_CATEGORIES, {
    errorMap: () => ({ message: 'Selecione uma categoria' }),
  }),
});

export const addressSchema = z.object({
  formatted: z.string(),
  street: z.string().min(1, 'Rua é obrigatória'),
  number: z.string().min(1, 'Número é obrigatório'),
  complement: z.string().optional(),
  neighborhood: z.string().min(1, 'Bairro é obrigatório'),
  city: z.string().min(1, 'Cidade é obrigatória'),
  state: z.string().length(2, 'Estado deve ter 2 letras'),
  zipCode: z.string().regex(/^\d{5}-?\d{3}$/, 'CEP inválido'),
  country: z.string().default('BR'),
  lat: z.number().optional(),
  lng: z.number().optional(),
});

export type ClinicProfileInput = z.infer<typeof clinicProfileSchema>;
export type AddressInput = z.infer<typeof addressSchema>;
```

### 4. Clinic Profile Form Component

```typescript
// apps/web/src/components/onboarding/ClinicProfileForm.tsx
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { clinicProfileSchema, ClinicProfileInput, CLINIC_CATEGORIES } from '@/schemas/clinic.schema';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useTranslations } from 'next-intl';

interface Props {
  onSubmit: (data: ClinicProfileInput) => Promise<void>;
  defaultValues?: Partial<ClinicProfileInput>;
}

export function ClinicProfileForm({ onSubmit, defaultValues }: Props) {
  const t = useTranslations('onboarding');

  const form = useForm<ClinicProfileInput>({
    resolver: zodResolver(clinicProfileSchema),
    defaultValues: {
      name: '',
      description: '',
      cnpj: '',
      phone: '',
      email: '',
      category: undefined,
      ...defaultValues,
    },
  });

  const handleSubmit = form.handleSubmit(async (data) => {
    await onSubmit(data);
  });

  // CNPJ mask
  const formatCNPJ = (value: string) => {
    return value
      .replace(/\D/g, '')
      .replace(/^(\d{2})(\d)/, '$1.$2')
      .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2')
      .slice(0, 18);
  };

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit} className="space-y-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('fields.name')}</FormLabel>
              <FormControl>
                <Input placeholder="Clínica Saúde" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="cnpj"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('fields.cnpj')}</FormLabel>
              <FormControl>
                <Input
                  placeholder="XX.XXX.XXX/XXXX-XX"
                  {...field}
                  onChange={(e) => field.onChange(formatCNPJ(e.target.value))}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('fields.phone')}</FormLabel>
              <FormControl>
                <Input placeholder="11999998888" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('fields.email')}</FormLabel>
              <FormControl>
                <Input type="email" placeholder="contato@clinica.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="category"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('fields.category')}</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={t('fields.selectCategory')} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {CLINIC_CATEGORIES.map((category) => (
                    <SelectItem key={category} value={category}>
                      {t(`categories.${category}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? t('saving') : t('continue')}
        </Button>
      </form>
    </Form>
  );
}
```

### 5. Address Autocomplete Component

```typescript
// apps/web/src/components/maps/AddressAutocomplete.tsx
'use client';

import { useRef, useCallback } from 'react';
import { useLoadScript, Autocomplete } from '@react-google-maps/api';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { AddressInput } from '@/schemas/clinic.schema';

const libraries: ('places')[] = ['places'];

interface Props {
  onSelect: (address: AddressInput) => void;
  defaultValue?: string;
}

export function AddressAutocomplete({ onSelect, defaultValue }: Props) {
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
    libraries,
  });

  const onLoad = useCallback((autocomplete: google.maps.places.Autocomplete) => {
    autocompleteRef.current = autocomplete;
  }, []);

  const onPlaceChanged = useCallback(() => {
    if (!autocompleteRef.current) return;

    const place = autocompleteRef.current.getPlace();
    if (!place.address_components) return;

    const address = parseAddressComponents(place);
    onSelect(address);
  }, [onSelect]);

  if (loadError) {
    return <Input placeholder="Digite o endereço manualmente" />;
  }

  if (!isLoaded) {
    return <Skeleton className="h-10 w-full" />;
  }

  return (
    <Autocomplete
      onLoad={onLoad}
      onPlaceChanged={onPlaceChanged}
      options={{
        componentRestrictions: { country: 'br' },
        types: ['address'],
      }}
    >
      <Input
        ref={inputRef}
        placeholder="Digite o endereço da clínica"
        defaultValue={defaultValue}
      />
    </Autocomplete>
  );
}

function parseAddressComponents(place: google.maps.places.PlaceResult): AddressInput {
  const get = (type: string) =>
    place.address_components?.find((c) => c.types.includes(type))?.long_name || '';

  const getShort = (type: string) =>
    place.address_components?.find((c) => c.types.includes(type))?.short_name || '';

  return {
    formatted: place.formatted_address || '',
    street: get('route'),
    number: get('street_number'),
    neighborhood: get('sublocality_level_1') || get('sublocality'),
    city: get('administrative_area_level_2'),
    state: getShort('administrative_area_level_1'),
    zipCode: get('postal_code'),
    country: getShort('country'),
    lat: place.geometry?.location?.lat(),
    lng: place.geometry?.location?.lng(),
  };
}
```

### 6. Backend API Controller

```typescript
// apps/functions/src/controllers/clinicController.ts
import { Request, Response } from 'express';
import { db } from '../lib/firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';

const clinicsCollection = db.collection('gendei_clinics');

// Get or create clinic for authenticated user
export async function getMyClinic(req: Request, res: Response) {
  try {
    const userId = req.user!.uid;
    const userEmail = req.user!.email;

    // Find existing clinic
    const snapshot = await clinicsCollection
      .where('ownerId', '==', userId)
      .limit(1)
      .get();

    if (!snapshot.empty) {
      const doc = snapshot.docs[0];
      return res.json({ id: doc.id, ...doc.data() });
    }

    // Auto-create minimal clinic
    const newClinic = {
      ownerId: userId,
      adminIds: [userId],
      name: '',
      email: userEmail || '',
      phone: '',
      category: null,
      timezone: 'America/Sao_Paulo',
      locale: 'pt-BR',
      operatingHours: getDefaultOperatingHours(),
      whatsappConnected: false,
      onboardingCompleted: false,
      onboardingStepsCompleted: [],
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    const docRef = await clinicsCollection.add(newClinic);

    return res.status(201).json({
      id: docRef.id,
      ...newClinic,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error('Error getting clinic:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Update clinic profile
export async function updateMyClinic(req: Request, res: Response) {
  try {
    const userId = req.user!.uid;
    const updates = req.body;

    // Find user's clinic
    const snapshot = await clinicsCollection
      .where('ownerId', '==', userId)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return res.status(404).json({ error: 'Clinic not found' });
    }

    const clinicRef = snapshot.docs[0].ref;

    // Update with timestamp
    await clinicRef.update({
      ...updates,
      updatedAt: FieldValue.serverTimestamp(),
    });

    const updated = await clinicRef.get();

    return res.json({ id: updated.id, ...updated.data() });
  } catch (error) {
    console.error('Error updating clinic:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Update specific setting
export async function updateClinicSetting(req: Request, res: Response) {
  try {
    const { clinicId, key } = req.params;
    const userId = req.user!.uid;
    const value = req.body;

    // Verify access
    const clinicRef = clinicsCollection.doc(clinicId);
    const clinic = await clinicRef.get();

    if (!clinic.exists) {
      return res.status(404).json({ error: 'Clinic not found' });
    }

    const data = clinic.data()!;
    if (data.ownerId !== userId && !data.adminIds?.includes(userId)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Validate key
    const validKeys = ['operatingHours', 'paymentSettings', 'timezone', 'locale'];
    if (!validKeys.includes(key)) {
      return res.status(400).json({ error: 'Invalid setting key' });
    }

    // Update
    await clinicRef.update({
      [key]: value,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return res.json({
      success: true,
      key,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error updating setting:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

function getDefaultOperatingHours() {
  const defaultDay = { isOpen: false, ranges: [] };
  const workDay = { isOpen: true, ranges: [{ from: '08:00', to: '18:00' }] };

  return {
    0: defaultDay,  // Sunday
    1: workDay,     // Monday
    2: workDay,     // Tuesday
    3: workDay,     // Wednesday
    4: workDay,     // Thursday
    5: workDay,     // Friday
    6: defaultDay,  // Saturday
  };
}
```

### 7. API Routes

```typescript
// apps/functions/src/routes/clinics.ts
import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { getMyClinic, updateMyClinic, updateClinicSetting } from '../controllers/clinicController';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

router.get('/me', getMyClinic);
router.patch('/me', updateMyClinic);
router.put('/:clinicId/settings/:key', updateClinicSetting);

export default router;
```

### 8. Auth Middleware

```typescript
// apps/functions/src/middleware/auth.ts
import { Request, Response, NextFunction } from 'express';
import { auth } from '../lib/firebase-admin';

declare global {
  namespace Express {
    interface Request {
      user?: {
        uid: string;
        email?: string;
      };
    }
  }
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization header' });
  }

  const token = authHeader.split('Bearer ')[1];

  try {
    const decoded = await auth.verifyIdToken(token);
    req.user = {
      uid: decoded.uid,
      email: decoded.email,
    };
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}
```

---

## Testing

### Run Firebase Emulators

```bash
firebase emulators:start
```

### Test API Endpoints

```bash
# Get ID token (from browser console after sign-in)
TOKEN="your_firebase_id_token"

# Get/create clinic
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:5001/gendei-dev/us-central1/api/clinics/me

# Update clinic
curl -X PATCH \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Minha Clínica", "category": "dentistry"}' \
  http://localhost:5001/gendei-dev/us-central1/api/clinics/me
```

---

## Deployment

```bash
# Deploy functions
firebase deploy --only functions

# Deploy Firestore rules
firebase deploy --only firestore:rules

# Deploy web app
cd apps/web && npm run build
firebase deploy --only hosting
```

---

## Common Issues

### Google Maps API Key Restrictions

Ensure your API key has:
- Maps JavaScript API enabled
- Places API enabled
- HTTP referrer restrictions for production domain

### Firebase Auth Domain

Add your domain to Firebase Console → Authentication → Settings → Authorized domains

### CORS Issues

Functions should include CORS middleware:
```typescript
import cors from 'cors';
app.use(cors({ origin: true }));
```
