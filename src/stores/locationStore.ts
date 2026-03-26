import { create } from 'zustand';
import { listenToLocations } from '@/services/firestore';
import type { Location } from '@/types';

interface LocationState {
  locations: Location[];
  loading: boolean;
  selectedLocationId: string | null;
  initialize: () => () => void;
  selectLocation: (locationId: string) => void;
}

let initUnsub: (() => void) | null = null;

export const useLocationStore = create<LocationState>((set) => ({
  locations: [],
  loading: true,
  selectedLocationId: null,

  initialize: () => {
    // Guard against double-init in StrictMode
    if (initUnsub) {
      initUnsub();
    }
    initUnsub = listenToLocations((locations) => {
      set({ locations, loading: false });
    });
    return () => {
      if (initUnsub) {
        initUnsub();
        initUnsub = null;
      }
    };
  },

  selectLocation: (locationId: string) => {
    set({ selectedLocationId: locationId });
  },
}));
