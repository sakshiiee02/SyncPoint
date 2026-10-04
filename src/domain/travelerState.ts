import { TravelerState } from '@/types/member';

/** Things that can happen to a traveler. Every state change goes through this table. */
export type TravelerAction =
  | 'START'
  | 'PAUSE'
  | 'RESUME'
  | 'ARRIVE'
  | 'FINISH'
  | 'LEAVE';

const TRANSITIONS: Record<TravelerState, Partial<Record<TravelerAction, TravelerState>>> = {
  WAITING: { START: 'TRAVELING', LEAVE: 'LEFT' },
  TRAVELING: { PAUSE: 'PAUSED', ARRIVE: 'ARRIVED', FINISH: 'FINISHED', LEAVE: 'LEFT' },
  PAUSED: { RESUME: 'TRAVELING', ARRIVE: 'ARRIVED', FINISH: 'FINISHED', LEAVE: 'LEFT' },
  ARRIVED: { FINISH: 'FINISHED', LEAVE: 'LEFT' },
  FINISHED: {},
  LEFT: {},
};

export class InvalidTransitionError extends Error {
  constructor(public readonly from: TravelerState, public readonly action: TravelerAction) {
    super(`Cannot ${action} while ${from}`);
    this.name = 'InvalidTransitionError';
  }
}

/** Returns the next state, or null if `action` is not allowed from `from`. */
export function nextTravelerState(
  from: TravelerState,
  action: TravelerAction
): TravelerState | null {
  return TRANSITIONS[from][action] ?? null;
}

export function applyTravelerAction(from: TravelerState, action: TravelerAction): TravelerState {
  const next = nextTravelerState(from, action);
  if (!next) throw new InvalidTransitionError(from, action);
  return next;
}

export function canTravelerAct(from: TravelerState, action: TravelerAction): boolean {
  return nextTravelerState(from, action) !== null;
}

/** Human-readable roster label. Never derived from distance. */
export function travelerStateLabel(state: TravelerState): string {
  switch (state) {
    case 'WAITING':
      return 'Not started';
    case 'TRAVELING':
      return 'On the way';
    case 'PAUSED':
      return 'Paused';
    case 'ARRIVED':
      return 'Arrived';
    case 'FINISHED':
      return 'Finished';
    case 'LEFT':
      return 'Left';
  }
}
