import { Database, get, onValue, push, ref, update } from 'firebase/database';
import { CONFIG } from '@/constants/config';
import {
  Destination,
  JourneyMeta,
  JourneyPreview,
  JOURNEY_SCHEMA_VERSION,
  UserJourneyRef,
  isTerminalJourneyStatus,
} from '@/types/journey';
import {
  JourneyMember,
  OriginLocation,
  TravelMode,
  TravelerState,
  UserProfile,
  isTravelingState,
} from '@/types/member';
import { generateJoinCode, isValidJoinCode, normalizeJoinCode } from '@/domain/joinCode';
import { countTakenSeats, findSeatOf, pickFreeSeat } from '@/domain/seats';
import {
  InvalidTransitionError,
  TravelerAction,
  applyTravelerAction,
} from '@/domain/travelerState';
import {
  allTravelersDone,
  isJourneyExpired,
  joinBlockReason,
  pickNextCreator,
} from '@/domain/journeyRules';
import { JourneyError, isPermissionDenied, toJourneyError } from './errors';
import { Paths } from './paths';
import { serverNow } from './serverClock';
import {
  memberFromDb,
  memberToDb,
  membersFromDb,
  metaFromDb,
  metaToDb,
  stripUndefined,
} from './serialization';

const WRITE_TIMEOUT_MS = 15000;
const MAX_CODE_ATTEMPTS = 6;

function withTimeout<T>(promise: Promise<T>, ms: number = WRITE_TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new JourneyError('TIMEOUT')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

async function read(db: Database, path: string) {
  try {
    return await withTimeout(get(ref(db, path)));
  } catch (error) {
    throw toJourneyError(error);
  }
}

async function write(db: Database, updates: Record<string, unknown>): Promise<void> {
  await withTimeout(update(ref(db), updates));
}

async function readMeta(db: Database, journeyId: string): Promise<JourneyMeta> {
  const snap = await read(db, Paths.meta(journeyId));
  if (!snap.exists()) throw new JourneyError('JOURNEY_NOT_FOUND');
  return metaFromDb(snap.val());
}

/** Throws unless the user is free to start/join a journey (stale references are ignored). */
async function assertFreeToJoin(db: Database, uid: string, targetJourneyId?: string): Promise<void> {
  const snap = await read(db, Paths.userJourney(uid));
  if (!snap.exists()) return;
  const current = snap.val() as UserJourneyRef;
  if (targetJourneyId && current.journeyId === targetJourneyId) return;

  const now = serverNow(db);
  if (current.expiresAt <= now) return;

  const metaSnap = await read(db, Paths.meta(current.journeyId));
  if (!metaSnap.exists()) return;
  const meta = metaFromDb(metaSnap.val());
  if (isTerminalJourneyStatus(meta.status) || isJourneyExpired(meta, now)) return;

  const seats = (await read(db, Paths.seats(current.journeyId))).val();
  if (findSeatOf(seats, uid) === null) return; // removed from that journey

  throw new JourneyError('ALREADY_IN_JOURNEY', undefined, current.journeyId);
}

export interface CreateJourneyInput {
  name: string;
  destination: Destination;
  expiryHours: number;
  origin: OriginLocation;
  travelMode: TravelMode;
}

export interface JoinedJourney {
  meta: JourneyMeta;
  member: JourneyMember;
}

async function joinCodeTaken(db: Database, code: string): Promise<boolean> {
  const snap = await get(ref(db, Paths.joinCode(code)));
  return snap.exists();
}

/** Creates a journey with the caller as creator, first member (seat 0) and holder of its code. */
export async function createJourney(
  db: Database,
  creator: UserProfile,
  input: CreateJourneyInput
): Promise<JoinedJourney> {
  await assertFreeToJoin(db, creator.uid);

  const journeyId = push(ref(db, Paths.journeys())).key;
  if (!journeyId) throw new JourneyError('UNKNOWN');

  const now = serverNow(db);
  const expiresAt = now + input.expiryHours * 60 * 60 * 1000;

  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
    const joinCode = generateJoinCode();
    const meta: JourneyMeta = {
      journeyId,
      name: input.name.trim(),
      status: 'LOBBY',
      creatorUid: creator.uid,
      joinCode,
      createdAt: now,
      startedAt: null,
      expiresAt,
      destination: input.destination,
      schemaVersion: JOURNEY_SCHEMA_VERSION,
    };
    const member: JourneyMember = {
      ...creator,
      seat: 0,
      origin: input.origin,
      travelMode: input.travelMode,
      state: 'WAITING',
      joinedAt: now,
      startedAt: null,
      finishedAt: null,
    };
    const userRef: UserJourneyRef = { journeyId, joinedAt: now, expiresAt };

    try {
      await write(db, {
        [Paths.meta(journeyId)]: metaToDb(meta),
        [Paths.seat(journeyId, 0)]: creator.uid,
        [Paths.member(journeyId, creator.uid)]: memberToDb(member),
        [Paths.joinCode(joinCode)]: { journeyId, expiresAt },
        [Paths.userJourney(creator.uid)]: stripUndefined(userRef),
      });
      return { meta, member };
    } catch (error) {
      // The only expected rejection is a short-code collision: pick another code.
      if (isPermissionDenied(error) && (await joinCodeTaken(db, joinCode).catch(() => false))) {
        continue;
      }
      throw toJourneyError(error);
    }
  }
  throw new JourneyError('UNKNOWN', 'Could not allocate an invite code. Please try again.');
}

