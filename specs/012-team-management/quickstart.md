# Quickstart: Team Management

**Feature**: 012-team-management
**Date**: 2026-02-04

---

## Invitation Service

```typescript
// apps/functions/src/services/teamService.ts
import { db, FieldValue, Timestamp } from '../lib/firebase';
import { adminAuth } from '../lib/firebase-admin';
import { sendEmail } from './emailService';
import { randomBytes, createHash } from 'crypto';

const INVITATION_EXPIRY_DAYS = 7;

export async function inviteTeamMember(
  clinicId: string,
  invitedBy: string,
  data: {
    email: string;
    role: string;
    additionalPermissions?: string[];
    message?: string;
    professionalId?: string;
  }
) {
  // Check if already a member
  const existingMember = await db
    .collection('gendei_team_members')
    .where('clinicId', '==', clinicId)
    .where('email', '==', data.email)
    .where('status', 'in', ['pending', 'active'])
    .limit(1)
    .get();

  if (!existingMember.empty) {
    throw new Error('User is already a team member or has a pending invitation');
  }

  // Check for existing pending invitation
  const existingInvitation = await db
    .collection('gendei_invitations')
    .where('clinicId', '==', clinicId)
    .where('email', '==', data.email)
    .where('status', '==', 'pending')
    .limit(1)
    .get();

  if (!existingInvitation.empty) {
    throw new Error('An invitation is already pending for this email');
  }

  // Get clinic info
  const clinicDoc = await db.collection('gendei_clinics').doc(clinicId).get();
  const clinic = clinicDoc.data()!;

  // Get inviter info
  const inviterDoc = await db
    .collection('gendei_team_members')
    .where('clinicId', '==', clinicId)
    .where('userId', '==', invitedBy)
    .limit(1)
    .get();
  const inviter = inviterDoc.docs[0]?.data();

  // Generate secure token
  const token = randomBytes(32).toString('hex');
  const hashedToken = hashToken(token);

  // Create invitation
  const invitationRef = await db.collection('gendei_invitations').add({
    clinicId,
    clinicName: clinic.name,
    email: data.email,
    role: data.role,
    additionalPermissions: data.additionalPermissions || [],
    token: hashedToken,
    expiresAt: Timestamp.fromDate(
      new Date(Date.now() + INVITATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000)
    ),
    status: 'pending',
    invitedBy,
    invitedByName: inviter?.name || 'Team Member',
    message: data.message,
    professionalId: data.professionalId,
    createdAt: FieldValue.serverTimestamp(),
  });

  // Create pending team member
  await db.collection('gendei_team_members').add({
    clinicId,
    email: data.email,
    role: data.role,
    permissions: data.additionalPermissions || [],
    deniedPermissions: [],
    status: 'pending',
    invitedBy,
    invitedAt: FieldValue.serverTimestamp(),
    professionalId: data.professionalId,
    loginCount: 0,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  // Send invitation email
  const invitationLink = `${process.env.APP_URL}/invite/accept?token=${token}`;

  await sendEmail({
    to: data.email,
    subject: `Convite para equipe - ${clinic.name}`,
    template: 'team-invitation',
    variables: {
      clinicName: clinic.name,
      roleName: getRoleName(data.role),
      inviterName: inviter?.name || 'A equipe',
      invitationLink,
      message: data.message,
    },
  });

  return {
    id: invitationRef.id,
    email: data.email,
    role: data.role,
    expiresAt: new Date(Date.now() + INVITATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
  };
}

export async function acceptInvitation(token: string, userId: string, name?: string) {
  const hashedToken = hashToken(token);

  // Find invitation
  const invitationsQuery = await db
    .collection('gendei_invitations')
    .where('token', '==', hashedToken)
    .where('status', '==', 'pending')
    .limit(1)
    .get();

  if (invitationsQuery.empty) {
    throw new Error('Invalid or expired invitation');
  }

  const invitationDoc = invitationsQuery.docs[0];
  const invitation = invitationDoc.data();

  // Check expiry
  if (invitation.expiresAt.toDate() < new Date()) {
    await invitationDoc.ref.update({ status: 'expired' });
    throw new Error('Invitation has expired');
  }

  // Get user info
  const user = await adminAuth.getUser(userId);

  // Check email matches
  if (user.email?.toLowerCase() !== invitation.email.toLowerCase()) {
    throw new Error('Email does not match invitation');
  }

  // Find pending team member
  const memberQuery = await db
    .collection('gendei_team_members')
    .where('clinicId', '==', invitation.clinicId)
    .where('email', '==', invitation.email)
    .where('status', '==', 'pending')
    .limit(1)
    .get();

  if (memberQuery.empty) {
    throw new Error('Team member record not found');
  }

  const memberDoc = memberQuery.docs[0];

  // Update team member
  await memberDoc.ref.update({
    userId,
    name: name || user.displayName || invitation.email.split('@')[0],
    photoUrl: user.photoURL,
    status: 'active',
    acceptedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  // Update invitation
  await invitationDoc.ref.update({
    status: 'accepted',
    acceptedAt: FieldValue.serverTimestamp(),
    acceptedBy: userId,
  });

  // Update user custom claims
  await updateUserClaims(userId);

  return {
    clinicId: invitation.clinicId,
    clinicName: invitation.clinicName,
    role: invitation.role,
  };
}

async function updateUserClaims(userId: string) {
  const memberships = await db
    .collection('gendei_team_members')
    .where('userId', '==', userId)
    .where('status', '==', 'active')
    .get();

  const clinicIds: string[] = [];
  const roles: Record<string, string> = {};

  memberships.docs.forEach((doc) => {
    const data = doc.data();
    clinicIds.push(data.clinicId);
    roles[data.clinicId] = data.role;
  });

  await adminAuth.setCustomUserClaims(userId, { clinicIds, roles });
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function getRoleName(role: string): string {
  const names: Record<string, string> = {
    owner: 'Proprietário',
    admin: 'Administrador',
    staff: 'Profissional',
    reception: 'Recepção',
  };
  return names[role] || role;
}
```

