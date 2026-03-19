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

export const useLocationStore = create<LocationState>((set) => ({
  locations: [],
  loading: true,
  selectedLocationId: null,

  initialize: () => {
    const unsub = listenToLocations((locations) => {
      set({ locations, loading: false });
    });
    return unsub;
  },

  selectLocation: (locationId: string) => {
    set({ selectedLocationId: locationId });
  },
}));
