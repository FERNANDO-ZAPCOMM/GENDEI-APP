# Data Model: Professional Management

**Feature**: 002-professional-management
**Date**: 2026-02-04

---

## Firestore Collections

### Subcollection: `gendei_clinics/{clinicId}/professionals`

**Path**: `gendei_clinics/{clinicId}/professionals/{professionalId}`

**Description**: Healthcare professionals associated with a clinic.

---

## TypeScript Interfaces

### Professional (Main Document)

```typescript
import { Timestamp } from 'firebase/firestore';

/**
 * Healthcare professional working at a clinic.
 * Stored as subcollection under the clinic document.
 */
interface Professional {
  /** Firestore document ID */
  id: string;

  /** Parent clinic ID (denormalized for queries) */
  clinicId: string;

  // ─────────────────────────────────────────────
  // Profile Information
  // ─────────────────────────────────────────────

  /** Professional's full name */
  name: string;

  /** Professional title (e.g., "Dr.", "Dra.") */
  title?: string;

  /** Council registration number (CRM, CRO, CRP, etc.) */
  crm?: string;

  /** Email address */
  email: string;

  /** Phone number */
  phone: string;

  /** Medical specialties (vertical-based IDs from verticals.ts) */
  specialties: string[];

  /** Optional bio/description */
  bio?: string;

  // ─────────────────────────────────────────────
  // Photo
  // ─────────────────────────────────────────────

  /** Public URL for the profile photo */
  photoUrl?: string;

  /** Firebase Storage path (for deletion) */
  photoPath?: string;

  // ─────────────────────────────────────────────
  // Appointment Settings
  // ─────────────────────────────────────────────

  /** Default appointment duration in minutes */
  appointmentDuration: number;

  /** Buffer time between appointments in minutes */
  bufferTime: number;

  /** Consultation price in BRL cents */
  consultationPrice: number;

  /** IDs of services this professional can perform */
  serviceIds: string[];

  // ─────────────────────────────────────────────
  // Working Schedule
  // ─────────────────────────────────────────────

  /** Days of the week this professional works (0-6) */
  workingDays: DayOfWeek[];

  /** Working hours per day */
  workingHours: ProfessionalWorkingHours;

  // ─────────────────────────────────────────────
  // Status
  // ─────────────────────────────────────────────

  /** Whether the professional is currently active */
  active: boolean;

  /** When the professional was deactivated (soft delete) */
  deactivatedAt?: Timestamp;

  // ─────────────────────────────────────────────
  // Metadata
  // ─────────────────────────────────────────────

  /** Document creation timestamp */
  createdAt: Timestamp;

  /** Last update timestamp */
  updatedAt: Timestamp;
}
```

---

### ProfessionalWorkingHours

```typescript
/**
 * Working hours configuration per day.
 * Only includes days the professional works.
 */
type ProfessionalWorkingHours = {
  [day in DayOfWeek]?: DayWorkingHours;
};

/**
 * Working hours for a single day.
 */
interface DayWorkingHours {
  /** Time ranges when available (supports breaks) */
  ranges: TimeRange[];
}

/**
 * A time range during which the professional is available.
 */
interface TimeRange {
  /** Start time in HH:MM format (24h) */
  from: string;

  /** End time in HH:MM format (24h) */
  to: string;
}

/** Day of week number (0-6, Sunday-Saturday) */
type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;
```

**Example**:
```typescript
const workingHours: ProfessionalWorkingHours = {
  1: { ranges: [{ from: '08:00', to: '12:00' }, { from: '14:00', to: '18:00' }] }, // Monday
  2: { ranges: [{ from: '08:00', to: '12:00' }, { from: '14:00', to: '18:00' }] }, // Tuesday
  3: { ranges: [{ from: '08:00', to: '12:00' }] }, // Wednesday (half day)
  4: { ranges: [{ from: '08:00', to: '12:00' }, { from: '14:00', to: '18:00' }] }, // Thursday
  5: { ranges: [{ from: '08:00', to: '12:00' }, { from: '14:00', to: '17:00' }] }, // Friday
  // No Saturday (6) or Sunday (0)
};
```

---

### Enums and Constants

> **Note**: Specialties are now defined per-vertical in `apps/frontend/lib/verticals.ts`. Each vertical (med, dental, psi, nutri, fisio) has its own specialty list. The static list below is kept for backward compatibility.

