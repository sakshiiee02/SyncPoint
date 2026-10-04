import { ChatMessage } from '@/types/chat';
import { HistoryPoint } from '@/types/history';
import { RouteRecord } from '@/types/route';
import { SCHEMA_STATEMENTS, SCHEMA_VERSION } from './schema';
import { SqlDatabase } from './sql';

/** Typed access to the on-device tables. All SQL lives here. */
export class LocalStore {
  constructor(private readonly db: SqlDatabase) {}

  async migrate(): Promise<void> {
    const rows = await this.db.all<{ user_version: number }>('PRAGMA user_version');
    const current = Number(rows[0]?.user_version ?? 0);
    if (current >= SCHEMA_VERSION) return;
    for (const statement of SCHEMA_STATEMENTS) await this.db.run(statement);
    await this.db.run(`PRAGMA user_version = ${SCHEMA_VERSION}`);
  }

  // ── route ────────────────────────────────────────────────────────────────────────────
  async cacheRoute(journeyId: string, route: RouteRecord): Promise<void> {
    await this.db.run(
      `INSERT INTO route_cache (journey_id, route_json, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(journey_id) DO UPDATE SET route_json = excluded.route_json, updated_at = excluded.updated_at`,
      [journeyId, JSON.stringify(route), Date.now()]
    );
  }

  async getCachedRoute(journeyId: string): Promise<RouteRecord | null> {
    const rows = await this.db.all<{ route_json: string }>(
      'SELECT route_json FROM route_cache WHERE journey_id = ?',
      [journeyId]
    );
    if (rows.length === 0) return null;
    try {
      return JSON.parse(rows[0].route_json) as RouteRecord;
    } catch {
      return null;
    }
  }

  // ── recorded track ───────────────────────────────────────────────────────────────────
  async appendTrackPoint(journeyId: string, point: HistoryPoint): Promise<void> {
    await this.db.run(
      'INSERT INTO track_points (journey_id, ts, lat, lng, speed_mps) VALUES (?, ?, ?, ?, ?)',
      [journeyId, point.timestamp, point.lat, point.lng, point.speedMps]
    );
  }

  async getTrackPoints(journeyId: string): Promise<HistoryPoint[]> {
    const rows = await this.db.all<{ ts: number; lat: number; lng: number; speed_mps: number }>(
      'SELECT ts, lat, lng, speed_mps FROM track_points WHERE journey_id = ? ORDER BY ts ASC, id ASC',
      [journeyId]
    );
    return rows.map((r) => ({
      timestamp: Number(r.ts),
      lat: Number(r.lat),
      lng: Number(r.lng),
      speedMps: Number(r.speed_mps),
    }));
  }

  async clearTrack(journeyId: string): Promise<void> {
    await this.db.run('DELETE FROM track_points WHERE journey_id = ?', [journeyId]);
  }

  // ── chat outbox ──────────────────────────────────────────────────────────────────────
  async enqueueChat(journeyId: string, message: ChatMessage): Promise<void> {
    await this.db.run(
      'INSERT OR REPLACE INTO chat_outbox (id, journey_id, message_json, created_at) VALUES (?, ?, ?, ?)',
      [message.id, journeyId, JSON.stringify(message), Date.now()]
    );
  }

  async getChatOutbox(journeyId: string): Promise<ChatMessage[]> {
    const rows = await this.db.all<{ message_json: string }>(
      'SELECT message_json FROM chat_outbox WHERE journey_id = ? ORDER BY created_at ASC',
      [journeyId]
    );
    const out: ChatMessage[] = [];
    for (const row of rows) {
      try {
        out.push(JSON.parse(row.message_json) as ChatMessage);
      } catch {
        // skip corrupt row
      }
    }
    return out;
  }

  async removeChat(id: string): Promise<void> {
    await this.db.run('DELETE FROM chat_outbox WHERE id = ?', [id]);
  }

  // ── housekeeping ─────────────────────────────────────────────────────────────────────
  async purgeJourney(journeyId: string): Promise<void> {
    await this.db.run('DELETE FROM route_cache WHERE journey_id = ?', [journeyId]);
    await this.db.run('DELETE FROM track_points WHERE journey_id = ?', [journeyId]);
    await this.db.run('DELETE FROM chat_outbox WHERE journey_id = ?', [journeyId]);
  }
}
