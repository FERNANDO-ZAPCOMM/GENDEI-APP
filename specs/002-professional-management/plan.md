# Plan: Professional Management

**Feature**: 002-professional-management
**Status**: Planning
**Date**: 2026-02-04

---

## Overview

Implement a comprehensive healthcare professional management system that allows clinics to add, edit, and manage their medical staff. Each professional has configurable specialties, working hours, appointment durations, and consultation prices. The system supports photo uploads and active/inactive status management.

---

## Technical Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16 (App Router), React 19, TypeScript 5.7 |
| Styling | Tailwind CSS 4, shadcn/ui |
| State | TanStack Query 5 |
| Storage | Firebase Storage (photos) |
| Backend | Firebase Functions (Node.js 20, Express.js) |
| Database | Firestore (subcollection) |

---

## Implementation Phases

### Phase 1: Data Model & API Design
**Duration**: Foundation

**Tasks**:
- [ ] Define Professional TypeScript interface
- [ ] Create Zod validation schemas
- [ ] Design Firestore subcollection structure
- [ ] Set up Firestore security rules
- [ ] Create base API route structure

**Files**:
- `apps/web/src/types/professional.ts`
- `apps/web/src/schemas/professional.schema.ts`
- `apps/functions/src/routes/professionals.ts`
- `firestore.rules`

**Acceptance Criteria**:
- Professional interface covers all fields
- Validation schemas match API requirements
- Subcollection path: `gendei_clinics/{clinicId}/professionals/{professionalId}`

---

### Phase 2: Backend CRUD API
**Duration**: Core feature

**Tasks**:
- [ ] Implement GET /professionals (list)
- [ ] Implement GET /professionals/:id (single)
- [ ] Implement POST /professionals (create)
- [ ] Implement PATCH /professionals/:id (update)
- [ ] Implement DELETE /professionals/:id (soft delete)
- [ ] Add pagination support
- [ ] Add filtering by specialty/active status

**Files**:
- `apps/functions/src/controllers/professionalController.ts`
- `apps/functions/src/middleware/validateRequest.ts`

**API Endpoints**:
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /professionals | List all professionals |
| GET | /professionals/:id | Get single professional |
| POST | /professionals | Create professional |
| PATCH | /professionals/:id | Update professional |
| DELETE | /professionals/:id | Soft delete (deactivate) |

**Acceptance Criteria**:
- All CRUD operations functional
- Proper authorization (clinic owner/admin only)
- Pagination with cursor-based navigation
- Filtering by specialty and status

---

### Phase 3: Photo Upload System
**Duration**: Enhancement

**Tasks**:
- [ ] Configure Firebase Storage bucket
- [ ] Create signed upload URL endpoint
- [ ] Build photo upload component with preview
- [ ] Implement image resizing/optimization
- [ ] Add photo deletion on professional removal

**Files**:
- `apps/functions/src/controllers/uploadController.ts`
- `apps/web/src/components/professionals/PhotoUpload.tsx`
- `apps/functions/src/routes/uploads.ts`
- `storage.rules`

**Acceptance Criteria**:
- Photos upload to Firebase Storage
- Preview shows before saving
- Images optimized for web display
- Old photos cleaned up on update

---

### Phase 4: Professional Form UI
**Duration**: Core feature

**Tasks**:
- [ ] Create professional form component
- [ ] Build specialty selector (18+ options)
- [ ] Implement contact fields (email, phone)
- [ ] Add appointment duration selector
- [ ] Create price input with BRL formatting
- [ ] Build active/inactive toggle

**Files**:
- `apps/web/src/components/professionals/ProfessionalForm.tsx`
- `apps/web/src/components/professionals/SpecialtySelector.tsx`
- `apps/web/src/components/ui/PriceInput.tsx`

**Acceptance Criteria**:
- All fields validate before submit
- Specialty covers healthcare categories
- Price displays in BRL format (R$ XX,XX)
- Duration in 15-minute increments

---

### Phase 5: Working Hours Configuration
**Duration**: Core feature

**Tasks**:
- [ ] Design working hours data structure
- [ ] Create day selection grid
- [ ] Build time range pickers
- [ ] Support multiple ranges per day (breaks)
- [ ] Add "copy to all days" feature
- [ ] Validate against clinic operating hours

**Files**:
- `apps/web/src/components/professionals/WorkingHoursForm.tsx`
- `apps/web/src/components/ui/DaySelector.tsx`
- `apps/web/src/hooks/useWorkingHours.ts`

**Acceptance Criteria**:
- Each day can have different hours
- Support for lunch breaks
- Cannot exceed clinic operating hours
- Visual indication of selected days

---

### Phase 6: Professional List View
**Duration**: UI

