import { LiveLocationRecord } from '@/types/liveLocation';
import { JourneyMeta } from '@/types/journey';
import { JourneyMember } from '@/types/member';

export type EventSeverity = 'info' | 'warning' | 'urgent';

export interface JourneyEvent {
  id: string;
  severity: EventSeverity;
  title: string;
  message: string;
}

export const LOW_BATTERY_PCT = 15;
/** A traveler must recover above this before another low-battery alert can fire. */
const BATTERY_RECOVERED_PCT = 25;

type Members = Record<string, JourneyMember>;
type Live = Record<string, LiveLocationRecord>;

let counter = 0;
const event = (severity: EventSeverity, title: string, message: string, key: string): JourneyEvent => ({
  id: `${key}:${Date.now()}:${counter++}`,
  severity,
  title,
  message,
});

const nameOf = (members: Members, uid: string, fallback = 'A traveler') => members[uid]?.name ?? fallback;

/**
 * Events from changes to the roster, as seen by `selfUid`. Nothing is reported about yourself:
 * you already know what you just did.
 */
export function diffMembers(prev: Members, next: Members, selfUid: string | null): JourneyEvent[] {
  const events: JourneyEvent[] = [];

  for (const [uid, member] of Object.entries(next)) {
    if (uid === selfUid) continue;
    const before = prev[uid];
    if (!before) {
      events.push(event('info', 'New traveler', `${member.name} joined the journey.`, `join:${uid}`));
      continue;
    }
    if (before.state !== member.state) {
      if (member.state === 'TRAVELING' && before.state === 'WAITING') {
        events.push(event('info', 'On the move', `${member.name} started their trip.`, `start:${uid}`));
      } else if (member.state === 'ARRIVED') {
        events.push(event('info', 'Arrived', `${member.name} has arrived.`, `arrive:${uid}`));
      } else if (member.state === 'FINISHED') {
        events.push(event('info', 'Trip finished', `${member.name} finished their trip.`, `finish:${uid}`));
      }
    }
  }

  for (const [uid, member] of Object.entries(prev)) {
    if (uid !== selfUid && !next[uid]) {
      events.push(event('info', 'Traveler left', `${member.name} left the journey.`, `left:${uid}`));
    }
  }
  return events;
}

export function diffMeta(
  prev: JourneyMeta | null,
  next: JourneyMeta,
  members: Members,
  selfUid: string | null
): JourneyEvent[] {
  if (!prev || prev.creatorUid === next.creatorUid) return [];
  const message =
    next.creatorUid === selfUid
      ? 'You are now the host of this journey.'
      : `${nameOf(members, next.creatorUid)} is now the host.`;
  return [event('info', 'New host', message, `host:${next.creatorUid}`)];
}

/**
 * Safety-relevant events from live updates: someone asks for help, or a phone is about to die.
 * `warnedLowBattery` is kept by the caller so each dip alerts once, not on every update.
 */
export function diffLive(
  prev: Live,
  next: Live,
  members: Members,
  selfUid: string | null,
  warnedLowBattery: Set<string>
): JourneyEvent[] {
  const events: JourneyEvent[] = [];

  for (const [uid, record] of Object.entries(next)) {
    if (uid === selfUid) continue;
    const name = nameOf(members, uid);

    if (record.status === 'NEED_HELP' && prev[uid]?.status !== 'NEED_HELP') {
      events.push(event('urgent', 'Needs help', `${name} asked for help. Check their location.`, `help:${uid}`));
    }

    const battery = record.batteryPct;
    if (typeof battery === 'number') {
      if (battery <= LOW_BATTERY_PCT && !record.charging && !warnedLowBattery.has(uid)) {
        warnedLowBattery.add(uid);
        events.push(event('warning', 'Low battery', `${name}'s phone is at ${battery}%.`, `battery:${uid}`));
      } else if (battery >= BATTERY_RECOVERED_PCT || record.charging) {
        warnedLowBattery.delete(uid);
      }
    }
  }
  return events;
}
