# Data Model: Service Management

**Feature**: 003-service-management
**Date**: 2026-02-04

---

## Firestore Collections

### Subcollection: `gendei_clinics/{clinicId}/services`

**Path**: `gendei_clinics/{clinicId}/services/{serviceId}`

**Description**: Medical services offered by the clinic.

---

## TypeScript Interfaces

### Service (Main Document)

```typescript
import { Timestamp } from 'firebase/firestore';

/**
 * Medical service offered by a clinic.
 * Stored as subcollection under the clinic document.
 */
interface Service {
  /** Firestore document ID */
  id: string;

  /** Parent clinic ID (denormalized for queries) */
  clinicId: string;

  // ─────────────────────────────────────────────
  // Basic Information
  // ─────────────────────────────────────────────

  /** Service name */
  name: string;

  /** Optional service description */
  description?: string;

  // ─────────────────────────────────────────────
  // Pricing
  // ─────────────────────────────────────────────

  /** Service price in BRL cents */
  priceCents: number;

  /** Deposit/signal percentage required (10-100) */
  signalPercentage: number;

  // ─────────────────────────────────────────────
  // Duration
  // ─────────────────────────────────────────────

  /** Service duration in minutes */
  durationMinutes: number;

  // ─────────────────────────────────────────────
  // Professionals
  // ─────────────────────────────────────────────

  /** IDs of professionals who offer this service */
  professionalIds: string[];

  // ─────────────────────────────────────────────
  // Status
  // ─────────────────────────────────────────────

  /** Whether the service is currently active */
  active: boolean;

  /** When the service was deactivated (soft delete) */
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

### ServiceWithProfessionals (Enriched)

```typescript
/**
 * Service with resolved professional information.
 * Used for display in UI.
 */
interface ServiceWithProfessionals extends Service {
  /** Resolved professional objects */
  professionals: Array<{
    id: string;
    name: string;
    photoUrl?: string;
    specialty: string;
  }>;
}
```

---

### Constants

```typescript
/**
 * Available service durations in minutes.
 */
const SERVICE_DURATIONS = [
  15, 30, 45, 60, 90, 120, 150, 180, 240
] as const;

type ServiceDuration = typeof SERVICE_DURATIONS[number];

/**
 * Duration display labels.
 */
const DURATION_LABELS: Record<ServiceDuration, string> = {
  15: '15 minutos',
  30: '30 minutos',
  45: '45 minutos',
  60: '1 hora',
  90: '1h 30min',
  120: '2 horas',
  150: '2h 30min',
  180: '3 horas',
  240: '4 horas',
};

/**
 * Deposit percentage constraints.
 */
const DEPOSIT_CONSTRAINTS = {
  min: 10,
  max: 100,
  default: 30,
  step: 5,
} as const;

/**
 * Default values for new services.
 */
const SERVICE_DEFAULTS = {
  priceCents: 10000,        // R$ 100,00
  signalPercentage: 30,     // 30% deposit
  durationMinutes: 30,      // 30 minutes
  active: true,
} as const;
```

---

## Zod Validation Schemas

```typescript
import { z } from 'zod';

// ─────────────────────────────────────────────
// Create Service Schema
// ─────────────────────────────────────────────

export const createServiceSchema = z.object({
  name: z.string()
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .max(100, 'Nome muito longo'),

  description: z.string()
    .max(500, 'Descrição muito longa')
    .optional()
    .or(z.literal('')),

  priceCents: z.number()
    .int('Preço deve ser um valor inteiro')
    .min(0, 'Preço não pode ser negativo')
    .max(100000000, 'Preço muito alto'), // Max R$ 1.000.000,00

  signalPercentage: z.number()
    .int()
    .min(10, 'Sinal mínimo: 10%')
    .max(100, 'Sinal máximo: 100%'),

  durationMinutes: z.number()
    .int()
    .min(15, 'Duração mínima: 15 minutos')
    .max(240, 'Duração máxima: 4 horas')
    .refine(
      (val) => val % 15 === 0,
      'Duração deve ser múltiplo de 15 minutos'
    ),

  professionalIds: z.array(z.string())
    .min(1, 'Selecione pelo menos um profissional'),
});

// ─────────────────────────────────────────────
// Update Service Schema
// ─────────────────────────────────────────────

export const updateServiceSchema = createServiceSchema.partial().extend({
  active: z.boolean().optional(),
});

// ─────────────────────────────────────────────
// Type Exports
// ─────────────────────────────────────────────

