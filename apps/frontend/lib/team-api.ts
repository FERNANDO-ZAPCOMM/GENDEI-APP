import { apiClient } from './api';
import { TeamRole } from './permissions';

// Re-export TeamRole so consumers can import from this module
export { TeamRole } from './permissions';

export enum InvitationStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  EXPIRED = 'expired',
  REVOKED = 'revoked',
}

export interface TeamMember {
  id: string;
  email: string;
  role: TeamRole;
  displayName?: string;
  invitedAt: Date;
  acceptedAt?: Date;
  status: string;
}

export interface TeamInvitation {
  id: string;
  email: string;
  role: TeamRole;
  invitedBy: string;
  invitedByEmail: string;
  creatorName: string;
  expiresAt: string | Date; // Can be ISO string from API or Date object
  status: string;
}

export interface InviteTeamMemberRequest {
  email: string;
  role: TeamRole;
  displayName?: string;
}

export interface UpdateTeamMemberRoleRequest {
  role: TeamRole;
}

export interface AcceptInvitationRequest {
  token: string;
}

// Team API Client
export const teamApi = {
  // Get all team members
  async getTeamMembers(token: string): Promise<TeamMember[]> {
    return apiClient<TeamMember[]>('/team/members', {
      method: 'GET',
      token,
    });
  },

  // Get pending invitations
  async getPendingInvitations(token: string): Promise<TeamInvitation[]> {
    return apiClient<TeamInvitation[]>('/team/invitations', {
      method: 'GET',
      token,
    });
  },

  // Get current user's role
  async getMyRole(token: string): Promise<{ role: TeamRole | null }> {
    return apiClient<{ role: TeamRole | null }>('/team/my-role', {
      method: 'GET',
      token,
    });
  },

  // Invite a new team member
  async inviteTeamMember(
    token: string,
    data: InviteTeamMemberRequest
  ): Promise<TeamInvitation> {
    return apiClient<TeamInvitation>('/team/invite', {
      method: 'POST',
      token,
      body: JSON.stringify(data),
    });
  },

  // Accept an invitation
  async acceptInvitation(
    token: string,
    data: AcceptInvitationRequest
  ): Promise<TeamMember> {
    return apiClient<TeamMember>('/team/accept-invitation', {
      method: 'POST',
      token,
      body: JSON.stringify(data),
    });
  },

  // Update team member role
  async updateMemberRole(
    token: string,
    memberId: string,
    data: UpdateTeamMemberRoleRequest
  ): Promise<{ message: string }> {
    return apiClient<{ message: string }>(`/team/members/${memberId}/role`, {
      method: 'PUT',
      token,
      body: JSON.stringify(data),
    });
  },

  // Remove team member
  async removeMember(
    token: string,
    memberId: string
  ): Promise<{ message: string }> {
    return apiClient<{ message: string }>(`/team/members/${memberId}`, {
      method: 'DELETE',
      token,
    });
  },

  // Revoke invitation
  async revokeInvitation(
    token: string,
    invitationId: string
  ): Promise<{ message: string }> {
    return apiClient<{ message: string }>(`/team/invitations/${invitationId}`, {
      method: 'DELETE',
      token,
    });
  },

  // Resend invitation email
  async resendInvitation(
    token: string,
    invitationId: string
  ): Promise<{ message: string }> {
    return apiClient<{ message: string }>(`/team/invitations/${invitationId}/resend`, {
      method: 'POST',
      token,
    });
  },
};

// Helper functions
export const getRoleName = (role: TeamRole): string => {
  const roleNames = {
    [TeamRole.OWNER]: 'Owner',
    [TeamRole.ADMIN]: 'Admin',
    [TeamRole.SUPPORT]: 'Support',
    [TeamRole.MARKETING]: 'Marketing',
  };
  return roleNames[role] || role;
};

export const getRoleColor = (role: TeamRole): string => {
  const roleColors = {
    [TeamRole.OWNER]: 'bg-purple-100 text-purple-800',
    [TeamRole.ADMIN]: 'bg-blue-100 text-blue-800',
    [TeamRole.SUPPORT]: 'bg-green-100 text-green-800',
    [TeamRole.MARKETING]: 'bg-orange-100 text-orange-800',
  };
  return roleColors[role] || 'bg-gray-100 text-gray-800';
};

export const canInvite = (role: TeamRole | null): boolean => {
  return role === TeamRole.OWNER || role === TeamRole.ADMIN;
};

export const canManageTeam = (role: TeamRole | null): boolean => {
  return role === TeamRole.OWNER || role === TeamRole.ADMIN;
};
