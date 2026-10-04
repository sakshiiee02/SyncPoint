import { open } from '@op-engineering/op-sqlite';
import { LocalStore } from './localStore';
import { SqlDatabase, SqlValue } from './sql';

/** Adapts op-sqlite (SQLite via JSI) to the SqlDatabase interface. */
function createDeviceDatabase(): SqlDatabase {
  const db = open({ name: 'syncpoint.db' });
  return {
    async run(sql: string, params: SqlValue[] = []) {
      await db.execute(sql, params);
    },
    async all<T>(sql: string, params: SqlValue[] = []) {
      const result = await db.execute(sql, params);
      return (result.rows ?? []) as unknown as T[];
    },
  };
}

let storePromise: Promise<LocalStore> | null = null;

/** The app-wide local store, opened and migrated on first use. */
export function getLocalStore(): Promise<LocalStore> {
  if (!storePromise) {
    storePromise = (async () => {
      const store = new LocalStore(createDeviceDatabase());
      await store.migrate();
      return store;
    })();
    // Allow a retry on the next call if opening failed.
    storePromise.catch(() => {
      storePromise = null;
    });
  }
  return storePromise;
}
