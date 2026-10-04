export type JourneyStatus = 'LOBBY' | 'ACTIVE' | 'COMPLETED' | 'EXPIRED' | 'CANCELLED';

export const TERMINAL_JOURNEY_STATUSES: readonly JourneyStatus[] = [
  'COMPLETED',
  'EXPIRED',
  'CANCELLED',
];

export function isTerminalJourneyStatus(status: JourneyStatus): boolean {
  return TERMINAL_JOURNEY_STATUSES.includes(status);
}

/** Bumped whenever the RTDB layout changes incompatibly. */
export const JOURNEY_SCHEMA_VERSION = 2;

export interface Destination {
  lat: number;
  lng: number;
  placeId?: string;
  displayName: string;
  address?: string;
}

/**
 * journeys/{journeyId}/meta. Readable by any signed-in user who knows the (unguessable)
 * journeyId, which is what lets someone preview a journey before joining it.
 * The creator is whoever `creatorUid` points at — ownership can be handed off.
 */
export interface JourneyMeta {
  journeyId: string;
  name: string;
  status: JourneyStatus;
  creatorUid: string;
  /** Short invite code. Stored on the journey so it survives app restarts and every member can share it. */
  joinCode: string;
  createdAt: number;
  startedAt: number | null;
  expiresAt: number;
  destination: Destination;
  schemaVersion: number;
}

/** joinCodes/{CODE}: resolves a short code to a journey. Looked up by exact key only. */
export interface JoinCodeRecord {
  journeyId: string;
  expiresAt: number;
}

/** userJourney/{uid}: the one journey this user is currently part of. */
export interface UserJourneyRef {
  journeyId: string;
  joinedAt: number;
  expiresAt: number;
}

/** What a person sees after entering a code, before they commit to joining. */
export interface JourneyPreview {
  meta: JourneyMeta;
  seatsTaken: number;
}
