import { create } from 'zustand';
import { RouteRecord } from '@/types/route';
import { NavigationProgress } from '@/services/routing/navigationEngine';

interface NavigationState {
  activeRoute: RouteRecord | null;
  savedCanonicalRoute: RouteRecord | null;
  currentStepIndex: number;
  distanceToNextManeuverM: number;
  nextInstruction: string;
  maneuverIcon: string;
  isOffRoute: boolean;
  isSecondaryRoute: boolean;
  secondaryTravelerName: string | null;

  setActiveRoute: (route: RouteRecord | null) => void;
  updateProgress: (progress: NavigationProgress) => void;
  startSecondaryRouteToTraveler: (travelerName: string, secondaryRoute: RouteRecord) => void;
  exitSecondaryRoute: () => void;
  resetNavigation: () => void;
}

export const useNavigationStore = create<NavigationState>((set, get) => ({
  activeRoute: null,
  savedCanonicalRoute: null,
  currentStepIndex: 0,
  distanceToNextManeuverM: 0,
  nextInstruction: 'Follow route to destination',
  maneuverIcon: '⬆️',
  isOffRoute: false,
  isSecondaryRoute: false,
  secondaryTravelerName: null,

  setActiveRoute: (activeRoute) =>
    set({
      activeRoute,
      savedCanonicalRoute: activeRoute,
      isSecondaryRoute: false,
      secondaryTravelerName: null,
      isOffRoute: false,
    }),

  updateProgress: (progress) =>
    set({
      currentStepIndex: progress.currentStepIndex,
      distanceToNextManeuverM: progress.distanceToNextManeuverM,
      nextInstruction: progress.instruction,
      maneuverIcon: progress.maneuverIcon,
      isOffRoute: progress.isOffRoute,
    }),

  startSecondaryRouteToTraveler: (travelerName, secondaryRoute) => {
    const current = get();
    // Save canonical route if not already in secondary mode
    const canonical = current.savedCanonicalRoute || current.activeRoute;
    set({
      savedCanonicalRoute: canonical,
      activeRoute: secondaryRoute,
      isSecondaryRoute: true,
      secondaryTravelerName: travelerName,
      isOffRoute: false,
    });
  },

  exitSecondaryRoute: () => {
    const saved = get().savedCanonicalRoute;
    set({
      activeRoute: saved,
      isSecondaryRoute: false,
      secondaryTravelerName: null,
      isOffRoute: false,
    });
  },

  resetNavigation: () =>
    set({
      activeRoute: null,
      savedCanonicalRoute: null,
      currentStepIndex: 0,
      distanceToNextManeuverM: 0,
      nextInstruction: 'Follow route to destination',
      maneuverIcon: '⬆️',
      isOffRoute: false,
      isSecondaryRoute: false,
      secondaryTravelerName: null,
    }),
}));
