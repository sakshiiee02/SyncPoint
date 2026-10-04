import { AppState } from 'react-native';
import { JourneyEvent } from '@/domain/journeyEvents';
import { LocationBridge } from '@/services/location/LocationBridge';
import { useToastStore } from '@/store/useToastStore';

/**
 * Shows journey events to the user without any server push (keeps the app on the free plan):
 * an in-app banner while the app is open, an Android notification while it is in the background
 * (the tracking service keeps the app alive on a trip, so these still arrive).
 */
export function deliverAlerts(events: JourneyEvent[]): void {
  if (events.length === 0) return;
  const inForeground = AppState.currentState === 'active';
  for (const event of events) {
    if (inForeground) {
      useToastStore.getState().push(event);
    } else {
      LocationBridge.notify(event.title, event.message, event.severity === 'urgent');
    }
  }
}
