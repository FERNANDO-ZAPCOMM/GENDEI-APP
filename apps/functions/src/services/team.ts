import { getFirestore } from 'firebase-admin/firestore';
import { v4 as uuidv4 } from 'uuid';
import {
  TeamMember,
  TeamInvitation,
  TeamRole,
  TeamMemberStatus,
  Collections,
} from '../types';

const db = getFirestore();

/**
 * Get team members collection reference for a creator
 * Schema v2: creators/{creatorId}/team
 */
function getTeamCollection(creatorId: string) {
  return db.collection(Collections.CREATORS).doc(creatorId).collection(Collections.TEAM);
}

/**
 * Get invitations collection reference for a creator
 * We store invitations as settings documents with a special key
 * Schema v2: creators/{creatorId}/settings/invitations
 */
function getInvitationsCollection(creatorId: string) {
  return db.collection(Collections.CREATORS).doc(creatorId).collection('team_invitations');
}

/**
 * Get all team members for a creator
 */
export async function getTeamMembers(creatorId: string): Promise<TeamMember[]> {
  const membersRef = getTeamCollection(creatorId);
  const snapshot = await membersRef.get();

  return snapshot.docs.map((doc) => ({
    ...doc.data(),
    id: doc.id,
  })) as TeamMember[];
}

/**
 * Get a single team member
 */
export async function getTeamMember(
  creatorId: string,
  memberId: string
): Promise<TeamMember | null> {
  const memberRef = getTeamCollection(creatorId).doc(memberId);
  const doc = await memberRef.get();

  if (!doc.exists) {
    return null;
  }

  return { ...doc.data(), id: doc.id } as TeamMember;
}

/**
 * Get team member by user ID
 */
export async function getTeamMemberByUserId(
  creatorId: string,
  userId: string
): Promise<TeamMember | null> {
  const membersRef = getTeamCollection(creatorId);
  const snapshot = await membersRef.where('userId', '==', userId).limit(1).get();

  if (snapshot.empty) {
    return null;
  }

  const doc = snapshot.docs[0];
  return { ...doc?.data(), id: doc?.id } as TeamMember;
}

/**
 * Get team member by email
 */
export async function getTeamMemberByEmail(
  creatorId: string,
  email: string
): Promise<TeamMember | null> {
  const membersRef = getTeamCollection(creatorId);
  const snapshot = await membersRef
    .where('email', '==', email.toLowerCase())
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }

  const doc = snapshot.docs[0];
  return { ...doc?.data(), id: doc?.id } as TeamMember;
}

/**
 * Get pending invitations for a creator
 */
export async function getPendingInvitations(
  creatorId: string
): Promise<TeamInvitation[]> {
  const invitationsRef = getInvitationsCollection(creatorId);
  const snapshot = await invitationsRef
    .where('status', '==', TeamMemberStatus.PENDING)
    .get();

  return snapshot.docs.map((doc) => ({
    ...doc.data(),
    id: doc.id,
  })) as TeamInvitation[];
}

/**
 * Create a team invitation
 */
export async function createInvitation(
  data: Omit<TeamInvitation, 'id' | 'token' | 'createdAt'>
): Promise<TeamInvitation> {
  const invitationsRef = getInvitationsCollection(data.creatorId);
  const newInvitationRef = invitationsRef.doc();
  const token = uuidv4();

  const invitation: TeamInvitation = {
    id: newInvitationRef.id,
    ...data,
    token,
    createdAt: new Date(),
  };

  await newInvitationRef.set(invitation);
  return invitation;
}

/**
 * Get invitation by token
 */
export async function getInvitationByToken(
  token: string
): Promise<TeamInvitation | null> {
  // Search across all creator for the invitation
  const creatorsRef = db.collection(Collections.CREATORS);
  const creatorsSnapshot = await creatorsRef.get();

  for (const creatorDoc of creatorsSnapshot.docs) {
    const invitationsRef = getInvitationsCollection(creatorDoc.id);
    const snapshot = await invitationsRef.where('token', '==', token).limit(1).get();

    if (!snapshot.empty) {
      const doc = snapshot.docs[0];
      return { ...doc?.data(), id: doc?.id } as TeamInvitation;
    }
  }

  return null;
}

