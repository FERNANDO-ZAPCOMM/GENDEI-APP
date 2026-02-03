# Research: Admin Portal

**Feature**: 011-admin-portal
**Date**: 2026-02-04

---

## Technical Decisions

### 1. Admin Portal Architecture

**Decision**: Separate Next.js application with shared components

**Options**:
| Approach | Pros | Cons | Decision |
|----------|------|------|----------|
| Separate app | Security isolation, different UI needs | Code duplication | **Selected** |
| Same app with admin routes | Shared code | Security risk, complexity | Rejected |
| Admin section in dashboard | Simple | Mixed concerns | Rejected |

**Why Separate App**:
- Clear security boundary
- Different deployment and access patterns
- Admin-specific UI components
- Easier to restrict access (different domain/subdomain)

### 2. Admin Authentication

**Decision**: Firebase Auth with custom claims

**Implementation**:
```typescript
// Custom claims on admin users
interface AdminClaims {
  admin: true;
  adminRole: 'super_admin' | 'admin' | 'support';
  permissions: string[];
}

// Set claims via Firebase Admin SDK
await admin.auth().setCustomUserClaims(uid, {
  admin: true,
  adminRole: 'super_admin',
  permissions: ['clinics.read', 'clinics.write', 'clinics.delete'],
});
```

### 3. Impersonation Strategy

**Decision**: Token-based temporary access with audit logging

**Flow**:
```
1. Admin requests impersonation for clinicId
2. System generates short-lived impersonation token (1 hour)
3. Admin is redirected to main app with impersonation context
4. All actions logged with original admin ID
5. Token automatically expires
```

### 4. Audit Logging

**Decision**: Firestore collection with structured events

**Events to Log**:
- Admin login/logout
- Clinic status changes
- Subscription updates
- Impersonation sessions
- Feature flag changes
- Data exports

---

## Admin Dashboard Sections

### 1. Overview Dashboard

```typescript
interface PlatformOverview {
  // Clinic metrics
  totalClinics: number;
  activeClinicLast30Days: number;
  newClinicsThisMonth: number;
  churnedClinicsThisMonth: number;

  // Appointment metrics
  totalAppointmentsThisMonth: number;
  appointmentsGrowth: number;  // percentage

  // Message metrics
  totalMessagesThisMonth: number;
  aiResponseRate: number;

  // Revenue metrics
  mrr: number;
  arr: number;
  averageRevenuePerClinic: number;
}
```

### 2. Clinic Management

```typescript
interface ClinicListFilters {
  status: 'all' | 'active' | 'trial' | 'suspended' | 'cancelled';
  plan: 'all' | 'starter' | 'professional' | 'enterprise';
  search: string;  // name, email, phone
  sortBy: 'createdAt' | 'lastActiveAt' | 'appointmentCount';
  sortOrder: 'asc' | 'desc';
}

interface ClinicAdminView {
  // Basic info
  id: string;
  name: string;
  ownerEmail: string;
  phone: string;

  // Status
  status: string;
  subscriptionPlan: string;
  subscriptionStatus: string;

  // Usage
  appointmentsThisMonth: number;
  messagesThisMonth: number;
  professionalsCount: number;

  // Timestamps
  createdAt: Timestamp;
  lastActiveAt: Timestamp;
}
```

### 3. Feature Flags

```typescript
interface FeatureFlag {
  id: string;
  name: string;
  description: string;
  enabled: boolean;

  // Targeting
  targetType: 'all' | 'percentage' | 'clinicIds' | 'plans';
  targetValue?: number | string[] | string;

  createdAt: Timestamp;
  updatedAt: Timestamp;
  updatedBy: string;
}

// Example flags
const FEATURE_FLAGS = {
  'new-calendar-ui': {
    enabled: true,
    targetType: 'percentage',
    targetValue: 25,  // 25% rollout
  },
  'ai-v2-model': {
    enabled: true,
    targetType: 'plans',
    targetValue: 'enterprise',
  },
  'beta-features': {
    enabled: true,
    targetType: 'clinicIds',
    targetValue: ['clinic_1', 'clinic_2'],
  },
};
```

---

## Subscription Plans

```typescript
interface SubscriptionPlan {
  id: 'starter' | 'professional' | 'enterprise';
  name: string;
  priceCents: number;
  billingPeriod: 'monthly' | 'yearly';

  // Limits
  professionals: number;
  monthlyAppointments: number;
  monthlyMessages: number;
  whatsappNumbers: number;

  // Features
  features: {
    aiAssistant: boolean;
    analytics: boolean;
    apiAccess: boolean;
    prioritySupport: boolean;
    customBranding: boolean;
  };
}

const PLANS: SubscriptionPlan[] = [
  {
    id: 'starter',
    name: 'Starter',
    priceCents: 9900,  // R$ 99,00
    billingPeriod: 'monthly',
    professionals: 2,
    monthlyAppointments: 100,
    monthlyMessages: 500,
    whatsappNumbers: 1,
    features: {
      aiAssistant: true,
      analytics: false,
      apiAccess: false,
      prioritySupport: false,
      customBranding: false,
    },
  },
  {
    id: 'professional',
    name: 'Professional',
    priceCents: 19900,  // R$ 199,00
    billingPeriod: 'monthly',
    professionals: 5,
    monthlyAppointments: 500,
    monthlyMessages: 2000,
    whatsappNumbers: 1,
    features: {
      aiAssistant: true,
      analytics: true,
      apiAccess: false,
      prioritySupport: false,
      customBranding: true,
    },
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    priceCents: 49900,  // R$ 499,00
    billingPeriod: 'monthly',
    professionals: -1,  // unlimited
    monthlyAppointments: -1,
    monthlyMessages: -1,
    whatsappNumbers: 3,
    features: {
      aiAssistant: true,
      analytics: true,
      apiAccess: true,
      prioritySupport: true,
      customBranding: true,
    },
  },
];
```

---

## Security Considerations

1. **Separate Domain**: admin.gendei.com.br
2. **IP Allowlist**: Restrict to known admin IPs
3. **2FA Required**: All admin accounts must have 2FA
4. **Session Timeout**: 30 minutes of inactivity
5. **Audit Everything**: Log all admin actions
6. **Impersonation Limits**: Max 1 hour, full audit trail

---

## References

- [Firebase Custom Claims](https://firebase.google.com/docs/auth/admin/custom-claims)
- [Admin Panel Best Practices](https://www.nngroup.com/articles/admin-interfaces/)
