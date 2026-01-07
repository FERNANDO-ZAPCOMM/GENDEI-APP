import { initializeApp, getApps, FirebaseApp } from 'firebase/app';

// Re-export User type without triggering barrel optimization
// We define our own interface that matches firebase User
export interface FirebaseUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  emailVerified: boolean;
  providerData: Array<{
    providerId: string;
    uid: string;
    displayName: string | null;
    email: string | null;
    phoneNumber: string | null;
    photoURL: string | null;
  }>;
  getIdToken: (forceRefresh?: boolean) => Promise<string>;
}

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase app
function getFirebaseApp(): FirebaseApp {
  if (getApps().length === 0) {
    return initializeApp(firebaseConfig);
  }
  return getApps()[0];
}

// Lazy initialization to avoid SSR issues
let _app: FirebaseApp | undefined;

function ensureApp(): FirebaseApp {
  if (typeof window === 'undefined') {
    throw new Error('Firebase can only be used on the client side');
  }
  if (!_app) {
    _app = getFirebaseApp();
  }
  return _app;
}

// Auth functions - dynamically import to avoid barrel optimization issues
export async function getFirebaseAuth() {
  const app = ensureApp();
  const { getAuth } = await import('firebase/auth');
  return getAuth(app);
}

export async function firebaseSignIn(email: string, password: string) {
  const auth = await getFirebaseAuth();
  const { signInWithEmailAndPassword } = await import('firebase/auth');
  return signInWithEmailAndPassword(auth, email, password);
}

export async function firebaseSignUp(email: string, password: string) {
  const auth = await getFirebaseAuth();
  const { createUserWithEmailAndPassword } = await import('firebase/auth');
  return createUserWithEmailAndPassword(auth, email, password);
}

export async function firebaseSignOut() {
  const auth = await getFirebaseAuth();
  const { signOut } = await import('firebase/auth');
  return signOut(auth);
}

export async function firebaseSignInWithGoogle() {
  const auth = await getFirebaseAuth();
  const { GoogleAuthProvider, signInWithPopup } = await import('firebase/auth');
  const provider = new GoogleAuthProvider();
  return signInWithPopup(auth, provider);
}

export async function subscribeToAuthChanges(
  callback: (user: FirebaseUser | null) => void
): Promise<() => void> {
  const auth = await getFirebaseAuth();
  const { onAuthStateChanged } = await import('firebase/auth');
  return onAuthStateChanged(auth, (user) => {
    callback(user as FirebaseUser | null);
  });
}

// Storage functions
export async function getFirebaseStorage() {
  const app = ensureApp();
  const { getStorage } = await import('firebase/storage');
  return getStorage(app);
}

// Profile update functions
export async function firebaseUpdateProfile(displayName: string, photoURL?: string) {
  const auth = await getFirebaseAuth();
  const { updateProfile } = await import('firebase/auth');
  if (!auth.currentUser) throw new Error('No user logged in');
  return updateProfile(auth.currentUser, { displayName, photoURL: photoURL || null });
}

export async function firebaseUpdateEmail(newEmail: string) {
  const auth = await getFirebaseAuth();
  const { updateEmail } = await import('firebase/auth');
  if (!auth.currentUser) throw new Error('No user logged in');
  return updateEmail(auth.currentUser, newEmail);
}

export async function firebaseUpdatePassword(newPassword: string) {
  const auth = await getFirebaseAuth();
  const { updatePassword } = await import('firebase/auth');
  if (!auth.currentUser) throw new Error('No user logged in');
  return updatePassword(auth.currentUser, newPassword);
}

export async function firebaseReauthenticate(password: string) {
  const auth = await getFirebaseAuth();
  const { reauthenticateWithCredential, EmailAuthProvider } = await import('firebase/auth');
  if (!auth.currentUser?.email) throw new Error('No user logged in');
  const credential = EmailAuthProvider.credential(auth.currentUser.email, password);
  return reauthenticateWithCredential(auth.currentUser, credential);
}
