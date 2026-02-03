# Research: Clinic Onboarding

**Feature**: 001-clinic-onboarding
**Date**: 2026-02-04

---

## Technology Decisions

### 1. Authentication Provider

**Decision**: Firebase Authentication with Google Sign-In + Email/Password

**Alternatives Considered**:

| Approach | Pros | Cons | Decision |
|----------|------|------|----------|
| Firebase Auth | Easy setup, Google integration, free tier | Vendor lock-in | **Selected** |
| Auth0 | Feature-rich, enterprise | Cost at scale | Rejected |
| NextAuth.js | Full control, OSS | More setup, session management | Rejected |
| Clerk | Great DX, modern | Cost, newer service | Rejected |

**Why Firebase Auth**:
- Already using Firebase ecosystem (Firestore, Functions)
- Native Google Sign-In support
- Free tier covers startup needs
- Easy integration with Firestore security rules
- Mobile SDK available for future iOS app

**Implementation**:
```typescript
// apps/web/src/lib/firebase.ts
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
};

export const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
```

---

### 2. Form Library

**Decision**: React Hook Form 7 + Zod 3

**Alternatives Considered**:

| Approach | Pros | Cons | Decision |
|----------|------|------|----------|
| React Hook Form + Zod | Performance, type-safe | Learning curve | **Selected** |
| Formik + Yup | Popular, mature | Performance at scale | Rejected |
| Native forms | Simple | No validation, boilerplate | Rejected |
| TanStack Form | New, powerful | Less ecosystem | Considered |

**Why React Hook Form + Zod**:
- Minimal re-renders (uncontrolled inputs)
- Full TypeScript inference from Zod schemas
- Excellent shadcn/ui integration
- Large community and documentation
- Zod schemas reusable on backend

**Implementation**:
```typescript
// apps/web/src/schemas/clinic.schema.ts
import { z } from 'zod';

export const clinicProfileSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  cnpj: z.string().regex(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/, 'CNPJ inválido').optional(),
  phone: z.string().min(10, 'Telefone inválido'),
  email: z.string().email('Email inválido'),
  category: z.enum(CLINIC_CATEGORIES),
});

export type ClinicProfileInput = z.infer<typeof clinicProfileSchema>;
```

---

### 3. UI Component Library

**Decision**: shadcn/ui with Tailwind CSS 4

**Alternatives Considered**:

| Approach | Pros | Cons | Decision |
|----------|------|------|----------|
| shadcn/ui | Customizable, accessible, copy-paste | Setup per component | **Selected** |
| Chakra UI | Feature-rich, theming | Bundle size, styling conflicts | Rejected |
| Material UI | Comprehensive | Heavy, opinionated design | Rejected |
| Radix + custom | Full control | More work | Rejected |

**Why shadcn/ui**:
- Components are copied into codebase (full control)
- Built on Radix UI (accessibility)
- Native Tailwind CSS styling
- Excellent form components
- Active development and community

**Implementation**:
```bash
# Install base shadcn/ui
npx shadcn@latest init

# Add required components
npx shadcn@latest add button input form select card
```

---

### 4. Google Maps Integration

**Decision**: @react-google-maps/api for Places Autocomplete

**Alternatives Considered**:

| Approach | Pros | Cons | Decision |
|----------|------|------|----------|
| @react-google-maps/api | React-native, typed | Google dependency | **Selected** |
| Mapbox | Beautiful maps, free tier | Different API | Rejected |
| OpenStreetMap | Free, open | Less accurate in Brazil | Rejected |
| Manual address | No dependency | Poor UX | Rejected |

**Why Google Maps**:
- Best address coverage in Brazil
- Accurate geocoding for clinic locations
- Places Autocomplete saves typing
- Structured address components
- Future map display needs

