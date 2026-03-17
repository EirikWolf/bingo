import { create } from 'zustand';
import type { Game, Coupon } from '@/types';

interface GameState {
  currentGame: Game | null;
  coupons: Coupon[];
  activeCouponIndex: number;
  setCurrentGame: (game: Game | null) => void;
  setCoupons: (coupons: Coupon[]) => void;
  setActiveCouponIndex: (index: number) => void;
  reset: () => void;
}

export const useGameStore = create<GameState>((set) => ({
  currentGame: null,
  coupons: [],
  activeCouponIndex: 0,

  setCurrentGame: (game) => set({ currentGame: game }),
  setCoupons: (coupons) => set({ coupons }),
  setActiveCouponIndex: (index) => set({ activeCouponIndex: index }),
  reset: () => set({ currentGame: null, coupons: [], activeCouponIndex: 0 }),
}));
