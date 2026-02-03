# Data Model: Clinic Onboarding

**Feature**: 001-clinic-onboarding
**Date**: 2026-02-04

---

## Firestore Collections

### Collection: `gendei_clinics`

**Path**: `gendei_clinics/{clinicId}`

**Description**: Stores clinic profile, settings, and configuration data.

---

## TypeScript Interfaces

### Clinic (Main Document)

```typescript
import { Timestamp } from 'firebase/firestore';

/**
 * Main clinic document stored in gendei_clinics collection.
 * Created automatically on first user authentication.
 */
interface Clinic {
  /** Firestore document ID */
  id: string;

  /** Firebase Auth UID of the clinic owner */
  ownerId: string;

  /** Firebase Auth UIDs of additional admins */
  adminIds: string[];

  // ─────────────────────────────────────────────
  // Profile Information
  // ─────────────────────────────────────────────

  /** Clinic display name */
  name: string;

  /** Optional description/tagline */
  description?: string;

  /** Brazilian business registration number (XX.XXX.XXX/XXXX-XX) */
  cnpj?: string;

  /** Contact phone number with DDD */
  phone: string;

  /** Contact email address */
  email: string;

  /** Logo URL in Firebase Storage */
  logoUrl?: string;

  // ─────────────────────────────────────────────
  // Address
  // ─────────────────────────────────────────────

  /** Structured address from Google Maps */
  address: ClinicAddress;

  // ─────────────────────────────────────────────
  // Business Settings
  // ─────────────────────────────────────────────

  /** Healthcare category/specialty */
  category: ClinicCategory;

  /** IANA timezone identifier */
  timezone: string;

  /** UI locale preference */
  locale: SupportedLocale;

  // ─────────────────────────────────────────────
  // Operating Hours
  // ─────────────────────────────────────────────

  /** Weekly operating schedule */
  operatingHours: OperatingHours;

  // ─────────────────────────────────────────────
  // Payment Configuration
  // ─────────────────────────────────────────────

  /** Payment and billing settings */
  paymentSettings?: PaymentSettings;

  // ─────────────────────────────────────────────
  // WhatsApp Integration (populated by 004)
  // ─────────────────────────────────────────────

  /** Whether WhatsApp is connected */
  whatsappConnected: boolean;

  /** Meta WhatsApp Phone Number ID */
  whatsappPhoneNumberId?: string;

  /** Meta WhatsApp Business Account ID */
  whatsappWabaId?: string;

  /** Display phone number for WhatsApp */
  whatsappDisplayPhone?: string;

  // ─────────────────────────────────────────────
  // Metadata
  // ─────────────────────────────────────────────

  /** Onboarding wizard completion status */
  onboardingCompleted: boolean;

  /** Steps completed in onboarding */
  onboardingStepsCompleted: OnboardingStep[];

  /** Document creation timestamp */
  createdAt: Timestamp;

  /** Last update timestamp */
  updatedAt: Timestamp;
}
```

---

### ClinicAddress

```typescript
/**
 * Structured address parsed from Google Maps Places API.
 */
interface ClinicAddress {
  /** Full formatted address string */
  formatted: string;

  /** Street name (logradouro) */
  street: string;

  /** Street number */
  number: string;

  /** Apartment, suite, floor (complemento) */
  complement?: string;

  /** Neighborhood (bairro) */
  neighborhood: string;

  /** City name */
  city: string;

  /** State code (e.g., "SP", "RJ") */
  state: string;

  /** Postal code (CEP) */
  zipCode: string;

  /** Country code */
  country: string;

  /** Latitude for map display */
  lat?: number;

  /** Longitude for map display */
  lng?: number;

  /** Google Place ID for reference */
  placeId?: string;
}
```

---

### OperatingHours

```typescript
/**
 * Weekly operating hours configuration.
 * Keys are day-of-week (0=Sunday, 6=Saturday).
 */
type OperatingHours = {
  [day in DayOfWeek]: DaySchedule;
};

/** Day of week number (0-6, Sunday-Saturday) */
type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Schedule for a single day.
 */
interface DaySchedule {
  /** Whether the clinic is open this day */
  isOpen: boolean;

  /** Time ranges when open (supports breaks) */
  ranges: TimeRange[];
}

/**
 * A time range during which the clinic is open.
 */
interface TimeRange {
  /** Start time in HH:MM format (24h) */
  from: string;

  /** End time in HH:MM format (24h) */
  to: string;
}
```

