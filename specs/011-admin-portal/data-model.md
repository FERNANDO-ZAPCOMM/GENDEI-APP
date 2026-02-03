# Data Model: Admin Portal

**Feature**: 011-admin-portal
**Date**: 2026-02-04

---

## Collections Overview

```
gendei_admin_users (top-level)
├── {adminUserId}

gendei_audit_logs (top-level)
├── {logId}

gendei_feature_flags (top-level)
├── {flagId}

gendei_platform_analytics (top-level)
├── {date}

gendei_impersonation_sessions (top-level)
├── {sessionId}
```

---

## Admin User Document

**Collection**: `gendei_admin_users`

```typescript
interface AdminUser {
  // Identity
  id: string;  // matches Firebase Auth UID
  email: string;
  name: string;
  photoUrl?: string;

  // Role and permissions
  role: AdminRole;
  permissions: AdminPermission[];

  // Status
  active: boolean;
  lastLoginAt?: Timestamp;
  lastActivityAt?: Timestamp;

  // Security
  requires2FA: boolean;
  ipAllowlist?: string[];

  // Metadata
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
}

type AdminRole = 'super_admin' | 'admin' | 'support';

type AdminPermission =
  | 'clinics.read'
  | 'clinics.write'
  | 'clinics.delete'
  | 'clinics.suspend'
  | 'subscriptions.read'
  | 'subscriptions.write'
  | 'analytics.read'
  | 'analytics.export'
  | 'feature_flags.read'
  | 'feature_flags.write'
  | 'audit_logs.read'
  | 'impersonation.use'
  | 'admins.manage';
```

---

## Audit Log Document

**Collection**: `gendei_audit_logs`

```typescript
interface AuditLog {
  id: string;

  // Actor
  actorId: string;  // admin user ID
  actorEmail: string;
  actorRole: AdminRole;
  impersonating?: string;  // clinicId if impersonating

  // Action
  action: AuditAction;
  resource: AuditResource;
  resourceId?: string;

  // Details
  description: string;
  changes?: {
    field: string;
    oldValue: any;
    newValue: any;
  }[];
  metadata?: Record<string, any>;

  // Context
  ipAddress: string;
  userAgent: string;
  requestId?: string;

  // Timestamp
  timestamp: Timestamp;
}

type AuditAction =
  | 'create'
  | 'read'
  | 'update'
  | 'delete'
  | 'suspend'
  | 'unsuspend'
  | 'impersonate'
  | 'export'
  | 'login'
  | 'logout';

type AuditResource =
  | 'clinic'
  | 'subscription'
  | 'feature_flag'
  | 'admin_user'
  | 'system'
  | 'session';
```

---

## Feature Flag Document

**Collection**: `gendei_feature_flags`

```typescript
interface FeatureFlag {
  id: string;
  name: string;
  description: string;

  // Status
  enabled: boolean;

  // Targeting
  targeting: FeatureFlagTargeting;

  // Metadata
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  updatedBy: string;
}

interface FeatureFlagTargeting {
  type: 'all' | 'none' | 'percentage' | 'clinicIds' | 'plans' | 'rules';

  // For percentage rollout
  percentage?: number;

  // For specific clinics
  clinicIds?: string[];

  // For plan-based
  plans?: string[];

  // For complex rules
  rules?: FeatureFlagRule[];
}

interface FeatureFlagRule {
  field: string;  // e.g., 'clinic.createdAt', 'clinic.plan'
  operator: 'eq' | 'neq' | 'gt' | 'lt' | 'in' | 'contains';
  value: any;
}
```

---

## Platform Analytics Document

**Collection**: `gendei_platform_analytics`

**Document ID**: `{YYYY-MM-DD}`

```typescript
interface PlatformAnalytics {
  date: string;  // YYYY-MM-DD

  // Clinic metrics
  clinics: {
    total: number;
    active: number;
    new: number;
    churned: number;
    byPlan: Record<string, number>;
    byStatus: Record<string, number>;
  };

  // Appointment metrics
  appointments: {
    total: number;
    completed: number;
    cancelled: number;
    noShow: number;
    byHour: Record<string, number>;  // hour -> count
  };

  // Message metrics
  messages: {
    total: number;
    inbound: number;
    outbound: number;
    aiResponses: number;
    humanResponses: number;
  };

  // Revenue metrics
  revenue: {
    totalCents: number;
    byPlan: Record<string, number>;
    newMrr: number;
    churnedMrr: number;
  };

  // System metrics
  system: {
    apiCalls: number;
    errors: number;
    avgResponseTimeMs: number;
  };

  updatedAt: Timestamp;
}
```

---

## Clinic Admin Extension Fields

**Added to existing `gendei_clinics` documents**

