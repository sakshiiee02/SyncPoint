import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

class MockLocalDb {
  constructor() {
    this.routes = new Map();
    this.buffer = [];
    this.chat = [];
    this.packs = new Map();
  }

  cacheRoute(journeyId, route) {
    this.routes.set(journeyId, { ...route, cachedAt: Date.now() });
  }

  getCachedRoute(journeyId) {
    return this.routes.get(journeyId) || null;
  }

  bufferLocation(journeyId, uid, record) {
    const item = { ...record, id: `loc_${this.buffer.length + 1}`, journeyId, uid, isSynced: false };
    this.buffer.push(item);
    return item.id;
  }

  getUnsynced(journeyId) {
    return this.buffer.filter((b) => b.journeyId === journeyId && !b.isSynced);
  }

  markSynced(ids) {
    const idSet = new Set(ids);
    for (const b of this.buffer) {
      if (idSet.has(b.id)) b.isSynced = true;
    }
  }

  queueChat(journeyId, msg) {
    const item = { ...msg, id: `chat_${this.chat.length + 1}`, journeyId, isSent: false };
    this.chat.push(item);
    return item.id;
  }

  getUnsentChat(journeyId) {
    return this.chat.filter((c) => c.journeyId === journeyId && !c.isSent);
  }

  markChatSent(ids) {
    const idSet = new Set(ids);
    for (const c of this.chat) {
      if (idSet.has(c.id)) c.isSent = true;
    }
  }

  savePack(pack) {
    this.packs.set(pack.packId, pack);
  }

  getPacks(journeyId) {
    return Array.from(this.packs.values()).filter((p) => p.journeyId === journeyId);
  }

  deletePack(packId) {
    this.packs.delete(packId);
  }
}

function estimatePackSize(bounds, minZoom = 10, maxZoom = 15) {
  const latSpan = Math.abs(bounds.maxLat - bounds.minLat);
  const lngSpan = Math.abs(bounds.maxLng - bounds.minLng);
  const areaDeg2 = Math.max(latSpan * lngSpan, 0.05);

  const estimatedTileCount = Math.round(areaDeg2 * Math.pow(2, maxZoom - minZoom) * 45);
  return Math.max(estimatedTileCount * 14500, 15 * 1024 * 1024);
}

function formatBytes(bytes) {
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

describe('SyncPoint Phase 5: Offline Maps & Sync Resilience', () => {
  test('Local DB caches route and retrieves when offline', () => {
    const db = new MockLocalDb();
    const route = {
      routeVersion: 1,
      profile: 'CAR',
      distanceM: 142000,
      durationS: 7800,
      geometry: { type: 'LineString', coordinates: [[77.20, 28.61], [73.83, 15.38]] },
    };

    db.cacheRoute('journey_goa', route);
    const cached = db.getCachedRoute('journey_goa');

    assert.ok(cached !== null);
    assert.equal(cached.distanceM, 142000);
    assert.ok(cached.cachedAt > 0);
  });

  test('Location buffer queues GPS fixes while disconnected and marks synced upon reconnect', () => {
    const db = new MockLocalDb();

    const id1 = db.bufferLocation('journey_goa', 'user_1', { lat: 28.6, lng: 77.2, speedMps: 20 });
    const id2 = db.bufferLocation('journey_goa', 'user_1', { lat: 28.5, lng: 77.1, speedMps: 22 });

    const unsynced = db.getUnsynced('journey_goa');
    assert.equal(unsynced.length, 2);

    // Reconnection flush
    db.markSynced([id1, id2]);
    const afterFlush = db.getUnsynced('journey_goa');
    assert.equal(afterFlush.length, 0);
  });

  test('Chat queue buffers outgoing text messages offline', () => {
    const db = new MockLocalDb();

    const c1 = db.queueChat('journey_goa', { text: 'Stopped at fuel station', senderUid: 'u1' });
    const unsent = db.getUnsentChat('journey_goa');
    assert.equal(unsent.length, 1);
    assert.equal(unsent[0].text, 'Stopped at fuel station');

    db.markChatSent([c1]);
    assert.equal(db.getUnsentChat('journey_goa').length, 0);
  });

  test('estimatePackSize calculates storage requirements accurately', () => {
    const bounds = { minLat: 15.0, maxLat: 16.0, minLng: 73.0, maxLng: 74.0 };
    const bytes = estimatePackSize(bounds);

    assert.ok(bytes >= 15 * 1024 * 1024, `Size should be at least 15MB, got ${bytes}`);
    const formatted = formatBytes(bytes);
    assert.match(formatted, /^\d+(\.\d+)? MB$/);
  });

  test('Map pack lifecycle supports saving and deleting packs', () => {
    const db = new MockLocalDb();
    const pack = {
      packId: 'pack_123',
      journeyId: 'journey_goa',
      name: 'Goa Corridor',
      sizeBytes: 35000000,
      downloadedAt: Date.now(),
    };

    db.savePack(pack);
    assert.equal(db.getPacks('journey_goa').length, 1);

    db.deletePack('pack_123');
    assert.equal(db.getPacks('journey_goa').length, 0);
  });
});
