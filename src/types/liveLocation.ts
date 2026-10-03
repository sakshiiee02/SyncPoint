import { QuickStatusType } from './status';

export type MotionState = 'FAST' | 'NORMAL' | 'SLOW' | 'STATIONARY';

export interface LiveLocationRecord {
  lat: number;
  lng: number;
  heading: number;
  speedMps: number;
  batteryPct: number;
  status: QuickStatusType;
  lastUpdatedAt: number;
  currentRoad: string;
  distanceRemainingM: number;
  etaEpochMs: number;
  routeVersion: number;
  isSharing: boolean;
}

export interface ParticipantLiveState extends LiveLocationRecord {
  uid: string;
  name: string;
  phone: string;
  photoUrl?: string;
  isLocalUser: boolean;
  isStale: boolean;
}
