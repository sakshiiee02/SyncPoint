import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { get, ref, serverTimestamp, set, update } from 'firebase/database';
import {
  changeTravelerState,
  createJourney,
  endJourney,
  expireIfOverdue,
  finishTraveler,
  joinJourney,
  leaveJourney,
  lookupJourneyByCode,
  removeMember,
  startTraveling,
} from '@/data/journeyRepository';
import { resolveResumableJourney } from '@/data/userJourneyRepository';
import { Paths } from '@/data/paths';
import { metaFromDb } from '@/data/serialization';
import {
  DELHI_GPS,
  GOA,
  JAIPUR,
  TestUser,
  disposeAllUsers,
  newUser,
  rejectsWith,
  sleep,
} from './helpers';

const CAR = 'CAR' as const;

async function setupJourney(creator: TestUser, hours = 24) {
  return createJourney(creator.db, creator.profile, {
    name: 'Goa Trip',
    destination: GOA,
    expiryHours: hours,
    origin: DELHI_GPS,
    travelMode: CAR,
  });
}

async function join(user: TestUser, journeyId: string) {
  return joinJourney(user.db, user.profile, journeyId, { origin: JAIPUR, travelMode: CAR });
}

async function readMeta(user: TestUser, journeyId: string) {
  return metaFromDb((await get(ref(user.db, Paths.meta(journeyId)))).val());
}

const liveRecord = (overrides: Record<string, unknown> = {}) => ({
  lat: 15.4,
  lng: 73.8,
  heading: 90,
  speedMps: 10,
  batteryPct: 77,
  status: 'ON_THE_WAY',
  lastUpdatedAt: Date.now(),
  currentRoad: 'NH66',
  distanceRemainingM: 1000,
  etaEpochMs: Date.now() + 60000,
  routeVersion: 1,
  isSharing: true,
  ...overrides,
});

after(disposeAllUsers);

describe('create + lookup + join', () => {
  it('creates a journey with creator in seat 0 and a resolvable code', async () => {
    const creator = await newUser('Creator');
    const { meta, member } = await setupJourney(creator);
    assert.equal(meta.status, 'LOBBY');
    assert.equal(meta.creatorUid, creator.uid);
    assert.equal(member.seat, 0);
    assert.equal(member.state, 'WAITING');
    assert.equal(member.origin.kind, 'GPS');
    assert.equal(member.origin.lat, null);

    const friend = await newUser('Friend');
    const preview = await lookupJourneyByCode(friend.db, meta.joinCode.toLowerCase());
    assert.equal(preview.meta.journeyId, meta.journeyId);
    assert.equal(preview.seatsTaken, 1);
  });

  it('rejects malformed and unknown codes', async () => {
    const user = await newUser('Lookup');
    await rejectsWith(lookupJourneyByCode(user.db, 'abc'), 'code');
    await rejectsWith(lookupJourneyByCode(user.db, 'ZZZZZZ'), 'code');
  });

  it('lets a friend join and see members; strangers cannot read anything', async () => {
    const creator = await newUser('Host');
    const friend = await newUser('Pal');
    const stranger = await newUser('Stranger');
    const { meta } = await setupJourney(creator);

    const joined = await join(friend, meta.journeyId);
    assert.equal(joined.member.seat, 1);

    const members = (await get(ref(friend.db, Paths.members(meta.journeyId)))).val();
    assert.equal(Object.keys(members).length, 2);

    await rejectsWith(get(ref(stranger.db, Paths.members(meta.journeyId))), 'permission');
    await rejectsWith(get(ref(stranger.db, Paths.live(meta.journeyId))), 'permission');
    await rejectsWith(get(ref(stranger.db, Paths.chat(meta.journeyId))), 'permission');
    // ...but a stranger holding the id/code can still preview the journey.
    assert.equal((await readMeta(stranger, meta.journeyId)).name, 'Goa Trip');
  });

  it('is idempotent when the same user joins twice', async () => {
    const creator = await newUser('Host2');
    const friend = await newUser('Pal2');
    const { meta } = await setupJourney(creator);
    const first = await join(friend, meta.journeyId);
    const second = await join(friend, meta.journeyId);
    assert.equal(first.member.seat, second.member.seat);
    assert.equal(first.member.joinedAt, second.member.joinedAt);
  });
});

