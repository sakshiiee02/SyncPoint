import { create } from 'zustand';
import { LiveLocationRecord, ParticipantLiveState } from '@/types/liveLocation';
import { UserProfile } from '@/types/member';
import { CONFIG } from '@/constants/config';

interface LiveLocationState {
  locations: Record<string, LiveLocationRecord>;
  isSharingPaused: boolean;
  selectedTravelerUid: string | null;

  updateParticipantLocation: (uid: string, record: LiveLocationRecord) => void;
  setAllLocations: (locations: Record<string, LiveLocationRecord>) => void;
  setSharingPaused: (isPaused: boolean) => void;
  setSelectedTravelerUid: (uid: string | null) => void;
  clearLocations: () => void;
}

export const useLiveLocationStore = create<LiveLocationState>((set) => ({
  locations: {},
  isSharingPaused: false,
  selectedTravelerUid: null,

  updateParticipantLocation: (uid, record) => {
    set((state) => ({
      locations: {
        ...state.locations,
        [uid]: record,
      },
    }));
  },

  setAllLocations: (locations) => set({ locations }),

  setSharingPaused: (isSharingPaused) => set({ isSharingPaused }),

  setSelectedTravelerUid: (selectedTravelerUid) => set({ selectedTravelerUid }),

  clearLocations: () => set({ locations: {}, selectedTravelerUid: null, isSharingPaused: false }),
}));

/**
 * Computes derived display properties for a participant (isStale, recency label, etc.)
 */
export function computeParticipantLiveState(
  record: LiveLocationRecord | undefined,
  profile: UserProfile,
  isLocalUser: boolean,
  nowMs: number = Date.now()
): ParticipantLiveState {
  const fallbackRecord: LiveLocationRecord = {
    lat: 0,
    lng: 0,
    heading: 0,
    speedMps: 0,
    batteryPct: 100,
    status: 'ON_THE_WAY',
    lastUpdatedAt: nowMs,
    currentRoad: 'Route corridor',
    distanceRemainingM: 0,
    etaEpochMs: nowMs,
    routeVersion: 1,
    isSharing: true,
  };

  const active = record || fallbackRecord;
  const isStale = nowMs - active.lastUpdatedAt > CONFIG.STALE_WARNING_MS;

  return {
    ...active,
    uid: profile.uid,
    name: profile.name,
    phone: profile.phone,
    photoUrl: profile.photoUrl,
    isLocalUser,
    isStale,
  };
}