export type CreateServiceInput = z.infer<typeof createServiceSchema>;
export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;
```

---

## Firestore Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Helper functions (from previous specs)
    function isAuthenticated() {
      return request.auth != null;
    }

    function isClinicMember(clinicId) {
      let clinic = get(/databases/$(database)/documents/gendei_clinics/$(clinicId)).data;
      return isAuthenticated() &&
        (clinic.ownerId == request.auth.uid || request.auth.uid in clinic.adminIds);
    }

    // Clinic and subcollections
    match /gendei_clinics/{clinicId} {
      allow read, write: if isClinicMember(clinicId);

      // Services subcollection
      match /services/{serviceId} {
        // Only clinic members can read
        allow read: if isClinicMember(clinicId);

        // Only clinic members can create
        allow create: if isClinicMember(clinicId) &&
          request.resource.data.priceCents >= 0 &&
          request.resource.data.signalPercentage >= 10 &&
          request.resource.data.signalPercentage <= 100 &&
          request.resource.data.durationMinutes >= 15 &&
          request.resource.data.professionalIds.size() >= 1;

        // Only clinic members can update
        allow update: if isClinicMember(clinicId);

        // Only clinic members can delete
        allow delete: if isClinicMember(clinicId);
      }
    }
  }
}
```

---

## Indexes

```json
{
  "indexes": [
    {
      "collectionGroup": "services",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "active", "order": "ASCENDING" },
        { "fieldPath": "name", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "services",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "professionalIds", "arrayConfig": "CONTAINS" },
        { "fieldPath": "active", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "services",
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
  "id": "svc_abc123",
  "clinicId": "clinic_xyz789",
  "name": "Limpeza Dental",
  "description": "Limpeza completa com remoção de tártaro e polimento",
  "priceCents": 15000,
  "signalPercentage": 30,
  "durationMinutes": 45,
  "professionalIds": ["prof_001", "prof_002"],
  "active": true,
  "createdAt": "2026-02-04T10:00:00Z",
  "updatedAt": "2026-02-04T10:00:00Z"
}
```

---

## Query Patterns

### List Active Services

```typescript
const snapshot = await db
  .collection('gendei_clinics')
  .doc(clinicId)
  .collection('services')
  .where('active', '==', true)
  .orderBy('name')
  .get();
```

### Services by Professional

```typescript
const snapshot = await db
  .collection('gendei_clinics')
  .doc(clinicId)
  .collection('services')
  .where('professionalIds', 'array-contains', professionalId)
  .where('active', '==', true)
  .get();
```

### Service with Professional Details

```typescript
async function getServiceWithProfessionals(
  clinicId: string,
  serviceId: string
): Promise<ServiceWithProfessionals | null> {
  const serviceDoc = await db
    .collection('gendei_clinics')
    .doc(clinicId)
    .collection('services')
    .doc(serviceId)
    .get();

  if (!serviceDoc.exists) return null;

  const service = { id: serviceDoc.id, ...serviceDoc.data() } as Service;

  // Fetch professionals
  const profDocs = await Promise.all(
    service.professionalIds.map(id =>
      db.collection('gendei_clinics')
        .doc(clinicId)
        .collection('professionals')
        .doc(id)
        .get()
    )
  );

  const professionals = profDocs
    .filter(doc => doc.exists)
    .map(doc => ({
      id: doc.id,
      name: doc.data()!.name,
      photoUrl: doc.data()!.photoUrl,
      specialty: doc.data()!.specialty,
    }));

  return { ...service, professionals };
}
```

---

## Utility Functions

### Price Formatting

```typescript
/**
 * Format cents as BRL currency string.
 */
export function formatPrice(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

/**
 * Parse BRL string to cents.
 */
export function parsePriceToCents(value: string): number {
  const cleaned = value.replace(/[^\d,]/g, '');
  const [reais, centavos = '00'] = cleaned.split(',');
  return parseInt(reais || '0') * 100 + parseInt(centavos.slice(0, 2).padEnd(2, '0'));
}
```

### Deposit Calculation

```typescript
/**
 * Calculate deposit amount in cents.
 */
export function calculateDeposit(priceCents: number, signalPercentage: number): number {
  return Math.round((priceCents * signalPercentage) / 100);
}

/**
 * Format deposit for display.
 */
export function formatDeposit(priceCents: number, signalPercentage: number): string {
  const depositCents = calculateDeposit(priceCents, signalPercentage);
  return `${formatPrice(depositCents)} (${signalPercentage}%)`;
}
```

### Duration Formatting

```typescript
/**
 * Format minutes as readable duration.
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} minutos`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}min`;
}
```
