# Plan: Service Management

**Feature**: 003-service-management
**Status**: Planning
**Date**: 2026-02-04

---

## Overview

Implement a service management system that allows clinics to define the medical services they offer. Each service has a name, description, price, duration, and deposit percentage. Services can be assigned to multiple professionals and support soft deletion (deactivation).

---

## Technical Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16 (App Router), React 19, TypeScript 5.7 |
| Styling | Tailwind CSS 4, shadcn/ui |
| State | TanStack Query 5 |
| Backend | Firebase Functions (Node.js 20, Express.js) |
| Database | Firestore (subcollection) |

---

## Implementation Phases

### Phase 1: Data Model & Schema
**Duration**: Foundation

**Tasks**:
- [ ] Define Service TypeScript interface
- [ ] Create Zod validation schemas
- [ ] Design Firestore subcollection structure
- [ ] Update Firestore security rules

**Files**:
- `apps/web/src/types/service.ts`
- `apps/web/src/schemas/service.schema.ts`
- `firestore.rules`

**Acceptance Criteria**:
- Service interface covers all required fields
- Price stored in cents (integer)
- Duration in minutes
- Professional IDs as array reference

---

### Phase 2: Backend CRUD API
**Duration**: Core feature

**Tasks**:
- [ ] Implement GET /services endpoint
- [ ] Implement GET /services/:id endpoint
- [ ] Implement POST /services endpoint
- [ ] Implement PUT /services/:id endpoint
- [ ] Implement DELETE /services/:id (soft delete)
- [ ] Add professional validation on create/update

**Files**:
- `apps/functions/src/routes/services.ts`
- `apps/functions/src/controllers/serviceController.ts`

**API Endpoints**:
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /services | List all services |
| GET | /services/:id | Get single service |
| POST | /services | Create service |
| PUT | /services/:id | Update service |
| DELETE | /services/:id | Soft delete (deactivate) |

**Acceptance Criteria**:
- All CRUD operations functional
- Professional IDs validated against clinic's professionals
- Soft delete sets `active: false`

---

### Phase 3: Service Form UI
**Duration**: Core feature

**Tasks**:
- [ ] Create service form component
- [ ] Build name and description inputs
- [ ] Implement price input with BRL formatting
- [ ] Add duration selector (15-minute increments)
- [ ] Create deposit percentage slider (10-100%)
- [ ] Build professional multi-select

**Files**:
- `apps/web/src/components/services/ServiceForm.tsx`
- `apps/web/src/components/services/ProfessionalMultiSelect.tsx`
- `apps/web/src/components/ui/PercentageSlider.tsx`

**Acceptance Criteria**:
- Price displays as R$ XX,XX
- Duration in 15-minute increments
- Deposit percentage with visual slider
- Multi-select shows professional names with photos

---

### Phase 4: Service List View
**Duration**: UI

**Tasks**:
- [ ] Create services list page
- [ ] Build service card component
- [ ] Add search functionality
- [ ] Implement filter by professional
- [ ] Add active/inactive filter
- [ ] Create empty state

**Files**:
- `apps/web/src/app/[locale]/dashboard/services/page.tsx`
- `apps/web/src/components/services/ServiceList.tsx`
- `apps/web/src/components/services/ServiceCard.tsx`

**Acceptance Criteria**:
- Cards display service name, price, duration
- Shows assigned professionals
- Search filters by name
- Empty state prompts to add service

---

### Phase 5: Service Detail/Edit
**Duration**: UI

**Tasks**:
- [ ] Create service detail page
- [ ] Build view/edit mode toggle
- [ ] Add delete confirmation dialog
- [ ] Show appointment count for service
- [ ] Prevent deletion if active appointments exist

**Files**:
- `apps/web/src/app/[locale]/dashboard/services/[id]/page.tsx`
- `apps/web/src/components/services/ServiceDetail.tsx`

**Acceptance Criteria**:
- Detail view shows full service info
- Edit mode reuses form component
- Delete warns if appointments exist
- Stats show service usage

---

### Phase 6: TanStack Query Integration
**Duration**: State management

**Tasks**:
- [ ] Create service query hooks
- [ ] Implement optimistic updates
- [ ] Add cache invalidation
- [ ] Handle loading/error states

**Files**:
- `apps/web/src/hooks/useServices.ts`
- `apps/web/src/hooks/useService.ts`
- `apps/web/src/lib/api/services.ts`

**Acceptance Criteria**:
- Data caching with 5-minute stale time
- Optimistic UI updates on mutations
- Proper error handling

---

## Data Model

### Firestore Subcollection: `gendei_clinics/{clinicId}/services/{serviceId}`

```typescript
interface Service {
  id: string;
  clinicId: string;

  // Basic Info
  name: string;
  description?: string;

  // Pricing
  priceCents: number;          // Price in BRL cents
  signalPercentage: number;    // Deposit percentage (10-100)

  // Duration
  durationMinutes: number;     // Service duration in minutes

  // Professionals
  professionalIds: string[];   // IDs of professionals who offer this service

  // Status
  active: boolean;
  deactivatedAt?: Timestamp;

  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

---

## Business Rules

1. **Price**: Stored in cents, minimum R$ 0,00 (free services allowed)
2. **Deposit**: Percentage 10-100%, default 30%
3. **Duration**: 15-240 minutes, in 15-minute increments
4. **Professionals**: At least one professional required
5. **Deletion**: Soft delete only; hard delete blocked if appointments exist

---

## Security Considerations

1. **Authorization**: Only clinic owner/admin can manage services
2. **Professional Validation**: Only clinic's professionals can be assigned
3. **Price Integrity**: Server validates price is non-negative integer
4. **Referential Integrity**: Check appointments before hard delete

---

## Testing Strategy

1. **Unit Tests**: Price formatting, validation schemas
2. **Integration Tests**: API endpoints with emulator
3. **E2E Tests**: Create/edit/delete service flow
4. **Manual Testing**: Professional multi-select, deposit slider

---

## Dependencies

- `@tanstack/react-query` (already installed)
- `zod` (already installed)
- `shadcn/ui` Slider component

---

## Success Metrics

- Service creation time < 1 minute
- List load time < 300ms
- Zero data integrity issues
