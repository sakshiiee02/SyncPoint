import { CONFIG } from '@/constants/config';

/**
 * Seats are the mechanism that enforces the member cap without a server: each journey
 * has MAX_MEMBERS slots at journeys/{id}/seats/{0..MAX-1}, and a slot can only be written
 * while empty. Two people racing for the same slot cannot both win.
 */
export type SeatMap = Record<string, string> | null | undefined;

export function countTakenSeats(seats: SeatMap): number {
  return seats ? Object.keys(seats).length : 0;
}

/** Seat already held by `uid`, if any (makes joining idempotent). */
export function findSeatOf(seats: SeatMap, uid: string): number | null {
  if (!seats) return null;
  for (const [index, holder] of Object.entries(seats)) {
    if (holder === uid) return Number(index);
  }
  return null;
}

/**
 * Picks the lowest free seat, skipping any in `exclude` (seats we already lost a race for).
 * Returns null when the journey is full.
 */
export function pickFreeSeat(
  seats: SeatMap,
  exclude: ReadonlySet<number> = new Set(),
  maxMembers: number = CONFIG.MAX_MEMBERS
): number | null {
  for (let i = 0; i < maxMembers; i++) {
    if (!seats || seats[String(i)] === undefined) {
      if (!exclude.has(i)) return i;
    }
  }
  return null;
}
