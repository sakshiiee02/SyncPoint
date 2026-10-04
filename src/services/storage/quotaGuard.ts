import { KeyValueStore } from './keyValueStore';

/**
 * Keeps us inside the free tier of each provider. The keys ship inside the APK, so the only
 * protection against burning a shared daily quota is for every device to ration itself and to
 * fall back to another provider (or a clear "unavailable" message) instead of hammering one.
 * Counts reset each (UTC) day.
 */
export class QuotaGuard {
  constructor(
    private readonly store: KeyValueStore,
    private readonly dailyLimits: Record<string, number>,
    private readonly now: () => number = Date.now
  ) {}

  private key(name: string): string {
    return `@syncpoint_quota_${name}_${new Date(this.now()).toISOString().slice(0, 10)}`;
  }

  async used(name: string): Promise<number> {
    return Number((await this.store.getItem(this.key(name))) ?? 0) || 0;
  }

  /** Reserves one request. Returns false when this device's share of the day is used up. */
  async tryConsume(name: string): Promise<boolean> {
    const limit = this.dailyLimits[name];
    const used = await this.used(name);
    if (limit !== undefined && used >= limit) return false;
    await this.store.setItem(this.key(name), String(used + 1));
    return true;
  }
}
