import { getFirestore } from 'firebase-admin/firestore';
import {
  CreatorProfile,
  VoiceStyle,
  SpeakingPerspective,
  Collections,
} from '../types';
import * as teamService from './team';

const db = getFirestore();

/**
 * Get creator document reference
 * Schema v2: Profile is embedded in creators/{creatorId}
 */
function getCreatorRef(creatorId: string) {
  return db.collection(Collections.CREATORS).doc(creatorId);
}

export interface CreateProfileDto {
  displayName: string;
  profileImageUrl?: string;
  bio?: string;
}

export interface UpdatePersonaDto {
  voiceStyle: VoiceStyle;
  speakingPerspective: SpeakingPerspective;
  sampleResponses?: string;
}

export interface UpdateBusinessDto {
  country?: string;
  primaryLanguage: string;
  paymentMethod?: string;
  pixKey?: string;
}

/**
 * Create or update profile (Step 1)
 * Schema v2: Profile is embedded in creators/{creatorId}.profile
 */
export async function updateProfile(
  creatorId: string,
  dto: CreateProfileDto,
  userEmail?: string
): Promise<CreatorProfile> {
  console.log(`Updating profile for creator: ${creatorId}`);

  const creatorRef = getCreatorRef(creatorId);
  const existingCreator = await creatorRef.get();
  const existingProfile = existingCreator.data()?.profile;

  const profileData: Partial<CreatorProfile> = {
    displayName: dto.displayName,
    language: existingProfile?.language || 'pt-BR',
    voiceStyle: existingProfile?.voiceStyle || VoiceStyle.FRIENDLY_COACH,
    speakingPerspective: existingProfile?.speakingPerspective || SpeakingPerspective.FIRST_PERSON,
    showProductsInGreeting: existingProfile?.showProductsInGreeting ?? true,
  };

  // Determine onboarding step
  const currentStep = existingCreator.data()?.onboardingStep || 0;
  const onboardingStep = Math.max(currentStep, 1);

  if (!existingCreator.exists) {
    // Create new creator document
    await creatorRef.set({
      id: creatorId,
      name: dto.displayName,
      status: 'pending',
      plan: 'free',
      profile: profileData,
      whatsapp: {
        status: 'disconnected',
      },
      onboardingStep,
      onboardingCompleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Initialize owner in team collection when creator is first created
    try {
      const existingMember = await teamService.getTeamMemberByUserId(
        creatorId,
        creatorId
      );

      if (!existingMember) {
        console.log(`Initializing owner for creator: ${creatorId}`);
        await teamService.initializeOwner(
          creatorId,
          creatorId, // userId = creatorId for owner
          userEmail || 'owner@unknown.com',
          dto.displayName
        );
      }
    } catch (error) {
      console.error(
        `Failed to initialize owner for creator ${creatorId}: ${(error as Error).message}`
      );
      // Don't fail the profile creation if team member creation fails
    }
  } else {
    // Update existing creator
    await creatorRef.set({
      name: dto.displayName,
      profile: profileData,
      onboardingStep,
      updatedAt: new Date(),
    }, { merge: true });
  }

  const updated = await creatorRef.get();
  return updated.data()?.profile as CreatorProfile;
}

/**
 * Update AI Persona (Step 2)
 * Schema v2: Profile is embedded in creators/{creatorId}.profile
 */
export async function updatePersona(
  creatorId: string,
  dto: UpdatePersonaDto
): Promise<CreatorProfile> {
  console.log(`Updating persona for creator: ${creatorId}`);

  const creatorRef = getCreatorRef(creatorId);
  const existing = await creatorRef.get();

  if (!existing.exists) {
    throw new Error('Creator profile not found');
  }

  const currentStep = existing.data()?.onboardingStep || 1;
  const onboardingStep = Math.max(currentStep, 2);

  await creatorRef.set({
    'profile.voiceStyle': dto.voiceStyle,
    'profile.speakingPerspective': dto.speakingPerspective,
    'profile.sampleResponses': dto.sampleResponses,
    onboardingStep,
    updatedAt: new Date(),
  }, { merge: true });

  const updated = await creatorRef.get();
  return updated.data()?.profile as CreatorProfile;
}

/**
 * Update Business Information (Step 3)
 * Schema v2: Profile is embedded in creators/{creatorId}.profile
 */
export async function updateBusiness(
  creatorId: string,
  dto: UpdateBusinessDto
): Promise<CreatorProfile> {
  console.log(`Updating business info for creator: ${creatorId}`);

  const creatorRef = getCreatorRef(creatorId);
  const existing = await creatorRef.get();

  if (!existing.exists) {
    throw new Error('Creator profile not found');
  }

  // Update profile and payment settings
  await creatorRef.set({
    'profile.country': dto.country,
    'profile.language': dto.primaryLanguage,
    status: 'active', // Activate creator after onboarding
    onboardingStep: 3,
    onboardingCompleted: true, // Complete onboarding
    updatedAt: new Date(),
  }, { merge: true });

  // Also save payment settings in settings subcollection for easier access
  if (dto.pixKey) {
    await db
      .collection(Collections.CREATORS)
      .doc(creatorId)
      .collection(Collections.SETTINGS)
      .doc('payments')
      .set({
        pixKey: dto.pixKey,
        paymentMethod: dto.paymentMethod,
        updatedAt: new Date(),
      }, { merge: true });
  }

  const updated = await creatorRef.get();
  return updated.data()?.profile as CreatorProfile;
}

/**
 * Get creator profile
 * Schema v2: Profile is embedded in creators/{creatorId}.profile
 */
export async function getProfile(
  creatorId: string
): Promise<CreatorProfile | null> {
  const creatorRef = getCreatorRef(creatorId);
  const doc = await creatorRef.get();

  if (!doc.exists) {
    return null;
  }

  return doc.data()?.profile as CreatorProfile || null;
}

/**
 * Check if onboarding is complete
 */
export async function isOnboardingComplete(creatorId: string): Promise<boolean> {
  const creatorRef = getCreatorRef(creatorId);
  const doc = await creatorRef.get();
  return doc.data()?.onboardingCompleted || false;
}

/**
 * Get onboarding status
 */
export async function getOnboardingStatus(creatorId: string): Promise<{
  isComplete: boolean;
  currentStep: number;
  profile: CreatorProfile | null;
}> {
  const creatorRef = getCreatorRef(creatorId);
  const doc = await creatorRef.get();
  const data = doc.data();

  return {
    isComplete: data?.onboardingCompleted || false,
    currentStep: data?.onboardingStep || 0,
    profile: data?.profile as CreatorProfile || null,
  };
}