**Implementation**:
```typescript
// apps/web/src/components/maps/AddressAutocomplete.tsx
import { useLoadScript, Autocomplete } from '@react-google-maps/api';

const libraries: Libraries = ['places'];

export function AddressAutocomplete({ onSelect }: Props) {
  const { isLoaded } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
    libraries,
  });

  const handlePlaceSelect = (autocomplete: google.maps.places.Autocomplete) => {
    const place = autocomplete.getPlace();
    onSelect(parseAddressComponents(place.address_components));
  };

  if (!isLoaded) return <Skeleton />;

  return (
    <Autocomplete
      onLoad={setAutocomplete}
      onPlaceChanged={handlePlaceSelect}
      options={{ componentRestrictions: { country: 'br' } }}
    >
      <Input placeholder="Digite o endereço..." />
    </Autocomplete>
  );
}
```

---

### 5. Internationalization

**Decision**: next-intl for i18n

**Alternatives Considered**:

| Approach | Pros | Cons | Decision |
|----------|------|------|----------|
| next-intl | App Router native, typed | Newer | **Selected** |
| next-i18next | Mature, popular | Pages Router focused | Rejected |
| react-intl | Feature-rich | More setup | Rejected |
| Custom | Full control | Reinventing wheel | Rejected |

**Why next-intl**:
- Built for Next.js App Router
- Type-safe message access
- Server Component support
- Date/number formatting
- Locale-based routing

**Implementation**:
```typescript
// apps/web/src/i18n/request.ts
import { getRequestConfig } from 'next-intl/server';

export default getRequestConfig(async ({ locale }) => ({
  messages: (await import(`../messages/${locale}.json`)).default
}));
```

```json
// apps/web/src/messages/pt-BR.json
{
  "onboarding": {
    "title": "Configure sua clínica",
    "steps": {
      "profile": "Perfil",
      "address": "Endereço",
      "hours": "Horários",
      "payment": "Pagamento"
    },
    "fields": {
      "name": "Nome da clínica",
      "cnpj": "CNPJ",
      "phone": "Telefone"
    }
  }
}
```

---

### 6. CNPJ Validation

**Decision**: Client-side format validation + optional Receita Federal check

**Validation Rules**:
```typescript
// CNPJ format: XX.XXX.XXX/XXXX-XX
const CNPJ_REGEX = /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/;

// CNPJ digit verification algorithm
function validateCNPJ(cnpj: string): boolean {
  const numbers = cnpj.replace(/\D/g, '');
  if (numbers.length !== 14) return false;

  // Check for known invalid patterns
  if (/^(\d)\1+$/.test(numbers)) return false;

  // Verify check digits
  let sum = 0;
  let weight = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  for (let i = 0; i < 12; i++) {
    sum += parseInt(numbers[i]) * weight[i];
  }

  let digit = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (parseInt(numbers[12]) !== digit) return false;

  // Second digit verification...
  return true;
}
```

---

### 7. Operating Hours Data Structure

**Decision**: Day-indexed object with multiple ranges

**Alternatives Considered**:

| Approach | Pros | Cons | Decision |
|----------|------|------|----------|
| Day-indexed object | Fast lookup, clear | Sparse storage | **Selected** |
| Array of intervals | Compact | Complex queries | Rejected |
| Bitmask + times | Very compact | Hard to read | Rejected |

**Why Day-Indexed**:
- Easy to query "is open on Monday?"
- Supports multiple time ranges per day
- Clear data structure for UI
- Firestore-friendly

**Implementation**:
```typescript
interface OperatingHours {
  [day: number]: {
    isOpen: boolean;
    ranges: Array<{
      from: string; // "08:00"
      to: string;   // "12:00"
    }>;
  };
}

// Example: Open Mon-Fri 8-12, 14-18
const hours: OperatingHours = {
  0: { isOpen: false, ranges: [] }, // Sunday
  1: { isOpen: true, ranges: [{ from: '08:00', to: '12:00' }, { from: '14:00', to: '18:00' }] },
  2: { isOpen: true, ranges: [{ from: '08:00', to: '12:00' }, { from: '14:00', to: '18:00' }] },
  // ...
};
```

---

### 8. PIX Key Storage

**Decision**: Stored in Firestore with type indication