describe('member cap (10 seats)', () => {
  it('refuses the 11th traveler', async () => {
    const creator = await newUser('CapHost');
    const { meta } = await setupJourney(creator);
    for (let i = 1; i < 10; i++) await join(await newUser(`Cap${i}`), meta.journeyId);
    const late = await newUser('TooLate');
    await rejectsWith(join(late, meta.journeyId), 'full');
  });

  it('lets exactly one of many concurrent joiners take the last seat', async () => {
    const creator = await newUser('RaceHost');
    const { meta } = await setupJourney(creator);
    for (let i = 1; i < 9; i++) await join(await newUser(`Race${i}`), meta.journeyId);
    const racers = await Promise.all([newUser('R1'), newUser('R2'), newUser('R3'), newUser('R4')]);
    const results = await Promise.allSettled(racers.map((r) => join(r, meta.journeyId)));
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
    const seats = (await get(ref(creator.db, Paths.seats(meta.journeyId)))).val();
    assert.equal(Object.keys(seats).length, 10);
  });
});

describe('one active journey per user', () => {
  it('blocks creating or joining a second journey, then allows it after leaving', async () => {
    const a = await newUser('OneA');
    const b = await newUser('OneB');
    const { meta: first } = await setupJourney(a);
    await rejectsWith(setupJourney(a), 'already');

    const { meta: second } = await setupJourney(b);
    await rejectsWith(join(a, second.journeyId), 'already');

    await leaveJourney(a.db, first.journeyId, a.uid);
    const joined = await join(a, second.journeyId);
    assert.equal(joined.member.seat, 1);
  });

  it('treats a removed member and an ended journey as free to move on', async () => {
    const host = await newUser('FreeHost');
    const kicked = await newUser('Kicked');
    const { meta } = await setupJourney(host);
    await join(kicked, meta.journeyId);
    await removeMember(host.db, meta.journeyId, host.uid, kicked.uid);
    const other = await newUser('FreeOther');
    const { meta: other1 } = await setupJourney(other);
    const joined = await join(kicked, other1.journeyId);
    assert.equal(joined.member.state, 'WAITING');

    await endJourney(host.db, meta.journeyId, host.uid);
    const { meta: fresh } = await setupJourney(host); // stale reference is overwritten
    assert.notEqual(fresh.journeyId, meta.journeyId);
  });
});

describe('start / waiting travelers (the "friend already arrived" scenario)', () => {
  it('keeps a friend WAITING while the creator travels, and only travelers may publish live data', async () => {
    const host = await newUser('StartHost');
    const friend = await newUser('StartPal');
    const { meta } = await setupJourney(host);
    await join(friend, meta.journeyId);

    await startTraveling(host.db, meta.journeyId, host.uid, {
      kind: 'GPS',
      lat: 28.6,
      lng: 77.2,
      displayName: 'My current location',
    });

    const hostMember = (await get(ref(host.db, Paths.member(meta.journeyId, host.uid)))).val();
    const friendMember = (await get(ref(host.db, Paths.member(meta.journeyId, friend.uid)))).val();
    assert.equal(hostMember.state, 'TRAVELING');
    assert.equal(hostMember.origin.lat, 28.6); // real fix recorded, not a preset
    assert.equal(friendMember.state, 'WAITING');
    assert.equal((await readMeta(host, meta.journeyId)).status, 'ACTIVE');

    await set(ref(host.db, Paths.liveOf(meta.journeyId, host.uid)), liveRecord());
    await rejectsWith(
      set(ref(friend.db, Paths.liveOf(meta.journeyId, friend.uid)), liveRecord()),
      'permission'
    );

    // Friend starts later; journey is already ACTIVE, which must not break their start.
    await startTraveling(friend.db, meta.journeyId, friend.uid);
    await set(ref(friend.db, Paths.liveOf(meta.journeyId, friend.uid)), liveRecord());
  });

  it('accepts the real publish shape: server timestamp, real battery, charging flag', async () => {
    const host = await newUser('PubHost');
    const { meta } = await setupJourney(host);
    await startTraveling(host.db, meta.journeyId, host.uid);
    const livePath = Paths.liveOf(meta.journeyId, host.uid);

    await set(ref(host.db, livePath), {
      ...liveRecord({ batteryPct: 42, charging: true }),
      lastUpdatedAt: serverTimestamp(),
    });
    const stored = (await get(ref(host.db, livePath))).val();
    assert.equal(stored.batteryPct, 42);
    assert.equal(stored.charging, true);
    assert.ok(Math.abs(stored.lastUpdatedAt - Date.now()) < 10_000);

    // A device that can't report battery simply omits it (no fake value).
    const { batteryPct: _omit, ...withoutBattery } = liveRecord();
    await set(ref(host.db, livePath), withoutBattery);
    assert.equal((await get(ref(host.db, livePath))).val().batteryPct, undefined);
  });

  it('lets two travelers start at the same moment', async () => {
    const host = await newUser('SimHost');
    const friend = await newUser('SimPal');
    const { meta } = await setupJourney(host);
    await join(friend, meta.journeyId);
    await Promise.all([
      startTraveling(host.db, meta.journeyId, host.uid),
      startTraveling(friend.db, meta.journeyId, friend.uid),
    ]);
    const members = (await get(ref(host.db, Paths.members(meta.journeyId)))).val();
    assert.equal(members[host.uid].state, 'TRAVELING');
    assert.equal(members[friend.uid].state, 'TRAVELING');
  });
});

