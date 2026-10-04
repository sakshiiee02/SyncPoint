import { Database, onValue, ref } from 'firebase/database';

/**
 * Firebase security rules compare against *server* time, so anything the client sends as an
 * expiry or timestamp must be computed from the server clock — otherwise a phone whose clock
 * is a few hours off would have its writes rejected. `.info/serverTimeOffset` gives the delta.
 */
const offsets = new WeakMap<Database, number>();
const attached = new WeakSet<Database>();

export function attachServerClock(db: Database): void {
  if (attached.has(db)) return;
  attached.add(db);
  onValue(ref(db, '.info/serverTimeOffset'), (snap) => {
    const value = snap.val();
    if (typeof value === 'number') offsets.set(db, value);
  });
}

/** Current time on the Firebase server's clock (falls back to the local clock until known). */
export function serverNow(db: Database): number {
  return Date.now() + (offsets.get(db) ?? 0);
}
