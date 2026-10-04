import { CONFIG } from '@/constants/config';
import { ArrivalDetector } from '@/domain/arrival';
import { PaceTracker, estimateEtaEpochMs } from '@/domain/eta';
import { getLocalStore } from '@/db/sqliteClient';
import { isOnline, onReconnect } from '@/services/connectivity';
import { publishLiveLocation, publishSharedRoute } from '@/services/firebase/liveLocationService';
import { toSharedRoute } from '@/domain/routeSharing';
import { RouteRecord } from '@/types/route';
import { saveLocalJourneyHistory } from '@/services/firebase/historyService';
import {
  LocationBridge,
  NativeTrackingStatus,
  RawLocationUpdate,
} from '@/services/location/LocationBridge';
import {
  NavigationProgress,
  evaluateNavigationProgress,
} from '@/services/routing/navigationEngine';
import { getRoute } from '@/services/routing';
import { voiceGuidance } from '@/services/routing/voiceGuidanceService';
import { journeySession } from '@/session/journeySession';
import { setTravelerStateAction } from '@/session/journeyActions';
import { useJourneyStore } from '@/store/useJourneyStore';
import { useNavigationStore } from '@/store/useNavigationStore';
import { useTrackingStore } from '@/store/useTrackingStore';
import { Destination } from '@/types/journey';
import { HistoryPoint, JourneyHistorySnapshot } from '@/types/history';
import { LiveLocationRecord } from '@/types/liveLocation';
import { TravelMode } from '@/types/member';
import { QuickStatusType } from '@/types/status';
import { calculateDistanceMeters } from '@/utils/geoMath';
import { computeTravelerSummary } from '@/utils/historyCompression';

export interface TrackingContext {
  journeyId: string;
  uid: string;
  journeyName: string;
  destination: Destination;
  travelMode: TravelMode;
  journeyCreatedAt: number;
  startedAt: number;
  /** Resume into the paused state (app restarted while sharing was paused). */
  startPaused?: boolean;
}

const MIN_PUBLISH_GAP_MS = 1500;
const REROUTE_COOLDOWN_MS = 20_000;
const MAX_USABLE_ACCURACY_M = 300;
const HISTORY_MIN_DISTANCE_M = 15;
const HISTORY_MIN_INTERVAL_MS = 30_000;
const HISTORY_MAX_POINTS = 20_000;

/**
 * Owns everything that must keep happening while a traveler is on the road, independent of which
 * screen is open: receiving GPS fixes, following the route, voice prompts, arrival detection and
 * publishing to the group. Screens only read the stores it writes.
 */
class TrackingController {
  private ctx: TrackingContext | null = null;
  private cleanups: Array<() => void> = [];
  private stopping = false;

  private arrival = new ArrivalDetector(CONFIG.ARRIVAL_RADIUS_M);
  private pace = new PaceTracker();
  private lastFix: RawLocationUpdate | null = null;
  private lastPublishMs = 0;
  private lastRerouteMs = 0;
  private routeLoading = false;
  private canonicalHint: number | undefined;
  private activeHint: number | undefined;
  private routeVersion = 1;
  private history: HistoryPoint[] = [];
  private lastHistoryPoint: HistoryPoint | null = null;
  /** The shared route, kept so it can be re-sent after a reconnect. */
  private sharedRoute: RouteRecord | null = null;

  get isRunning(): boolean {
    return this.ctx !== null;
  }

  isRunningFor(journeyId: string): boolean {
    return this.ctx?.journeyId === journeyId;
  }