describe('rules: tampering is rejected', () => {
  it('rejects illegal state jumps, forged members and edited seats', async () => {
    const host = await newUser('TamperHost');
    const friend = await newUser('TamperPal');
    const { meta } = await setupJourney(host);
    await join(friend, meta.journeyId);
    const memberPath = Paths.member(meta.journeyId, friend.uid);

    // WAITING -> ARRIVED is not a legal transition.
    await rejectsWith(update(ref(friend.db, memberPath), { state: 'ARRIVED' }), 'permission');
    // Cannot touch someone else's record.
    await rejectsWith(
      update(ref(friend.db, Paths.member(meta.journeyId, host.uid)), { name: 'hacked' }),
      'permission'
    );
    // Cannot move to another seat.
    await rejectsWith(update(ref(friend.db, memberPath), { seat: '5' }), 'permission');
    // Cannot take the host's role or rewrite the destination.
    await rejectsWith(
      update(ref(friend.db, Paths.meta(meta.journeyId)), { creatorUid: friend.uid }),
      'permission'
    );
    await rejectsWith(
      set(ref(host.db, `${Paths.meta(meta.journeyId)}/destination/lat`), 1),
      'permission'
    );
    // Cannot grab a seat without a matching member record.
    await rejectsWith(set(ref(friend.db, Paths.seat(meta.journeyId, 7)), friend.uid), 'permission');
  });

  it('rejects out-of-range live data and writes after the journey ends', async () => {
    const host = await newUser('LiveHost');
    const { meta } = await setupJourney(host);
    await startTraveling(host.db, meta.journeyId, host.uid);
    const livePath = Paths.liveOf(meta.journeyId, host.uid);

    await set(ref(host.db, livePath), liveRecord());
    await rejectsWith(set(ref(host.db, livePath), liveRecord({ batteryPct: 150 })), 'permission');
    await rejectsWith(set(ref(host.db, livePath), liveRecord({ lat: 200 })), 'permission');

    await endJourney(host.db, meta.journeyId, host.uid);
    await rejectsWith(set(ref(host.db, livePath), liveRecord()), 'permission');
  });

  it('rejects live writes once the journey has expired and lets a member mark it EXPIRED', async () => {
    const host = await newUser('ExpHost');
    const { meta } = await createJourney(host.db, host.profile, {
      name: 'Short',
      destination: GOA,
      expiryHours: 4 / 3600, // 4 seconds
      origin: DELHI_GPS,
      travelMode: CAR,
    });
    await startTraveling(host.db, meta.journeyId, host.uid);
    const livePath = Paths.liveOf(meta.journeyId, host.uid);
    await set(ref(host.db, livePath), liveRecord());

    await sleep(5000);
    await rejectsWith(set(ref(host.db, livePath), liveRecord()), 'permission');
    assert.equal(await expireIfOverdue(host.db, await readMeta(host, meta.journeyId)), true);
    assert.equal((await readMeta(host, meta.journeyId)).status, 'EXPIRED');
    assert.equal(await resolveResumableJourney(host.db, host.uid), null);
  });
});

