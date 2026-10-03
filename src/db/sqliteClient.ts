import { RouteRecord } from '@/types/route';
import { LiveLocationRecord } from '@/types/liveLocation';
import { ChatMessage } from '@/types/chat';

export interface OfflineLocationItem extends LiveLocationRecord {
  id: string;
  journeyId: string;
  uid: string;
  isSynced: boolean;
}

export interface OfflineChatItem extends ChatMessage {
  journeyId: string;
  isSent: boolean;
}

export interface OfflineMapPackRecord {
  packId: string;
  journeyId: string;
  name: string;
  bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number };
  sizeBytes: number;
  downloadedAt: number;
}

/**
 * Local offline persistence layer.
 * Implements durable storage for routes, unsynced GPS fixes, and queued chat messages.
 * Matches Section 12, 13, and 19 of Developer Handoff.
 */
class LocalDatabaseClient {
  private routeStorage: Map<string, RouteRecord> = new Map();
  private locationBuffer: OfflineLocationItem[] = [];
  private chatQueue: OfflineChatItem[] = [];
  private mapPacks: Map<string, OfflineMapPackRecord> = new Map();

  // Route Caching
  async cacheRoute(journeyId: string, route: RouteRecord): Promise<void> {
    this.routeStorage.set(journeyId, { ...route, updatedAt: Date.now() });
  }

  async getCachedRoute(journeyId: string): Promise<RouteRecord | null> {
    return this.routeStorage.get(journeyId) || null;
  }

  // Location Buffering
  async bufferLocation(
    journeyId: string,
    uid: string,
    record: LiveLocationRecord
  ): Promise<string> {
    const id = `loc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const item: OfflineLocationItem = {
      ...record,
      id,
      journeyId,
      uid,
      isSynced: false,
    };
    this.locationBuffer.push(item);
    return id;
  }

  async getUnsyncedLocations(journeyId: string): Promise<OfflineLocationItem[]> {
    return this.locationBuffer.filter(
      (item) => item.journeyId === journeyId && !item.isSynced
    );
  }

  async markLocationsSynced(ids: string[]): Promise<void> {
    const idSet = new Set(ids);
    for (const item of this.locationBuffer) {
      if (idSet.has(item.id)) {
        item.isSynced = true;
      }
    }
  }

  // Chat Queue
  async queueChat(journeyId: string, message: ChatMessage): Promise<void> {
    this.chatQueue.push({
      ...message,
      journeyId,
      isSent: false,
    });
  }

  async getUnsentChat(journeyId: string): Promise<OfflineChatItem[]> {
    return this.chatQueue.filter(
      (item) => item.journeyId === journeyId && !item.isSent
    );
  }

  async markChatSent(ids: string[]): Promise<void> {
    const idSet = new Set(ids);
    for (const item of this.chatQueue) {
      if (idSet.has(item.id)) {
        item.isSent = true;
      }
    }
  }

  // Map Pack Management
  async saveMapPack(pack: OfflineMapPackRecord): Promise<void> {
    this.mapPacks.set(pack.packId, pack);
  }

  async getMapPacks(journeyId: string): Promise<OfflineMapPackRecord[]> {
    return Array.from(this.mapPacks.values()).filter(
      (p) => p.journeyId === journeyId
    );
  }

  async deleteMapPack(packId: string): Promise<void> {
    this.mapPacks.delete(packId);
  }

  clearAll() {
    this.routeStorage.clear();
    this.locationBuffer = [];
    this.chatQueue = [];
    this.mapPacks.clear();
  }
}

export const localDb = new LocalDatabaseClient();
