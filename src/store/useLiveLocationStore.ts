import { create } from 'zustand';
import { LiveLocationRecord } from '@/types/liveLocation';
import { SharedRoute } from '@/types/route';

/** What other travelers have published (journeys/{id}/live), plus which traveler is selected on the map. */
interface LiveLocationState {
  locations: Record<string, LiveLocationRecord>;
  /** Routes other travelers have shared, by traveler id. */
  routes: Record<string, SharedRoute>;
  selectedTravelerUid: string | null;

  setAllLocations: (locations: Record<string, LiveLocationRecord>) => void;
  setRoutes: (routes: Record<string, SharedRoute>) => void;
  setSelectedTravelerUid: (uid: string | null) => void;
  clearLocations: () => void;
}

export const useLiveLocationStore = create<LiveLocationState>((set) => ({
  locations: {},
  routes: {},
  selectedTravelerUid: null,

  setAllLocations: (locations) => set({ locations }),
  setRoutes: (routes) => set({ routes }),
  setSelectedTravelerUid: (selectedTravelerUid) => set({ selectedTravelerUid }),
  clearLocations: () => set({ locations: {}, routes: {}, selectedTravelerUid: null }),
}));
