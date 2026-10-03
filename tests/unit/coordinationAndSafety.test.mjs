import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

const QUICK_STATUS_LABELS = {
  ON_THE_WAY: { label: 'On the way', icon: '🚗' },
  FUEL_STOP: { label: 'Fuel Stop', icon: '⛽' },
  FOOD_STOP: { label: 'Food Stop', icon: '🍔' },
  BREAK: { label: 'Break', icon: '☕' },
  RESTROOM: { label: 'Restroom', icon: '🚻' },
  STOPPED: { label: 'Stopped', icon: '🛑' },
  TRAFFIC: { label: 'Heavy Traffic', icon: '🚦' },
  VEHICLE_PROBLEM: { label: 'Vehicle Problem', icon: '🔧' },
  NEED_HELP: { label: 'Need Help', icon: '🆘' },
  BACK_ON_ROUTE: { label: 'Back on route', icon: '🚀' },
};

class MockFirebaseConvoyDb {
  constructor() {
    this.liveStatuses = {};
    this.statusLog = [];
    this.chatLog = [];
  }

  async updateStatus(journeyId, user, status, note) {
    const meta = QUICK_STATUS_LABELS[status];
    if (!meta) throw new Error(`Invalid status: ${status}`);

    const now = Date.now();
    this.liveStatuses[user.uid] = { status, lastUpdatedAt: now };

    const statusRecord = {
      id: `stat_${now}_${Math.random().toString(36).substring(2, 6)}`,
      uid: user.uid,
      status,
      timestamp: now,
      note,
    };
    this.statusLog.push(statusRecord);

    // Cross-post to chat
    const chatText = `${meta.icon} ${meta.label}${note ? `: ${note}` : ''}`;
    const chatRecord = {
      id: `msg_${now}`,
      senderUid: user.uid,
      senderName: user.name,
      text: chatText,
      timestamp: now,
      type: status === 'NEED_HELP' ? 'EMERGENCY' : 'STATUS',
    };
    this.chatLog.push(chatRecord);

    return { statusRecord, chatRecord };
  }

  sendChatMessage(journeyId, sender, text, type = 'TEXT') {
    if (!text || !text.trim()) throw new Error('Message text cannot be empty');
    const msg = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      senderUid: sender.uid,
      senderName: sender.name,
      text: text.trim(),
      timestamp: Date.now(),
      type,
    };
    this.chatLog.push(msg);
    return msg;
  }

  getSortedChat() {
    return [...this.chatLog].sort((a, b) => a.timestamp - b.timestamp);
  }
}

function buildFcmPayload(journeyId, eventType, title, body) {
  const isHighPriority = eventType === 'EMERGENCY_STATUS' || eventType === 'MEMBER_ARRIVED';
  return {
    topic: `journey_${journeyId}`,
    notification: {
      title,
      body: body || 'SyncPoint Journey Update',
    },
    android: {
      priority: isHighPriority ? 'high' : 'normal',
      notification: {
        channelId: 'syncpoint_tracking_channel',
        sound: isHighPriority ? 'default' : undefined,
      },
    },
    data: {
      journeyId,
      eventType,
    },
  };
}

describe('SyncPoint Phase 6: Coordination, Chat & Safety', () => {
  test('QUICK_STATUS_LABELS covers all 10 mandated status types with emojis', () => {
    const requiredStatuses = [
      'ON_THE_WAY',
      'FUEL_STOP',
      'FOOD_STOP',
      'BREAK',
      'RESTROOM',
      'STOPPED',
      'TRAFFIC',
      'VEHICLE_PROBLEM',
      'NEED_HELP',
      'BACK_ON_ROUTE',
    ];

    for (const status of requiredStatuses) {
      const meta = QUICK_STATUS_LABELS[status];
      assert.ok(meta, `Missing definition for ${status}`);
      assert.ok(meta.label.length > 0, `Missing label for ${status}`);
      assert.ok(meta.icon.length > 0, `Missing icon for ${status}`);
    }
  });

  test('Broadcasting status updates participant live record and cross-posts to chat', async () => {
    const db = new MockFirebaseConvoyDb();
    const user = { uid: 'user_aarav', name: 'Aarav Sharma' };

    const { statusRecord, chatRecord } = await db.updateStatus(
      'journey_goa',
      user,
      'FUEL_STOP',
      'HP Petrol Pump on NH 48'
    );

    assert.equal(db.liveStatuses['user_aarav'].status, 'FUEL_STOP');
    assert.equal(statusRecord.uid, 'user_aarav');
    assert.equal(chatRecord.type, 'STATUS');
    assert.equal(chatRecord.text, '⛽ Fuel Stop: HP Petrol Pump on NH 48');
  });

  test('Broadcasting NEED_HELP generates an EMERGENCY chat event', async () => {
    const db = new MockFirebaseConvoyDb();
    const user = { uid: 'user_rohan', name: 'Rohan Verma' };

    const { chatRecord } = await db.updateStatus(
      'journey_goa',
      user,
      'NEED_HELP',
      'Flat tire near toll plaza'
    );

    assert.equal(chatRecord.type, 'EMERGENCY');
    assert.equal(chatRecord.text, '🆘 Need Help: Flat tire near toll plaza');
  });

  test('Group chat sends regular text messages and maintains chronological order', () => {
    const db = new MockFirebaseConvoyDb();
    const sender = { uid: 'user_priya', name: 'Priya Patel' };

    const msg1 = db.sendChatMessage('journey_goa', sender, 'Taking the western bypass');
    assert.equal(msg1.type, 'TEXT');
    assert.equal(msg1.senderName, 'Priya Patel');

    // Blank message should throw
    assert.throws(() => {
      db.sendChatMessage('journey_goa', sender, '   ');
    }, /cannot be empty/);

    const sorted = db.getSortedChat();
    assert.equal(sorted.length, 1);
    assert.equal(sorted[0].id, msg1.id);
  });

  test('FCM payload builds high priority notification for emergency convoy alerts', () => {
    const payload = buildFcmPayload(
      'journey_goa',
      'EMERGENCY_STATUS',
      'Rohan needs help!',
      'Vehicle problem on NH 48'
    );

    assert.equal(payload.topic, 'journey_journey_goa');
    assert.equal(payload.android.priority, 'high');
    assert.equal(payload.android.notification.channelId, 'syncpoint_tracking_channel');
    assert.equal(payload.android.notification.sound, 'default');
    assert.equal(payload.data.eventType, 'EMERGENCY_STATUS');
  });

  test('FCM payload builds normal priority notification for regular events', () => {
    const payload = buildFcmPayload(
      'journey_goa',
      'MEMBER_JOINED',
      'Priya joined the convoy',
      'Traveling by Car'
    );

    assert.equal(payload.android.priority, 'normal');
    assert.equal(payload.android.notification.sound, undefined);
  });
});
