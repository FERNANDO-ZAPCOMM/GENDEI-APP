'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { usePermissions } from '@/hooks/use-permissions';
import {
  teamApi,
  TeamMember,
  TeamInvitation,
  TeamRole,
  getRoleName,
  getRoleColor,
  canInvite,
} from '@/lib/team-api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { UserPlus, Trash2, Mail, Shield, Clock, Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';

export function TeamManagement() {
  const { getIdToken } = useAuth();
  const { role: myRole, loading: permissionsLoading, refetch: refetchPermissions } = usePermissions();

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<TeamInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);

  // Invite form state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<TeamRole>(TeamRole.SUPPORT);
  const [inviting, setInviting] = useState(false);

  // Track loading states for actions
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [revokingInvitationId, setRevokingInvitationId] = useState<string | null>(null);
  const [resendingInvitationId, setResendingInvitationId] = useState<string | null>(null);

  // Load team data (role is handled by usePermissions hook)
  const loadTeamData = async () => {
    try {
      setLoading(true);
      const token = await getIdToken();
      if (!token) return;

      const [membersData, invitationsData] = await Promise.all([
        teamApi.getTeamMembers(token),
        teamApi.getPendingInvitations(token),
      ]);

      // Debug: log invitation data to see the format
      if (invitationsData.length > 0) {
        console.log('Invitations data:', invitationsData);
        console.log('First invitation expiresAt:', invitationsData[0].expiresAt, 'type:', typeof invitationsData[0].expiresAt);
      }

      setMembers(membersData);
      setInvitations(invitationsData);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load team data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTeamData();
  }, []);

  // Handle invite submission
  const handleInvite = async () => {
    if (!inviteEmail || !inviteRole) return;

    try {
      setInviting(true);
      const token = await getIdToken();
      if (!token) return;

      await teamApi.inviteTeamMember(token, {
        email: inviteEmail,
        role: inviteRole,
      });

      toast.success(`Invitation sent to ${inviteEmail}`);

      // Reset form and close dialog
      setInviteEmail('');
      setInviteRole(TeamRole.SUPPORT);
      setInviteDialogOpen(false);

      // Reload data
      loadTeamData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to send invitation');
    } finally {
      setInviting(false);
    }
  };

  // Handle remove member
  const handleRemoveMember = async (memberId: string, email: string) => {
    if (!confirm(`Are you sure you want to remove ${email}?`)) return;

    try {
      setRemovingMemberId(memberId);
      const token = await getIdToken();
      if (!token) return;

      await teamApi.removeMember(token, memberId);

      toast.success(`Removed ${email} from the team`);

      loadTeamData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to remove member');
    } finally {
      setRemovingMemberId(null);
    }
  };

  // Handle revoke invitation
  const handleRevokeInvitation = async (invitationId: string, email: string) => {
    if (!confirm(`Are you sure you want to revoke the invitation for ${email}?`)) return;

    try {
      setRevokingInvitationId(invitationId);
      const token = await getIdToken();
      if (!token) return;

      await teamApi.revokeInvitation(token, invitationId);

      toast.success(`Revoked invitation for ${email}`);

      loadTeamData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to revoke invitation');
    } finally {
      setRevokingInvitationId(null);
    }
  };

  // Handle resend invitation
  const handleResendInvitation = async (invitationId: string, email: string) => {
    try {
      setResendingInvitationId(invitationId);
      const token = await getIdToken();
      if (!token) return;

      await teamApi.resendInvitation(token, invitationId);

      toast.success(`Invitation resent to ${email}`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to resend invitation');
    } finally {
      setResendingInvitationId(null);
    }
  };

  if (loading || permissionsLoading) {
    return (
      <div className="space-y-6">
        {/* Your Role Skeleton */}
        <Card className="animate-in fade-in duration-300">
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-6 w-20" />
          </CardContent>
        </Card>

        {/* Team Members Skeleton */}
        <Card className="animate-in fade-in duration-300">
          <CardHeader>
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-64 mt-2" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {/* Table Header */}
              <div className="flex gap-4 border-b pb-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={`header-${i}`} className="h-4 flex-1" />
                ))}
              </div>

              {/* Table Rows */}
              {Array.from({ length: 3 }).map((_, rowIndex) => (
                <div key={`row-${rowIndex}`} className="flex gap-4 py-3 border-b">
                  {Array.from({ length: 4 }).map((_, colIndex) => (
                    <Skeleton key={`cell-${rowIndex}-${colIndex}`} className="h-4 flex-1" />
                  ))}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const canManage = canInvite(myRole);

  return (
    <div className="space-y-6">
      {/* Your Role */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Your Role
          </CardTitle>
        </CardHeader>
        <CardContent>
          {myRole ? (
            <Badge className={getRoleColor(myRole)}>{getRoleName(myRole)}</Badge>
          ) : (
            <p className="text-sm text-muted-foreground">No role assigned</p>
          )}
        </CardContent>
      </Card>

      {/* Team Members */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Team Members</CardTitle>
            <CardDescription>Manage your team members and their roles</CardDescription>
          </div>
          {canManage && (
            <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Invite Member
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Invite Team Member</DialogTitle>
                  <DialogDescription>
                    Send an invitation to add a new member to your team
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="colleague@example.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role">Role</Label>
                    <Select
                      value={inviteRole}
                      onValueChange={(value) => setInviteRole(value as TeamRole)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {myRole === TeamRole.OWNER && (
                          <SelectItem value={TeamRole.ADMIN}>
                            {getRoleName(TeamRole.ADMIN)}
                          </SelectItem>
                        )}
                        <SelectItem value={TeamRole.SUPPORT}>
                          {getRoleName(TeamRole.SUPPORT)}
                        </SelectItem>
                        <SelectItem value={TeamRole.MARKETING}>
                          {getRoleName(TeamRole.MARKETING)}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setInviteDialogOpen(false)}
                    disabled={inviting}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleInvite} disabled={inviting || !inviteEmail}>
                    {inviting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {inviting ? 'Sending...' : 'Send Invitation'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No team members yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
                  {canManage && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">
                      {member.displayName && (
                        <div className="text-xs text-muted-foreground">{member.displayName}</div>
                      )}
                      {member.email}
                    </TableCell>
                    <TableCell>
                      <Badge className={getRoleColor(member.role)}>
                        {getRoleName(member.role)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {member.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {member.acceptedAt
                        ? new Date(member.acceptedAt).toLocaleDateString()
                        : 'Pending'}
                    </TableCell>
                    {canManage && (
                      <TableCell className="text-right">
                        {member.role !== TeamRole.OWNER && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveMember(member.id, member.email)}
                            disabled={removingMemberId === member.id}
                          >
                            {removingMemberId === member.id ? (
                              <Loader2 className="h-4 w-4 animate-spin text-destructive" />
                            ) : (
                              <Trash2 className="h-4 w-4 text-destructive" />
                            )}
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pending Invitations */}
      {canManage && invitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Pending Invitations
            </CardTitle>
            <CardDescription>Invitations waiting to be accepted</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations.map((invitation) => (
                  <TableRow key={invitation.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        {invitation.email}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getRoleColor(invitation.role)}>
                        {getRoleName(invitation.role)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {invitation.expiresAt && !isNaN(new Date(invitation.expiresAt).getTime())
                        ? new Date(invitation.expiresAt).toLocaleDateString()
                        : 'N/A'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleResendInvitation(invitation.id, invitation.email)}
                          disabled={resendingInvitationId === invitation.id}
                          title="Resend invitation email"
                        >
                          {resendingInvitationId === invitation.id ? (
                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                          ) : (
                            <Send className="h-4 w-4 text-primary" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRevokeInvitation(invitation.id, invitation.email)}
                          disabled={revokingInvitationId === invitation.id}
                          title="Revoke invitation"
                        >
                          {revokingInvitationId === invitation.id ? (
                            <Loader2 className="h-4 w-4 animate-spin text-destructive" />
                          ) : (
                            <Trash2 className="h-4 w-4 text-destructive" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
