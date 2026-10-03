/**
 * Firebase Cloud Functions for SyncPoint
 * Matches Section 18 of Developer Handoff
 */

import * as admin from 'firebase-admin';

admin.initializeApp();

export { createJourney } from './createJourney';
export { joinJourney } from './joinJourney';
export { pushJourneyEvent } from './pushJourneyEvent';
export { expireJourney } from './expireJourney';


