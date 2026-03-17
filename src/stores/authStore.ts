import { create } from 'zustand';
import type { User as FirebaseUser } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { onAuthChange } from '@/services/auth';
import type { User, UserRole } from '@/types';

interface AuthState {
  firebaseUser: FirebaseUser | null;
  userProfile: User | null;
  loading: boolean;
  initialized: boolean;
  init: () => () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  firebaseUser: null,
  userProfile: null,
  loading: true,
  initialized: false,

  init: () => {
    if (get().initialized) return () => {};

    let profileUnsub: (() => void) | null = null;

    const authUnsub = onAuthChange((firebaseUser) => {
      if (profileUnsub) {
        profileUnsub();
        profileUnsub = null;
      }

      if (firebaseUser) {
        set({ firebaseUser, loading: true });

        profileUnsub = onSnapshot(doc(db, 'users', firebaseUser.uid), (snap) => {
          const userProfile = snap.exists()
            ? ({ id: snap.id, ...snap.data() } as unknown as User)
            : null;
          set({ userProfile, loading: false });
        });
      } else {
        set({ firebaseUser: null, userProfile: null, loading: false });
      }
    });

    set({ initialized: true });

    return () => {
      authUnsub();
      if (profileUnsub) profileUnsub();
    };
  },
}));

// Hjelpefunksjoner
export const useIsAuthenticated = () => useAuthStore((s) => s.firebaseUser !== null);
export const useUserRole = (): UserRole | null => useAuthStore((s) => s.userProfile?.role ?? null);
export const useUserId = (): string | null => useAuthStore((s) => s.firebaseUser?.uid ?? null);
