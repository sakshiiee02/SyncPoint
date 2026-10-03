import { create } from 'zustand';
import { JourneyMeta, JourneyStatus } from '@/types/journey';
import { JourneyMember, SharingState } from '@/types/member';

interface JourneyState {
  currentJourney: JourneyMeta | null;
  members: Record<string, JourneyMember>;
  activeJoinCode: string | null;
  isLoading: boolean;
  error: string | null;

  setCurrentJourney: (journey: JourneyMeta | null) => void;
  setMembers: (members: Record<string, JourneyMember>) => void;
  setActiveJoinCode: (code: string | null) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  updateMemberSharingState: (uid: string, state: SharingState) => void;
  updateJourneyStatus: (status: JourneyStatus) => void;
  resetJourney: () => void;
}

export const useJourneyStore = create<JourneyState>((set) => ({
  currentJourney: null,
  members: {},
  activeJoinCode: null,
  isLoading: false,
  error: null,

  setCurrentJourney: (journey) => set({ currentJourney: journey, error: null }),

  setMembers: (members) => set({ members }),

  setActiveJoinCode: (code) => set({ activeJoinCode: code }),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error, isLoading: false }),

  updateMemberSharingState: (uid, sharingState) => {
    set((state) => {
      const existing = state.members[uid];
      if (!existing) return state;
      return {
        members: {
          ...state.members,
          [uid]: { ...existing, sharingState },
        },
      };
    });
  },

  updateJourneyStatus: (status) => {
    set((state) => {
      if (!state.currentJourney) return state;
      return {
        currentJourney: { ...state.currentJourney, status },
      };
    });
  },

  resetJourney: () => {
    set({
      currentJourney: null,
      members: {},
      activeJoinCode: null,
      isLoading: false,
      error: null,
    });
  },
}));