```typescript
interface ClinicAdminFields {
  // Subscription
  subscription: {
    plan: 'starter' | 'professional' | 'enterprise';
    status: 'trial' | 'active' | 'past_due' | 'cancelled' | 'paused';
    currentPeriodStart: Timestamp;
    currentPeriodEnd: Timestamp;
    trialEndsAt?: Timestamp;
    cancelledAt?: Timestamp;
    cancellationReason?: string;
  };

  // Admin status
  admin: {
    verified: boolean;
    verifiedAt?: Timestamp;
    suspended: boolean;
    suspendedAt?: Timestamp;
    suspendedBy?: string;
    suspendedReason?: string;
    notes?: string;
  };

  // Usage quotas
  quotas: {
    professionals: {
      limit: number;
      used: number;
    };
    monthlyAppointments: {
      limit: number;
      used: number;
      resetAt: Timestamp;
    };
    monthlyMessages: {
      limit: number;
      used: number;
      resetAt: Timestamp;
    };
    whatsappNumbers: {
      limit: number;
      used: number;
    };
  };

  // Enabled features
  features: {
    aiAssistant: boolean;
    analytics: boolean;
    apiAccess: boolean;
    prioritySupport: boolean;
    customBranding: boolean;
  };
}
```

---

## Impersonation Session Document

**Collection**: `gendei_impersonation_sessions`

```typescript
interface ImpersonationSession {
  id: string;

  // Admin
  adminId: string;
  adminEmail: string;

  // Target
  clinicId: string;
  clinicName: string;

  // Session
  token: string;  // hashed
  startedAt: Timestamp;
  expiresAt: Timestamp;
  endedAt?: Timestamp;

  // Context
  reason: string;
  ipAddress: string;
  userAgent: string;

  // Activity log
  actionsPerformed: {
    action: string;
    resource: string;
    timestamp: Timestamp;
  }[];
}
```

---

## Zod Schemas

```typescript
import { z } from 'zod';

export const adminRoleSchema = z.enum(['super_admin', 'admin', 'support']);

export const adminPermissionSchema = z.enum([
  'clinics.read',
  'clinics.write',
  'clinics.delete',
  'clinics.suspend',
  'subscriptions.read',
  'subscriptions.write',
  'analytics.read',
  'analytics.export',
  'feature_flags.read',
  'feature_flags.write',
  'audit_logs.read',
  'impersonation.use',
  'admins.manage',
]);

export const createAdminUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
  role: adminRoleSchema,
  permissions: z.array(adminPermissionSchema),
  requires2FA: z.boolean().default(true),
  ipAllowlist: z.array(z.string().ip()).optional(),
});

export const suspendClinicSchema = z.object({
  reason: z.string().min(10).max(500),
  notifyOwner: z.boolean().default(true),
});

export const featureFlagSchema = z.object({
  name: z.string().min(1).max(50),
  description: z.string().max(500),
  enabled: z.boolean(),
  targeting: z.object({
    type: z.enum(['all', 'none', 'percentage', 'clinicIds', 'plans', 'rules']),
    percentage: z.number().min(0).max(100).optional(),
    clinicIds: z.array(z.string()).optional(),
    plans: z.array(z.string()).optional(),
  }),
});

export const impersonationRequestSchema = z.object({
  clinicId: z.string(),
  reason: z.string().min(10).max(500),
  duration: z.number().min(15).max(60).default(60),  // minutes
});
```

---

## Example Documents

### Admin User

```json
{
  "id": "admin_user_123",
  "email": "admin@gendei.com.br",
  "name": "João Admin",
  "role": "super_admin",
  "permissions": [
    "clinics.read",
    "clinics.write",
    "clinics.delete",
    "clinics.suspend",
    "subscriptions.read",
    "subscriptions.write",
    "analytics.read",
    "analytics.export",
    "feature_flags.read",
    "feature_flags.write",
    "audit_logs.read",
    "impersonation.use",
    "admins.manage"
  ],
  "active": true,
  "requires2FA": true,
  "lastLoginAt": "2026-02-04T09:00:00Z",
  "createdAt": "2025-01-01T00:00:00Z",
  "createdBy": "system",
  "updatedAt": "2026-02-04T09:00:00Z"
}
```

### Audit Log

```json
{
  "id": "audit_abc123",
  "actorId": "admin_user_123",
  "actorEmail": "admin@gendei.com.br",
  "actorRole": "super_admin",
  "action": "suspend",
  "resource": "clinic",
  "resourceId": "clinic_xyz",
  "description": "Suspended clinic due to payment issues",
  "changes": [
    {
      "field": "admin.suspended",
      "oldValue": false,
      "newValue": true
    }
  ],
  "ipAddress": "192.168.1.1",
  "userAgent": "Mozilla/5.0...",
  "timestamp": "2026-02-04T10:30:00Z"
}
```

### Feature Flag

```json
{
  "id": "new-calendar-ui",
  "name": "New Calendar UI",
  "description": "Enables the new calendar interface with drag-and-drop",
  "enabled": true,
  "targeting": {
    "type": "percentage",
    "percentage": 25
  },
  "createdAt": "2026-01-15T00:00:00Z",
  "createdBy": "admin_user_123",
  "updatedAt": "2026-02-01T00:00:00Z",
  "updatedBy": "admin_user_123"
}
```
