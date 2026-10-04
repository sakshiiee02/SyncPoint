import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateJoinCode, isValidJoinCode, normalizeJoinCode } from '@/domain/joinCode';
import { countTakenSeats, findSeatOf, pickFreeSeat } from '@/domain/seats';
import {
  InvalidTransitionError,
  applyTravelerAction,
  canTravelerAct,
  nextTravelerState,
  travelerStateLabel,
} from '@/domain/travelerState';
import {
  allTravelersDone,
  isJourneyExpired,
  joinBlockReason,
  pickNextCreator,
} from '@/domain/journeyRules';
import { buildAppLink, buildInviteLink, parseInviteCode } from '@/domain/inviteLink';
import { memberFromDb, memberToDb, stripUndefined } from '@/data/serialization';
import { findMissingFirebaseSettings } from '@/config/env';
import { defaultMascot } from '@/domain/mascot';
import { TRAVELER_STATES, JourneyMember } from '@/types/member';

describe('join codes', () => {
  it('generates valid, ambiguity-free codes', () => {
    for (let i = 0; i < 200; i++) {
      const code = generateJoinCode();
      assert.equal(isValidJoinCode(code), true, code);
      assert.doesNotMatch(code, /[01OI]/);
    }
  });

  it('normalizes pasted codes', () => {
    assert.equal(normalizeJoinCode(' abc-234 '), 'ABC234');
    assert.equal(isValidJoinCode('ABC234'), true);
    assert.equal(isValidJoinCode('ABC23'), false);
    assert.equal(isValidJoinCode('ABC23O'), false); // O is excluded from the alphabet
  });
});

describe('seats', () => {
  it('picks the lowest free seat and respects seats already lost in a race', () => {
    assert.equal(pickFreeSeat(null), 0);
    assert.equal(pickFreeSeat({ '0': 'a', '1': 'b' }), 2);
    assert.equal(pickFreeSeat({ '0': 'a' }, new Set([1])), 2);
    assert.equal(pickFreeSeat({ '0': 'a', '2': 'c' }), 1);
  });

  it('reports a full journey as null', () => {
    const full = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [String(i), `u${i}`]));
    assert.equal(pickFreeSeat(full), null);
    assert.equal(countTakenSeats(full), 10);
  });

  it('finds the seat a user already holds', () => {
    assert.equal(findSeatOf({ '3': 'me', '4': 'you' }, 'me'), 3);
    assert.equal(findSeatOf({ '3': 'me' }, 'nobody'), null);
    assert.equal(findSeatOf(null, 'me'), null);
  });
});

describe('traveler state machine', () => {
  it('follows the documented lifecycle', () => {
    assert.equal(applyTravelerAction('WAITING', 'START'), 'TRAVELING');
    assert.equal(applyTravelerAction('TRAVELING', 'PAUSE'), 'PAUSED');
    assert.equal(applyTravelerAction('PAUSED', 'RESUME'), 'TRAVELING');
    assert.equal(applyTravelerAction('TRAVELING', 'ARRIVE'), 'ARRIVED');
    assert.equal(applyTravelerAction('ARRIVED', 'FINISH'), 'FINISHED');
  });

  it('never lets a waiting traveler arrive or finish (the "already arrived" bug)', () => {
    assert.equal(nextTravelerState('WAITING', 'ARRIVE'), null);
    assert.equal(nextTravelerState('WAITING', 'FINISH'), null);
    assert.throws(() => applyTravelerAction('WAITING', 'ARRIVE'), InvalidTransitionError);
  });

  it('treats FINISHED and LEFT as terminal', () => {
    for (const action of ['START', 'PAUSE', 'RESUME', 'ARRIVE', 'FINISH', 'LEAVE'] as const) {
      assert.equal(canTravelerAct('FINISHED', action), false);
      assert.equal(canTravelerAct('LEFT', action), false);
    }
  });

  it('labels every state', () => {
    for (const state of TRAVELER_STATES) assert.ok(travelerStateLabel(state).length > 0);
    assert.equal(travelerStateLabel('WAITING'), 'Not started');
  });
});