**Example**:
```typescript
const operatingHours: OperatingHours = {
  0: { isOpen: false, ranges: [] }, // Sunday - closed
  1: { isOpen: true, ranges: [
    { from: '08:00', to: '12:00' },
    { from: '14:00', to: '18:00' }
  ]}, // Monday
  2: { isOpen: true, ranges: [
    { from: '08:00', to: '12:00' },
    { from: '14:00', to: '18:00' }
  ]}, // Tuesday
  3: { isOpen: true, ranges: [
    { from: '08:00', to: '12:00' },
    { from: '14:00', to: '18:00' }
  ]}, // Wednesday
  4: { isOpen: true, ranges: [
    { from: '08:00', to: '12:00' },
    { from: '14:00', to: '18:00' }
  ]}, // Thursday
  5: { isOpen: true, ranges: [
    { from: '08:00', to: '12:00' },
    { from: '14:00', to: '17:00' }
  ]}, // Friday (closes early)
  6: { isOpen: true, ranges: [
    { from: '08:00', to: '12:00' }
  ]}, // Saturday (morning only)
};
```

---

### PaymentSettings

```typescript
/**
 * Payment and billing configuration for the clinic.
 */
interface PaymentSettings {
  /** Accepts health insurance (convênio) */
  acceptsConvenio: boolean;

  /** List of accepted health insurance providers */
  convenioList: string[];

  /** Accepts private/cash payment */
  acceptsParticular: boolean;

  /** Requires deposit for appointments */
  requiresDeposit: boolean;

  /** Deposit percentage (10-100) */
  depositPercentage: number;

  /** PIX key configuration */
  pix?: PixKeyConfig;
}

/**
 * PIX key configuration for receiving payments.
 */
interface PixKeyConfig {
  /** Type of PIX key */
  type: PixKeyType;

  /** The PIX key value */
  key: string;

  /** When the key was verified */
  verifiedAt?: Timestamp;
}

/** Supported PIX key types */
type PixKeyType = 'cpf' | 'cnpj' | 'email' | 'phone' | 'random';
```

---

### Enums and Constants

```typescript
/**
 * Supported healthcare categories.
 */
const CLINIC_CATEGORIES = [
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

type ClinicCategory = typeof CLINIC_CATEGORIES[number];

/**
 * Supported UI locales.
 */
type SupportedLocale = 'pt-BR' | 'en';

/**
 * Onboarding wizard steps.
 */
type OnboardingStep =
  | 'profile'
  | 'address'
  | 'hours'
  | 'payment'
  | 'whatsapp';

/**
 * Default timezone for Brazilian clinics.
 */
const DEFAULT_TIMEZONE = 'America/Sao_Paulo';

/**
 * Common Brazilian timezones.
 */
const BRAZIL_TIMEZONES = [
  'America/Sao_Paulo',      // Brasília time (most of Brazil)
  'America/Manaus',         // Amazon time
  'America/Rio_Branco',     // Acre time
  'America/Noronha',        // Fernando de Noronha
  'America/Recife',         // Northeast (no DST)
  'America/Cuiaba',         // Mato Grosso
  'America/Porto_Velho',    // Rondônia
  'America/Boa_Vista',      // Roraima
  'America/Belem',          // Pará (east)
] as const;
```

---

## Zod Validation Schemas

```typescript
import { z } from 'zod';

// ─────────────────────────────────────────────
// Address Schema
// ─────────────────────────────────────────────

export const addressSchema = z.object({
  formatted: z.string().min(1),
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
  placeId: z.string().optional(),
});

// ─────────────────────────────────────────────
// Operating Hours Schema
// ─────────────────────────────────────────────

const timeRangeSchema = z.object({
  from: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Formato HH:MM'),
  to: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Formato HH:MM'),
}).refine(data => data.from < data.to, {
  message: 'Horário de início deve ser antes do fim',
});

const dayScheduleSchema = z.object({
  isOpen: z.boolean(),
  ranges: z.array(timeRangeSchema),
});

export const operatingHoursSchema = z.record(
  z.enum(['0', '1', '2', '3', '4', '5', '6']),
  dayScheduleSchema
);

// ─────────────────────────────────────────────
// Payment Settings Schema
// ─────────────────────────────────────────────

export const pixKeySchema = z.object({
  type: z.enum(['cpf', 'cnpj', 'email', 'phone', 'random']),
  key: z.string().min(1),
});

export const paymentSettingsSchema = z.object({
  acceptsConvenio: z.boolean(),
  convenioList: z.array(z.string()),
  acceptsParticular: z.boolean(),
  requiresDeposit: z.boolean(),
  depositPercentage: z.number().min(10).max(100),
  pix: pixKeySchema.optional(),
});

// ─────────────────────────────────────────────
// Clinic Profile Schema
// ─────────────────────────────────────────────

export const clinicProfileSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  description: z.string().max(500).optional(),
  cnpj: z.string()
    .regex(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/, 'CNPJ inválido')
    .optional()
    .or(z.literal('')),
  phone: z.string()
    .min(10, 'Telefone deve ter pelo menos 10 dígitos')
    .max(15, 'Telefone muito longo'),
  email: z.string().email('Email inválido'),
  category: z.enum(CLINIC_CATEGORIES),
  timezone: z.string().default('America/Sao_Paulo'),
  locale: z.enum(['pt-BR', 'en']).default('pt-BR'),
});

// ─────────────────────────────────────────────
// Full Clinic Schema (for updates)
// ─────────────────────────────────────────────

export const clinicUpdateSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().max(500).optional(),
  cnpj: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  category: z.enum(CLINIC_CATEGORIES).optional(),
  timezone: z.string().optional(),
  locale: z.enum(['pt-BR', 'en']).optional(),
  address: addressSchema.optional(),
  operatingHours: operatingHoursSchema.optional(),
  paymentSettings: paymentSettingsSchema.optional(),
});

// Type exports
export type ClinicProfileInput = z.infer<typeof clinicProfileSchema>;
export type ClinicUpdateInput = z.infer<typeof clinicUpdateSchema>;
export type AddressInput = z.infer<typeof addressSchema>;
export type PaymentSettingsInput = z.infer<typeof paymentSettingsSchema>;
```