/** Resolves a typed/scanned code to a journey preview. Throws a JourneyError when unusable. */
export async function lookupJourneyByCode(db: Database, rawCode: string): Promise<JourneyPreview> {
  const code = normalizeJoinCode(rawCode);
  if (!isValidJoinCode(code)) throw new JourneyError('CODE_NOT_FOUND');

  const codeSnap = await read(db, Paths.joinCode(code));
  if (!codeSnap.exists()) throw new JourneyError('CODE_NOT_FOUND');

  const record = codeSnap.val() as { journeyId: string; expiresAt: number };
  if (record.expiresAt <= serverNow(db)) throw new JourneyError('CODE_EXPIRED');

  const meta = await readMeta(db, record.journeyId);
  const block = joinBlockReason(meta, serverNow(db));
  if (block === 'ENDED') throw new JourneyError('JOURNEY_ENDED');
  if (block === 'EXPIRED') throw new JourneyError('JOURNEY_EXPIRED');

  const seats = (await read(db, Paths.seats(meta.journeyId))).val();
  return { meta, seatsTaken: countTakenSeats(seats) };
}

export interface TravelerSetup {
  origin: OriginLocation;
  travelMode: TravelMode;
}

/**
 * Joins a journey: claims the lowest free seat atomically together with the member record
 * and the user's active-journey reference. Safe to call again (idempotent for existing members).
 */
