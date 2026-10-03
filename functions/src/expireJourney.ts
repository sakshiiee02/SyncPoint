import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';

/**
 * Server-authoritative Cloud Function to expire or complete a journey.
 * Enforces:
 * 1. Only journey creator or server lifecycle trigger can transition journey to EXPIRED/COMPLETED
 * 2. Unlocks /activeJourneyByUser/{uid} for all journey members
 * 3. Deactivates join code
 * 4. Freezes live tracking updates
 * Matches Section 10.3 & 18 of Developer Handoff.
 */
export const expireJourney = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated.');
  }

  const callerUid = context.auth.uid;
  const { journeyId, reason } = data;

  if (!journeyId) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing journeyId.');
  }

  const db = admin.database();

  const metaSnap = await db.ref(`journeys/${journeyId}/meta`).once('value');
  if (!metaSnap.exists()) {
    throw new functions.https.HttpsError('not-found', 'Journey does not exist.');
  }

  const meta = metaSnap.val();
  const isCreator = meta.creatorUid === callerUid;
  const isExpiredByTime = meta.expiresAt <= Date.now();

  if (!isCreator && !isExpiredByTime) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Only the journey creator can end this journey before expiry.'
    );
  }

  const now = Date.now();
  const nextStatus = reason === 'COMPLETED' ? 'COMPLETED' : 'EXPIRED';

  const updates: Record<string, unknown> = {};
  updates[`journeys/${journeyId}/meta/status`] = nextStatus;
  updates[`journeys/${journeyId}/meta/expiredAt`] = now;

  // Retrieve journey members to clear activeJourneyByUser entries
  const membersSnap = await db.ref(`journeys/${journeyId}/members`).once('value');
  if (membersSnap.exists()) {
    const members = membersSnap.val() as Record<string, any>;
    for (const uid of Object.keys(members)) {
      updates[`activeJourneyByUser/${uid}`] = null;
      updates[`journeys/${journeyId}/members/${uid}/sharingState`] = 'FINISHED';
      updates[`journeys/${journeyId}/members/${uid}/finishedAt`] = now;
    }
  }

  // Deactivate any active join codes for this journey
  const joinCodesSnap = await db.ref('joinCodes').orderByChild('journeyId').equalTo(journeyId).once('value');
  if (joinCodesSnap.exists()) {
    const codes = joinCodesSnap.val() as Record<string, any>;
    for (const code of Object.keys(codes)) {
      updates[`joinCodes/${code}/status`] = 'EXPIRED';
    }
  }

  await db.ref().update(updates);

  // Dispatch FCM Notification to all convoy subscribers
  try {
    const topic = `journey_${journeyId}`;
    await admin.messaging().send({
      topic,
      notification: {
        title: `${meta.name || 'Journey'} Concluded`,
        body: nextStatus === 'COMPLETED' ? 'The road trip has reached its destination!' : 'The journey has expired.',
      },
      android: {
        priority: 'high',
        notification: {
          channelId: 'syncpoint_tracking_channel',
        },
      },
      data: {
        journeyId,
        eventType: 'JOURNEY_EXPIRED',
      },
    });
  } catch (err: any) {
    console.warn('[expireJourney] FCM alert notification failed:', err.message);
  }

  return { success: true, journeyId, status: nextStatus, expiredAt: now };
});
