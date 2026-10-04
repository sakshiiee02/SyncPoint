import { onValue, ref } from 'firebase/database';
import { create } from 'zustand';
import { getFirebaseDb } from './firebase/firebaseApp';

interface ConnectivityState {
  /** Connected to Firebase right now. Optimistically true until the first signal arrives. */
  isOnline: boolean;
}

export const useConnectivityStore = create<ConnectivityState>(() => ({ isOnline: true }));

type Listener = () => void;
const reconnectListeners = new Set<Listener>();
let monitoring = false;

export function isOnline(): boolean {
  return useConnectivityStore.getState().isOnline;
}

/** Runs `listener` every time the connection comes back after being lost. Returns an unsubscribe. */
export function onReconnect(listener: Listener): () => void {
  reconnectListeners.add(listener);
  return () => {
    reconnectListeners.delete(listener);
  };
}

/**
 * Watches Firebase's own connection state (the one that actually matters for publishing),
 * which also catches "connected to Wi-Fi but no internet".
 */
export function startConnectivityMonitor(): void {
  if (monitoring) return;
  monitoring = true;
  onValue(ref(getFirebaseDb(), '.info/connected'), (snapshot) => {
    const connected = snapshot.val() === true;
    const wasOnline = useConnectivityStore.getState().isOnline;
    useConnectivityStore.setState({ isOnline: connected });
    if (connected && !wasOnline) {
      for (const listener of Array.from(reconnectListeners)) {
        try {
          listener();
        } catch (error) {
          console.warn('[Connectivity] reconnect listener failed:', error);
        }
      }
    }
  });
}
