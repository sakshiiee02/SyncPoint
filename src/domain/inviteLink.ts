import { normalizeJoinCode, isValidJoinCode } from './joinCode';

export const INVITE_SCHEME = 'syncpoint';

/**
 * https invite link served from the landing-page domain, or null when no domain is
 * configured yet (invites then fall back to sharing the plain code).
 */
export function buildInviteLink(baseUrl: string, code: string): string | null {
  const base = baseUrl.trim().replace(/\/+$/, '');
  if (!base) return null;
  return `${base}/join/${encodeURIComponent(code)}`;
}

/** App-scheme link, always available: syncpoint://join/CODE */
export function buildAppLink(code: string): string {
  return `${INVITE_SCHEME}://join/${encodeURIComponent(code)}`;
}

/**
 * Extracts a valid join code from a pasted/scanned/deep-linked string. Accepts a raw code,
 * syncpoint://join/CODE, or https://<any-host>/join/CODE. Returns null if none is found.
 */
export function parseInviteCode(input: string): string | null {
  const text = input.trim();
  if (!text) return null;

  const match = text.match(/\/join\/([^/?#\s]+)/i);
  const candidate = normalizeJoinCode(match ? decodeURIComponent(match[1]) : text);
  return isValidJoinCode(candidate) ? candidate : null;
}
