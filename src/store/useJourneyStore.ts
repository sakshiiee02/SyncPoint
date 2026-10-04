import { create } from 'zustand';
import { JourneyMeta } from '@/types/journey';
import { JourneyMember } from '@/types/member';

/** Why the journey the user was in stopped being usable. */
export type JourneyEndReason = 'COMPLETED' | 'CANCELLED' | 'EXPIRED' | 'REMOVED';

/**
 * Read-only mirror of the journey the user is currently part of. Only the JourneySession
 * (and the actions in journeyActions.ts) write to it; screens just read.
 */
interface JourneyState {
  activeJourneyId: string | null;
  currentJourney: JourneyMeta | null;
  members: Record<string, JourneyMember>;
  /** True once the first members snapshot arrived (before that the roster is unknown). */
  membersLoaded: boolean;
  endedReason: JourneyEndReason | null;

  setActiveJourney: (journeyId: string | null) => void;
  setCurrentJourney: (journey: JourneyMeta | null) => void;
  setMembers: (members: Record<string, JourneyMember>) => void;
  patchMember: (uid: string, patch: Partial<JourneyMember>) => void;
  setEnded: (reason: JourneyEndReason) => void;
  resetJourney: () => void;
}

const EMPTY = {
  activeJourneyId: null,
  currentJourney: null,
  members: {},
  membersLoaded: false,
  endedReason: null,
} as const;

export const useJourneyStore = create<JourneyState>((set) => ({
  ...EMPTY,

  setActiveJourney: (activeJourneyId) => set({ activeJourneyId }),

  setCurrentJourney: (currentJourney) =>
    set({ currentJourney, activeJourneyId: currentJourney?.journeyId ?? null }),

  setMembers: (members) => set({ members, membersLoaded: true }),

  patchMember: (uid, patch) =>
    set((state) => {
      const existing = state.members[uid];
      if (!existing) return state;
      return { members: { ...state.members, [uid]: { ...existing, ...patch } } };
    }),

  setEnded: (endedReason) => set({ endedReason }),

  resetJourney: () => set({ ...EMPTY, members: {} }),
}));
