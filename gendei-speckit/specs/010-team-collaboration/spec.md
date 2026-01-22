# Feature 010: Team Collaboration

## Spec

### Overview

Team Collaboration enables clinic owners to invite team members with different roles (Owner, Admin, Support) to help manage the clinic. Role-based access control ensures appropriate permissions for each team member.

---

### User Stories

#### US-001: Team Member Invitation

**As a** clinic owner
**I want to** invite team members by email
**So that** they can help manage the clinic

**Acceptance Criteria:**
- [ ] Enter email address
- [ ] Select role for invitee
- [ ] Invitation email sent
- [ ] Invitation shows in pending list

#### US-002: Role Assignment

**As a** clinic owner
**I want to** assign roles to team members
**So that** they have appropriate access

**Acceptance Criteria:**
- [ ] Owner: Full access, can delete clinic
- [ ] Admin: Full access except deletion
- [ ] Support: Conversations and appointments only

#### US-003: Team Member List

**As a** clinic owner
**I want to** see all team members
**So that** I know who has access

**Acceptance Criteria:**
- [ ] List all active members
- [ ] Show name, email, role
- [ ] Show pending invitations
- [ ] Visual role indicators

#### US-004: Remove Team Member

**As a** clinic owner
**I want to** remove a team member
**So that** they no longer have access

**Acceptance Criteria:**
- [ ] Confirmation dialog
- [ ] Access revoked immediately
- [ ] Member notified (optional)

#### US-005: Change Role

**As a** clinic owner
**I want to** change a member's role
**So that** I can adjust permissions

**Acceptance Criteria:**
- [ ] Select new role
- [ ] Permissions updated immediately
- [ ] Cannot demote self from Owner

---

### Functional Requirements

#### FR-001: Role Definitions

```python
ROLES = {
    "owner": {
        "description": "Full access, can delete clinic and manage team",
        "permissions": ["*"],  # All permissions
        "transferable": False,  # Only one owner
    },
    "admin": {
        "description": "Full access except clinic deletion",
        "permissions": [
            "appointments:*",
            "patients:*",
            "professionals:*",
            "services:*",
            "conversations:*",
            "settings:read",
            "settings:write",
            "team:read",
        ],
    },
    "support": {
        "description": "Manage conversations and appointments only",
        "permissions": [
            "appointments:read",
            "appointments:write",
            "patients:read",
            "conversations:*",
        ],
    },
}
```

#### FR-002: Permission Definitions

```python
PERMISSIONS = {
    # Appointments
    "appointments:read": "View appointments",
    "appointments:write": "Create/edit appointments",
    "appointments:delete": "Cancel appointments",

    # Patients
    "patients:read": "View patients",
    "patients:write": "Create/edit patients",
    "patients:delete": "Delete patients",

    # Professionals
    "professionals:read": "View professionals",
    "professionals:write": "Create/edit professionals",
    "professionals:delete": "Delete professionals",

    # Services
    "services:read": "View services",
    "services:write": "Create/edit services",
    "services:delete": "Delete services",

    # Conversations
    "conversations:read": "View conversations",
    "conversations:respond": "Send messages",
    "conversations:takeover": "Human takeover",

    # Settings
    "settings:read": "View clinic settings",
    "settings:write": "Change clinic settings",

    # Team
    "team:read": "View team members",
    "team:invite": "Invite new members",
    "team:remove": "Remove members",
    "team:roles": "Change member roles",

    # Clinic
    "clinic:delete": "Delete clinic (owner only)",
}
```

#### FR-003: Team Member Structure

```python
# Stored in clinic document or separate collection
{
    "teamMembers": [
        {
            "userId": "user_123",
            "email": "maria@clinic.com",
            "name": "Maria Santos",
            "role": "owner",
            "addedAt": Timestamp,
        },
        {
            "userId": "user_456",
            "email": "joao@clinic.com",
            "name": "João Silva",
            "role": "admin",
            "addedAt": Timestamp,
            "addedBy": "user_123",
        },
    ],
    "pendingInvitations": [
        {
            "email": "ana@clinic.com",
            "role": "support",
            "invitedAt": Timestamp,
            "invitedBy": "user_123",
            "token": "unique_token",
            "expiresAt": Timestamp,  # 7 days
        },
    ],
}
```

#### FR-004: Permission Check

