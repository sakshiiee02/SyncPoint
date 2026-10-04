import { useCallback, useEffect, useState } from 'react';
import { ensureAnonymousAuth } from '@/services/firebase/authService';
import { startConnectivityMonitor } from '@/services/connectivity';
import { FirebaseConfigError } from '@/services/firebase/firebaseApp';
import { resumeJourneyAction } from '@/session/journeyActions';
import { resumeTrackingIfNeeded } from '@/tracking/journeyTracking';
import { useProfileStore } from '@/store/useProfileStore';
import { ResumeRoute } from './navigation/routes';

export type BootState =
  | { status: 'loading' }
  | { status: 'config-error'; missing: string[] }
  | { status: 'offline-error'; message: string }
  | { status: 'ready'; resumeRoute: ResumeRoute | null };

/**
 * App start-up: restore the saved profile, restore (or create, once) the anonymous identity,
 * then re-attach to a journey that was in progress when the app last closed.
 */
export function useBootstrap(): { state: BootState; retry: () => void } {
  const [state, setState] = useState<BootState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => {
    setState({ status: 'loading' });
    setAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const { initProfile, setUid } = useProfileStore.getState();
        await initProfile();
        const user = await ensureAnonymousAuth();
        setUid(user.uid);
        startConnectivityMonitor();

        let resumeRoute: ResumeRoute | null = null;
        if (useProfileStore.getState().hasCompletedProfile) {
          const resumed = await resumeJourneyAction(user.uid).catch(() => null);
          if (resumed) {
            resumeRoute = resumed.member.state === 'WAITING' ? 'JourneyLobby' : 'ActiveJourney';
            // Android may have killed the app while the traveler was on the road: pick GPS back up.
            await resumeTrackingIfNeeded().catch(() => undefined);
          }
        }
        if (!cancelled) setState({ status: 'ready', resumeRoute });
      } catch (error) {
        if (cancelled) return;
        if (error instanceof FirebaseConfigError) {
          setState({ status: 'config-error', missing: error.missing });
        } else {
          setState({
            status: 'offline-error',
            message:
              'SyncPoint could not reach its servers. Check your internet connection and try again.',
          });
        }
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  return { state, retry };
}