export async function joinJourney(
  db: Database,
  user: UserProfile,
  journeyId: string,
  setup: TravelerSetup
): Promise<JoinedJourney> {
  await assertFreeToJoin(db, user.uid, journeyId);

  let meta = await readMeta(db, journeyId);
  const triedSeats = new Set<number>();

  for (let attempt = 0; attempt <= CONFIG.MAX_MEMBERS + 2; attempt++) {
    const now = serverNow(db);
    const block = joinBlockReason(meta, now);
    if (block === 'ENDED') throw new JourneyError('JOURNEY_ENDED');
    if (block === 'EXPIRED') throw new JourneyError('JOURNEY_EXPIRED');

    const seats = (await read(db, Paths.seats(journeyId))).val();
    const existingSeat = findSeatOf(seats, user.uid);
    const seat = existingSeat ?? pickFreeSeat(seats, triedSeats);
    if (seat === null) throw new JourneyError('JOURNEY_FULL');

    let prior: JourneyMember | null = null;
    if (existingSeat !== null) {
      const priorSnap = await read(db, Paths.member(journeyId, user.uid));
      if (priorSnap.exists()) prior = memberFromDb(user.uid, priorSnap.val());
    }
    const keepPriorSetup = prior !== null && prior.state !== 'WAITING';

    const member: JourneyMember = {
      ...user,
      seat,
      origin: keepPriorSetup ? prior!.origin : setup.origin,
      travelMode: keepPriorSetup ? prior!.travelMode : setup.travelMode,
      state: prior?.state ?? 'WAITING',
      joinedAt: prior?.joinedAt ?? now,
      startedAt: prior?.startedAt ?? null,
      finishedAt: prior?.finishedAt ?? null,
    };

    const updates: Record<string, unknown> = {
      [Paths.member(journeyId, user.uid)]: memberToDb(member),
      [Paths.userJourney(user.uid)]: {
        journeyId,
        joinedAt: member.joinedAt,
        expiresAt: meta.expiresAt,
      } satisfies UserJourneyRef,
    };
    if (existingSeat === null) updates[Paths.seat(journeyId, seat)] = user.uid;

    try {
      await write(db, updates);
      return { meta, member };
    } catch (error) {
      if (!isPermissionDenied(error)) throw toJourneyError(error);
      // Someone else took this seat (or the journey just ended): re-evaluate and retry.
      triedSeats.add(seat);
      meta = await readMeta(db, journeyId);
    }
  }
  throw new JourneyError('JOURNEY_FULL');
}

/** Updates the caller's mascot in a journey they belong to (allowed at any time). */
export async function updateMascot(
  db: Database,
  journeyId: string,
  uid: string,
  mascot: { animal: string; color: string }
): Promise<void> {
  try {
    await write(db, { [`${Paths.member(journeyId, uid)}/mascot`]: mascot });
  } catch (error) {
    throw toJourneyError(error);
  }
}

/** Lets a traveler change origin / travel mode — only possible until they press Start. */
export async function updateTravelerSetup(
  db: Database,
  journeyId: string,
  uid: string,
  setup: Partial<TravelerSetup>
): Promise<void> {
  const updates: Record<string, unknown> = {};
  if (setup.origin) {
    updates[`${Paths.member(journeyId, uid)}/origin`] = stripUndefined({
      kind: setup.origin.kind,
      displayName: setup.origin.displayName,
      lat: setup.origin.lat,
      lng: setup.origin.lng,
    });
  }
  if (setup.travelMode) updates[`${Paths.member(journeyId, uid)}/travelMode`] = setup.travelMode;
  if (Object.keys(updates).length === 0) return;
  try {
    await write(db, updates);
  } catch (error) {
    throw toJourneyError(error);
  }
}

async function readOwnMember(db: Database, journeyId: string, uid: string): Promise<JourneyMember> {
  const snap = await read(db, Paths.member(journeyId, uid));
  if (!snap.exists()) throw new JourneyError('NOT_A_MEMBER');
  return memberFromDb(uid, snap.val());
}

function applyAction(state: TravelerState, action: TravelerAction): TravelerState {
  try {
    return applyTravelerAction(state, action);
  } catch (error) {
    if (error instanceof InvalidTransitionError) throw new JourneyError('INVALID_TRANSITION');
    throw error;
  }
}

/**
 * WAITING → TRAVELING. If this is the first traveler to start, the journey flips LOBBY → ACTIVE
 * in the same atomic write. `resolvedOrigin` carries the real GPS fix for "current location" starts.
 */