```typescript
/**
 * Healthcare professional specialties.
 */
const PROFESSIONAL_SPECIALTIES = [
  'general_practitioner',
  'dentist',
  'dermatologist',
  'cardiologist',
  'orthopedist',
  'gynecologist',
  'pediatrician',
  'ophthalmologist',
  'psychiatrist',
  'psychologist',
  'physiotherapist',
  'nutritionist',
  'endocrinologist',
  'urologist',
  'neurologist',
  'otolaryngologist',
  'veterinarian',
  'aesthetician',
  'nurse',
  'other',
] as const;

type ProfessionalSpecialty = typeof PROFESSIONAL_SPECIALTIES[number];

/**
 * Specialty display names (pt-BR).
 */
const SPECIALTY_LABELS: Record<ProfessionalSpecialty, string> = {
  general_practitioner: 'Clínico Geral',
  dentist: 'Dentista',
  dermatologist: 'Dermatologista',
  cardiologist: 'Cardiologista',
  orthopedist: 'Ortopedista',
  gynecologist: 'Ginecologista',
  pediatrician: 'Pediatra',
  ophthalmologist: 'Oftalmologista',
  psychiatrist: 'Psiquiatra',
  psychologist: 'Psicólogo(a)',
  physiotherapist: 'Fisioterapeuta',
  nutritionist: 'Nutricionista',
  endocrinologist: 'Endocrinologista',
  urologist: 'Urologista',
  neurologist: 'Neurologista',
  otolaryngologist: 'Otorrinolaringologista',
  veterinarian: 'Veterinário(a)',
  aesthetician: 'Esteticista',
  nurse: 'Enfermeiro(a)',
  other: 'Outro',
};

/**
 * Available appointment durations in minutes.
 */
const APPOINTMENT_DURATIONS = [15, 30, 45, 60, 90, 120] as const;

type AppointmentDuration = typeof APPOINTMENT_DURATIONS[number];

/**
 * Default values for new professionals.
 */
const PROFESSIONAL_DEFAULTS = {
  appointmentDuration: 30,
  consultationPrice: 15000, // R$ 150,00
  active: true,
} as const;
```

---

## Zod Validation Schemas

```typescript
import { z } from 'zod';

// ─────────────────────────────────────────────
// Time Range Schema
// ─────────────────────────────────────────────

const timeRangeSchema = z.object({
  from: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Formato HH:MM'),
  to: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Formato HH:MM'),
}).refine(data => data.from < data.to, {
  message: 'Horário de início deve ser antes do fim',
});

// ─────────────────────────────────────────────
// Working Hours Schema
// ─────────────────────────────────────────────

const dayWorkingHoursSchema = z.object({
  ranges: z.array(timeRangeSchema).min(1, 'Adicione pelo menos um horário'),
});

export const workingHoursSchema = z.record(
  z.enum(['0', '1', '2', '3', '4', '5', '6']),
  dayWorkingHoursSchema
);

// ─────────────────────────────────────────────
// Professional Create Schema
// ─────────────────────────────────────────────

export const createProfessionalSchema = z.object({
  name: z.string()
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .max(100, 'Nome muito longo'),

  email: z.string()
    .email('Email inválido'),

  phone: z.string()
    .min(10, 'Telefone deve ter pelo menos 10 dígitos')
    .max(15, 'Telefone muito longo'),

  specialties: z.array(z.string()).min(1, 'Selecione pelo menos uma especialidade'),

  bio: z.string()
    .max(500, 'Biografia muito longa')
    .optional(),

  appointmentDuration: z.number()
    .int()
    .min(15, 'Duração mínima: 15 minutos')
    .max(240, 'Duração máxima: 4 horas'),

  consultationPrice: z.number()
    .int()
    .min(0, 'Preço não pode ser negativo')
    .max(100000000, 'Preço muito alto'), // Max R$ 1.000.000,00

  workingDays: z.array(z.number().min(0).max(6))
    .min(1, 'Selecione pelo menos um dia'),

  workingHours: workingHoursSchema,
});

// ─────────────────────────────────────────────
// Professional Update Schema
// ─────────────────────────────────────────────

export const updateProfessionalSchema = createProfessionalSchema.partial().extend({
  active: z.boolean().optional(),
  photoUrl: z.string().url().optional(),
  photoPath: z.string().optional(),
});

// Type exports
export type CreateProfessionalInput = z.infer<typeof createProfessionalSchema>;
export type UpdateProfessionalInput = z.infer<typeof updateProfessionalSchema>;
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

    function isClinicMember(clinicId) {
      let clinic = get(/databases/$(database)/documents/gendei_clinics/$(clinicId)).data;
      return isAuthenticated() &&
        (clinic.ownerId == request.auth.uid || request.auth.uid in clinic.adminIds);
    }

    // Clinic rules (from 001)
    match /gendei_clinics/{clinicId} {
      allow read, write: if isClinicMember(clinicId);

      // Professional subcollection
      match /professionals/{professionalId} {
        // Only clinic members can read
        allow read: if isClinicMember(clinicId);

        // Only clinic members can create/update
        allow create, update: if isClinicMember(clinicId);

        // Only clinic members can delete (soft delete preferred)
        allow delete: if isClinicMember(clinicId);
      }
    }
  }
}
```

