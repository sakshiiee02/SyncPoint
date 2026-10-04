import { create } from 'zustand';
import { LiveLocationRecord } from '@/types/liveLocation';

/** What other travelers have published (journeys/{id}/live), plus which traveler is selected on the map. */
interface LiveLocationState {
  locations: Record<string, LiveLocationRecord>;
  selectedTravelerUid: string | null;

  setAllLocations: (locations: Record<string, LiveLocationRecord>) => void;
  setSelectedTravelerUid: (uid: string | null) => void;
  clearLocations: () => void;
}

export const useLiveLocationStore = create<LiveLocationState>((set) => ({
  locations: {},
  selectedTravelerUid: null,

  setAllLocations: (locations) => set({ locations }),
  setSelectedTravelerUid: (selectedTravelerUid) => set({ selectedTravelerUid }),
  clearLocations: () => set({ locations: {}, selectedTravelerUid: null }),
}));
