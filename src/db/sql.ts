/** The minimal SQL surface the app needs; implemented by op-sqlite on device and node:sqlite in tests. */
export type SqlValue = string | number | null;

export interface SqlDatabase {
  run(sql: string, params?: SqlValue[]): Promise<void>;
  all<T = Record<string, SqlValue>>(sql: string, params?: SqlValue[]): Promise<T[]>;
}