---

## Permission Hook

```typescript
// apps/web/src/hooks/usePermission.ts
'use client';

import { useAuth } from './useAuth';

const ROLE_PERMISSIONS: Record<string, string[]> = {
  owner: ['*'],
  admin: [
    'team.read', 'team.write',
    'settings.read', 'settings.write',
    'appointments.read', 'appointments.write',
    'patients.read', 'patients.write',
    'professionals.read', 'professionals.write',
    'services.read', 'services.write',
    'analytics.read',
    'inbox.read', 'inbox.write', 'inbox.handoff',
  ],
  staff: [
    'appointments.read', 'appointments.write:own',
    'patients.read', 'patients.write',
    'analytics.read:own',
    'inbox.read', 'inbox.write',
  ],
  reception: [
    'appointments.read', 'appointments.write',
    'patients.read', 'patients.write:basic',
    'inbox.read', 'inbox.write',
  ],
};

export function usePermission(permission: string): boolean {
  const { user, currentClinicId } = useAuth();

  if (!user || !currentClinicId) return false;

  const role = user.roles?.[currentClinicId];
  if (!role) return false;

  // Owner has all permissions
  if (role === 'owner') return true;

  // Check role permissions
  const rolePermissions = ROLE_PERMISSIONS[role] || [];

  // Direct match
  if (rolePermissions.includes(permission)) return true;
  if (rolePermissions.includes('*')) return true;

  // Check :own variant (user has broader permission)
  const basePermission = permission.replace(':own', '').replace(':basic', '');
  if (rolePermissions.includes(basePermission)) return true;

  // Check if user has :own but requesting full
  // (don't grant - :own is more restrictive)

  return false;
}

export function useRole(): string | null {
  const { user, currentClinicId } = useAuth();
  if (!user || !currentClinicId) return null;
  return user.roles?.[currentClinicId] || null;
}
```

---

## Team Management Page