```typescript
function hasPermission(user: TeamMember, permission: string): boolean {
  const role = ROLES[user.role];
  const userPermissions = role.permissions;

  // Check full wildcard
  if (userPermissions.includes("*")) {
    return true;
  }

  // Check exact match
  if (userPermissions.includes(permission)) {
    return true;
  }

  // Check resource wildcard (e.g., "appointments:*")
  const [resource] = permission.split(":");
  if (userPermissions.includes(`${resource}:*`)) {
    return true;
  }

  return false;
}
```

#### FR-005: Invite Flow

```python
async def invite_team_member(clinic_id: str, email: str, role: str, inviter_id: str):
    """
    Invite a new team member.
    """
    # Generate unique invitation token
    token = generate_secure_token()

    invitation = {
        "email": email,
        "role": role,
        "invitedAt": firestore.SERVER_TIMESTAMP,
        "invitedBy": inviter_id,
        "token": token,
        "expiresAt": datetime.utcnow() + timedelta(days=7),
    }

    # Add to pending invitations
    await db.collection("gendei_clinics").document(clinic_id).update({
        "pendingInvitations": firestore.ArrayUnion([invitation]),
    })

    # Send invitation email
    await send_invitation_email(email, clinic_id, token, role)

    return invitation
```

---

### API Endpoints

```yaml
# Team Management
GET /api/team
  Query:
    clinicId: string
  Response:
    members: TeamMember[]
    invitations: Invitation[]

POST /api/team/invite
  Request:
    email: string
    role: "admin" | "support"
  Response:
    invitation: Invitation

PUT /api/team/:userId/role
  Request:
    role: "admin" | "support"
  Response:
    member: TeamMember

DELETE /api/team/:userId
  Response:
    removed: boolean

# Invitation Handling
POST /api/team/invitations/:token/accept
  Response:
    member: TeamMember
    clinicId: string

DELETE /api/team/invitations/:email
  Response:
    cancelled: boolean
```

---

### UI Wireframes

```
┌────────────────────────────────────────────────────────────────┐
│  Equipe                                          [+ Convidar]  │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Membros da Equipe                                             │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 👤 Maria Santos (você)                                   │  │
│  │    maria@clinic.com                                      │  │
│  │    👑 Owner                                              │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 👤 João Silva                                            │  │
│  │    joao@clinic.com                                       │  │
│  │    ⚙️ Admin                                              │  │
│  │                        [Alterar Função] [Remover]        │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 👤 Ana Costa                                             │  │
│  │    ana@clinic.com                                        │  │
│  │    💬 Support                                            │  │
│  │                        [Alterar Função] [Remover]        │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Convites Pendentes                                            │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 📧 pedro@clinic.com                                      │  │
│  │    Convidado como Admin • Expira em 5 dias              │  │
│  │                                 [Reenviar] [Cancelar]    │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│  Convidar Membro                                        [X]   │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  E-mail                                                        │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ email@exemplo.com                                        │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Função                                                        │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ ⚙️ Admin                                              ▼ │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Permissões da Função:                                         │
│                                                                 │
│  ✅ Admin                                                      │
│  ├─ ✓ Gerenciar agendamentos                                  │
│  ├─ ✓ Gerenciar pacientes                                     │
│  ├─ ✓ Gerenciar profissionais                                 │
│  ├─ ✓ Gerenciar serviços                                      │
│  ├─ ✓ Responder conversas                                     │
│  ├─ ✓ Ver e editar configurações                              │
│  └─ ✗ Excluir clínica                                         │
│                                                                 │
│  💬 Support                                                    │
│  ├─ ✓ Ver e editar agendamentos                               │
│  ├─ ✓ Ver pacientes                                           │
│  ├─ ✓ Responder conversas                                     │
│  └─ ✗ Outras configurações                                    │
│                                                                 │
│                              [Cancelar] [Enviar Convite]       │
│                                                                 │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│  Alterar Função                                         [X]   │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Membro: João Silva                                            │
│  Função Atual: Admin                                           │
│                                                                 │
│  Nova Função                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ ○ Admin - Acesso completo (exceto exclusão)             │  │
│  │ ● Support - Conversas e agendamentos apenas             │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│                              [Cancelar] [Salvar Alteração]     │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

---

### Review & Acceptance Checklist

- [x] Team member invitation via email
- [x] Role assignment (Owner, Admin, Support)
- [x] Team member list with roles
- [x] Remove team member
- [x] Change member role
- [x] Permission enforcement (UI + API)
- [x] Pending invitations display
- [x] Invitation expiration (7 days)
