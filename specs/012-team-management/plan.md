# Plan: Team Management

**Feature**: 012-team-management
**Status**: Planning
**Date**: 2026-02-04

---

## Overview

Implement team member management for clinics, including role-based access control (RBAC), invitations, permissions management, and activity logging.

---

## Technical Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16 + React 19 |
| Auth | Firebase Auth |
| Backend | Firebase Functions |
| Database | Firestore |
| Email | SendGrid/Resend |

---

## Key Features

1. Role-based access control (Owner, Admin, Staff, Reception)
2. Team member invitations via email
3. Permission management per role
4. Activity logging per user
5. Multi-clinic support
6. Session management

---

## Roles and Permissions

| Role | Description | Key Permissions |
|------|-------------|-----------------|
| owner | Clinic owner | Full access, billing, delete |
| admin | Clinic administrator | Manage team, settings |
| staff | Professional/Doctor | Own appointments, patients |
| reception | Front desk | Appointments, basic patient info |

---

## User Flow

### Invite Flow
```
1. Owner/Admin opens Team Settings
2. Clicks "Invite Member"
3. Enters email and selects role
4. System sends invitation email
5. Invitee clicks link, creates/links account
6. Invitee gains access to clinic
```

### Access Flow
```
1. User logs in
2. System loads clinicIds from custom claims
3. User selects clinic (if multiple)
4. Permissions loaded for selected clinic
5. UI adapts to user permissions
```

---

## Data Model

### Team Member

```typescript
interface TeamMember {
  id: string;
  clinicId: string;
  userId: string;
  email: string;
  name: string;
  role: TeamRole;
  permissions: string[];

  // Status
  status: 'pending' | 'active' | 'suspended';
  invitedAt: Timestamp;
  acceptedAt?: Timestamp;

  // Professional link (if applicable)
  professionalId?: string;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /team | List team members |
| POST | /team/invite | Send invitation |
| POST | /team/accept | Accept invitation |
| PATCH | /team/:id | Update member role/permissions |
| DELETE | /team/:id | Remove member |
| GET | /team/:id/activity | Get member activity |

---

## Success Metrics

- Invitation acceptance rate > 80%
- Role setup time < 2 minutes
- Zero unauthorized access incidents
