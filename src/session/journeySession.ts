import { expireIfOverdue, subscribeToJourney } from '@/data/journeyRepository';
import { clearUserJourney } from '@/data/userJourneyRepository';
import { serverNow } from '@/data/serverClock';
import { getFirebaseDb } from '@/services/firebase/firebaseApp';
import { subscribeToLiveLocations, subscribeToSharedRoutes } from '@/services/firebase/liveLocationService';
import { flushChatOutbox } from '@/services/firebase/chatService';
import { deliverAlerts } from '@/services/notifications/alerts';
import { diffLive, diffMembers, diffMeta } from '@/domain/journeyEvents';
import { LiveLocationRecord } from '@/types/liveLocation';
import { onReconnect } from '@/services/connectivity';
import { useLiveLocationStore } from '@/store/useLiveLocationStore';
import { JourneyEndReason, useJourneyStore } from '@/store/useJourneyStore';
import { JourneyMeta } from '@/types/journey';
import { JourneyMember } from '@/types/member';

type EndedListener = (reason: JourneyEndReason) => void | Promise<void>;

const MAX_TIMER_MS = 2 ** 31 - 1;

/**
 * Owns the single live subscription to the journey the user is part of. Screens never
 * subscribe to Firebase themselves: they read the store, which this class keeps current.
 *
 * It is also the one place that detects "this journey is over for me" — completed, cancelled,
 * expired, or the user being removed — and announces it exactly once.
 */
class JourneySession {
  private unsubscribe: (() => void) | null = null;
  private unsubscribeLive: (() => void) | null = null;
  private unsubscribeRoutes: (() => void) | null = null;
  private unsubscribeReconnect: (() => void) | null = null;
  private journeyId: string | null = null;
  private uid: string | null = null;
  private expiryTimer: ReturnType<typeof setTimeout> | null = null;
  private endedListeners = new Set<EndedListener>();
  private ending = false;
  private sawSelf = false;
  private sawMeta = false;

  // Previous snapshots, so changes can be turned into alerts ("Rahul arrived").
  private prevMembers: Record<string, JourneyMember> | null = null;
  private prevMeta: JourneyMeta | null = null;
  private prevLive: Record<string, LiveLocationRecord> = {};
  private warnedLowBattery = new Set<string>();

  isRunningFor(journeyId: string): boolean {
    return this.journeyId === journeyId && this.unsubscribe !== null;
  }

  start(journeyId: string, uid: string): void {
    if (this.isRunningFor(journeyId)) return;
    this.stop();

    this.journeyId = journeyId;
    this.uid = uid;
    this.ending = false;
    this.sawSelf = false;
    this.sawMeta = false;
    this.prevMembers = null;
    this.prevMeta = null;
    this.prevLive = {};
    this.warnedLowBattery = new Set();

    const store = useJourneyStore.getState();
    store.setActiveJourney(journeyId);
    useJourneyStore.setState({ endedReason: null });

    useLiveLocationStore.getState().clearLocations();
    this.unsubscribeLive = subscribeToLiveLocations(journeyId, (locations) => {
      useLiveLocationStore.getState().setAllLocations(locations);
      this.alertOnLiveChanges(locations);
    });

    this.unsubscribeRoutes = subscribeToSharedRoutes(journeyId, (routes) =>
      useLiveLocationStore.getState().setRoutes(routes)
    );

    // Messages typed while offline go out as soon as the connection is back (and on resume).
    this.unsubscribeReconnect = onReconnect(() => void flushChatOutbox(journeyId).catch(() => undefined));
    void flushChatOutbox(journeyId).catch(() => undefined);

    this.unsubscribe = subscribeToJourney(getFirebaseDb(), journeyId, {
      onMeta: (meta) => this.handleMeta(meta),
      onMembers: (members) => this.handleMembers(members),
      onError: (error) => {
        // Rules cancel the listener when we are no longer a member.
        if (error.code === 'NOT_ALLOWED') void this.end('REMOVED');
      },
    });
  }

  /** Stops listening without announcing anything (used when the user leaves on purpose). */
  stop(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.unsubscribeLive?.();
    this.unsubscribeLive = null;
    this.unsubscribeRoutes?.();
    this.unsubscribeRoutes = null;
    this.unsubscribeReconnect?.();
    this.unsubscribeReconnect = null;
    if (this.expiryTimer) clearTimeout(this.expiryTimer);
    this.expiryTimer = null;
    this.journeyId = null;
    this.uid = null;
  }

  /** Registers cleanup to run (e.g. stop GPS) before the "journey ended" UI appears. */
  addEndedListener(listener: EndedListener): () => void {
    this.endedListeners.add(listener);
    return () => {
      this.endedListeners.delete(listener);
    };
  }

  private handleMeta(meta: JourneyMeta | null): void {
    if (this.ending) return;
    if (!meta) {
      void this.end(this.sawMeta ? 'CANCELLED' : 'REMOVED');
      return;
    }
    this.sawMeta = true;
    if (meta.status === 'COMPLETED' || meta.status === 'CANCELLED' || meta.status === 'EXPIRED') {
      void this.end(meta.status);
      return;
    }
    const { members } = useJourneyStore.getState();
    deliverAlerts(diffMeta(this.prevMeta, meta, members, this.uid));
    this.prevMeta = meta;
    useJourneyStore.getState().setCurrentJourney(meta);
    this.scheduleExpiry(meta);
  }

  private handleMembers(members: Record<string, JourneyMember>): void {
    if (this.ending) return;
    // The first snapshot is just "who is here already": only later changes are news.
    if (this.prevMembers) deliverAlerts(diffMembers(this.prevMembers, members, this.uid));
    this.prevMembers = members;
    useJourneyStore.getState().setMembers(members);
    if (this.uid && members[this.uid]) {
      this.sawSelf = true;
    } else if (this.sawSelf) {
      void this.end('REMOVED');
    }
  }

  private alertOnLiveChanges(locations: Record<string, LiveLocationRecord>): void {
    if (this.ending) return;
    const { members } = useJourneyStore.getState();
    deliverAlerts(diffLive(this.prevLive, locations, members, this.uid, this.warnedLowBattery));
    this.prevLive = locations;
  }

  private scheduleExpiry(meta: JourneyMeta): void {
    if (this.expiryTimer) clearTimeout(this.expiryTimer);
    const delay = Math.min(Math.max(meta.expiresAt - serverNow(getFirebaseDb()), 0), MAX_TIMER_MS);
    this.expiryTimer = setTimeout(async () => {
      if (this.ending) return;
      await expireIfOverdue(getFirebaseDb(), meta);
      void this.end('EXPIRED');
    }, delay + 250);
  }

  private async end(reason: JourneyEndReason): Promise<void> {
    if (this.ending) return;
    this.ending = true;
    const uid = this.uid;
    this.stop();

    for (const listener of Array.from(this.endedListeners)) {
      try {
        await listener(reason);
      } catch (error) {
        console.warn('[JourneySession] ended listener failed:', error);
      }
    }
    if (uid) await clearUserJourney(getFirebaseDb(), uid).catch(() => undefined);
    useJourneyStore.getState().setEnded(reason);
  }
}

export const journeySession = new JourneySession();
