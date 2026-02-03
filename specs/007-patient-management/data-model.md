# Data Model: Patient Management

**Feature**: 007-patient-management
**Date**: 2026-02-04

---

## Firestore Collection

**Path**: `gendei_patients/{patientId}`

---

## TypeScript Interface

```typescript
import { Timestamp } from 'firebase/firestore';

interface Patient {
  id: string;

  // Clinic association (multi-clinic support)
  clinicIds: string[];

  // Personal information
  name: string;
  nameLower: string;  // For search
  phone: string;
  email?: string;
  dateOfBirth?: string;  // YYYY-MM-DD
  cpf?: string;

  // Address
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;

  // WhatsApp
  whatsappPhone?: string;

  // CRM
  notes?: string;
  tags: string[];

  // Statistics
  totalAppointments: number;
  lastAppointmentAt?: Timestamp;
  completedAppointments: number;
  cancelledAppointments: number;
  noShowCount: number;

  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy?: string;
}
```

---

## Zod Schema

```typescript
import { z } from 'zod';

export const createPatientSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  phone: z.string().min(10, 'Telefone inválido'),
  email: z.string().email().optional().or(z.literal('')),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  cpf: z.string().regex(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/).optional().or(z.literal('')),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).default([]),
});

export type CreatePatientInput = z.infer<typeof createPatientSchema>;
```

---

## Indexes

```json
{
  "indexes": [
    {
      "collectionGroup": "gendei_patients",
      "fields": [
        { "fieldPath": "clinicIds", "arrayConfig": "CONTAINS" },
        { "fieldPath": "name", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "gendei_patients",
      "fields": [
        { "fieldPath": "clinicIds", "arrayConfig": "CONTAINS" },
        { "fieldPath": "phone", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "gendei_patients",
      "fields": [
        { "fieldPath": "clinicIds", "arrayConfig": "CONTAINS" },
        { "fieldPath": "lastAppointmentAt", "order": "DESCENDING" }
      ]
    }
  ]
}
```

---

## Example Document

```json
{
  "id": "patient_abc123",
  "clinicIds": ["clinic_001", "clinic_002"],
  "name": "Maria Silva",
  "nameLower": "maria silva",
  "phone": "+5511999998888",
  "email": "maria@email.com",
  "dateOfBirth": "1990-05-15",
  "cpf": "123.456.789-00",
  "address": "Rua das Flores, 100",
  "city": "São Paulo",
  "state": "SP",
  "zipCode": "01310-100",
  "whatsappPhone": "+5511999998888",
  "notes": "Alergia a dipirona",
  "tags": ["vip", "recorrente"],
  "totalAppointments": 12,
  "lastAppointmentAt": "2026-01-15T10:00:00Z",
  "completedAppointments": 10,
  "cancelledAppointments": 1,
  "noShowCount": 1,
  "createdAt": "2025-01-01T10:00:00Z",
  "updatedAt": "2026-01-15T10:00:00Z"
}
```

---

## Query Patterns

### Search by phone
```typescript
const patients = await db.collection('gendei_patients')
  .where('clinicIds', 'array-contains', clinicId)
  .where('phone', '==', phone)
  .limit(1)
  .get();
```

### Get patients with tag
```typescript
const patients = await db.collection('gendei_patients')
  .where('clinicIds', 'array-contains', clinicId)
  .where('tags', 'array-contains', 'vip')
  .orderBy('name')
  .get();
```

### Get patient appointments
```typescript
const appointments = await db.collection('gendei_appointments')
  .where('patientId', '==', patientId)
  .orderBy('date', 'desc')
  .limit(20)
  .get();
```
