import { create } from 'zustand';
import { QuickStatusType } from '@/types/status';

export interface SelfFix {
  lat: number;
  lng: number;
  speedMps: number;
  heading: number;
  accuracy: number;
  timestamp: number;
}

export type GpsProblem = 'PERMISSION' | 'LOCATION_OFF' | null;

/**
 * This device's own live telemetry. Written only by the TrackingController, read by the UI.
 * It is separate from what is *published*, so the traveler's own marker is smooth and shows
 * their true battery even while sharing is paused or the network is down.
 */
interface TrackingState {
  isTracking: boolean;
  isPaused: boolean;
  selfFix: SelfFix | null;
  batteryPct: number | null;
  charging: boolean;
  status: QuickStatusType;
  distanceRemainingM: number | null;
  etaEpochMs: number | null;
  currentRoad: string;
  /** Set when arrival is detected so the UI can ask "Finish your trip?" exactly once. */
  arrivalPromptPending: boolean;

  set: (patch: Partial<Omit<TrackingState, 'set' | 'reset'>>) => void;
  reset: () => void;
}

const INITIAL = {
  isTracking: false,
  isPaused: false,
  selfFix: null,
  batteryPct: null,
  charging: false,
  status: 'ON_THE_WAY' as QuickStatusType,
  distanceRemainingM: null,
  etaEpochMs: null,
  currentRoad: '',
  arrivalPromptPending: false,
};

export const useTrackingStore = create<TrackingState>((set) => ({
  ...INITIAL,
  set: (patch) => set(patch),
  reset: () => set({ ...INITIAL }),
}));