export async function startTraveling(
  db: Database,
  journeyId: string,
  uid: string,
  resolvedOrigin?: OriginLocation
): Promise<TravelerState> {
  const meta = await readMeta(db, journeyId);
  const block = joinBlockReason(meta, serverNow(db));
  if (block === 'ENDED') throw new JourneyError('JOURNEY_ENDED');
  if (block === 'EXPIRED') throw new JourneyError('JOURNEY_EXPIRED');

  const prior = await readOwnMember(db, journeyId, uid);
  if (isTravelingState(prior.state)) return prior.state; // already started: idempotent
  const next = applyAction(prior.state, 'START');
  const now = serverNow(db);

  const base: Record<string, unknown> = {
    [`${Paths.member(journeyId, uid)}/state`]: next,
    [`${Paths.member(journeyId, uid)}/startedAt`]: now,
  };
  if (resolvedOrigin) {
    base[`${Paths.member(journeyId, uid)}/origin`] = stripUndefined({
      kind: resolvedOrigin.kind,
      displayName: resolvedOrigin.displayName,
      lat: resolvedOrigin.lat,
      lng: resolvedOrigin.lng,
    });
  }

  const withMeta: Record<string, unknown> = { ...base };
  if (meta.status === 'LOBBY') {
    withMeta[`${Paths.meta(journeyId)}/status`] = 'ACTIVE';
    if (meta.startedAt === null) withMeta[`${Paths.meta(journeyId)}/startedAt`] = now;
  }

  try {
    await write(db, withMeta);
  } catch (error) {
    // Another traveler flipped the journey to ACTIVE first: retry with only our own fields.
    if (!isPermissionDenied(error) || meta.status !== 'LOBBY') throw toJourneyError(error);
    try {
      await write(db, base);
    } catch (retryError) {
      throw toJourneyError(retryError);
    }
  }
  return next;
}

/** PAUSE / RESUME / ARRIVE for the caller. Returns the new state. */
export async function changeTravelerState(
  db: Database,
  journeyId: string,
  uid: string,
  action: Extract<TravelerAction, 'PAUSE' | 'RESUME' | 'ARRIVE'>
): Promise<TravelerState> {
  const prior = await readOwnMember(db, journeyId, uid);
  const next = applyAction(prior.state, action);
  try {
    await write(db, { [`${Paths.member(journeyId, uid)}/state`]: next });
  } catch (error) {
    throw toJourneyError(error);
  }
  return next;
}

/**
 * Finishes the caller's trip: records FINISHED, removes their live location and releases their
 * active-journey slot. The last traveler to finish also completes the journey.
 */
export async function finishTraveler(
  db: Database,
  journeyId: string,
  uid: string
): Promise<{ state: TravelerState; journeyCompleted: boolean }> {
  const membersSnap = await read(db, Paths.members(journeyId));
  const members = membersFromDb(membersSnap.val());
  const prior = members[uid];
  if (!prior) throw new JourneyError('NOT_A_MEMBER');
  const next = applyAction(prior.state, 'FINISH');

  const afterFinish = { ...members, [uid]: { ...prior, state: next } };
  const meta = await readMeta(db, journeyId);
  const journeyCompleted =
    allTravelersDone(afterFinish) && !isTerminalJourneyStatus(meta.status);

  const updates: Record<string, unknown> = {
    [`${Paths.member(journeyId, uid)}/state`]: next,
    [`${Paths.member(journeyId, uid)}/finishedAt`]: serverNow(db),
    [Paths.liveOf(journeyId, uid)]: null,
    [Paths.routeOf(journeyId, uid)]: null,
    [Paths.userJourney(uid)]: null,
  };
  if (journeyCompleted) updates[`${Paths.meta(journeyId)}/status`] = 'COMPLETED';

  try {
    await write(db, updates);
  } catch (error) {
    throw toJourneyError(error);
  }
  return { state: next, journeyCompleted };
}

/**
 * Leaves the journey. A leaving creator hands ownership to the longest-standing remaining member;
 * if nobody remains the journey is closed.
 */