/**
 * Update invitation status
 */
export async function updateInvitationStatus(
  creatorId: string,
  invitationId: string,
  status: TeamMemberStatus
): Promise<void> {
  const invitationRef = getInvitationsCollection(creatorId).doc(invitationId);
  await invitationRef.update({ status, updatedAt: new Date() });
}

/**
 * Create a team member
 */
export async function createTeamMember(
  creatorId: string,
  data: Omit<TeamMember, 'id' | 'createdAt' | 'updatedAt'>
): Promise<TeamMember> {
  const membersRef = getTeamCollection(creatorId);
  const newMemberRef = membersRef.doc();

  const member: TeamMember = {
    id: newMemberRef.id,
    ...data,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await newMemberRef.set(member);
  return member;
}

/**
 * Initialize owner in team collection
 */
export async function initializeOwner(
  creatorId: string,
  userId: string,
  email: string,
  displayName?: string
): Promise<TeamMember> {
  const membersRef = getTeamCollection(creatorId);
  const newMemberRef = membersRef.doc();

  const member: TeamMember = {
    id: newMemberRef.id,
    creatorId,
    userId,
    email,
    role: TeamRole.OWNER,
    displayName,
    status: TeamMemberStatus.ACTIVE,
    joinedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await newMemberRef.set(member);
  return member;
}

/**
 * Update team member role
 */
export async function updateTeamMemberRole(
  creatorId: string,
  memberId: string,
  role: TeamRole
): Promise<void> {
  const memberRef = getTeamCollection(creatorId).doc(memberId);
  await memberRef.update({ role, updatedAt: new Date() });
}

/**
 * Remove team member
 */
export async function removeTeamMember(
  creatorId: string,
  memberId: string
): Promise<void> {
  const memberRef = getTeamCollection(creatorId).doc(memberId);
  await memberRef.delete();
}

/**
 * Revoke invitation
 */
export async function revokeInvitation(
  creatorId: string,
  invitationId: string
): Promise<void> {
  await updateInvitationStatus(creatorId, invitationId, TeamMemberStatus.REVOKED);
}

/**
 * Validate if inviter can invite the given role
 */
export function validateInvitePermission(
  inviterRole: TeamRole,
  inviteeRole: TeamRole
): void {
  // Owner can invite anyone
  if (inviterRole === TeamRole.OWNER) {
    return;
  }

  // Admin can invite Support and Marketing
  if (inviterRole === TeamRole.ADMIN) {
    if ([TeamRole.SUPPORT, TeamRole.MARKETING].includes(inviteeRole)) {
      return;
    }
    throw new Error('Admins can only invite Support and Marketing roles');
  }

  // Support and Marketing cannot invite
  throw new Error('Insufficient permissions to invite team members');
}

/**
 * Validate role change permission
 */
export function validateRoleChangePermission(
  requesterRole: TeamRole,
  currentRole: TeamRole,
  newRole: TeamRole
): void {
  // Owner can change any role (except other owners)
  if (requesterRole === TeamRole.OWNER) {
    return;
  }

  // Admin can change Support and Marketing roles
  if (requesterRole === TeamRole.ADMIN) {
    if (
      [TeamRole.SUPPORT, TeamRole.MARKETING].includes(currentRole) &&
      [TeamRole.SUPPORT, TeamRole.MARKETING].includes(newRole)
    ) {
      return;
    }
    throw new Error('Admins can only change Support and Marketing roles');
  }

  throw new Error('Insufficient permissions to change roles');
}

/**
 * Validate remove permission
 */
export function validateRemovePermission(
  requesterRole: TeamRole,
  targetRole: TeamRole
): void {
  // Owner can remove anyone (except owner)
  if (requesterRole === TeamRole.OWNER) {
    return;
  }

  // Admin can remove Support and Marketing
  if (requesterRole === TeamRole.ADMIN) {
    if ([TeamRole.SUPPORT, TeamRole.MARKETING].includes(targetRole)) {
      return;
    }
    throw new Error('Admins can only remove Support and Marketing members');
  }

  throw new Error('Insufficient permissions to remove team members');
}
