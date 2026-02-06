// Gendei Authentication Middleware
// Handles Firebase Auth verification and clinic access control

import { Request, Response, NextFunction } from 'express';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { isValidVertical, buildCompositeClinicId } from '../utils/verticals';

const db = getFirestore();

// Gendei collections
const CLINICS = 'gendei_clinics';

// User interface for authenticated requests
export interface AuthenticatedUser {
  uid: string;
  email?: string;
  emailVerified?: boolean;
  clinicId?: string;
  vertical?: string;
  isOwner?: boolean;
  isAdmin?: boolean;
}

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

/**
 * Middleware to verify Firebase ID token
 */
export async function verifyAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    res.status(401).json({
      statusCode: 401,
      message: 'No authorization header provided. Please sign in.',
      error: 'Unauthorized',
    });
    return;
  }

  if (!authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      statusCode: 401,
      message: 'Invalid authorization header format. Expected: Bearer <token>',
      error: 'Unauthorized',
    });
    return;
  }

  const idToken = authHeader.substring(7);

  try {
    const decodedToken = await getAuth().verifyIdToken(idToken);

    // Read vertical from X-Vertical header, default to 'geral'
    const verticalHeader = (req.headers['x-vertical'] as string) || 'geral';
    const vertical = isValidVertical(verticalHeader) ? verticalHeader : 'geral';

    // Find clinic for this user + vertical
    const clinicInfo = await findClinicForUser(decodedToken.uid, vertical);

    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      emailVerified: decodedToken.email_verified,
      clinicId: clinicInfo?.clinicId,
      vertical,
      isOwner: clinicInfo?.isOwner,
      isAdmin: clinicInfo?.isAdmin,
    };

    next();
  } catch (error) {
    console.error('Token verification failed:', error);
    res.status(401).json({
      statusCode: 401,
      message: `Firebase token validation failed: ${(error as Error).message}`,
      error: 'Unauthorized',
    });
  }
}

/**
 * Find clinic for a user + vertical combination
 * Uses composite clinic ID: {userId}_{vertical}
 * Falls back to legacy {userId} doc during migration
 */
async function findClinicForUser(
  userId: string,
  vertical: string
): Promise<{ clinicId: string; isOwner: boolean; isAdmin: boolean } | null> {
  const compositeId = buildCompositeClinicId(userId, vertical);

  // 1. Check composite ID first (new format)
  const compositeDoc = await db.collection(CLINICS).doc(compositeId).get();
  if (compositeDoc.exists) {
    return {
      clinicId: compositeId,
      isOwner: true,
      isAdmin: true,
    };
  }

  // 2. Fallback: check legacy doc ID = userId (backward compat during migration)
  const legacyDoc = await db.collection(CLINICS).doc(userId).get();
  if (legacyDoc.exists) {
    return {
      clinicId: userId,
      isOwner: true,
      isAdmin: true,
    };
  }

  // 3. Check if user is a clinic owner via ownerId field (legacy support)
  const ownerQuery = await db
    .collection(CLINICS)
    .where('ownerId', '==', userId)
    .limit(1)
    .get();

  if (!ownerQuery.empty) {
    return {
      clinicId: ownerQuery.docs[0].id,
      isOwner: true,
      isAdmin: true,
    };
  }

  // 4. Check if user is an admin (in adminIds array)
  const adminQuery = await db
    .collection(CLINICS)
    .where('adminIds', 'array-contains', userId)
    .limit(1)
    .get();

  if (!adminQuery.empty) {
    return {
      clinicId: adminQuery.docs[0].id,
      isOwner: false,
      isAdmin: true,
    };
  }

  // No clinic found - return composite ID so routes can create one
  return {
    clinicId: compositeId,
    isOwner: true,
    isAdmin: true,
  };
}

/**
 * Middleware to verify user has access to the clinic in the request
 */
export async function verifyClinicAccess(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const { clinicId } = req.params;
  const user = req.user;

  if (!user) {
    res.status(401).json({
      statusCode: 401,
      message: 'Authentication required',
      error: 'Unauthorized',
    });
    return;
  }

  if (!clinicId) {
    res.status(400).json({
      statusCode: 400,
      message: 'Clinic ID is required',
      error: 'Bad Request',
    });
    return;
  }

  // Check if user has access to this specific clinic
  const hasAccess = await checkClinicAccess(user.uid, clinicId);

  if (!hasAccess) {
    res.status(403).json({
      statusCode: 403,
      message: 'You do not have access to this clinic',
      error: 'Forbidden',
    });
    return;
  }

  // Update user with confirmed clinic access
  req.user = {
    ...user,
    clinicId,
  };

  next();
}

/**
 * Check if a user has access to a clinic (by ownerId or adminIds)
 */
async function checkClinicAccess(userId: string, clinicId: string): Promise<boolean> {
  try {
    const clinicDoc = await db.collection(CLINICS).doc(clinicId).get();

    if (!clinicDoc.exists) {
      return false;
    }

    const data = clinicDoc.data();

    // Check if owner (ownerId is always the raw Firebase uid)
    if (data?.ownerId === userId) {
      return true;
    }

    // Check if admin
    if (data?.adminIds?.includes(userId)) {
      return true;
    }

    return false;
  } catch (error) {
    console.error('Error checking clinic access:', error);
    return false;
  }
}