export async function leaveJourney(db: Database, journeyId: string, uid: string): Promise<void> {
  const metaSnap = await read(db, Paths.meta(journeyId));
  const updates: Record<string, unknown> = { [Paths.userJourney(uid)]: null };

  if (metaSnap.exists()) {
    const meta = metaFromDb(metaSnap.val());
    const members = membersFromDb((await read(db, Paths.members(journeyId))).val());
    const me = members[uid];

    if (me) {
      updates[Paths.member(journeyId, uid)] = null;
      updates[Paths.seat(journeyId, me.seat)] = null;
      updates[Paths.liveOf(journeyId, uid)] = null;
      updates[Paths.routeOf(journeyId, uid)] = null;

      if (meta.creatorUid === uid && !isTerminalJourneyStatus(meta.status)) {
        const next = pickNextCreator(members, uid);
        if (next) {
          updates[`${Paths.meta(journeyId)}/creatorUid`] = next;
        } else {
          updates[`${Paths.meta(journeyId)}/status`] =
            meta.status === 'LOBBY' ? 'CANCELLED' : 'COMPLETED';
          if (meta.joinCode) updates[Paths.joinCode(meta.joinCode)] = null;
        }
      }
    }
  }

  try {
    await write(db, updates);
  } catch (error) {
    throw toJourneyError(error);
  }
}

/** Creator-only: removes another member from the journey. */
export async function removeMember(
  db: Database,
  journeyId: string,
  actorUid: string,
  targetUid: string
): Promise<void> {
  const meta = await readMeta(db, journeyId);
  if (meta.creatorUid !== actorUid) throw new JourneyError('NOT_ALLOWED');
  const target = await readOwnMember(db, journeyId, targetUid);
  try {
    await write(db, {
      [Paths.member(journeyId, targetUid)]: null,
      [Paths.seat(journeyId, target.seat)]: null,
      [Paths.liveOf(journeyId, targetUid)]: null,
      [Paths.routeOf(journeyId, targetUid)]: null,
    });
  } catch (error) {
    throw toJourneyError(error);
  }
}

/** Creator-only: ends the journey for everyone (CANCELLED while still in the lobby). */
export async function endJourney(db: Database, journeyId: string, actorUid: string): Promise<void> {
  const meta = await readMeta(db, journeyId);
  if (meta.creatorUid !== actorUid) throw new JourneyError('NOT_ALLOWED');
  if (isTerminalJourneyStatus(meta.status)) return;

  const members = membersFromDb((await read(db, Paths.members(journeyId))).val());
  const updates: Record<string, unknown> = {
    [`${Paths.meta(journeyId)}/status`]: meta.status === 'LOBBY' ? 'CANCELLED' : 'COMPLETED',
    [Paths.userJourney(actorUid)]: null,
  };
  if (meta.joinCode) updates[Paths.joinCode(meta.joinCode)] = null;
  for (const memberUid of Object.keys(members)) {
    updates[Paths.liveOf(journeyId, memberUid)] = null;
    updates[Paths.routeOf(journeyId, memberUid)] = null;
  }

  try {
    await write(db, updates);
  } catch (error) {
    throw toJourneyError(error);
  }
}

/** Any member's client may mark an overdue journey EXPIRED (the server clock decides). */
export async function expireIfOverdue(db: Database, meta: JourneyMeta): Promise<boolean> {
  if (isTerminalJourneyStatus(meta.status) || !isJourneyExpired(meta, serverNow(db))) return false;
  try {
    await write(db, { [`${Paths.meta(meta.journeyId)}/status`]: 'EXPIRED' });
    return true;
  } catch {
    return false; // someone else already did, or we are no longer a member
  }
}

export interface JourneySubscriptionHandlers {
  onMeta: (meta: JourneyMeta | null) => void;
  onMembers: (members: Record<string, JourneyMember>) => void;
  onError?: (error: JourneyError) => void;
}

/** Subscribes to meta + members. Returns one unsubscribe function for both. */
export function subscribeToJourney(
  db: Database,
  journeyId: string,
  handlers: JourneySubscriptionHandlers
): () => void {
  const fail = (error: unknown) => handlers.onError?.(toJourneyError(error));

  const unsubMeta = onValue(
    ref(db, Paths.meta(journeyId)),
    (snap) => handlers.onMeta(snap.exists() ? metaFromDb(snap.val()) : null),
    fail
  );
  const unsubMembers = onValue(
    ref(db, Paths.members(journeyId)),
    (snap) => handlers.onMembers(membersFromDb(snap.val())),
    fail
  );
  return () => {
    unsubMeta();
    unsubMembers();
  };
}