**PIX Key Types**:
```typescript
type PixKeyType = 'cpf' | 'cnpj' | 'email' | 'phone' | 'random';

interface PixKeyConfig {
  type: PixKeyType;
  key: string;
  verifiedAt?: Timestamp;
}

// Validation per type
const PIX_KEY_VALIDATORS: Record<PixKeyType, RegExp> = {
  cpf: /^\d{3}\.\d{3}\.\d{3}-\d{2}$/,
  cnpj: /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/,
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  phone: /^\+55\d{10,11}$/,
  random: /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i,
};
```

**Double-Entry Verification**:
```typescript
// UI requires entering PIX key twice
const pixSchema = z.object({
  pixKey: z.string().min(1),
  pixKeyConfirm: z.string().min(1),
}).refine(data => data.pixKey === data.pixKeyConfirm, {
  message: 'As chaves PIX não conferem',
  path: ['pixKeyConfirm'],
});
```

---

### 9. Healthcare Categories

**Decision**: 18+ predefined categories with i18n support

**Categories**:
```typescript
const CLINIC_CATEGORIES = [
  'general_clinic',      // Clínica Geral
  'dentistry',           // Odontologia
  'dermatology',         // Dermatologia
  'cardiology',          // Cardiologia
  'orthopedics',         // Ortopedia
  'gynecology',          // Ginecologia
  'pediatrics',          // Pediatria
  'ophthalmology',       // Oftalmologia
  'psychiatry',          // Psiquiatria
  'psychology',          // Psicologia
  'physiotherapy',       // Fisioterapia
  'nutrition',           // Nutrição
  'endocrinology',       // Endocrinologia
  'urology',             // Urologia
  'neurology',           // Neurologia
  'otolaryngology',      // Otorrinolaringologia
  'veterinary',          // Veterinária
  'aesthetics',          // Estética
  'other',               // Outro
] as const;

type ClinicCategory = typeof CLINIC_CATEGORIES[number];
```

---

### 10. Auto-Create Clinic Pattern

**Decision**: Create clinic document on first authenticated access

**Flow**:
```
User authenticates → GET /clinics/me → 404 → POST /clinics (auto) → Return new clinic
```

**Implementation**:
```typescript
// apps/functions/src/controllers/clinicController.ts
export async function getMyClinic(req: AuthenticatedRequest, res: Response) {
  const userId = req.user.uid;

  // Try to find existing clinic
  const clinicsRef = db.collection('gendei_clinics');
  const snapshot = await clinicsRef.where('ownerId', '==', userId).limit(1).get();

  if (!snapshot.empty) {
    return res.json(snapshot.docs[0].data());
  }

  // Auto-create minimal clinic
  const newClinic = {
    ownerId: userId,
    adminIds: [userId],
    email: req.user.email,
    name: '',
    onboardingCompleted: false,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  const docRef = await clinicsRef.add(newClinic);
  return res.status(201).json({ id: docRef.id, ...newClinic });
}
```

---

## Performance Considerations

### Form Performance
- React Hook Form uses uncontrolled inputs (minimal re-renders)
- Zod validation runs only on submit/blur
- Lazy load Google Maps script

### Firestore Optimization
- Single document for clinic profile
- Compound indexes for common queries
- Security rules minimize reads

### Bundle Size
- shadcn/ui components are tree-shakeable
- Dynamic import for Google Maps
- next-intl loads only active locale

---

## Security Considerations

1. **Firebase Rules**: Only owner/admin can read/write clinic
2. **Input Sanitization**: All inputs validated with Zod
3. **HTTPS Only**: All API calls over HTTPS
4. **Token Validation**: Firebase Auth tokens validated server-side
5. **PIX Key**: Not returned in GET responses (write-only field)

---

## References

- [Firebase Authentication](https://firebase.google.com/docs/auth)
- [React Hook Form](https://react-hook-form.com/)
- [Zod Documentation](https://zod.dev/)
- [shadcn/ui](https://ui.shadcn.com/)
- [next-intl](https://next-intl-docs.vercel.app/)
- [Google Maps JavaScript API](https://developers.google.com/maps/documentation/javascript)
- [CNPJ Validation](https://www.macoratti.net/alg_cnpj.htm)
