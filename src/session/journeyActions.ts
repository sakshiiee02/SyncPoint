import {
  CreateJourneyInput,
  JoinedJourney,
  TravelerSetup,
  changeTravelerState,
  createJourney,
  endJourney,
  finishTraveler,
  joinJourney,
  leaveJourney,
  startTraveling,
  updateMascot,
} from '@/data/journeyRepository';
import { resolveResumableJourney } from '@/data/userJourneyRepository';
import { JourneyError } from '@/data/errors';
import { getFirebaseDb } from '@/services/firebase/firebaseApp';
import { useJourneyStore } from '@/store/useJourneyStore';
import { useProfileStore } from '@/store/useProfileStore';
import { OriginLocation, TravelerState, UserProfile } from '@/types/member';
import { Mascot } from '@/domain/mascot';
import { journeySession } from './journeySession';

/**
 * Application-level operations on "the journey I'm in". Each one combines the repository
 * call, the live session and the store so screens only have to call a single function.
 */

function requireProfile(): UserProfile {
  const profile = useProfileStore.getState().profile;
  if (!profile) throw new JourneyError('NOT_ALLOWED', 'Your profile is not ready yet.');
  return profile;
}

function requireJourneyId(): string {
  const id = useJourneyStore.getState().activeJourneyId;
  if (!id) throw new JourneyError('JOURNEY_NOT_FOUND');
  return id;
}

function adopt(joined: JoinedJourney): void {
  const store = useJourneyStore.getState();
  store.setCurrentJourney(joined.meta);
  store.setMembers({ [joined.member.uid]: joined.member });
  journeySession.start(joined.meta.journeyId, joined.member.uid);
}

export async function createJourneyAction(input: CreateJourneyInput): Promise<JoinedJourney> {
  const joined = await createJourney(getFirebaseDb(), requireProfile(), input);
  adopt(joined);
  return joined;
}

export async function joinJourneyAction(
  journeyId: string,
  setup: TravelerSetup
): Promise<JoinedJourney> {
  const joined = await joinJourney(getFirebaseDb(), requireProfile(), journeyId, setup);
  adopt(joined);
  return joined;
}

/** After an app restart: re-attaches to the journey the user was in, if it is still live. */
export async function resumeJourneyAction(uid: string): Promise<JoinedJourney | null> {
  const resumable = await resolveResumableJourney(getFirebaseDb(), uid);
  if (!resumable) return null;
  adopt(resumable);
  return resumable;
}

/** Press "Start Journey". `resolvedOrigin` is the real GPS fix for "current location" starts. */
export async function startTravelingAction(resolvedOrigin?: OriginLocation): Promise<void> {
  const profile = requireProfile();
  const journeyId = requireJourneyId();
  const store = useJourneyStore.getState();
  const previous = store.members[profile.uid]?.state;

  store.patchMember(profile.uid, { state: 'TRAVELING' });
  try {
    await startTraveling(getFirebaseDb(), journeyId, profile.uid, resolvedOrigin);
  } catch (error) {
    if (previous) useJourneyStore.getState().patchMember(profile.uid, { state: previous });
    throw error;
  }
}

export async function setTravelerStateAction(
  action: 'PAUSE' | 'RESUME' | 'ARRIVE'
): Promise<TravelerState> {
  const profile = requireProfile();
  const journeyId = requireJourneyId();
  const next = await changeTravelerState(getFirebaseDb(), journeyId, profile.uid, action);
  useJourneyStore.getState().patchMember(profile.uid, { state: next });
  return next;
}

/** Runs `operation` with the live session detached, restoring it if the operation fails. */
async function detachedWhile(operation: () => Promise<void>): Promise<void> {
  const profile = requireProfile();
  const journeyId = requireJourneyId();
  journeySession.stop();
  try {
    await operation();
  } catch (error) {
    journeySession.start(journeyId, profile.uid);
    throw error;
  }
  useJourneyStore.getState().resetJourney();
}

export async function finishJourneyAction(): Promise<{ journeyCompleted: boolean }> {
  const profile = requireProfile();
  const journeyId = requireJourneyId();
  let journeyCompleted = false;
  await detachedWhile(async () => {
    const result = await finishTraveler(getFirebaseDb(), journeyId, profile.uid);
    journeyCompleted = result.journeyCompleted;
  });
  return { journeyCompleted };
}

export async function leaveJourneyAction(): Promise<void> {
  const profile = requireProfile();
  const journeyId = requireJourneyId();
  await detachedWhile(() => leaveJourney(getFirebaseDb(), journeyId, profile.uid));
}

/** Creator only. Ends (or cancels, if still in the lobby) the journey for everyone. */
export async function endJourneyAction(): Promise<void> {
  const profile = requireProfile();
  const journeyId = requireJourneyId();
  await detachedWhile(() => endJourney(getFirebaseDb(), journeyId, profile.uid));
}

/** Drops local journey state without touching the server (e.g. after the journey ended remotely). */
export function discardLocalJourney(): void {
  journeySession.stop();
  useJourneyStore.getState().resetJourney();
}

/** After the mascot is edited in the profile: show the new one to friends in the current journey, if any. */
export async function shareMascotWithJourney(mascot: Mascot): Promise<void> {
  const journeyId = useJourneyStore.getState().activeJourneyId;
  const uid = useProfileStore.getState().uid;
  if (!journeyId || !uid) return;
  await updateMascot(getFirebaseDb(), journeyId, uid, mascot);
}
