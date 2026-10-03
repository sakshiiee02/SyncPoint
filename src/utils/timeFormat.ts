/**
 * Time formatting utilities for SyncPoint
 */

export function formatRecency(timestampMs: number, nowMs: number = Date.now()): string {
  const diffSeconds = Math.max(0, Math.floor((nowMs - timestampMs) / 1000));

  if (diffSeconds < 5) {
    return 'just now';
  }
  if (diffSeconds < 60) {
    return `${diffSeconds}s ago`;
  }
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }
  const diffHours = Math.floor(diffMinutes / 60);
  return `${diffHours}h ago`;
}

export function formatETA(etaEpochMs: number): string {
  if (!etaEpochMs || etaEpochMs <= 0) return '--:--';
  const date = new Date(etaEpochMs);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
