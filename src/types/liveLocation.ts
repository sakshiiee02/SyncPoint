import { QuickStatusType } from './status';
import { TravelerState, TravelMode } from './member';

export type MotionState = 'FAST' | 'NORMAL' | 'SLOW' | 'STATIONARY';

/** What a traveler publishes to journeys/{id}/live/{uid} (schema v2). */
export interface LiveLocationRecord {
  lat: number;
  lng: number;
  heading: number;
  speedMps: number;
  /** Real device battery, 0-100. Omitted when the device could not report it. */
  batteryPct?: number;
  charging?: boolean;
  status: QuickStatusType;
  lastUpdatedAt: number;
  currentRoad: string;
  distanceRemainingM: number;
  etaEpochMs: number;
  routeVersion: number;
  isSharing: boolean;
}

/** Where the position shown for a traveler comes from. */
export type PositionKind =
  /** A real, shared GPS fix. */
  | 'LIVE'
  /** The traveler has not started; shown at their chosen starting point. */
  | 'ORIGIN'
  /** Nothing to show. */
  | 'NONE';

/**
 * Everything the UI needs to draw one traveler. Built by `buildParticipantViews` from the
 * member record (who they are, what state they are in) plus live data (where they are).
 * Numbers that are unknown are `null` — never a made-up default.
 */
export interface ParticipantLiveState {
  uid: string;
  name: string;
  phone: string;
  photoUrl?: string;
  isLocalUser: boolean;

  travelerState: TravelerState;
  travelMode: TravelMode;
  originLabel: string;

  positionKind: PositionKind;
  lat: number;
  lng: number;
  heading: number;
  speedMps: number;

  batteryPct: number | null;
  charging: boolean;
  status: QuickStatusType;
  currentRoad: string;
  distanceRemainingM: number | null;
  etaEpochMs: number | null;

  /** Server time of the last published update, null if none yet. */
  lastUpdatedAt: number | null;
  /** True while location is actively being shared (false when waiting, paused or finished). */
  isSharing: boolean;
  /** Sharing, but no update for longer than the stale threshold. */
  isStale: boolean;
}
