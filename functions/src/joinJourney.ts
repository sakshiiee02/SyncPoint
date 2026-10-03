import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';

/**
 * Server-authoritative Cloud Function to join a journey.
 * Enforces:
 * 1. Hard cap of 10 members (Section 22)
 * 2. Validates journey is not COMPLETED or EXPIRED
 * 3. Enforces single active journey per traveler
 * Matches Section 18 of Developer Handoff.
 */
export const joinJourney = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated anonymously or with profile.');
  }

  const uid = context.auth.uid;
  const { code, origin, travelMode, profile } = data;

  if (!code) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing invite code.');
  }

  const db = admin.database();
  const cleanCode = String(code).trim().toUpperCase();

  // 1. Resolve join code
  const codeSnap = await db.ref(`joinCodes/${cleanCode}`).once('value');
  if (!codeSnap.exists()) {
    throw new functions.https.HttpsError('not-found', 'Invalid invite code.');
  }

  const codeRecord = codeSnap.val();
  if (codeRecord.status !== 'ACTIVE' || codeRecord.expiresAt < Date.now()) {
    throw new functions.https.HttpsError('failed-precondition', 'This invite code has expired.');
  }

  const journeyId = codeRecord.journeyId;

  // 2. Check journey metadata & capacity
  const metaSnap = await db.ref(`journeys/${journeyId}/meta`).once('value');
  if (!metaSnap.exists()) {
    throw new functions.https.HttpsError('not-found', 'Journey no longer exists.');
  }

  const meta = metaSnap.val();
  if (meta.status === 'COMPLETED' || meta.status === 'EXPIRED') {
    throw new functions.https.HttpsError('failed-precondition', 'This journey has already concluded.');
  }

  // 3. Check existing membership
  const memberSnap = await db.ref(`journeys/${journeyId}/members/${uid}`).once('value');
  const alreadyMember = memberSnap.exists();

  if (!alreadyMember) {
    const allMembersSnap = await db.ref(`journeys/${journeyId}/members`).once('value');
    const memberCount = allMembersSnap.numChildren();
    if (memberCount >= 10) {
      throw new functions.https.HttpsError('resource-exhausted', 'Journey has reached maximum capacity of 10 travelers.');
    }
  }

  const now = Date.now();
  const memberData = {
    uid,
    name: profile?.name || 'Traveler',
    username: profile?.username || 'traveler',
    phone: profile?.phone || '',
    photoUrl: profile?.photoUrl || null,
    role: alreadyMember ? memberSnap.val().role : 'MEMBER',
    origin: origin || { displayName: 'Starting Point', lat: meta.destination.lat, lng: meta.destination.lng },
    travelMode: travelMode || 'CAR',
    sharingState: 'NOT_STARTED',
    joinedAt: alreadyMember ? memberSnap.val().joinedAt : now,
    startedAt: null,
    finishedAt: null,
  };

  const updates: Record<string, unknown> = {};
  updates[`journeys/${journeyId}/members/${uid}`] = memberData;
  if (!alreadyMember) {
    updates[`journeys/${journeyId}/meta/memberCount`] = admin.database.ServerValue.increment(1);
  }
  updates[`activeJourneyByUser/${uid}`] = {
    journeyId,
    startedAt: now,
    expiresAt: meta.expiresAt,
  };

  await db.ref().update(updates);

  return { success: true, journeyId, meta };
});
