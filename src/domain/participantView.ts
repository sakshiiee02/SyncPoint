import { LiveLocationRecord, ParticipantLiveState } from '@/types/liveLocation';
import { JourneyMember, hasCoordinates, isTravelingState } from '@/types/member';
import { QuickStatusType } from '@/types/status';
import { defaultMascot } from './mascot';

/** What this device knows about its own traveler, fresher than anything round-tripped via Firebase. */
export interface SelfTelemetry {
  fix: { lat: number; lng: number; speedMps: number; heading: number } | null;
  batteryPct: number | null;
  charging: boolean;
  distanceRemainingM: number | null;
  etaEpochMs: number | null;
  currentRoad: string;
  status: QuickStatusType;
}

export interface ParticipantViewInput {
  members: Record<string, JourneyMember>;
  locations: Record<string, LiveLocationRecord>;
  selfUid: string | null;
  self: SelfTelemetry;
  nowMs: number;
  staleMs: number;
}

/**
 * Builds the roster/map model. The rule that fixes the "friend already arrived" bug lives here:
 * what a traveler *is* (waiting, traveling, arrived…) comes from `member.state`, and a traveler
 * with no live data simply has no distance/ETA — it is never defaulted to 0.
 */
export function buildParticipantViews(input: ParticipantViewInput): ParticipantLiveState[] {
  const { members, locations, selfUid, self, nowMs, staleMs } = input;

  return Object.values(members)
    .sort((a, b) => a.joinedAt - b.joinedAt)
    .map((member): ParticipantLiveState => {
      const isLocalUser = member.uid === selfUid;
      const live = locations[member.uid];
      const state = member.state;
      const traveling = isTravelingState(state);

      const base = {
        uid: member.uid,
        name: member.name,
        phone: member.phone,
        photoUrl: member.photoUrl,
        isLocalUser,
        seat: member.seat,
        mascot: member.mascot ?? defaultMascot(member.uid),
        travelerState: state,
        travelMode: member.travelMode,
        originLabel: member.origin.displayName,
        heading: 0,
        speedMps: 0,
        batteryPct: null as number | null,
        charging: false,
        status: 'ON_THE_WAY' as QuickStatusType,
        currentRoad: '',
        distanceRemainingM: null as number | null,
        etaEpochMs: null as number | null,
        lastUpdatedAt: null as number | null,
        isSharing: false,
        isStale: false,
      };

      // Not out on the road: show them at their chosen starting point (if it has coordinates).
      if (!traveling) {
        if (state === 'WAITING' && hasCoordinates(member.origin)) {
          return { ...base, positionKind: 'ORIGIN', lat: member.origin.lat, lng: member.origin.lng };
        }
        return { ...base, positionKind: 'NONE', lat: 0, lng: 0 };
      }

      const sharing = state !== 'PAUSED';

      if (isLocalUser && self.fix) {
        return {
          ...base,
          positionKind: 'LIVE',
          lat: self.fix.lat,
          lng: self.fix.lng,
          heading: self.fix.heading,
          speedMps: self.fix.speedMps,
          batteryPct: self.batteryPct,
          charging: self.charging,
          status: self.status,
          currentRoad: self.currentRoad,
          distanceRemainingM: state === 'ARRIVED' ? 0 : self.distanceRemainingM,
          etaEpochMs: state === 'ARRIVED' ? nowMs : self.etaEpochMs,
          lastUpdatedAt: nowMs,
          isSharing: sharing,
          isStale: false,
        };
      }

      if (live) {
        return {
          ...base,
          positionKind: 'LIVE',
          lat: live.lat,
          lng: live.lng,
          heading: live.heading ?? 0,
          speedMps: live.speedMps ?? 0,
          batteryPct: typeof live.batteryPct === 'number' ? live.batteryPct : null,
          charging: Boolean(live.charging),
          status: live.status ?? 'ON_THE_WAY',
          currentRoad: live.currentRoad ?? '',
          distanceRemainingM: state === 'ARRIVED' ? 0 : live.distanceRemainingM ?? null,
          etaEpochMs: state === 'ARRIVED' ? live.lastUpdatedAt : live.etaEpochMs ?? null,
          lastUpdatedAt: live.lastUpdatedAt,
          isSharing: sharing && live.isSharing !== false,
          isStale: sharing && nowMs - live.lastUpdatedAt > staleMs,
        };
      }

      // Started, but their first fix hasn't arrived yet.
      if (hasCoordinates(member.origin)) {
        return { ...base, positionKind: 'ORIGIN', lat: member.origin.lat, lng: member.origin.lng, isSharing: sharing };
      }
      return { ...base, positionKind: 'NONE', lat: 0, lng: 0, isSharing: sharing };
    });
}