  async start(ctx: TrackingContext): Promise<void> {
    if (this.isRunningFor(ctx.journeyId)) return;
    await this.stop({ saveHistory: false });

    this.ctx = ctx;
    this.arrival = new ArrivalDetector(CONFIG.ARRIVAL_RADIUS_BY_MODE[ctx.travelMode]);
    this.pace.reset();
    this.lastFix = null;
    this.lastPublishMs = 0;
    this.lastRerouteMs = 0;
    this.routeLoading = false;
    this.canonicalHint = undefined;
    this.activeHint = undefined;
    this.routeVersion = 1;
    this.history = [];
    this.lastHistoryPoint = null;
    this.sharedRoute = null;

    voiceGuidance.reset();
    useNavigationStore.getState().resetNavigation();
    useTrackingStore.getState().reset();
    useTrackingStore.getState().set({ isTracking: true, isPaused: Boolean(ctx.startPaused) });

    try {
      await LocationBridge.startTracking(ctx.journeyId, ctx.journeyName, ctx.destination.displayName);
    } catch (error) {
      this.ctx = null;
      useTrackingStore.getState().reset();
      throw error;
    }

    this.cleanups.push(LocationBridge.addLocationListener((fix) => this.onFix(fix)));
    this.cleanups.push(LocationBridge.addStatusListener((status) => this.onNativeStatus(status)));
    this.cleanups.push(journeySession.addEndedListener(() => this.stop({ saveHistory: true })));
    // After an outage, share where we are *now* (stale positions are never replayed).
    this.cleanups.push(
      onReconnect(() => {
        void this.publishNow(true).catch(() => undefined);
        void this.publishRoute().catch(() => undefined);
      })
    );
    if (ctx.startPaused) LocationBridge.pauseTracking().catch(() => undefined);

    // Resume from what survived on disk if the app was killed mid-trip: the route (so navigation
    // works instantly, even with no signal) and the track recorded so far (so history isn't lost).
    try {
      const store = await getLocalStore();
      const [cached, points] = await Promise.all([
        store.getCachedRoute(ctx.journeyId),
        store.getTrackPoints(ctx.journeyId),
      ]);
      if (this.ctx !== ctx) return;
      if (cached) {
        useNavigationStore.getState().setActiveRoute(cached);
        this.sharedRoute = cached;
        void this.publishRoute().catch(() => undefined);
      }
      if (points.length > 0) {
        this.history = points;
        this.lastHistoryPoint = points[points.length - 1];
      }
    } catch (error) {
      console.warn('[Tracking] could not restore local state:', (error as Error)?.message);
    }
  }

  async stop(options: { saveHistory: boolean }): Promise<void> {
    const ctx = this.ctx;
    if (!ctx || this.stopping) return;
    this.stopping = true;

    for (const cleanup of this.cleanups.splice(0)) cleanup();
    await LocationBridge.finishTracking().catch(() => undefined);
    LocationBridge.stopSpeaking();
    if (options.saveHistory) {
      await saveLocalJourneyHistory(this.buildHistorySnapshot(ctx)).catch(() => undefined);
    }
    // The trip is saved (or abandoned): free the on-disk working copy.
    await getLocalStore()
      .then((store) => store.purgeJourney(ctx.journeyId))
      .catch(() => undefined);

    voiceGuidance.reset();
    useNavigationStore.getState().resetNavigation();
    useTrackingStore.getState().reset();
    this.ctx = null;
    this.stopping = false;
  }

  /** Pause or resume *sharing*. The traveler's own navigation keeps running while paused. */
  async setPaused(paused: boolean, fromNotification = false): Promise<void> {
    const ctx = this.ctx;
    const tracking = useTrackingStore.getState();
    if (!ctx || tracking.isPaused === paused) return;

    tracking.set({ isPaused: paused });
    try {
      await setTravelerStateAction(paused ? 'PAUSE' : 'RESUME');
    } catch (error) {
      useTrackingStore.getState().set({ isPaused: !paused });
      throw error;
    }
    if (!fromNotification) {
      const toggle = paused ? LocationBridge.pauseTracking() : LocationBridge.resumeTracking();
      await toggle.catch(() => undefined);
    }
    await this.publishNow();
  }

  /** Changes the quick status chip ("Fuel stop"…) and shares it right away. */
  async setStatus(status: QuickStatusType): Promise<void> {
    useTrackingStore.getState().set({ status });
    await this.publishNow();
  }

  clearArrivalPrompt(): void {
    useTrackingStore.getState().set({ arrivalPromptPending: false });
  }

  // ── internals ──────────────────────────────────────────────────────────────────────────

  private onNativeStatus(status: NativeTrackingStatus): void {
    if (status === 'PAUSED') void this.setPaused(true, true).catch(() => undefined);
    if (status === 'RESUMED') void this.setPaused(false, true).catch(() => undefined);
  }