describe('leave / hand-off / end / finish', () => {
  it('frees the seat when a member leaves so someone else can take it', async () => {
    const host = await newUser('SeatHost');
    const a = await newUser('SeatA');
    const b = await newUser('SeatB');
    const { meta } = await setupJourney(host);
    await join(a, meta.journeyId);
    await leaveJourney(a.db, meta.journeyId, a.uid);
    const joined = await join(b, meta.journeyId);
    assert.equal(joined.member.seat, 1);
    assert.equal((await get(ref(a.db, Paths.userJourney(a.uid)))).exists(), false);
  });

  it('hands ownership to the longest-standing member when the creator leaves', async () => {
    const host = await newUser('HandHost');
    const first = await newUser('HandFirst');
    const second = await newUser('HandSecond');
    const { meta } = await setupJourney(host);
    await join(first, meta.journeyId);
    await sleep(20);
    await join(second, meta.journeyId);

    await leaveJourney(host.db, meta.journeyId, host.uid);
    const after = await readMeta(first, meta.journeyId);
    assert.equal(after.creatorUid, first.uid);
    assert.equal(after.status, 'LOBBY');
    // The new creator can now end it; the old one no longer can.
    await rejectsWith(endJourney(second.db, meta.journeyId, second.uid), 'allowed');
    await endJourney(first.db, meta.journeyId, first.uid);
    assert.equal((await readMeta(first, meta.journeyId)).status, 'CANCELLED');
  });

  it('closes the journey when its only member leaves', async () => {
    const host = await newUser('SoloHost');
    const { meta } = await setupJourney(host);
    await leaveJourney(host.db, meta.journeyId, host.uid);
    assert.equal((await readMeta(host, meta.journeyId)).status, 'CANCELLED');
    const other = await newUser('SoloOther');
    await rejectsWith(lookupJourneyByCode(other.db, meta.joinCode), 'code');
  });

  it('only the creator can end the journey or remove members', async () => {
    const host = await newUser('EndHost');
    const friend = await newUser('EndPal');
    const { meta } = await setupJourney(host);
    await join(friend, meta.journeyId);
    await rejectsWith(endJourney(friend.db, meta.journeyId, friend.uid), 'allowed');
    await rejectsWith(removeMember(friend.db, meta.journeyId, friend.uid, host.uid), 'allowed');
    await endJourney(host.db, meta.journeyId, host.uid);
    assert.equal((await readMeta(friend, meta.journeyId)).status, 'CANCELLED');
  });

  it('completes the journey when the last traveler finishes, and clears their live data', async () => {
    const host = await newUser('FinHost');
    const friend = await newUser('FinPal');
    const { meta } = await setupJourney(host);
    await join(friend, meta.journeyId);
    await startTraveling(host.db, meta.journeyId, host.uid);
    await startTraveling(friend.db, meta.journeyId, friend.uid);
    await set(ref(host.db, Paths.liveOf(meta.journeyId, host.uid)), liveRecord());

    assert.equal(await changeTravelerState(host.db, meta.journeyId, host.uid, 'ARRIVE'), 'ARRIVED');
    const firstDone = await finishTraveler(host.db, meta.journeyId, host.uid);
    assert.equal(firstDone.journeyCompleted, false);
    assert.equal((await get(ref(host.db, Paths.liveOf(meta.journeyId, host.uid)))).exists(), false);
    assert.equal((await get(ref(host.db, Paths.userJourney(host.uid)))).exists(), false);

    const lastDone = await finishTraveler(friend.db, meta.journeyId, friend.uid);
    assert.equal(lastDone.journeyCompleted, true);
    assert.equal((await readMeta(host, meta.journeyId)).status, 'COMPLETED');
  });
});

describe('resume after restart', () => {
  it('returns the in-progress journey and member, and drops it once the journey ends', async () => {
    const host = await newUser('ResHost');
    const { meta } = await setupJourney(host);
    await startTraveling(host.db, meta.journeyId, host.uid);

    const resumed = await resolveResumableJourney(host.db, host.uid);
    assert.equal(resumed?.meta.journeyId, meta.journeyId);
    assert.equal(resumed?.member.state, 'TRAVELING');

    await endJourney(host.db, meta.journeyId, host.uid);
    assert.equal(await resolveResumableJourney(host.db, host.uid), null);
  });
});

describe('chat rules', () => {
  it('lets members post as themselves only, immutably', async () => {
    const host = await newUser('ChatHost');
    const friend = await newUser('ChatPal');
    const stranger = await newUser('ChatStranger');
    const { meta } = await setupJourney(host);
    await join(friend, meta.journeyId);
    const message = (uid: string, id: string) => ({
      id,
      senderUid: uid,
      senderName: 'x',
      text: 'hello',
      timestamp: Date.now(),
      type: 'TEXT',
    });

    await set(ref(friend.db, Paths.chatMessage(meta.journeyId, 'm1')), message(friend.uid, 'm1'));
    await rejectsWith(
      set(ref(friend.db, Paths.chatMessage(meta.journeyId, 'm2')), message(host.uid, 'm2')),
      'permission'
    );
    await rejectsWith(
      set(ref(stranger.db, Paths.chatMessage(meta.journeyId, 'm3')), message(stranger.uid, 'm3')),
      'permission'
    );
    await rejectsWith(
      set(ref(friend.db, Paths.chatMessage(meta.journeyId, 'm1')), message(friend.uid, 'm1')),
      'permission'
    );
  });
});
