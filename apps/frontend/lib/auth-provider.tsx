'use client';

import { createContext, useEffect, useState } from 'react';
import {
  firebaseSignIn,
  firebaseSignUp,
  firebaseSignOut,
  firebaseSignInWithGoogle,
  firebaseUpdateProfile,
  firebaseUpdateEmail,
  firebaseUpdatePassword,
  firebaseReauthenticate,
  subscribeToAuthChanges,
  type FirebaseUser,
} from './firebase.client';

interface AuthContextType {
  currentUser: FirebaseUser | null;
  loading: boolean;
  getIdToken: () => Promise<string | null>;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (displayName: string) => Promise<void>;
  updateEmail: (newEmail: string, currentPassword: string) => Promise<void>;
  updatePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Helper to persist the Firebase session cookie and fail fast if it doesn't work
  const setSessionCookie = async (idToken: string) => {
    const response = await fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || 'Failed to establish session');
    }
  };

  useEffect(() => {
    // Set a timeout to prevent infinite loading
    // Use longer timeout (15s) for mobile networks which can be slower
    const timeout = setTimeout(() => {
      console.warn('Auth initialization timeout - forcing loading to false');
      setLoading(false);
    }, 15000); // 15 second timeout for mobile network resilience

    let unsubscribe: (() => void) | undefined;

    subscribeToAuthChanges((user) => {
      setCurrentUser(user);
      setLoading(false);
      clearTimeout(timeout);
    }).then((unsub) => {
      unsubscribe = unsub;
    }).catch((error) => {
      console.error('Failed to subscribe to auth changes:', error);
      setLoading(false);
      clearTimeout(timeout);
    });

    return () => {
      unsubscribe?.();
      clearTimeout(timeout);
    };
  }, []);

  const getIdToken = async (): Promise<string | null> => {
    if (!currentUser) return null;
    return currentUser.getIdToken();
  };

  const signIn = async (email: string, password: string): Promise<void> => {
    try {
      setLoading(true);
      const userCredential = await firebaseSignIn(email, password);
      setCurrentUser(userCredential.user as FirebaseUser);

      // Get ID token and set session cookie
      const idToken = await userCredential.user.getIdToken();
      await setSessionCookie(idToken);
    } catch (error: any) {
      // Enhanced error logging for debugging
      console.error('Firebase Auth Error:', {
        code: error.code,
        message: error.message,
        customData: error.customData,
      });
      setCurrentUser(null);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string): Promise<void> => {
    try {
      setLoading(true);
      const userCredential = await firebaseSignUp(email, password);
      setCurrentUser(userCredential.user as FirebaseUser);

      // Get ID token and set session cookie
      const idToken = await userCredential.user.getIdToken();
      await setSessionCookie(idToken);
    } catch (error: any) {
      console.error('Firebase Signup Error:', {
        code: error.code,
        message: error.message,
        customData: error.customData,
      });
      setCurrentUser(null);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signInWithGoogle = async (): Promise<void> => {
    try {
      setLoading(true);
      const userCredential = await firebaseSignInWithGoogle();
      setCurrentUser(userCredential.user as FirebaseUser);

      // Get ID token and set session cookie
      const idToken = await userCredential.user.getIdToken();
      await setSessionCookie(idToken);
    } catch (error: any) {
      console.error('Firebase Google Sign-In Error:', {
        code: error.code,
        message: error.message,
        customData: error.customData,
        fullError: error,
      });
      // Provide more helpful error messages
      if (error.code === 'auth/internal-error') {
        console.error('Hint: Make sure Google Sign-In is enabled in Firebase Console and your domain is authorized.');
      }
      setCurrentUser(null);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async (): Promise<void> => {
    await firebaseSignOut();

    // Clear session cookie
    await fetch('/api/auth/session', {
      method: 'DELETE',
    });
  };

  const updateProfile = async (displayName: string): Promise<void> => {
    await firebaseUpdateProfile(displayName);
    // Refresh the user state
    if (currentUser) {
      setCurrentUser({ ...currentUser, displayName });
    }
  };

  const updateEmail = async (newEmail: string, currentPassword: string): Promise<void> => {
    // First reauthenticate
    await firebaseReauthenticate(currentPassword);
    // Then update email
    await firebaseUpdateEmail(newEmail);
    // Refresh the user state
    if (currentUser) {
      setCurrentUser({ ...currentUser, email: newEmail });
    }
  };

  const updatePassword = async (currentPassword: string, newPassword: string): Promise<void> => {
    // First reauthenticate
    await firebaseReauthenticate(currentPassword);
    // Then update password
    await firebaseUpdatePassword(newPassword);
  };

  const value: AuthContextType = {
    currentUser,
    loading,
    getIdToken,
    signIn,
    signInWithGoogle,
    signUp,
    signOut,
    updateProfile,
    updateEmail,
    updatePassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
