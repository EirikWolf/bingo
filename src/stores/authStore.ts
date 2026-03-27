import { create } from 'zustand';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '@/services/firebase';
import type { User } from '@/types';

interface AuthState {
  firebaseUser: FirebaseUser | null;
  user: User | null;
  loading: boolean;
  error: string | null;
  initialize: () => () => void;
}

let _initialized = false;
let _cleanup: (() => void) | null = null;

export const useAuthStore = create<AuthState>((set) => ({
  firebaseUser: null,
  user: null,
  loading: true,
  error: null,

  initialize: () => {
    // Prevent double initialization (e.g. StrictMode or multiple mount)
    if (_initialized && _cleanup) {
      return _cleanup;
    }
    _initialized = true;

    let unsubUser: (() => void) | null = null;
    let currentUid: string | null = null;

    const unsubAuth = onAuthStateChanged(auth, (firebaseUser) => {
      // Skip if same user (token renewal — don't flash loading)
      if (firebaseUser && firebaseUser.uid === currentUid) {
        set({ firebaseUser });
        return;
      }

      // Clean up previous Firestore listener
      if (unsubUser) {
        unsubUser();
        unsubUser = null;
      }

      currentUid = firebaseUser?.uid ?? null;

      if (firebaseUser) {
        set({ firebaseUser, loading: true });

        // Listen to user document in Firestore
        unsubUser = onSnapshot(
          doc(db, 'users', firebaseUser.uid),
          (snap) => {
            if (snap.exists()) {
              const userData = { ...snap.data(), uid: snap.id } as User;
              set({ user: userData, loading: false, error: null });
            } else {
              // User document not yet created (race condition)
              set({ user: null, loading: false });
            }
          },
          (error) => {
            console.error('User document listener error:', error);
            set({ error: error.message, loading: false });
          }
        );
      } else {
        set({ firebaseUser: null, user: null, loading: false, error: null });
      }
    });

    // Return cleanup function
    _cleanup = () => {
      _initialized = false;
      _cleanup = null;
      unsubAuth();
      if (unsubUser) unsubUser();
    };
    return _cleanup;
  },
}));