---

## Firestore Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Helper functions
    function isAuthenticated() {
      return request.auth != null;
    }

    function isOwner(clinicId) {
      return isAuthenticated() &&
        get(/databases/$(database)/documents/gendei_clinics/$(clinicId)).data.ownerId == request.auth.uid;
    }

    function isAdmin(clinicId) {
      return isAuthenticated() &&
        request.auth.uid in get(/databases/$(database)/documents/gendei_clinics/$(clinicId)).data.adminIds;
    }

    function canAccessClinic(clinicId) {
      return isOwner(clinicId) || isAdmin(clinicId);
    }

    // Clinic rules
    match /gendei_clinics/{clinicId} {
      // Anyone authenticated can create their own clinic
      allow create: if isAuthenticated() &&
        request.resource.data.ownerId == request.auth.uid;

      // Only owner/admin can read
      allow read: if canAccessClinic(clinicId);

      // Only owner/admin can update
      allow update: if canAccessClinic(clinicId);

      // Only owner can delete
      allow delete: if isOwner(clinicId);
    }
  }
}
```

---

## Indexes

```json
// firestore.indexes.json
{
  "indexes": [
    {
      "collectionGroup": "gendei_clinics",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "ownerId", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "gendei_clinics",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "category", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    }
  ]
}
```

---

## Example Document

```json
{
  "id": "clinic_abc123",
  "ownerId": "user_xyz789",
  "adminIds": ["user_xyz789"],
  "name": "Clínica Saúde & Bem-Estar",
  "description": "Sua saúde em boas mãos",
  "cnpj": "12.345.678/0001-90",
  "phone": "11999998888",
  "email": "contato@clinicasaude.com.br",
  "logoUrl": "https://storage.googleapis.com/gendei.../logo.png",
  "address": {
    "formatted": "Av. Paulista, 1000 - Bela Vista, São Paulo - SP, 01310-100",
    "street": "Av. Paulista",
    "number": "1000",
    "complement": "Sala 501",
    "neighborhood": "Bela Vista",
    "city": "São Paulo",
    "state": "SP",
    "zipCode": "01310-100",
    "country": "BR",
    "lat": -23.5613,
    "lng": -46.6562,
    "placeId": "ChIJN1t_tDeuEmsRUsoyG83frY4"
  },
  "category": "general_clinic",
  "timezone": "America/Sao_Paulo",
  "locale": "pt-BR",
  "operatingHours": {
    "0": { "isOpen": false, "ranges": [] },
    "1": { "isOpen": true, "ranges": [{ "from": "08:00", "to": "18:00" }] },
    "2": { "isOpen": true, "ranges": [{ "from": "08:00", "to": "18:00" }] },
    "3": { "isOpen": true, "ranges": [{ "from": "08:00", "to": "18:00" }] },
    "4": { "isOpen": true, "ranges": [{ "from": "08:00", "to": "18:00" }] },
    "5": { "isOpen": true, "ranges": [{ "from": "08:00", "to": "17:00" }] },
    "6": { "isOpen": true, "ranges": [{ "from": "08:00", "to": "12:00" }] }
  },
  "paymentSettings": {
    "acceptsConvenio": true,
    "convenioList": ["Unimed", "Bradesco Saúde", "SulAmérica"],
    "acceptsParticular": true,
    "requiresDeposit": true,
    "depositPercentage": 30,
    "pix": {
      "type": "cnpj",
      "key": "12.345.678/0001-90"
    }
  },
  "whatsappConnected": false,
  "onboardingCompleted": true,
  "onboardingStepsCompleted": ["profile", "address", "hours", "payment"],
  "createdAt": "2026-02-04T10:00:00Z",
  "updatedAt": "2026-02-04T10:30:00Z"
}
```
