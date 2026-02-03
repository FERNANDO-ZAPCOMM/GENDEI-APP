# Plan: Patient Management

**Feature**: 007-patient-management
**Status**: Planning
**Date**: 2026-02-04

---

## Overview

Implement patient management with CRUD operations, search functionality, appointment history, CRM tags, and multi-clinic support. Patients can belong to multiple clinics.

---

## Technical Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16, React 19, TanStack Query 5 |
| Backend | Firebase Functions |
| Database | Firestore |

---

## Implementation Phases

### Phase 1: Data Model & API
- [ ] Define Patient interface
- [ ] Create Firestore collection
- [ ] Implement CRUD endpoints
- [ ] Add search functionality

### Phase 2: Patient List UI
- [ ] Create patient list page
- [ ] Build search component
- [ ] Add filter by tags
- [ ] Implement pagination

### Phase 3: Patient Detail
- [ ] Build patient profile view
- [ ] Show appointment history
- [ ] Add notes section
- [ ] Display CRM tags

### Phase 4: Multi-Clinic Support
- [ ] Handle clinicIds array
- [ ] Validate clinic access
- [ ] Cross-clinic queries

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /patients | List with search/filter |
| GET | /patients/:id | Get patient |
| POST | /patients | Create patient |
| PATCH | /patients/:id | Update patient |
| DELETE | /patients/:id | Soft delete |
| GET | /patients/:id/appointments | Patient's appointments |

---

## Data Model

```typescript
interface Patient {
  id: string;
  clinicIds: string[];  // Multi-clinic support

  // Personal info
  name: string;
  phone: string;
  email?: string;
  dateOfBirth?: string;
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

  // Stats
  totalAppointments: number;
  lastAppointmentAt?: Timestamp;

  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

---

## Search Implementation

```typescript
// Full-text search not native to Firestore
// Options: Algolia, Typesense, or client-side filtering

// Simple approach: Search by phone or name prefix
async function searchPatients(clinicId: string, query: string) {
  const byPhone = await db.collection('gendei_patients')
    .where('clinicIds', 'array-contains', clinicId)
    .where('phone', '>=', query)
    .where('phone', '<=', query + '\uf8ff')
    .limit(10)
    .get();

  const byName = await db.collection('gendei_patients')
    .where('clinicIds', 'array-contains', clinicId)
    .where('nameLower', '>=', query.toLowerCase())
    .where('nameLower', '<=', query.toLowerCase() + '\uf8ff')
    .limit(10)
    .get();

  // Merge and deduplicate
  return mergeResults(byPhone.docs, byName.docs);
}
```

---

## Success Metrics

- Search response time < 200ms
- Patient creation < 15 seconds
- Zero data duplication