**Tasks**:
- [ ] Create professional list/grid component
- [ ] Build professional card with photo
- [ ] Add search by name functionality
- [ ] Implement filter by specialty
- [ ] Add active/inactive filter
- [ ] Create empty state design

**Files**:
- `apps/web/src/app/[locale]/dashboard/professionals/page.tsx`
- `apps/web/src/components/professionals/ProfessionalList.tsx`
- `apps/web/src/components/professionals/ProfessionalCard.tsx`

**Acceptance Criteria**:
- Grid shows professional photos
- Search filters in real-time
- Filters persist in URL params
- Empty state guides user to add first professional

---

### Phase 7: Professional Detail/Edit View
**Duration**: UI

**Tasks**:
- [ ] Create professional detail page
- [ ] Build edit mode toggle
- [ ] Implement appointment history preview
- [ ] Add delete confirmation dialog
- [ ] Create stats summary (appointments, revenue)

**Files**:
- `apps/web/src/app/[locale]/dashboard/professionals/[id]/page.tsx`
- `apps/web/src/components/professionals/ProfessionalDetail.tsx`
- `apps/web/src/components/professionals/ProfessionalStats.tsx`

**Acceptance Criteria**:
- View mode shows all professional info
- Edit mode uses same form component
- Delete requires confirmation
- Stats show appointment metrics

---

### Phase 8: TanStack Query Integration
**Duration**: State management

**Tasks**:
- [ ] Create professional query hooks
- [ ] Implement optimistic updates
- [ ] Add cache invalidation on mutations
- [ ] Handle loading and error states
- [ ] Create prefetching for list → detail

**Files**:
- `apps/web/src/hooks/useProfessionals.ts`
- `apps/web/src/hooks/useProfessional.ts`
- `apps/web/src/lib/api/professionals.ts`

**Acceptance Criteria**:
- Data fetches efficiently with caching
- Mutations update UI optimistically
- Stale data revalidates in background
- Error states handled gracefully

---

## Data Model

### Firestore Subcollection: `gendei_clinics/{clinicId}/professionals/{professionalId}`

```typescript
interface Professional {
  id: string;
  clinicId: string;

  // Profile
  name: string;
  email: string;
  phone: string;
  specialty: ProfessionalSpecialty;
  bio?: string;

  // Photo
  photoUrl?: string;
  photoPath?: string;  // Storage path for deletion

  // Appointment Settings
  appointmentDuration: number;  // minutes (15, 30, 45, 60, etc.)
  consultationPrice: number;    // cents (BRL)

  // Working Schedule
  workingDays: number[];  // [1, 2, 3, 4, 5] = Mon-Fri
  workingHours: {
    [day: number]: {
      ranges: Array<{ from: string; to: string }>;
    };
  };

  // Status
  active: boolean;

  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

---

## Specialty Categories

```typescript
const PROFESSIONAL_SPECIALTIES = [
  'general_practitioner',  // Clínico Geral
  'dentist',               // Dentista
  'dermatologist',         // Dermatologista
  'cardiologist',          // Cardiologista
  'orthopedist',           // Ortopedista
  'gynecologist',          // Ginecologista
  'pediatrician',          // Pediatra
  'ophthalmologist',       // Oftalmologista
  'psychiatrist',          // Psiquiatra
  'psychologist',          // Psicólogo
  'physiotherapist',       // Fisioterapeuta
  'nutritionist',          // Nutricionista
  'endocrinologist',       // Endocrinologista
  'urologist',             // Urologista
  'neurologist',           // Neurologista
  'otolaryngologist',      // Otorrinolaringologista
  'veterinarian',          // Veterinário
  'aesthetician',          // Esteticista
  'nurse',                 // Enfermeiro(a)
  'other',                 // Outro
] as const;

type ProfessionalSpecialty = typeof PROFESSIONAL_SPECIALTIES[number];
```

---

## Security Considerations

1. **Authorization**: Only clinic owner/admin can manage professionals
2. **Photo Validation**: Validate file type and size before upload
3. **Storage Rules**: Photos accessible only to clinic members
4. **Soft Delete**: Professionals linked to appointments should deactivate, not delete
5. **Data Isolation**: Professionals scoped to clinic subcollection

---

## Testing Strategy

1. **Unit Tests**: Validation schemas, price formatting
2. **Integration Tests**: API endpoints with Firestore emulator
3. **E2E Tests**: Full CRUD flow with photo upload
4. **Manual Testing**: Image quality, mobile responsiveness

---

## Dependencies

- `@tanstack/react-query`
- `firebase/storage`
- `react-dropzone` (for photo upload)
- `sharp` (server-side image processing)
- `zod`

---

## Success Metrics

- Professional creation time < 2 minutes
- Photo upload success rate > 99%
- List load time < 500ms
- Search response time < 200ms
