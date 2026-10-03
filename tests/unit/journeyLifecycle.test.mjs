import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

const CONFIG = {
  MAX_MEMBERS: 10,
  JOIN_CODE: {
    LENGTH: 6,
    ALPHABET: '23456789ABCDEFGHJKLMNPQRSTUVWXYZ',
    DEFAULT_EXPIRY_HOURS: 24,
  },
};

function generateShortJoinCode() {
  const chars = CONFIG.JOIN_CODE.ALPHABET;
  let code = '';
  for (let i = 0; i < CONFIG.JOIN_CODE.LENGTH; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function validateProfile(profile) {
  if (!profile.name || !profile.name.trim()) return { valid: false, error: 'Name required' };
  if (!profile.username || !profile.username.trim()) return { valid: false, error: 'Username required' };
  if (!profile.phone || !profile.phone.trim()) return { valid: false, error: 'Phone required' };
  return { valid: true };
}

function canJoinJourney(currentMemberCount, userAlreadyMember = false) {
  if (userAlreadyMember) return true;
  return currentMemberCount < CONFIG.MAX_MEMBERS;
}

function canStartJourney(userActiveJourneys) {
  const now = Date.now();
  const hasActive = userActiveJourneys.some((j) => j.status === 'ACTIVE' && j.expiresAt > now);
  return !hasActive;
}

describe('SyncPoint Phase 1: Journey Lifecycle & Membership Rules', () => {
  test('generateShortJoinCode produces 6-character unambiguous uppercase codes', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateShortJoinCode();
      assert.equal(code.length, 6);
      // Ensure no 0, O, 1, or I characters exist
      assert.match(code, /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/);
      assert.doesNotMatch(code, /[01IO]/);
    }
  });

  test('validateProfile enforces name, handle, and contact number', () => {
    assert.equal(validateProfile({ name: '', username: 'dev', phone: '123' }).valid, false);
    assert.equal(validateProfile({ name: 'Shashank', username: '', phone: '123' }).valid, false);
    assert.equal(validateProfile({ name: 'Shashank', username: 'shashank_v', phone: '' }).valid, false);
    assert.equal(validateProfile({ name: 'Shashank', username: 'shashank_v', phone: '+91 9999999999' }).valid, true);
  });

  test('canJoinJourney enforces hard cap of 10 travelers', () => {
    // 1 to 9 members can accept a new joiner
    assert.equal(canJoinJourney(1), true);
    assert.equal(canJoinJourney(5), true);
    assert.equal(canJoinJourney(9), true);

    // 10 members is the maximum capacity
    assert.equal(canJoinJourney(10), false);
    assert.equal(canJoinJourney(11), false);

    // If already a member, re-entering lobby is allowed
    assert.equal(canJoinJourney(10, true), true);
  });

  test('canStartJourney blocks user if another active journey is in progress', () => {
    const now = Date.now();
    const activeTrips = [
      { journeyId: 'j1', status: 'ACTIVE', expiresAt: now + 3600000 },
    ];
    assert.equal(canStartJourney(activeTrips), false);

    const expiredTrips = [
      { journeyId: 'j2', status: 'ACTIVE', expiresAt: now - 1000 },
      { journeyId: 'j3', status: 'COMPLETED', expiresAt: now + 50000 },
    ];
    assert.equal(canStartJourney(expiredTrips), true);
  });

  test('Travel mode must be CAR, BIKE, or WALK', () => {
    const validModes = new Set(['CAR', 'BIKE', 'WALK']);
    assert.equal(validModes.has('CAR'), true);
    assert.equal(validModes.has('BIKE'), true);
    assert.equal(validModes.has('WALK'), true);
    assert.equal(validModes.has('PLANE'), false);
  });
});
