import { ref, update } from 'firebase/database';
import { getFirebaseDb } from './firebaseApp';
import { QuickStatusType, StatusUpdateRecord } from '@/types/status';
import { sendChatMessage } from './chatService';

export const QUICK_STATUS_LABELS: Record<QuickStatusType, { label: string; icon: string }> = {
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

/**
 * Broadcasts a quick travel status shortcut to the journey.
 * Matches Section 14.2 of Developer Handoff.
 */
export async function broadcastQuickStatus(
  journeyId: string,
  user: { uid: string; name: string },
  status: QuickStatusType,
  note?: string
): Promise<void> {
  const db = getFirebaseDb();
  const statusId = `stat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const now = Date.now();

  const record: StatusUpdateRecord = {
    id: statusId,
    uid: user.uid,
    status,
    timestamp: now,
    note,
  };

  const updates: Record<string, unknown> = {};
  updates[`journeys/${journeyId}/live/${user.uid}/status`] = status;
  updates[`journeys/${journeyId}/live/${user.uid}/lastUpdatedAt`] = now;
  updates[`journeys/${journeyId}/statuses/${statusId}`] = record;

  await update(ref(db), updates);

  // Cross-post as status message into group chat (Section 14.1 & 14.2)
  const meta = QUICK_STATUS_LABELS[status];
  const chatText = `${meta.icon} ${meta.label}${note ? `: ${note}` : ''}`;
  await sendChatMessage(journeyId, user, chatText, 'STATUS');
}
