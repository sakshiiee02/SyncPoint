import { Database, get, ref, remove } from 'firebase/database';
import { JourneyMeta, UserJourneyRef, isTerminalJourneyStatus } from '@/types/journey';
import { JourneyMember, isTerminalTravelerState } from '@/types/member';
import { isJourneyExpired } from '@/domain/journeyRules';
import { findSeatOf } from '@/domain/seats';
import { Paths } from './paths';
import { serverNow } from './serverClock';
import { memberFromDb, metaFromDb } from './serialization';

export async function getUserJourney(db: Database, uid: string): Promise<UserJourneyRef | null> {
  const snap = await get(ref(db, Paths.userJourney(uid)));
  return snap.exists() ? (snap.val() as UserJourneyRef) : null;
}

export async function clearUserJourney(db: Database, uid: string): Promise<void> {
  await remove(ref(db, Paths.userJourney(uid)));
}

export interface ResumableJourney {
  meta: JourneyMeta;
  member: JourneyMember;
}

/**
 * Finds the journey this user should be returned to after an app restart, or null.
 * Stale references (journey ended/expired/deleted, user removed or already finished) are
 * cleaned up on the way, so Home never shows a "resume" card that leads nowhere.
 */
export async function resolveResumableJourney(
  db: Database,
  uid: string
): Promise<ResumableJourney | null> {
  const userRef = await getUserJourney(db, uid);
  if (!userRef) return null;

  const discard = async () => {
    await clearUserJourney(db, uid).catch(() => undefined);
    return null;
  };

  const metaSnap = await get(ref(db, Paths.meta(userRef.journeyId)));
  if (!metaSnap.exists()) return discard();
  const meta = metaFromDb(metaSnap.val());
  if (isTerminalJourneyStatus(meta.status) || isJourneyExpired(meta, serverNow(db))) {
    return discard();
  }

  const seats = (await get(ref(db, Paths.seats(userRef.journeyId)))).val();
  if (findSeatOf(seats, uid) === null) return discard();

  const memberSnap = await get(ref(db, Paths.member(userRef.journeyId, uid)));
  if (!memberSnap.exists()) return discard();
  const member = memberFromDb(uid, memberSnap.val());
  if (isTerminalTravelerState(member.state)) return discard();

  return { meta, member };
}
