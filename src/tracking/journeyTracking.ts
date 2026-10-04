import { JourneyError } from '@/data/errors';
import { requestLocationPermissions } from '@/services/location/permissionService';
import { LocationBridge, PositionError } from '@/services/location/LocationBridge';
import { startTravelingAction } from '@/session/journeyActions';
import { useJourneyStore } from '@/store/useJourneyStore';
import { useProfileStore } from '@/store/useProfileStore';
import { isTravelingState, OriginLocation } from '@/types/member';
import { TrackingContext, trackingController } from './trackingController';

/** Why a journey could not be started, in terms the UI can explain. */
export type StartBlockReason = 'PERMISSION' | 'LOCATION_OFF' | 'NO_FIX';

export class StartBlockedError extends Error {
  constructor(public readonly reason: StartBlockReason, message: string) {
    super(message);
    this.name = 'StartBlockedError';
  }
}

function currentContext(startPaused = false): TrackingContext | null {
  const { currentJourney, members } = useJourneyStore.getState();
  const uid = useProfileStore.getState().uid;
  const me = uid ? members[uid] : undefined;
  if (!currentJourney || !uid || !me) return null;
  return {
    journeyId: currentJourney.journeyId,
    uid,
    journeyName: currentJourney.name,
    destination: currentJourney.destination,
    travelMode: me.travelMode,
    journeyCreatedAt: currentJourney.createdAt,
    startedAt: me.startedAt ?? Date.now(),
    startPaused,
  };
}

/**
 * "Start Journey". Must be triggered by a visible user action (Android only allows starting the
 * location foreground service from the foreground). Order matters: check location first, so a
 * failure leaves the traveler in WAITING instead of "started with no GPS".
 */
export async function beginJourney(): Promise<void> {
  const { members } = useJourneyStore.getState();
  const uid = useProfileStore.getState().uid;
  const me = uid ? members[uid] : undefined;
  if (!me) throw new JourneyError('NOT_A_MEMBER');

  if (isTravelingState(me.state)) {
    // Already started (e.g. coming back to the lobby): just make sure tracking is running.
    await resumeTrackingIfNeeded();
    return;
  }

  if (!(await requestLocationPermissions())) {
    throw new StartBlockedError(
      'PERMISSION',
      'SyncPoint needs precise location to show you on the group map. You can allow it in Settings.'
    );
  }

  let resolvedOrigin: OriginLocation | undefined;
  try {
    // Always take a fix: it proves location services are on, and "current location" starts need it.
    const fix = await LocationBridge.getCurrentPosition();
    if (me.origin.kind === 'GPS') {
      resolvedOrigin = {
        kind: 'GPS',
        lat: fix.latitude,
        lng: fix.longitude,
        displayName: me.origin.displayName,
      };
    }
  } catch (error) {
    if (error instanceof PositionError) {
      if (error.code === 'PERMISSION_DENIED') throw new StartBlockedError('PERMISSION', error.message);
      if (error.code === 'TIMEOUT') throw new StartBlockedError('NO_FIX', error.message);
      throw new StartBlockedError(
        'LOCATION_OFF',
        'Location seems to be turned off. Turn it on in your phone settings and try again.'
      );
    }
    throw error;
  }

  await startTravelingAction(resolvedOrigin);

  const ctx = currentContext();
  if (ctx) await trackingController.start(ctx);
}

/** After an app restart: if the traveler was on the road, start the GPS service again. */
export async function resumeTrackingIfNeeded(): Promise<void> {
  const { members } = useJourneyStore.getState();
  const uid = useProfileStore.getState().uid;
  const me = uid ? members[uid] : undefined;
  if (!me || !isTravelingState(me.state)) return;

  const ctx = currentContext(me.state === 'PAUSED');
  if (!ctx || trackingController.isRunningFor(ctx.journeyId)) return;

  if (!(await requestLocationPermissions())) return; // the Active screen shows a location banner
  await trackingController.start(ctx);
}

/** Stop GPS and keep a local history copy. Call before leaving / finishing / ending. */
export async function stopTracking(): Promise<void> {
  await trackingController.stop({ saveHistory: true });
}