describe('journey rules', () => {
  const base = { status: 'ACTIVE' as const, expiresAt: 1000 };

  it('blocks joining ended or expired journeys', () => {
    assert.equal(joinBlockReason(base, 999), null);
    assert.equal(joinBlockReason(base, 1000), 'EXPIRED');
    assert.equal(joinBlockReason({ ...base, status: 'COMPLETED' }, 1), 'ENDED');
    assert.equal(joinBlockReason({ ...base, status: 'CANCELLED' }, 1), 'ENDED');
    assert.equal(isJourneyExpired(base, 1000), true);
  });

  it('hands ownership to the longest-standing member who is still traveling', () => {
    const members = {
      a: { uid: 'a', joinedAt: 1, state: 'TRAVELING' as const },
      b: { uid: 'b', joinedAt: 2, state: 'FINISHED' as const },
      c: { uid: 'c', joinedAt: 3, state: 'WAITING' as const },
    };
    assert.equal(pickNextCreator(members, 'a'), 'c'); // b already finished
    assert.equal(pickNextCreator({ a: members.a }, 'a'), null);
    assert.equal(
      pickNextCreator(
        { a: members.a, b: { uid: 'b', joinedAt: 2, state: 'FINISHED' as const } },
        'a'
      ),
      'b'
    );
  });

  it('knows when everyone is done', () => {
    assert.equal(allTravelersDone({ a: { state: 'FINISHED' }, b: { state: 'LEFT' } }), true);
    assert.equal(allTravelersDone({ a: { state: 'FINISHED' }, b: { state: 'TRAVELING' } }), false);
    assert.equal(allTravelersDone({}), false);
  });
});

describe('invite links', () => {
  it('builds and parses https and app links', () => {
    assert.equal(
      buildInviteLink('https://syncpoint.example.com/', 'ABC234'),
      'https://syncpoint.example.com/join/ABC234'
    );
    assert.equal(buildInviteLink('', 'ABC234'), null);
    assert.equal(buildAppLink('ABC234'), 'syncpoint://join/ABC234');
    assert.equal(parseInviteCode('syncpoint://join/ABC234'), 'ABC234');
    assert.equal(parseInviteCode('https://anything.dev/join/abc234?x=1'), 'ABC234');
    assert.equal(parseInviteCode('abc 234'), 'ABC234');
  });

  it('ignores links that are not invites', () => {
    assert.equal(parseInviteCode('https://example.com/other/path'), null);
    assert.equal(parseInviteCode(''), null);
    assert.equal(parseInviteCode('syncpoint://join/short'), null);
  });
});

describe('RTDB serialization', () => {
  const member: JourneyMember = {
    uid: 'u1',
    name: 'Asha',
    username: 'asha',
    phone: '+911',
    seat: 4,
    origin: { kind: 'GPS', lat: null, lng: null, displayName: 'My current location' },
    travelMode: 'CAR',
    state: 'WAITING',
    joinedAt: 10,
    startedAt: null,
    finishedAt: null,
  };

  it('stores seat as a string and never stores fake coordinates for GPS origins', () => {
    const db = memberToDb(member) as any;
    assert.equal(db.seat, '4');
    assert.equal('lat' in db.origin, false);
    assert.equal('startedAt' in db, false);
  });

  it('round-trips a member', () => {
    const back = memberFromDb('u1', memberToDb(member) as any);
    assert.deepEqual(back, { ...member, photoUrl: undefined, mascot: defaultMascot('u1') });
  });

  it('strips undefined/null but keeps zero and false', () => {
    assert.deepEqual(stripUndefined({ a: 0, b: false, c: undefined, d: null, e: { f: undefined } }), {
      a: 0,
      b: false,
      e: {},
    });
  });
});

describe('environment', () => {
  it('reports exactly which Firebase settings are missing', () => {
    const empty = {
      apiKey: '',
      authDomain: '',
      databaseURL: '',
      projectId: '',
      storageBucket: '',
      messagingSenderId: '',
      appId: '',
    };
    assert.deepEqual(findMissingFirebaseSettings(empty), [
      'EXPO_PUBLIC_FIREBASE_API_KEY',
      'EXPO_PUBLIC_FIREBASE_DATABASE_URL',
      'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
      'EXPO_PUBLIC_FIREBASE_APP_ID',
    ]);
    assert.deepEqual(
      findMissingFirebaseSettings({ ...empty, apiKey: 'k', databaseURL: 'u', projectId: 'p', appId: 'a' }),
      []
    );
  });
});
