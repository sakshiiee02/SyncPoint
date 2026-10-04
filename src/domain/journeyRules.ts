import { JourneyMember } from '@/types/member';
import { JourneyMeta, isTerminalJourneyStatus } from '@/types/journey';

/** Server time is authoritative, but clients use their own clock to decide when to ask. */
export function isJourneyExpired(meta: Pick<JourneyMeta, 'expiresAt'>, nowMs: number): boolean {
  return nowMs >= meta.expiresAt;
}

export type JoinBlockReason = 'ENDED' | 'EXPIRED';

/** Why a journey cannot be joined right now, or null when joining is allowed. */
export function joinBlockReason(
  meta: Pick<JourneyMeta, 'status' | 'expiresAt'>,
  nowMs: number
): JoinBlockReason | null {
  if (isTerminalJourneyStatus(meta.status)) return 'ENDED';
  if (isJourneyExpired(meta, nowMs)) return 'EXPIRED';
  return null;
}

/**
 * Who inherits the journey when its creator leaves: the longest-standing member who has not
 * left or finished; otherwise the longest-standing member who has not left. Null when nobody
 * remains.
 */
export function pickNextCreator(
  members: Record<string, Pick<JourneyMember, 'uid' | 'joinedAt' | 'state'>>,
  leavingUid: string
): string | null {
  const others = Object.values(members).filter((m) => m.uid !== leavingUid && m.state !== 'LEFT');
  if (others.length === 0) return null;
  const byJoinTime = (a: { joinedAt: number; uid: string }, b: { joinedAt: number; uid: string }) =>
    a.joinedAt - b.joinedAt || a.uid.localeCompare(b.uid);
  const stillGoing = others.filter((m) => m.state !== 'FINISHED').sort(byJoinTime);
  if (stillGoing.length > 0) return stillGoing[0].uid;
  return others.sort(byJoinTime)[0].uid;
}

/** True when every remaining member has finished or left (journey can complete). */
export function allTravelersDone(
  members: Record<string, Pick<JourneyMember, 'state'>>
): boolean {
  const list = Object.values(members);
  return list.length > 0 && list.every((m) => m.state === 'FINISHED' || m.state === 'LEFT');
}
