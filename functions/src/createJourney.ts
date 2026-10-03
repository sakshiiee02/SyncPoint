import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';

/**
 * Server-authoritative Cloud Function to create a journey.
 * Enforces:
 * 1. User has no active journey currently in /activeJourneyByUser/{uid}
 * 2. Destination is locked at creation
 * 3. 6-character short join code generated and indexed
 * Matches Section 18 of Developer Handoff.
 */
export const createJourney = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated anonymously or with profile.');
  }

  const uid = context.auth.uid;
  const { name, destination, expiryHours, origin, travelMode, profile } = data;

  if (!name || !destination || !destination.lat || !destination.lng) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing journey name or valid destination coordinates.');
  }

  const db = admin.database();

  // Validate single active journey constraint (Section 22)
  const activeSnap = await db.ref(`activeJourneyByUser/${uid}`).once('value');
  if (activeSnap.exists()) {
    const active = activeSnap.val();
    if (active.expiresAt > Date.now()) {
      throw new functions.https.HttpsError('failed-precondition', 'You already have an active journey in progress.');
    }
  }

  const journeyId = `journey_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let joinCode = '';
  for (let i = 0; i < 6; i++) {
    joinCode += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  const now = Date.now();
  const safeExpiryHours = Math.min(Math.max(expiryHours || 24, 1), 72);
  const expiresAt = now + safeExpiryHours * 60 * 60 * 1000;

  const meta = {
    journeyId,
    name: String(name).trim(),
    status: 'LOBBY',
    creatorUid: uid,
    createdAt: now,
    startedAt: null,
    expiresAt,
    memberCount: 1,
    destination,
  };

  const creatorMember = {
    uid,
    name: profile?.name || 'Creator',
    username: profile?.username || 'creator',
    phone: profile?.phone || '',
    photoUrl: profile?.photoUrl || null,
    role: 'CREATOR',
    origin: origin || { displayName: 'Starting Point', lat: destination.lat, lng: destination.lng },
    travelMode: travelMode || 'CAR',
    sharingState: 'NOT_STARTED',
    joinedAt: now,
    startedAt: null,
    finishedAt: null,
  };

  const updates: Record<string, unknown> = {};
  updates[`journeys/${journeyId}/meta`] = meta;
  updates[`journeys/${journeyId}/destination`] = destination;
  updates[`journeys/${journeyId}/members/${uid}`] = creatorMember;
  updates[`joinCodes/${joinCode}`] = {
    journeyId,
    expiresAt,
    status: 'ACTIVE',
  };
  updates[`activeJourneyByUser/${uid}`] = {
    journeyId,
    startedAt: now,
    expiresAt,
  };

  await db.ref().update(updates);

  return { journeyId, joinCode, expiresAt };
});
