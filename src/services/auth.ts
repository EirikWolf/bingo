import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signInAnonymously,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile,
  type User as FirebaseUser,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';
import type { User } from '@/types';

const googleProvider = new GoogleAuthProvider();

export async function signInWithGoogle(): Promise<FirebaseUser> {
  const result = await signInWithPopup(auth, googleProvider);
  await ensureUserDocument(result.user);
  return result.user;
}

export async function signInWithEmail(email: string, password: string): Promise<FirebaseUser> {
  const result = await signInWithEmailAndPassword(auth, email, password);
  await ensureUserDocument(result.user);
  return result.user;
}

export async function signUpWithEmail(
  email: string,
  password: string,
  displayName: string
): Promise<FirebaseUser> {
  const result = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(result.user, { displayName });
  await ensureUserDocument(result.user, displayName);
  return result.user;
}

export async function signInAsGuest(): Promise<FirebaseUser> {
  const result = await signInAnonymously(auth);
  await ensureUserDocument(result.user, 'Gjest');
  return result.user;
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(auth);
}

export function onAuthChange(callback: (user: FirebaseUser | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}

async function ensureUserDocument(firebaseUser: FirebaseUser, fallbackName?: string): Promise<void> {
  const userRef = doc(db, 'users', firebaseUser.uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    const userData: Omit<User, 'createdAt' | 'lastActiveAt'> & {
      createdAt: ReturnType<typeof serverTimestamp>;
      lastActiveAt: ReturnType<typeof serverTimestamp>;
    } = {
      uid: firebaseUser.uid,
      displayName: firebaseUser.displayName || fallbackName || 'Anonym',
      email: firebaseUser.email,
      photoURL: firebaseUser.photoURL,
      role: 'player',
      activeLocationId: null,
      createdAt: serverTimestamp(),
      lastActiveAt: serverTimestamp(),
    };
    await setDoc(userRef, userData);
  } else {
    await setDoc(userRef, { lastActiveAt: serverTimestamp() }, { merge: true });
  }
}
