import { localDb, OfflineLocationItem, OfflineChatItem } from '@/db/sqliteClient';
import { getFirebaseDb } from '@/services/firebase/firebaseApp';
import { ref, update } from 'firebase/database';
import { LiveLocationRecord } from '@/types/liveLocation';
import { ChatMessage } from '@/types/chat';

/**
 * Reconnection & Offline Synchronization Orchestrator.
 * Matches Section 12, 12.1, and 255 of Developer Handoff:
 * "Automatically resynchronize latest participant state and buffered history when online."
 */
class ReconnectSyncService {
  private isOnlineState: boolean = true;
  private syncListeners: Array<(isOnline: boolean) => void> = [];

  setOnlineStatus(isOnline: boolean, journeyId?: string) {
    const wasOffline = !this.isOnlineState;
    this.isOnlineState = isOnline;

    for (const listener of this.syncListeners) {
      listener(isOnline);
    }

    // Automatically trigger resynchronization when connectivity is restored
    if (wasOffline && isOnline && journeyId) {
      this.syncBufferedData(journeyId).catch((err) => {
        console.warn('[SyncService] Background sync failed:', err);
      });
    }
  }

  isOnline(): boolean {
    return this.isOnlineState;
  }

  addConnectionListener(callback: (isOnline: boolean) => void): () => void {
    this.syncListeners.push(callback);
    return () => {
      this.syncListeners = this.syncListeners.filter((cb) => cb !== callback);
    };
  }

  /**
   * Buffers a location fix locally if offline.
   */
  async handleLocationUpdate(
    journeyId: string,
    uid: string,
    record: LiveLocationRecord
  ): Promise<boolean> {
    if (!this.isOnlineState) {
      await localDb.bufferLocation(journeyId, uid, record);
      return false; // buffered locally
    }
    return true; // online, proceed with live RTDB publish
  }

  /**
   * Queues an outgoing chat message if offline.
   */
  async handleChatMessage(
    journeyId: string,
    message: ChatMessage
  ): Promise<boolean> {
    if (!this.isOnlineState) {
      await localDb.queueChat(journeyId, message);
      return false; // queued locally
    }
    return true; // online
  }

  /**
   * Flushes all buffered location history segments and queued chat messages to Firebase.
   */
  async syncBufferedData(journeyId: string): Promise<{
    syncedLocationsCount: number;
    syncedChatCount: number;
  }> {
    const unsyncedLocations: OfflineLocationItem[] = await localDb.getUnsyncedLocations(journeyId);
    const unsentChat: OfflineChatItem[] = await localDb.getUnsentChat(journeyId);

    if (unsyncedLocations.length === 0 && unsentChat.length === 0) {
      return { syncedLocationsCount: 0, syncedChatCount: 0 };
    }

    const db = getFirebaseDb();
    const updates: Record<string, unknown> = {};
    const syncedLocationIds: string[] = [];
    const syncedChatIds: string[] = [];

    // 1. Batch append location history
    for (const loc of unsyncedLocations) {
      const historyKey = `journeys/${journeyId}/history/${loc.uid}/${loc.id}`;
      updates[historyKey] = {
        lat: loc.lat,
        lng: loc.lng,
        speedMps: loc.speedMps,
        heading: loc.heading,
        batteryPct: loc.batteryPct,
        lastUpdatedAt: loc.lastUpdatedAt,
      };
      syncedLocationIds.push(loc.id);
    }

    // 2. Batch append queued chat messages
    for (const chat of unsentChat) {
      const chatKey = `journeys/${journeyId}/chat/${chat.id}`;
      updates[chatKey] = {
        id: chat.id,
        senderUid: chat.senderUid,
        senderName: chat.senderName,
        text: chat.text,
        type: chat.type,
        timestamp: chat.timestamp,
      };
      syncedChatIds.push(chat.id);
    }

    try {
      await update(ref(db), updates);
      await localDb.markLocationsSynced(syncedLocationIds);
      await localDb.markChatSent(syncedChatIds);

      return {
        syncedLocationsCount: syncedLocationIds.length,
        syncedChatCount: syncedChatIds.length,
      };
    } catch (error) {
      console.warn('[SyncService] Error during batch synchronization:', error);
      throw error;
    }
  }
}

export const syncService = new ReconnectSyncService();
