# Plan: Clinic Onboarding

**Feature**: 001-clinic-onboarding
**Status**: Implemented
**Date**: 2026-02-04

---

## Overview

Implement a comprehensive clinic onboarding system that allows healthcare providers to register, configure their clinic profile, set operating hours, and prepare for appointment scheduling. The system supports both email/password and Google Sign-In authentication with full i18n support for Brazilian Portuguese and English.

---

## Technical Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16 (App Router), React 19, TypeScript 5.7 |
| Styling | Tailwind CSS 4, shadcn/ui |
| Forms | React Hook Form 7, Zod 3 |
| Auth | Firebase Authentication |
| Database | Firestore |
| Backend | Firebase Functions (Node.js 20, Express.js) |
| i18n | next-intl (pt-BR, en) |
| Maps | Google Maps Places API |

---

## Implementation Phases

### Phase 1: Authentication Setup
**Duration**: Foundation

**Tasks**:
- [ ] Configure Firebase Authentication project
- [ ] Implement email/password sign-up flow
- [ ] Implement Google Sign-In OAuth flow
- [ ] Create authentication context provider
- [ ] Build protected route middleware
- [ ] Design login/register UI components

**Files**:
- `apps/web/src/lib/firebase.ts`
- `apps/web/src/contexts/AuthContext.tsx`
- `apps/web/src/app/[locale]/(auth)/login/page.tsx`
- `apps/web/src/app/[locale]/(auth)/register/page.tsx`
- `apps/web/src/middleware.ts`

**Acceptance Criteria**:
- Users can register with email/password
- Users can sign in with Google
- Session persists across page refreshes
- Protected routes redirect to login

---

### Phase 2: Clinic Profile Form
**Duration**: Core feature

**Tasks**:
- [ ] Create clinic profile Zod schema
- [ ] Build multi-step onboarding wizard
- [ ] Implement clinic name and description fields
- [ ] Add CNPJ validation and formatting
- [ ] Integrate phone number input with mask
- [ ] Create vertical selector (med, dental, psi, nutri, fisio)

**Files**:
- `apps/web/src/schemas/clinic.schema.ts`
- `apps/web/src/app/[locale]/onboarding/page.tsx`
- `apps/web/src/components/onboarding/ClinicProfileForm.tsx`
- `apps/web/src/components/onboarding/VerticalSelector.tsx`

**Acceptance Criteria**:
- All fields validate according to business rules
- CNPJ follows XX.XXX.XXX/XXXX-XX format
- Phone accepts Brazilian format with DDD
- Verticals cover core healthcare segments (med, dental, psi, nutri, fisio)

---

### Phase 3: Google Maps Integration
**Duration**: Enhancement

**Tasks**:
- [ ] Set up Google Maps Places API credentials
- [ ] Create address autocomplete component
- [ ] Parse and store structured address data
- [ ] Display selected address on map preview
- [ ] Handle address components (street, city, state, zip)

**Files**:
- `apps/web/src/components/maps/AddressAutocomplete.tsx`
- `apps/web/src/components/maps/MapPreview.tsx`
- `apps/web/src/lib/google-maps.ts`

**Acceptance Criteria**:
- Address autocomplete suggests Brazilian addresses
- Selected address populates all fields
- Map preview shows clinic location
- Address stored in structured format

---

### Phase 4: Greeting & Workflow Configuration
**Duration**: Core feature

> **Note**: Operating hours are configured per-professional (see spec 002), not per-clinic.

**Tasks**:
- [ ] Create greeting summary field (AI greeting context)
- [ ] Build workflow mode selector ("booking" for scheduling, "info" for informational)
- [ ] Implement description field (mandatory, used by AI agents)

**Files**:
- `apps/frontend/app/[locale]/dashboard/clinic/page.tsx`
- `apps/frontend/components/clinic/ClinicSettingsForm.tsx`

**Acceptance Criteria**:
- Greeting summary saved and used by AI agents
- Workflow mode toggles agent behavior
- Description is mandatory and informs AI context

---

### Phase 5: Payment Settings (PIX)
**Duration**: Optional feature

**Tasks**:
- [ ] Create PIX key input with validation
- [ ] Implement double-entry verification for PIX
- [ ] Add deposit percentage slider (10-100%)
- [ ] Build health insurance (convênio) selector
- [ ] Create payment settings summary view

**Files**:
- `apps/web/src/components/onboarding/PaymentSettingsForm.tsx`
- `apps/web/src/schemas/payment.schema.ts`
- `apps/web/src/components/ui/PercentageSlider.tsx`

**Acceptance Criteria**:
- PIX key validates (CPF, CNPJ, email, phone, random)
- Double-entry confirmation prevents typos
- Deposit percentage configurable
- Convênio list is customizable

---

### Phase 6: Backend API Endpoints
**Duration**: Backend

