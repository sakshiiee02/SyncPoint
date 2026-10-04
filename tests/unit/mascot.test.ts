import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  MASCOT_ANIMALS,
  MASCOT_COLORS,
  defaultMascot,
  isMascotAnimal,
  normalizeMascot,
} from '@/domain/mascot';
import { memberFromDb, memberToDb } from '@/data/serialization';
import { buildParticipantViews } from '@/domain/participantView';
import { JourneyMember } from '@/types/member';

const member = (uid: string, mascot?: JourneyMember['mascot']): JourneyMember => ({
  uid,
  name: uid,
  username: uid,
  phone: '1',
  seat: 0,
  mascot,
  origin: { kind: 'GPS', lat: null, lng: null, displayName: 'x' },
  travelMode: 'CAR',
  state: 'WAITING',
  joinedAt: 1,
  startedAt: null,
  finishedAt: null,
});

describe('mascot', () => {
  it('gives the same person the same default every time, and spreads people across animals', () => {
    assert.deepEqual(defaultMascot('user-123'), defaultMascot('user-123'));
    const animals = new Set(Array.from({ length: 200 }, (_, i) => defaultMascot(`u${i}`).animal));
    assert.ok(animals.size >= 8, `only ${animals.size} animals used`);
    const mascot = defaultMascot('anyone');
    assert.ok(isMascotAnimal(mascot.animal));
    assert.ok((MASCOT_COLORS as readonly string[]).includes(mascot.color));
  });

  it('repairs anything invalid read from storage or the network', () => {
    const fallback = defaultMascot('u1');
    assert.deepEqual(normalizeMascot(null, 'u1'), fallback);
    assert.deepEqual(normalizeMascot({ animal: 'DRAGON', color: '#ffffff' }, 'u1'), fallback);
    assert.deepEqual(normalizeMascot({ animal: 'CAT', color: 'red' }, 'u1'), fallback);
    assert.deepEqual(normalizeMascot({ animal: 'CAT', color: '#aabbcc' }, 'u1'), { animal: 'CAT', color: '#aabbcc' });
    assert.equal(MASCOT_ANIMALS.length, 10);
  });

  it('survives the round trip to the database, and old members without one get a default', () => {
    const chosen = { animal: 'PANDA' as const, color: '#bae6fd' };
    const back = memberFromDb('u1', memberToDb(member('u1', chosen)) as any);
    assert.deepEqual(back.mascot, chosen);
    const legacy = memberFromDb('old-user', { name: 'Old', username: 'old', seat: '1' });
    assert.deepEqual(legacy.mascot, defaultMascot('old-user'));
  });

  it('is carried into the roster/map model for every traveler', () => {
    const views = buildParticipantViews({
      members: { a: member('a', { animal: 'FOX', color: '#fed7aa' }), b: member('b') },
      locations: {},
      selfUid: 'a',
      self: { fix: null, batteryPct: null, charging: false, distanceRemainingM: null, etaEpochMs: null, currentRoad: '', status: 'ON_THE_WAY' },
      nowMs: 1,
      staleMs: 1,
    });
    assert.equal(views.find((v) => v.uid === 'a')!.mascot.animal, 'FOX');
    assert.deepEqual(views.find((v) => v.uid === 'b')!.mascot, defaultMascot('b'));
  });
});