  private onFix(update: RawLocationUpdate): void {
    const ctx = this.ctx;
    if (!ctx || (update.accuracy > 0 && update.accuracy > MAX_USABLE_ACCURACY_M)) return;

    this.lastFix = update;
    const point = { lat: update.latitude, lng: update.longitude };
    const tracking = useTrackingStore.getState();

    tracking.set({
      selfFix: {
        lat: update.latitude,
        lng: update.longitude,
        speedMps: update.speedMps,
        heading: update.heading,
        accuracy: update.accuracy,
        timestamp: update.timestamp,
      },
      ...(typeof update.batteryPct === 'number'
        ? { batteryPct: update.batteryPct, charging: Boolean(update.isCharging) }
        : {}),
    });

    this.pace.push(update.speedMps);
    this.recordHistoryPoint(update);
    this.followRoute(ctx, point);
    this.checkArrival(ctx, point, update);

    if (update.shouldPublish) void this.publishNow().catch(() => undefined);
  }

  private followRoute(ctx: TrackingContext, point: { lat: number; lng: number }): void {
    const nav = useNavigationStore.getState();
    const canonical = nav.savedCanonicalRoute ?? nav.activeRoute;

    if (!canonical) {
      void this.loadRoute(ctx, point);
      // No route yet: show straight-line distance rather than nothing.
      const straight = calculateDistanceMeters(point, ctx.destination);
      useTrackingStore.getState().set({
        distanceRemainingM: Math.round(straight),
        etaEpochMs: estimateEtaEpochMs({
          remainingM: straight,
          route: null,
          recentPaceMps: this.pace.averageMps,
          travelMode: ctx.travelMode,
          nowMs: Date.now(),
        }),
      });
      return;
    }

    // Progress toward the destination (always the shared route; what we publish to the group).
    const progress = evaluateNavigationProgress(point, canonical, this.canonicalHint);
    this.canonicalHint = progress.segmentIndex;
    useTrackingStore.getState().set({
      distanceRemainingM: progress.distanceRemainingM,
      currentRoad: progress.currentRoad,
      etaEpochMs: estimateEtaEpochMs({
        remainingM: progress.distanceRemainingM,
        route: canonical,
        recentPaceMps: this.pace.averageMps,
        travelMode: ctx.travelMode,
        nowMs: Date.now(),
      }),
    });

    // What the navigation banner and voice follow (may be a temporary route to another traveler).
    const active = nav.activeRoute ?? canonical;
    let shown: NavigationProgress = progress;
    if (nav.isSecondaryRoute) {
      shown = evaluateNavigationProgress(point, active, this.activeHint);
      this.activeHint = shown.segmentIndex;
    }
    nav.updateProgress(shown);
    // An estimated straight line has no real turns to announce.
    if (active.source !== 'ESTIMATE') {
      voiceGuidance.evaluateManeuverPrompt(shown.currentStepIndex, shown.distanceToNextManeuverM, shown.instruction);
    }

    if (progress.isOffRoute && !nav.isSecondaryRoute) void this.reroute(ctx, point);
  }

  private async loadRoute(
    ctx: TrackingContext,
    from: { lat: number; lng: number },
    fresh = false
  ): Promise<void> {
    if (this.routeLoading) return;
    this.routeLoading = true;
    try {
      const route = await getRoute(from, ctx.destination, ctx.travelMode, {
        fresh,
        destinationName: ctx.destination.displayName,
      });
      if (this.ctx !== ctx) return;
      const versioned = { ...route, routeVersion: this.routeVersion };
      useNavigationStore.getState().setActiveRoute(versioned);
      this.sharedRoute = versioned;
      void this.publishRoute().catch(() => undefined);
      this.canonicalHint = undefined;
      await getLocalStore().then((store) => store.cacheRoute(ctx.journeyId, route));
    } catch (error) {
      console.warn('[Tracking] route unavailable:', (error as Error)?.message);
    } finally {
      this.routeLoading = false;
    }
  }

  private async reroute(ctx: TrackingContext, from: { lat: number; lng: number }): Promise<void> {
    const now = Date.now();
    if (this.routeLoading || now - this.lastRerouteMs < REROUTE_COOLDOWN_MS) return;
    this.lastRerouteMs = now;
    this.routeVersion += 1;
    await this.loadRoute(ctx, from, true);
  }

