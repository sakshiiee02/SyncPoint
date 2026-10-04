import { Mascot } from '@/domain/mascot';

export type TravelMode = 'CAR' | 'BIKE' | 'WALK';

/**
 * Lifecycle of one traveler inside a journey. UI must derive "waiting / on the way /
 * arrived" from this value — never from distance or from the presence of a location.
 *
 *   WAITING ──start──▶ TRAVELING ⇄ PAUSED
 *                         │
 *                         ├─arrive──▶ ARRIVED ──finish──▶ FINISHED
 *                         └─finish──▶ FINISHED
 *   (any, except FINISHED/LEFT) ──leave──▶ LEFT
 */
export type TravelerState =
  | 'WAITING'
  | 'TRAVELING'
  | 'PAUSED'
  | 'ARRIVED'
  | 'FINISHED'
  | 'LEFT';

export const TRAVELER_STATES: readonly TravelerState[] = [
  'WAITING',
  'TRAVELING',
  'PAUSED',
  'ARRIVED',
  'FINISHED',
  'LEFT',
];

/** How the traveler's starting point was chosen. */
export type OriginKind = 'GPS' | 'PLACE' | 'MAP';

/**
 * A traveler's starting point.
 *  - `GPS`: "wherever I am when I press Start". `lat`/`lng` stay null until the first
 *    real fix is taken, so no made-up coordinates are ever stored.
 *  - `PLACE` / `MAP`: fixed coordinates picked via search or on the map.
 */
export interface OriginLocation {
  kind: OriginKind;
  lat: number | null;
  lng: number | null;
  displayName: string;
}

export interface UserProfile {
  uid: string;
  name: string;
  username: string;
  phone: string;
  photoUrl?: string;
  /** The traveler's mascot, chosen in their profile. */
  mascot?: Mascot;
}

/** Member record stored at journeys/{journeyId}/members/{uid}. Visible to members only. */
export interface JourneyMember extends UserProfile {
  /** Seat slot (0..MAX_MEMBERS-1) claimed atomically to enforce the member cap. */
  seat: number;
  origin: OriginLocation;
  travelMode: TravelMode;
  state: TravelerState;
  joinedAt: number;
  startedAt: number | null;
  finishedAt: number | null;
}

/** States in which a traveler is actively part of the trip (counts toward "in progress"). */
export function isTravelingState(state: TravelerState): boolean {
  return state === 'TRAVELING' || state === 'PAUSED' || state === 'ARRIVED';
}

/** States after which the traveler can no longer participate. */
export function isTerminalTravelerState(state: TravelerState): boolean {
  return state === 'FINISHED' || state === 'LEFT';
}

export function hasCoordinates(
  origin: OriginLocation
): origin is OriginLocation & { lat: number; lng: number } {
  return typeof origin.lat === 'number' && typeof origin.lng === 'number';
}
