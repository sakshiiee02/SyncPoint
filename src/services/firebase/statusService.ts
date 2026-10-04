import { QuickStatusType } from '@/types/status';
import { sendChatMessage } from './chatService';

export const QUICK_STATUS_LABELS: Record<QuickStatusType, { label: string; iconKey: string }> = {
  ON_THE_WAY: { label: 'On the way', iconKey: 'car' },
  FUEL_STOP: { label: 'Fuel Stop', iconKey: 'fuel' },
  FOOD_STOP: { label: 'Food Stop', iconKey: 'food' },
  BREAK: { label: 'Break', iconKey: 'coffee' },
  RESTROOM: { label: 'Restroom', iconKey: 'restroom' },
  STOPPED: { label: 'Stopped', iconKey: 'stopped' },
  TRAFFIC: { label: 'Heavy Traffic', iconKey: 'traffic' },
  VEHICLE_PROBLEM: { label: 'Vehicle Issue', iconKey: 'wrench' },
  NEED_HELP: { label: 'Need Help', iconKey: 'alert' },
  BACK_ON_ROUTE: { label: 'Back on route', iconKey: 'route' },
};

/**
 * Posts a quick-status message ("Fuel stop"…) to the journey chat. The status chip shown on the
 * traveler's marker is published by the TrackingController together with their location.
 */
export async function broadcastQuickStatus(
  journeyId: string,
  user: { uid: string; name: string },
  status: QuickStatusType,
  note?: string
): Promise<void> {
  const meta = QUICK_STATUS_LABELS[status];
  const chatText = `[${meta.label}]${note ? `: ${note}` : ''}`;
  await sendChatMessage(journeyId, user, chatText, 'STATUS');
}
