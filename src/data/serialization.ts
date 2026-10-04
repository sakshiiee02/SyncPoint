import { JourneyMember, OriginLocation, TravelerState, TravelMode } from '@/types/member';
import { JourneyMeta } from '@/types/journey';
import { normalizeMascot } from '@/domain/mascot';

/**
 * RTDB cannot store `undefined` and silently drops `null`, and the rules expect `seat` as a
 * string key. These helpers are the only place that knows about those quirks.
 */
export function stripUndefined<T>(value: T): T {
  if (value === undefined) return null as unknown as T;
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(stripUndefined) as unknown as T;
  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    if (v !== undefined && v !== null) out[key] = stripUndefined(v);
  }
  return out as T;
}

export function memberToDb(member: JourneyMember): Record<string, unknown> {
  const { origin, seat, ...rest } = member;
  return stripUndefined({
    ...rest,
    seat: String(seat),
    origin: {
      kind: origin.kind,
      displayName: origin.displayName,
      lat: origin.lat,
      lng: origin.lng,
    },
  });
}

export function memberFromDb(uid: string, raw: Record<string, any>): JourneyMember {
  const origin = raw.origin ?? {};
  return {
    uid,
    name: raw.name ?? 'Traveler',
    username: raw.username ?? 'traveler',
    phone: raw.phone ?? '',
    photoUrl: raw.photoUrl ?? undefined,
    seat: Number(raw.seat ?? 0),
    mascot: normalizeMascot(raw.mascot, uid),
    origin: {
      kind: origin.kind ?? 'PLACE',
      lat: typeof origin.lat === 'number' ? origin.lat : null,
      lng: typeof origin.lng === 'number' ? origin.lng : null,
      displayName: origin.displayName ?? 'Starting point',
    } as OriginLocation,
    travelMode: (raw.travelMode ?? 'CAR') as TravelMode,
    state: (raw.state ?? 'WAITING') as TravelerState,
    joinedAt: Number(raw.joinedAt ?? 0),
    startedAt: typeof raw.startedAt === 'number' ? raw.startedAt : null,
    finishedAt: typeof raw.finishedAt === 'number' ? raw.finishedAt : null,
  };
}

export function membersFromDb(raw: Record<string, any> | null): Record<string, JourneyMember> {
  const out: Record<string, JourneyMember> = {};
  if (!raw) return out;
  for (const [uid, value] of Object.entries(raw)) {
    if (value && typeof value === 'object') out[uid] = memberFromDb(uid, value);
  }
  return out;
}

export function metaToDb(meta: JourneyMeta): Record<string, unknown> {
  return stripUndefined({ ...meta });
}

export function metaFromDb(raw: Record<string, any>): JourneyMeta {
  return {
    journeyId: raw.journeyId,
    name: raw.name,
    status: raw.status,
    creatorUid: raw.creatorUid,
    joinCode: raw.joinCode ?? '',
    createdAt: Number(raw.createdAt ?? 0),
    startedAt: typeof raw.startedAt === 'number' ? raw.startedAt : null,
    expiresAt: Number(raw.expiresAt ?? 0),
    destination: raw.destination,
    schemaVersion: Number(raw.schemaVersion ?? 2),
  };
}
