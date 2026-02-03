# Research: Team Management

**Feature**: 012-team-management
**Date**: 2026-02-04

---

## Technical Decisions

### 1. Permission System Architecture

**Decision**: Role + granular permissions with inheritance

**Options**:
| Approach | Pros | Cons | Decision |
|----------|------|------|----------|
| Role-based only | Simple | Inflexible | Rejected |
| Permission-based only | Flexible | Complex | Rejected |
| Role + permissions | Balanced | Slightly complex | **Selected** |

**Implementation**:
```typescript
// Roles provide base permissions
const ROLE_PERMISSIONS: Record<TeamRole, string[]> = {
  owner: ['*'],  // Full access
  admin: [
    'team.read', 'team.write',
    'settings.read', 'settings.write',
    'appointments.read', 'appointments.write',
    'patients.read', 'patients.write',
    'professionals.read', 'professionals.write',
    'services.read', 'services.write',
    'analytics.read',
  ],
  staff: [
    'appointments.read', 'appointments.write:own',
    'patients.read', 'patients.write',
    'analytics.read:own',
  ],
  reception: [
    'appointments.read', 'appointments.write',
    'patients.read', 'patients.write:basic',
  ],
};

// Additional permissions can be added per user
interface TeamMember {
  role: TeamRole;
  permissions: string[];  // Additional permissions
  deniedPermissions: string[];  // Explicitly denied
}
```

### 2. Multi-Clinic Access

**Decision**: Firebase custom claims with clinicIds array

**Implementation**:
```typescript
// Custom claims structure
interface UserClaims {
  clinicIds: string[];
  roles: Record<string, TeamRole>;  // clinicId -> role
}

// Example claims
{
  clinicIds: ['clinic_1', 'clinic_2'],
  roles: {
    'clinic_1': 'owner',
    'clinic_2': 'staff'
  }
}

// Update claims when team membership changes
async function updateUserClaims(userId: string) {
  const memberships = await db.collection('gendei_team_members')
    .where('userId', '==', userId)
    .where('status', '==', 'active')
    .get();

  const clinicIds: string[] = [];
  const roles: Record<string, string> = {};

  memberships.docs.forEach(doc => {
    const data = doc.data();
    clinicIds.push(data.clinicId);
    roles[data.clinicId] = data.role;
  });

  await admin.auth().setCustomUserClaims(userId, { clinicIds, roles });
}
```

### 3. Invitation System

**Decision**: Secure token-based email invitations

**Flow**:
```
1. Generate secure invitation token (UUID + expiry)
2. Store invitation in Firestore
3. Send email with invitation link
4. User clicks link:
   a. If logged in: validate and accept
   b. If not logged in: redirect to signup, then accept
5. On accept: create team membership, update claims
6. Invalidate invitation token
```

### 4. Activity Logging

**Decision**: Event-based activity log per clinic

```typescript
interface ActivityLog {
  id: string;
  clinicId: string;
  userId: string;
  userName: string;

  action: string;
  resource: string;
  resourceId?: string;
  details?: Record<string, any>;

  ipAddress?: string;
  userAgent?: string;
  timestamp: Timestamp;
}

// Example activities
// - User logged in
// - Created appointment for [patient]
// - Updated patient [name]
// - Changed clinic settings
```

---

## Permission Definitions

```typescript
const PERMISSIONS = {
  // Team
  'team.read': 'View team members',
  'team.write': 'Invite and manage team members',
  'team.delete': 'Remove team members',

  // Settings
  'settings.read': 'View clinic settings',
  'settings.write': 'Modify clinic settings',
  'billing.read': 'View billing information',
  'billing.write': 'Manage billing and subscription',

  // Appointments
  'appointments.read': 'View all appointments',
  'appointments.read:own': 'View own appointments only',
  'appointments.write': 'Create/edit any appointment',
  'appointments.write:own': 'Create/edit own appointments only',
  'appointments.delete': 'Cancel/delete appointments',

  // Patients
  'patients.read': 'View patient information',
  'patients.write': 'Create/edit patients',
  'patients.write:basic': 'Edit basic patient info only',
  'patients.delete': 'Delete patient records',

  // Professionals
  'professionals.read': 'View professional profiles',
  'professionals.write': 'Manage professional profiles',

  // Services
  'services.read': 'View services',
  'services.write': 'Manage services',

  // Analytics
  'analytics.read': 'View all analytics',
  'analytics.read:own': 'View own analytics only',
  'analytics.export': 'Export analytics data',

  // Inbox
  'inbox.read': 'View conversations',
  'inbox.write': 'Send messages',
  'inbox.handoff': 'Take over from AI',
};
```

---

## UI Permission Checks

```typescript
// Hook for permission checks
function usePermission(permission: string): boolean {
  const { user, currentClinic } = useAuth();

  if (!user || !currentClinic) return false;

  const role = user.roles?.[currentClinic.id];
  if (!role) return false;

  // Owner has all permissions
  if (role === 'owner') return true;

  // Check role permissions
  const rolePermissions = ROLE_PERMISSIONS[role] || [];
  if (rolePermissions.includes(permission)) return true;
  if (rolePermissions.includes('*')) return true;

  // Check for :own variant
  const basePermission = permission.replace(':own', '');
  if (rolePermissions.includes(basePermission)) return true;

  return false;
}

// Component usage
function TeamPage() {
  const canManageTeam = usePermission('team.write');

  return (
    <div>
      {canManageTeam && (
        <Button>Invite Member</Button>
      )}
    </div>
  );
}
```

---

## Invitation Email Template

```typescript
const INVITATION_EMAIL = {
  subject: 'Convite para equipe - {{clinicName}}',
  body: `
Olá,

Você foi convidado para fazer parte da equipe da **{{clinicName}}** no Gendei.

**Função:** {{roleName}}

Clique no link abaixo para aceitar o convite:
{{invitationLink}}

Este convite expira em 7 dias.

Se você não esperava este convite, pode ignorar este email.

Atenciosamente,
Equipe Gendei
  `,
};
```

---

## Security Considerations

1. **Token Security**: Cryptographically secure invitation tokens
2. **Token Expiry**: 7 days for invitations
3. **One-time Use**: Tokens invalidated after acceptance
4. **Claim Updates**: Immediate claim updates on membership changes
5. **Session Refresh**: Force session refresh after claim changes
6. **Audit Trail**: Log all team membership changes

---

## References

- [Firebase Custom Claims](https://firebase.google.com/docs/auth/admin/custom-claims)
- [RBAC Best Practices](https://www.osohq.com/academy/role-based-access-control-rbac)
