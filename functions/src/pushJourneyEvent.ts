import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';

export type JourneyEventType =
  | 'MEMBER_JOINED'
  | 'MEMBER_STARTED'
  | 'MEMBER_ARRIVED'
  | 'EMERGENCY_STATUS'
  | 'CHAT_MESSAGE';

/**
 * Cloud Function to dispatch push notifications via Firebase Cloud Messaging (FCM).
 * Matches Section 15 of Developer Handoff.
 */
export const pushJourneyEvent = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated.');
  }

  const { journeyId, eventType, title, body } = data;

  if (!journeyId || !eventType || !title) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing event details.');
  }

  const db = admin.database();

  // Retrieve journey members
  const membersSnap = await db.ref(`journeys/${journeyId}/members`).once('value');
  if (!membersSnap.exists()) {
    return { success: false, reason: 'No members found' };
  }

  // Topic fan-out to all journey subscribers
  const topic = `journey_${journeyId}`;
  const isHighPriority = eventType === 'EMERGENCY_STATUS' || eventType === 'MEMBER_ARRIVED';

  const message: admin.messaging.Message = {
    topic,
    notification: {
      title,
      body: body || 'SyncPoint Journey Update',
    },
    android: {
      priority: isHighPriority ? 'high' : 'normal',
      notification: {
        channelId: 'syncpoint_tracking_channel',
        sound: isHighPriority ? 'default' : undefined,
      },
    },
    data: {
      journeyId,
      eventType,
    },
  };

  try {
    const response = await admin.messaging().send(message);
    return { success: true, messageId: response };
  } catch (error: any) {
    console.warn('[FCM pushJourneyEvent] Failed to send FCM message:', error.message);
    return { success: false, error: error.message };
  }
});
