import {
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInAnonymously,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  updateProfile,
  type User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';
import type { UserRole } from '@/types';

const googleProvider = new GoogleAuthProvider();

/** Sign in with Google popup */
export async function signInWithGoogle(): Promise<FirebaseUser> {
  const result = await signInWithPopup(auth, googleProvider);
  await ensureUserDocument(result.user);
  return result.user;
}

/** Sign in with email and password */
export async function signInWithEmail(email: string, password: string): Promise<FirebaseUser> {
  const result = await signInWithEmailAndPassword(auth, email, password);
  await ensureUserDocument(result.user);
  return result.user;
}

/** Register with email, password and display name */
export async function registerWithEmail(
  email: string,
  password: string,
  displayName: string
): Promise<FirebaseUser> {
  const result = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(result.user, { displayName });
  await ensureUserDocument(result.user, displayName);
  return result.user;
}

/** Sign in anonymously */
export async function signInAnon(): Promise<FirebaseUser> {
  const result = await signInAnonymously(auth);
  await ensureUserDocument(result.user, 'Anonym spiller');
  return result.user;
}

/** Sign out */
export async function signOut(): Promise<void> {
  await firebaseSignOut(auth);
}

/** Send password reset email */
export async function resetPassword(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email);
}

/**
 * Ensure a user document exists in Firestore.
 * Creates one with role 'player' if it doesn't exist.
 */
async function ensureUserDocument(
  firebaseUser: FirebaseUser,
  fallbackName?: string
): Promise<void> {
  const userRef = doc(db, 'users', firebaseUser.uid);
  const snap = await getDoc(userRef);

  if (!snap.exists()) {
    const displayName = firebaseUser.displayName ?? fallbackName ?? 'Ukjent bruker';
    await setDoc(userRef, {
      uid: firebaseUser.uid,
      displayName,
      email: firebaseUser.email ?? null,
      phone: firebaseUser.phoneNumber ?? null,
      photoURL: firebaseUser.photoURL ?? null,
      role: 'player' as UserRole,
      activeLocationId: null,
      createdAt: serverTimestamp(),
      lastActiveAt: serverTimestamp(),
    });
  } else {
    // Update lastActiveAt on existing users
    const { updateDoc } = await import('firebase/firestore');
    await updateDoc(userRef, { lastActiveAt: serverTimestamp() });
  }
}