  private checkArrival(
    ctx: TrackingContext,
    point: { lat: number; lng: number },
    update: RawLocationUpdate
  ): void {
    const state = useJourneyStore.getState().members[ctx.uid]?.state;
    if (state !== 'TRAVELING') return; // paused travelers don't auto-arrive; arrived ones already did
    if (!this.arrival.update({ ...point, accuracy: update.accuracy }, ctx.destination)) return;

    setTravelerStateAction('ARRIVE')
      .then(() => {
        useTrackingStore.getState().set({ arrivalPromptPending: true });
        return this.publishNow();
      })
      .catch((error) => console.warn('[Tracking] could not record arrival:', error?.message));
  }

  private recordHistoryPoint(update: RawLocationUpdate): void {
    if (useTrackingStore.getState().isPaused) return;
    const ctx = this.ctx;
    if (!ctx || this.history.length >= HISTORY_MAX_POINTS) return;

    const last = this.lastHistoryPoint;
    const moved = last
      ? calculateDistanceMeters(
          { lat: last.lat, lng: last.lng },
          { lat: update.latitude, lng: update.longitude }
        )
      : Infinity;
    const elapsed = last ? update.timestamp - last.timestamp : Infinity;
    if (moved < HISTORY_MIN_DISTANCE_M && elapsed < HISTORY_MIN_INTERVAL_MS) return;

    const point: HistoryPoint = {
      lat: update.latitude,
      lng: update.longitude,
      timestamp: update.timestamp,
      speedMps: update.speedMps,
    };
    this.history.push(point);
    this.lastHistoryPoint = point;
    getLocalStore()
      .then((store) => store.appendTrackPoint(ctx.journeyId, point))
      .catch(() => undefined);
  }

  /** Publishes the latest known state (throttled), buffering locally if the network is down. */
  private async publishNow(force = false): Promise<void> {
    const ctx = this.ctx;
    const fix = this.lastFix;
    if (!ctx || !fix) return;

    const tracking = useTrackingStore.getState();
    const now = Date.now();
    if (!isOnline()) return; // offline: nothing to send; the reconnect hook publishes the latest fix
    if (!force && !tracking.isPaused && now - this.lastPublishMs < MIN_PUBLISH_GAP_MS) return;
    this.lastPublishMs = now;

    const record: LiveLocationRecord = {
      lat: fix.latitude,
      lng: fix.longitude,
      heading: fix.heading,
      speedMps: fix.speedMps,
      ...(tracking.batteryPct !== null
        ? { batteryPct: tracking.batteryPct, charging: tracking.charging }
        : {}),
      status: tracking.status,
      lastUpdatedAt: now,
      currentRoad: tracking.currentRoad,
      distanceRemainingM: Math.round(tracking.distanceRemainingM ?? 0),
      etaEpochMs: tracking.etaEpochMs ?? now,
      routeVersion: this.routeVersion,
      isSharing: !tracking.isPaused,
    };

    try {
      await publishLiveLocation(ctx.journeyId, ctx.uid, record);
    } catch (error) {
      console.warn('[Tracking] publish failed:', (error as Error)?.message);
    }
  }

  /** Shares the route with the group so friends can see where this traveler is heading. */
  private async publishRoute(): Promise<void> {
    const ctx = this.ctx;
    const route = this.sharedRoute;
    if (!ctx || !route || route.source === 'ESTIMATE' || !isOnline()) return;
    try {
      await publishSharedRoute(ctx.journeyId, ctx.uid, toSharedRoute(route));
    } catch (error) {
      console.warn('[Tracking] could not share route:', (error as Error)?.message);
    }
  }

  /** Real recorded track and stats for this traveler's trip. */
  private buildHistorySnapshot(ctx: TrackingContext): JourneyHistorySnapshot {
    const now = Date.now();
    const meta = useJourneyStore.getState().currentJourney;
    const summary = computeTravelerSummary(this.history, {
      uid: ctx.uid,
      name: useJourneyStore.getState().members[ctx.uid]?.name ?? 'Traveler',
      travelMode: ctx.travelMode,
      startedAt: ctx.startedAt,
      finishedAt: now,
    });
    return {
      journeyId: ctx.journeyId,
      name: meta?.name ?? ctx.journeyName,
      destination: {
        lat: ctx.destination.lat,
        lng: ctx.destination.lng,
        displayName: ctx.destination.displayName,
      },
      createdAt: ctx.journeyCreatedAt,
      completedAt: now,
      status: 'COMPLETED',
      travelers: { [ctx.uid]: summary },
    };
  }
}

export const trackingController = new TrackingController();
