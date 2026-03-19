import { create } from 'zustand';
import { listenToGame, listenToLocation, listenToUserCoupons } from '@/services/firestore';
import type { Game, Location, Coupon } from '@/types';

interface GameState {
  location: Location | null;
  game: Game | null;
  coupons: Coupon[];
  loading: boolean;
  activeCouponIndex: number;

  initializeLocation: (locationId: string) => () => void;
  initializeGame: (locationId: string, gameId: string) => () => void;
  initializeUserCoupons: (locationId: string, gameId: string, userId: string) => () => void;
  setActiveCouponIndex: (index: number) => void;
  reset: () => void;
}

export const useGameStore = create<GameState>((set) => ({
  location: null,
  game: null,
  coupons: [],
  loading: true,
  activeCouponIndex: 0,

  initializeLocation: (locationId: string) => {
    set({ loading: true });
    return listenToLocation(locationId, (location) => {
      set({ location, loading: false });
    });
  },

  initializeGame: (locationId: string, gameId: string) => {
    return listenToGame(locationId, gameId, (game) => {
      set({ game });
    });
  },

  initializeUserCoupons: (locationId: string, gameId: string, userId: string) => {
    return listenToUserCoupons(locationId, gameId, userId, (coupons) => {
      set({ coupons });
    });
  },

  setActiveCouponIndex: (index: number) => {
    set({ activeCouponIndex: index });
  },

  reset: () => {
    set({ location: null, game: null, coupons: [], loading: true, activeCouponIndex: 0 });
  },
}));
