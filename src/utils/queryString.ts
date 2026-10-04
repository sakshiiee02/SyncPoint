/**
 * Builds "a=1&b=two%20words". React Native's URLSearchParams does not implement set()/toString()
 * reliably, so URLs are assembled with encodeURIComponent, which behaves the same everywhere.
 */
export function buildQuery(params: Record<string, string | number | undefined>): string {
  return Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&');
}
