export type JourneyErrorCode =
  | 'ALREADY_IN_JOURNEY'
  | 'CODE_NOT_FOUND'
  | 'CODE_EXPIRED'
  | 'JOURNEY_NOT_FOUND'
  | 'JOURNEY_ENDED'
  | 'JOURNEY_EXPIRED'
  | 'JOURNEY_FULL'
  | 'NOT_A_MEMBER'
  | 'NOT_ALLOWED'
  | 'INVALID_TRANSITION'
  | 'OFFLINE'
  | 'TIMEOUT'
  | 'UNKNOWN';

const DEFAULT_MESSAGES: Record<JourneyErrorCode, string> = {
  ALREADY_IN_JOURNEY: 'You are already part of an active journey. Finish or leave it first.',
  CODE_NOT_FOUND: 'No journey found with this code. Check the code and try again.',
  CODE_EXPIRED: 'This invite code has expired.',
  JOURNEY_NOT_FOUND: 'This journey no longer exists.',
  JOURNEY_ENDED: 'This journey has already ended.',
  JOURNEY_EXPIRED: 'This journey has expired.',
  JOURNEY_FULL: 'This journey is full.',
  NOT_A_MEMBER: 'You are not a member of this journey.',
  NOT_ALLOWED: 'You are not allowed to do that.',
  INVALID_TRANSITION: 'That action is not available right now.',
  OFFLINE: 'No connection. Check your internet and try again.',
  TIMEOUT: 'The server took too long to respond. Check your connection and try again.',
  UNKNOWN: 'Something went wrong. Please try again.',
};

export class JourneyError extends Error {
  readonly code: JourneyErrorCode;
  /** Set for ALREADY_IN_JOURNEY so the UI can offer to open that journey. */
  readonly journeyId?: string;

  constructor(code: JourneyErrorCode, message?: string, journeyId?: string) {
    super(message ?? DEFAULT_MESSAGES[code]);
    this.name = 'JourneyError';
    this.code = code;
    this.journeyId = journeyId;
  }
}

/** Maps a Firebase/network failure to a JourneyError (leaves JourneyErrors untouched). */
export function toJourneyError(error: unknown): JourneyError {
  if (error instanceof JourneyError) return error;
  const code = (error as { code?: string } | null)?.code ?? '';
  const message = (error as { message?: string } | null)?.message ?? '';
  if (code.includes('PERMISSION_DENIED') || /permission[_ ]denied/i.test(message)) {
    return new JourneyError('NOT_ALLOWED');
  }
  if (/offline|network|unavailable|disconnected/i.test(`${code} ${message}`)) {
    return new JourneyError('OFFLINE');
  }
  return new JourneyError('UNKNOWN', message || undefined);
}

export function isPermissionDenied(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code ?? '';
  const message = (error as { message?: string } | null)?.message ?? '';
  return code.includes('PERMISSION_DENIED') || /permission[_ ]denied/i.test(message);
}