---

## Firebase Storage Rules

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {

    // Professional photos
    match /clinics/{clinicId}/professionals/{professionalId}/{fileName} {
      // Allow read if authenticated and clinic member
      allow read: if request.auth != null &&
        firestore.exists(/databases/(default)/documents/gendei_clinics/$(clinicId)/professionals/$(professionalId));

      // Allow write if authenticated, clinic member, and valid image
      allow write: if request.auth != null &&
        request.resource.size < 5 * 1024 * 1024 && // Max 5MB
        request.resource.contentType.matches('image/.*');
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
      "collectionGroup": "professionals",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "active", "order": "ASCENDING" },
        { "fieldPath": "name", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "professionals",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "specialty", "order": "ASCENDING" },
        { "fieldPath": "active", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "professionals",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "active", "order": "ASCENDING" },
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
  "id": "prof_abc123",
  "clinicId": "clinic_xyz789",
  "name": "Dra. Maria Silva",
  "email": "maria.silva@clinica.com",
  "phone": "11999887766",
  "specialties": ["dentist", "orthodontist"],
  "title": "Dra.",
  "crm": "CRO-SP 12345",
  "bio": "Especialista em ortodontia com 10 anos de experiência.",
  "photoUrl": "https://storage.googleapis.com/gendei.../photo.jpg",
  "photoPath": "clinics/clinic_xyz789/professionals/prof_abc123/photo.jpg",
  "appointmentDuration": 30,
  "bufferTime": 0,
  "consultationPrice": 20000,
  "serviceIds": ["svc_001", "svc_002"],
  "workingDays": [1, 2, 3, 4, 5],
  "workingHours": {
    "1": { "ranges": [{ "from": "08:00", "to": "12:00" }, { "from": "14:00", "to": "18:00" }] },
    "2": { "ranges": [{ "from": "08:00", "to": "12:00" }, { "from": "14:00", "to": "18:00" }] },
    "3": { "ranges": [{ "from": "08:00", "to": "12:00" }] },
    "4": { "ranges": [{ "from": "08:00", "to": "12:00" }, { "from": "14:00", "to": "18:00" }] },
    "5": { "ranges": [{ "from": "08:00", "to": "12:00" }, { "from": "14:00", "to": "17:00" }] }
  },
  "active": true,
  "createdAt": "2026-02-04T10:00:00Z",
  "updatedAt": "2026-02-04T10:00:00Z"
}
```

---

## Query Patterns

### List Active Professionals

```typescript
const snapshot = await db
  .collection('gendei_clinics')
  .doc(clinicId)
  .collection('professionals')
  .where('active', '==', true)
  .orderBy('name')
  .get();
```

### Filter by Specialty

```typescript
// Uses array-contains to match professionals with a given specialty
const snapshot = await db
  .collection('gendei_clinics')
  .doc(clinicId)
  .collection('professionals')
  .where('specialties', 'array-contains', 'dentist')
  .where('active', '==', true)
  .get();
```

### Get Professional with Working Hours for Day

```typescript
const professional = await db
  .collection('gendei_clinics')
  .doc(clinicId)
  .collection('professionals')
  .doc(professionalId)
  .get();

const data = professional.data();
const mondayHours = data?.workingHours?.[1]; // Day 1 = Monday
```