```typescript
// apps/web/src/app/[locale]/dashboard/settings/team/page.tsx
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usePermission } from '@/hooks/usePermission';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, UserPlus, Shield } from 'lucide-react';
import { InviteDialog } from '@/components/team/InviteDialog';

const ROLE_LABELS: Record<string, string> = {
  owner: 'Proprietário',
  admin: 'Administrador',
  staff: 'Profissional',
  reception: 'Recepção',
};

const ROLE_COLORS: Record<string, string> = {
  owner: 'bg-purple-500',
  admin: 'bg-blue-500',
  staff: 'bg-green-500',
  reception: 'bg-gray-500',
};

export default function TeamPage() {
  const [inviteOpen, setInviteOpen] = useState(false);
  const canManageTeam = usePermission('team.write');
  const queryClient = useQueryClient();

  const { data: members, isLoading } = useQuery({
    queryKey: ['team', 'members'],
    queryFn: () => api.get('/team').then((r) => r.data.members),
  });

  const { data: invitations } = useQuery({
    queryKey: ['team', 'invitations'],
    queryFn: () => api.get('/team/invitations').then((r) => r.data.invitations),
    enabled: canManageTeam,
  });

  const removeMember = useMutation({
    mutationFn: (memberId: string) => api.delete(`/team/${memberId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team'] });
    },
  });

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Equipe</h1>
          <p className="text-muted-foreground">
            Gerencie os membros da sua equipe
          </p>
        </div>

        {canManageTeam && (
          <Button onClick={() => setInviteOpen(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Convidar
          </Button>
        )}
      </div>

      {/* Pending invitations */}
      {invitations?.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-lg font-medium">Convites pendentes</h2>
          <div className="grid gap-2">
            {invitations.map((inv: any) => (
              <div
                key={inv.id}
                className="flex items-center justify-between p-4 border rounded-lg bg-muted/50"
              >
                <div>
                  <p className="font-medium">{inv.email}</p>
                  <p className="text-sm text-muted-foreground">
                    {ROLE_LABELS[inv.role]} • Expira em{' '}
                    {new Date(inv.expiresAt).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => api.delete(`/team/invitations/${inv.id}`)}
                >
                  Cancelar
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Team members */}
      <div className="space-y-2">
        <h2 className="text-lg font-medium">Membros</h2>
        <div className="grid gap-2">
          {members?.map((member: any) => (
            <div
              key={member.id}
              className="flex items-center justify-between p-4 border rounded-lg"
            >
              <div className="flex items-center gap-4">
                <Avatar>
                  <AvatarImage src={member.photoUrl} />
                  <AvatarFallback>
                    {member.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                  </AvatarFallback>
                </Avatar>

                <div>
                  <p className="font-medium">{member.name}</p>
                  <p className="text-sm text-muted-foreground">{member.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <Badge className={ROLE_COLORS[member.role]}>
                  {ROLE_LABELS[member.role]}
                </Badge>

                {member.status === 'suspended' && (
                  <Badge variant="destructive">Suspenso</Badge>
                )}

                {canManageTeam && member.role !== 'owner' && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>
                        <Shield className="h-4 w-4 mr-2" />
                        Alterar função
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => removeMember.mutate(member.id)}
                      >
                        Remover
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} />
    </div>
  );
}
```

---

## Invite Dialog Component

```typescript
// apps/web/src/components/team/InviteDialog.tsx
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { api } from '@/lib/api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

const inviteSchema = z.object({
  email: z.string().email('Email inválido'),
  role: z.enum(['admin', 'staff', 'reception']),
  message: z.string().max(500).optional(),
});

interface InviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InviteDialog({ open, onOpenChange }: InviteDialogProps) {
  const queryClient = useQueryClient();

  const form = useForm({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      email: '',
      role: 'staff' as const,
      message: '',
    },
  });

  const invite = useMutation({
    mutationFn: (data: z.infer<typeof inviteSchema>) =>
      api.post('/team/invite', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team'] });
      toast.success('Convite enviado!');
      form.reset();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erro ao enviar convite');
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Convidar membro</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => invite.mutate(data))} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input placeholder="email@exemplo.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Função</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="admin">Administrador</SelectItem>
                      <SelectItem value="staff">Profissional</SelectItem>
                      <SelectItem value="reception">Recepção</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="message"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mensagem (opcional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Adicione uma mensagem pessoal ao convite..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={invite.isPending}>
                {invite.isPending ? 'Enviando...' : 'Enviar convite'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
```

---

## Activity Logging Middleware

```typescript
// apps/functions/src/middleware/activityLogger.ts
import { db, FieldValue } from '../lib/firebase';

export function createActivityLogger(clinicId: string, userId: string, userName: string, userRole: string) {
  return async function logActivity(
    action: string,
    resource: string,
    resourceId?: string,
    resourceName?: string,
    details?: Record<string, any>
  ) {
    await db.collection('gendei_activity_logs').add({
      clinicId,
      userId,
      userName,
      userEmail: '', // Add from context
      userRole,
      action,
      resource,
      resourceId,
      resourceName,
      details,
      timestamp: FieldValue.serverTimestamp(),
    });
  };
}

// Usage in controllers
export async function createAppointment(req: Request, res: Response) {
  const { clinicId, userId, userName, userRole } = req;
  const logActivity = createActivityLogger(clinicId, userId, userName, userRole);

  // ... create appointment logic ...

  await logActivity(
    'create',
    'appointment',
    appointmentId,
    `Consulta - ${patientName}`,
    { patientName, professionalName, scheduledFor }
  );

  return res.json({ success: true });
}
```
