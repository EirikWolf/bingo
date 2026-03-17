import { create } from 'zustand';
import type { Location } from '@/types';

interface LocationState {
  locations: Location[];
  currentLocation: Location | null;
  loading: boolean;
  setLocations: (locations: Location[]) => void;
  setCurrentLocation: (location: Location | null) => void;
  setLoading: (loading: boolean) => void;
}

export const useLocationStore = create<LocationState>((set) => ({
  locations: [],
  currentLocation: null,
  loading: true,

  setLocations: (locations) => set({ locations, loading: false }),
  setCurrentLocation: (location) => set({ currentLocation: location }),
  setLoading: (loading) => set({ loading }),
}));
