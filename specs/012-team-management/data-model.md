# Data Model: Team Management

**Feature**: 012-team-management
**Date**: 2026-02-04

---

## Collections Overview

```
gendei_team_members (top-level)
├── {memberId}

gendei_invitations (top-level)
├── {invitationId}

gendei_activity_logs (top-level)
├── {logId}
```

---

## Team Member Document

**Collection**: `gendei_team_members`

```typescript
interface TeamMember {
  // Identity
  id: string;
  clinicId: string;
  userId: string;  // Firebase Auth UID

  // Profile
  email: string;
  name: string;
  photoUrl?: string;

  // Role and permissions
  role: TeamRole;
  permissions: string[];  // Additional permissions
  deniedPermissions: string[];  // Explicitly denied

  // Status
  status: TeamMemberStatus;
  invitedBy: string;
  invitedAt: Timestamp;
  acceptedAt?: Timestamp;
  suspendedAt?: Timestamp;
  suspendedBy?: string;
  suspendedReason?: string;

  // Professional link
  professionalId?: string;

  // Activity tracking
  lastActiveAt?: Timestamp;
  lastLoginAt?: Timestamp;
  loginCount: number;

  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

type TeamRole = 'owner' | 'admin' | 'staff' | 'reception';

type TeamMemberStatus = 'pending' | 'active' | 'suspended' | 'removed';
```

---

## Invitation Document

**Collection**: `gendei_invitations`

```typescript
interface Invitation {
  id: string;
  clinicId: string;
  clinicName: string;

  // Invitee
  email: string;
  role: TeamRole;
  additionalPermissions?: string[];

  // Token
  token: string;  // hashed
  expiresAt: Timestamp;

  // Status
  status: InvitationStatus;
  acceptedAt?: Timestamp;
  acceptedBy?: string;

  // Sender
  invitedBy: string;
  invitedByName: string;

  // Metadata
  message?: string;  // Optional personal message

  createdAt: Timestamp;
}

type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked';
```

---

## Activity Log Document

**Collection**: `gendei_activity_logs`

```typescript
interface ActivityLog {
  id: string;
  clinicId: string;

  // Actor
  userId: string;
  userName: string;
  userEmail: string;
  userRole: TeamRole;

  // Action
  action: ActivityAction;
  resource: ActivityResource;
  resourceId?: string;
  resourceName?: string;

  // Details
  details?: Record<string, any>;
  changes?: {
    field: string;
    oldValue: any;
    newValue: any;
  }[];

  // Context
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;

  // Timestamp
  timestamp: Timestamp;
}

type ActivityAction =
  | 'create'
  | 'read'
  | 'update'
  | 'delete'
  | 'login'
  | 'logout'
  | 'invite'
  | 'accept'
  | 'suspend'
  | 'export';

type ActivityResource =
  | 'appointment'
  | 'patient'
  | 'professional'
  | 'service'
  | 'team_member'
  | 'settings'
  | 'conversation'
  | 'session';
```

---

## User Custom Claims

```typescript
// Stored in Firebase Auth custom claims
interface UserClaims {
  // Clinic access
  clinicIds: string[];
  roles: Record<string, TeamRole>;  // clinicId -> role

  // Admin flag (for super admins)
  admin?: boolean;
  adminRole?: string;
}

// Example
{
  "clinicIds": ["clinic_abc", "clinic_xyz"],
  "roles": {
    "clinic_abc": "owner",
    "clinic_xyz": "staff"
  }
}
```

---

## Zod Schemas

```typescript
import { z } from 'zod';

export const teamRoleSchema = z.enum(['owner', 'admin', 'staff', 'reception']);

export const teamMemberStatusSchema = z.enum(['pending', 'active', 'suspended', 'removed']);

export const inviteTeamMemberSchema = z.object({
  email: z.string().email(),
  role: teamRoleSchema,
  additionalPermissions: z.array(z.string()).optional(),
  message: z.string().max(500).optional(),
  professionalId: z.string().optional(),
});

export const updateTeamMemberSchema = z.object({
  role: teamRoleSchema.optional(),
  permissions: z.array(z.string()).optional(),
  deniedPermissions: z.array(z.string()).optional(),
  professionalId: z.string().nullable().optional(),
});

export const suspendTeamMemberSchema = z.object({
  reason: z.string().min(5).max(500),
});

export const acceptInvitationSchema = z.object({
  token: z.string(),
  name: z.string().min(2).max(100).optional(),
});
```

