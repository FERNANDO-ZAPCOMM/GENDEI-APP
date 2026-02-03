# Plan: Admin Portal

**Feature**: 011-admin-portal
**Status**: Planning
**Date**: 2026-02-04

---

## Overview

Implement a super-admin portal for Gendei platform management, including clinic management, subscription billing, system analytics, feature flags, and support tools.

---

## Technical Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16 (separate app) |
| Auth | Firebase Auth (admin claims) |
| Backend | Firebase Functions |
| Database | Firestore |
| Analytics | Custom aggregations |

---

## Key Features

1. Clinic lifecycle management (approve, suspend, delete)
2. Subscription and billing management
3. Platform-wide analytics dashboard
4. Feature flags and A/B testing
5. Support tools (impersonation, logs)
6. System health monitoring
7. Audit logs

---

## Access Levels

| Role | Permissions |
|------|-------------|
| super_admin | Full access, billing, delete |
| admin | Clinic management, analytics |
| support | Read-only, impersonation |

---

## User Flow

```
1. Admin logs in with admin credentials
2. Dashboard shows platform overview
3. Navigate to specific section:
   - Clinics: manage clinic accounts
   - Subscriptions: billing management
   - Analytics: platform metrics
   - Settings: feature flags
   - Support: troubleshooting tools
```

---

## Data Model

### Admin User

```typescript
interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: 'super_admin' | 'admin' | 'support';
  permissions: string[];
  createdAt: Timestamp;
  lastLoginAt: Timestamp;
}
```

### Clinic Status Extensions

```typescript
interface ClinicAdminFields {
  // Subscription
  subscriptionStatus: 'trial' | 'active' | 'past_due' | 'cancelled';
  subscriptionPlan: 'starter' | 'professional' | 'enterprise';
  trialEndsAt?: Timestamp;
  subscriptionEndsAt?: Timestamp;

  // Admin flags
  verified: boolean;
  suspended: boolean;
  suspendedReason?: string;
  suspendedAt?: Timestamp;

  // Limits
  messageQuota: number;
  messageUsed: number;
  appointmentQuota: number;
}
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /admin/clinics | List all clinics |
| GET | /admin/clinics/:id | Get clinic details |
| PATCH | /admin/clinics/:id | Update clinic |
| POST | /admin/clinics/:id/suspend | Suspend clinic |
| POST | /admin/clinics/:id/unsuspend | Unsuspend clinic |
| DELETE | /admin/clinics/:id | Delete clinic |
| GET | /admin/analytics/overview | Platform metrics |
| GET | /admin/analytics/usage | Usage statistics |
| POST | /admin/impersonate/:clinicId | Impersonate clinic |
| GET | /admin/audit-logs | View audit logs |
| PUT | /admin/feature-flags | Update feature flags |

---

## Success Metrics

- Admin task completion < 30 seconds
- Zero unauthorized access
- Complete audit trail
- Real-time analytics updates
