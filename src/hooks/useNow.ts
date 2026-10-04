import { useEffect, useState } from 'react';

/** Current time, refreshed every `intervalMs`, so relative labels ("20s ago") and stale flags stay live. */
export function useNow(intervalMs: number = 5000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}