---

## Firestore Indexes

```javascript
// Team members by clinic
{
  collectionGroup: 'gendei_team_members',
  fields: [
    { fieldPath: 'clinicId', order: 'ASCENDING' },
    { fieldPath: 'status', order: 'ASCENDING' }
  ]
}

// Team members by user
{
  collectionGroup: 'gendei_team_members',
  fields: [
    { fieldPath: 'userId', order: 'ASCENDING' },
    { fieldPath: 'status', order: 'ASCENDING' }
  ]
}

// Invitations by clinic
{
  collectionGroup: 'gendei_invitations',
  fields: [
    { fieldPath: 'clinicId', order: 'ASCENDING' },
    { fieldPath: 'status', order: 'ASCENDING' },
    { fieldPath: 'createdAt', order: 'DESCENDING' }
  ]
}

// Activity logs by clinic
{
  collectionGroup: 'gendei_activity_logs',
  fields: [
    { fieldPath: 'clinicId', order: 'ASCENDING' },
    { fieldPath: 'timestamp', order: 'DESCENDING' }
  ]
}

// Activity logs by user
{
  collectionGroup: 'gendei_activity_logs',
  fields: [
    { fieldPath: 'clinicId', order: 'ASCENDING' },
    { fieldPath: 'userId', order: 'ASCENDING' },
    { fieldPath: 'timestamp', order: 'DESCENDING' }
  ]
}
```

---

## Security Rules

```javascript
// gendei_team_members
match /gendei_team_members/{memberId} {
  // Read: user is member of the clinic
  allow read: if request.auth != null &&
    resource.data.clinicId in request.auth.token.clinicIds;

  // Write: user is owner or admin of the clinic
  allow write: if request.auth != null &&
    resource.data.clinicId in request.auth.token.clinicIds &&
    request.auth.token.roles[resource.data.clinicId] in ['owner', 'admin'];
}

// gendei_invitations
match /gendei_invitations/{invitationId} {
  // Read: anyone with the token (handled in functions)
  allow read: if false;  // Only via functions

  // Write: only via functions
  allow write: if false;
}

// gendei_activity_logs
match /gendei_activity_logs/{logId} {
  // Read: user is admin or owner of the clinic
  allow read: if request.auth != null &&
    resource.data.clinicId in request.auth.token.clinicIds &&
    request.auth.token.roles[resource.data.clinicId] in ['owner', 'admin'];

  // Write: only via functions
  allow write: if false;
}
```

---

## Example Documents

### Team Member

```json
{
  "id": "member_abc123",
  "clinicId": "clinic_xyz",
  "userId": "user_456",
  "email": "maria@example.com",
  "name": "Maria Santos",
  "role": "admin",
  "permissions": ["analytics.export"],
  "deniedPermissions": [],
  "status": "active",
  "invitedBy": "user_789",
  "invitedAt": "2026-01-15T10:00:00Z",
  "acceptedAt": "2026-01-15T14:30:00Z",
  "lastActiveAt": "2026-02-04T09:00:00Z",
  "lastLoginAt": "2026-02-04T08:00:00Z",
  "loginCount": 45,
  "createdAt": "2026-01-15T10:00:00Z",
  "updatedAt": "2026-02-04T09:00:00Z"
}
```

### Invitation

```json
{
  "id": "inv_def456",
  "clinicId": "clinic_xyz",
  "clinicName": "Clínica Saúde Total",
  "email": "joao@example.com",
  "role": "staff",
  "token": "hashed_token_value",
  "expiresAt": "2026-02-11T10:00:00Z",
  "status": "pending",
  "invitedBy": "user_789",
  "invitedByName": "Dr. Carlos Silva",
  "message": "Bem-vindo à nossa equipe!",
  "createdAt": "2026-02-04T10:00:00Z"
}
```

### Activity Log

```json
{
  "id": "log_ghi789",
  "clinicId": "clinic_xyz",
  "userId": "user_456",
  "userName": "Maria Santos",
  "userEmail": "maria@example.com",
  "userRole": "admin",
  "action": "create",
  "resource": "appointment",
  "resourceId": "appt_123",
  "resourceName": "Consulta - João Silva",
  "details": {
    "patientName": "João Silva",
    "professionalName": "Dr. Carlos",
    "scheduledFor": "2026-02-05T14:00:00Z"
  },
  "ipAddress": "192.168.1.1",
  "timestamp": "2026-02-04T10:30:00Z"
}
```
