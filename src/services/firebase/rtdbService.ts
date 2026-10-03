import {
  ref,
  get,
  update,
  onValue,
  off,
  DataSnapshot,
} from 'firebase/database';
import { getFirebaseDb } from './firebaseApp';
import { JourneyMeta, Destination, JoinCodeRecord } from '@/types/journey';
import { JourneyMember, TravelMode, OriginLocation } from '@/types/member';
import { CONFIG } from '@/constants/config';

/**
 * Generates an opaque random 6-character alphanumeric code for easy sharing.
 * Avoids ambiguous characters (0/O, 1/I) as defined in CONFIG.
 */
export function generateShortJoinCode(): string {
  const chars = CONFIG.JOIN_CODE.ALPHABET;
  let code = '';
  for (let i = 0; i < CONFIG.JOIN_CODE.LENGTH; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Creates a new journey with the creator as the first member.
 * Matches Section 5.2 and Section 9 of Developer Handoff.
 */
export async function createJourneyInDb(
  creator: {
    uid: string;
    name: string;
    username: string;
    phone: string;
    photoUrl?: string;
  },
  journeyName: string,
  destination: Destination,
  expiryHours: number = CONFIG.JOIN_CODE.DEFAULT_EXPIRY_HOURS,
  origin: OriginLocation,
  travelMode: TravelMode
): Promise<{ journeyId: string; joinCode: string }> {
  const db = getFirebaseDb();
  const journeyId = `journey_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const joinCode = generateShortJoinCode();
  const now = Date.now();
  const expiresAt = now + expiryHours * 60 * 60 * 1000;

  const meta: JourneyMeta = {
    journeyId,
    name: journeyName.trim(),
    status: 'LOBBY',
    creatorUid: creator.uid,
    createdAt: now,
    startedAt: null,
    expiresAt,
    memberCount: 1,
    destination,
  };

  const creatorMember: JourneyMember = {
    uid: creator.uid,
    name: creator.name,
    username: creator.username,
    phone: creator.phone,
    photoUrl: creator.photoUrl,
    role: 'CREATOR',
    origin,
    travelMode,
    sharingState: 'NOT_STARTED',
    joinedAt: now,
    startedAt: null,
    finishedAt: null,
  };

  const joinRecord: JoinCodeRecord = {
    code: joinCode,
    journeyId,
    expiresAt,
    status: 'ACTIVE',
  };

  const updates: Record<string, unknown> = {};
  updates[`journeys/${journeyId}/meta`] = meta;
  updates[`journeys/${journeyId}/destination`] = destination;
  updates[`journeys/${journeyId}/members/${creator.uid}`] = creatorMember;
  updates[`joinCodes/${joinCode}`] = joinRecord;
  updates[`activeJourneyByUser/${creator.uid}`] = {
    journeyId,
    startedAt: now,
    expiresAt,
  };

  await update(ref(db), updates);
  return { journeyId, joinCode };
}

/**
 * Resolves a short join code or invite token to journey metadata.
 */
export async function lookupJourneyByCode(code: string): Promise<JourneyMeta | null> {
  const db = getFirebaseDb();
  const cleanCode = code.trim().toUpperCase();
  const codeSnap = await get(ref(db, `joinCodes/${cleanCode}`));

  if (!codeSnap.exists()) {
    return null;
  }

  const record = codeSnap.val() as JoinCodeRecord;
  if (record.status !== 'ACTIVE' || record.expiresAt < Date.now()) {
    throw new Error('This journey invite code has expired.');
  }

  const metaSnap = await get(ref(db, `journeys/${record.journeyId}/meta`));
  if (!metaSnap.exists()) {
    return null;
  }

  return metaSnap.val() as JourneyMeta;
}

/**
 * Joins a traveler to an existing journey with independent origin and travel mode.
 * Enforces the locked 10-member limit.
 */
export async function joinJourneyInDb(
  user: {
    uid: string;
    name: string;
    username: string;
    phone: string;
    photoUrl?: string;
  },
  journeyId: string,
  origin: OriginLocation,
  travelMode: TravelMode
): Promise<void> {
  const db = getFirebaseDb();
  const metaRef = ref(db, `journeys/${journeyId}/meta`);
  const metaSnap = await get(metaRef);

  if (!metaSnap.exists()) {
    throw new Error('Journey not found.');
  }

  const meta = metaSnap.val() as JourneyMeta;
  if (meta.status === 'COMPLETED' || meta.status === 'EXPIRED') {
    throw new Error('This journey has already ended.');
  }

  const membersSnap = await get(ref(db, `journeys/${journeyId}/members`));
  const currentMembers = membersSnap.val() || {};
  const currentCount = Object.keys(currentMembers).length;

  if (!currentMembers[user.uid] && currentCount >= CONFIG.MAX_MEMBERS) {
    throw new Error(`Journey is full (maximum ${CONFIG.MAX_MEMBERS} travelers).`);
  }

  const newMember: JourneyMember = {
    uid: user.uid,
    name: user.name,
    username: user.username,
    phone: user.phone,
    photoUrl: user.photoUrl,
    role: 'MEMBER',
    origin,
    travelMode,
    sharingState: 'NOT_STARTED',
    joinedAt: Date.now(),
    startedAt: null,
    finishedAt: null,
  };

  const updates: Record<string, unknown> = {};
  updates[`journeys/${journeyId}/members/${user.uid}`] = newMember;
  if (!currentMembers[user.uid]) {
    updates[`journeys/${journeyId}/meta/memberCount`] = currentCount + 1;
  }
  updates[`activeJourneyByUser/${user.uid}`] = {
    journeyId,
    startedAt: Date.now(),
    expiresAt: meta.expiresAt,
  };

  await update(ref(db), updates);
}

/**
 * Subscribes to live updates on journey metadata and member list.
 */
export function subscribeToJourney(
  journeyId: string,
  onMetaUpdate: (meta: JourneyMeta) => void,
  onMembersUpdate: (members: Record<string, JourneyMember>) => void
): () => void {
  const db = getFirebaseDb();
  const metaRef = ref(db, `journeys/${journeyId}/meta`);
  const membersRef = ref(db, `journeys/${journeyId}/members`);

  const metaCallback = (snapshot: DataSnapshot) => {
    if (snapshot.exists()) {
      onMetaUpdate(snapshot.val() as JourneyMeta);
    }
  };

  const membersCallback = (snapshot: DataSnapshot) => {
    if (snapshot.exists()) {
      onMembersUpdate(snapshot.val() as Record<string, JourneyMember>);
    } else {
      onMembersUpdate({});
    }
  };

  onValue(metaRef, metaCallback);
  onValue(membersRef, membersCallback);

  return () => {
    off(metaRef, 'value', metaCallback);
    off(membersRef, 'value', membersCallback);
  };
}
