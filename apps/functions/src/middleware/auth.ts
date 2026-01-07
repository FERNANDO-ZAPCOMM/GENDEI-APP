// Gendei Authentication Middleware
// Handles Firebase Auth verification and clinic access control

import { Request, Response, NextFunction } from 'express';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const db = getFirestore();

// Gendei collections
const CLINICS = 'gendei_clinics';

// User interface for authenticated requests
export interface AuthenticatedUser {
  uid: string;
  email?: string;
  emailVerified?: boolean;
  clinicId?: string;
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

    // Find clinic for this user
    const clinicInfo = await findClinicForUser(decodedToken.uid);

    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      emailVerified: decodedToken.email_verified,
      clinicId: clinicInfo?.clinicId,
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
 * Find clinic for a user (owner or admin)
 */
async function findClinicForUser(
  userId: string
): Promise<{ clinicId: string; isOwner: boolean; isAdmin: boolean } | null> {
  // Check if user is a clinic owner
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

  // Check if user is an admin (in adminIds array)
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

  return null;
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
 * Check if a user has access to a clinic
 */
async function checkClinicAccess(userId: string, clinicId: string): Promise<boolean> {
  try {
    const clinicDoc = await db.collection(CLINICS).doc(clinicId).get();

    if (!clinicDoc.exists) {
      return false;
    }

    const data = clinicDoc.data();

    // Check if owner
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

/**
 * Middleware to verify user is clinic owner
 */
export async function verifyOwner(
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

  try {
    const clinicDoc = await db.collection(CLINICS).doc(clinicId).get();

    if (!clinicDoc.exists) {
      res.status(404).json({
        statusCode: 404,
        message: 'Clinic not found',
        error: 'Not Found',
      });
      return;
    }

    const data = clinicDoc.data();

    if (data?.ownerId !== user.uid) {
      res.status(403).json({
        statusCode: 403,
        message: 'Only the clinic owner can perform this action',
        error: 'Forbidden',
      });
      return;
    }

    next();
  } catch (error) {
    console.error('Error verifying owner:', error);
    res.status(500).json({
      statusCode: 500,
      message: 'Error verifying ownership',
      error: 'Internal Server Error',
    });
  }
}

/**
 * Optional authentication - allows unauthenticated requests but adds user if present
 */
export async function optionalAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next();
    return;
  }

  const idToken = authHeader.substring(7);

  try {
    const decodedToken = await getAuth().verifyIdToken(idToken);
    const clinicInfo = await findClinicForUser(decodedToken.uid);

    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      emailVerified: decodedToken.email_verified,
      clinicId: clinicInfo?.clinicId,
      isOwner: clinicInfo?.isOwner,
      isAdmin: clinicInfo?.isAdmin,
    };
  } catch (error) {
    // Silent failure for optional auth
    console.warn('Optional auth token verification failed:', error);
  }

  next();
}