**Tasks**:
- [ ] Create POST /clinics endpoint (auto-create)
- [ ] Implement PATCH /clinics/me endpoint
- [ ] Build GET /clinics/me endpoint
- [ ] Add PUT /clinics/:id/settings/:key endpoint
- [ ] Implement Firestore security rules
- [ ] Add request validation middleware

**Files**:
- `apps/functions/src/routes/clinics.ts`
- `apps/functions/src/controllers/clinicController.ts`
- `apps/functions/src/middleware/validateRequest.ts`
- `firestore.rules`

**API Endpoints**:
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /clinics | Create clinic (auto on first access) |
| PATCH | /clinics/me | Update current user's clinic |
| GET | /clinics/me | Get current user's clinic |
| PUT | /clinics/:id/settings/:key | Update specific setting |

**Acceptance Criteria**:
- All endpoints require authentication
- Clinic auto-creates on first access
- Settings update atomically
- Proper error responses

---

### Phase 7: Timezone & Localization
**Duration**: Enhancement

**Tasks**:
- [ ] Configure next-intl for pt-BR and en
- [ ] Create timezone selector component
- [ ] Set default timezone (America/Sao_Paulo)
- [ ] Translate all onboarding content
- [ ] Format dates/times per locale

**Files**:
- `apps/web/src/i18n/request.ts`
- `apps/web/src/messages/pt-BR.json`
- `apps/web/src/messages/en.json`
- `apps/web/src/components/ui/TimezoneSelector.tsx`

**Acceptance Criteria**:
- UI adapts to selected locale
- All strings externalized
- Timezone affects time displays
- Date formats match locale

---

### Phase 8: Onboarding Flow UX
**Duration**: Polish

**Tasks**:
- [ ] Create stepper/progress indicator
- [ ] Implement form state persistence
- [ ] Add skip optional steps feature
- [ ] Build success/completion screen
- [ ] Create onboarding status tracking

**Files**:
- `apps/web/src/components/onboarding/OnboardingStepper.tsx`
- `apps/web/src/components/onboarding/CompletionScreen.tsx`
- `apps/web/src/hooks/useOnboardingState.ts`

**Acceptance Criteria**:
- Progress visible throughout flow
- State survives page refresh
- Optional steps can be skipped
- Clear completion confirmation

---

## Data Model

### Firestore Collection: `gendei_clinics/{clinicId}`

```typescript
interface Clinic {
  id: string;
  ownerId: string;
  adminIds: string[];

  // Profile
  name: string;
  description: string;           // Mandatory — used by AI agents
  cnpj?: string;
  phone: string;
  email?: string;

  // Address
  address: string;               // Flat string (or structured ClinicAddress)
  city: string;
  state: string;
  zipCode: string;

  // Vertical SaaS
  vertical: string;              // 'med' | 'dental' | 'psi' | 'nutri' | 'fisio' | 'geral'

  // AI & Workflow
  greetingSummary: string;       // Context for AI greeting agent
  workflowMode: string;          // 'booking' | 'info'

  // Settings
  timezone: string;              // Default: 'America/Sao_Paulo'
  locale: 'pt-BR' | 'en';

  // Payment
  paymentSettings: Record<string, any>;
  paymentGateway: string;        // 'pagseguro'
  pagseguroToken?: string;
  pixKey?: string;
  signalPercentage: number;      // Default deposit % (e.g., 15)

  // WhatsApp (populated by 004)
  whatsappConnected: boolean;
  whatsappPhoneNumberId?: string;
  whatsappWabaId?: string;
  whatsappAccessToken?: string;
  whatsappConfig: Record<string, any>;

  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

> **Note**: Operating hours are NOT on the Clinic model. They are configured per-professional (see spec 002). The `category` field exists for backward compatibility but is replaced by `vertical`.

---

## Security Considerations

1. **Authentication**: All endpoints require valid Firebase Auth token
2. **Authorization**: Users can only access their own clinic
3. **CNPJ Validation**: Server-side validation against Receita Federal format
4. **PIX Key Security**: Stored securely, not exposed in API responses
5. **Rate Limiting**: Prevent abuse of clinic creation endpoint

---

## Testing Strategy

1. **Unit Tests**: Zod schemas, validation functions
2. **Integration Tests**: API endpoints with Firestore emulator
3. **E2E Tests**: Complete onboarding flow with Playwright
4. **Manual Testing**: Google Sign-In, Maps integration

---

## Dependencies

- `firebase` / `firebase-admin`
- `react-hook-form`
- `zod`
- `@hookform/resolvers`
- `next-intl`
- `@react-google-maps/api`
- `shadcn/ui` components

---

## Success Metrics

- Onboarding completion rate > 80%
- Average completion time < 10 minutes
- Form validation error rate < 5%
- Google Maps address accuracy > 95%
