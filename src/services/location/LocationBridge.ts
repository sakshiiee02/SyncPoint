import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

export interface RawLocationUpdate {
  latitude: number;
  longitude: number;
  speedMps: number;
  heading: number;
  /** Horizontal accuracy in metres. */
  accuracy: number;
  timestamp: number;
  /** Native sampling policy's verdict: is this fix worth publishing? */
  shouldPublish: boolean;
  /** Real device battery, 0-100. Absent if the OS didn't report one. */
  batteryPct?: number;
  isCharging?: boolean;
}

export interface CurrentPosition {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
  batteryPct?: number;
  isCharging?: boolean;
}

export type NativeTrackingStatus = 'STARTED' | 'PAUSED' | 'RESUMED' | 'FINISHED';

export type PositionErrorCode = 'PERMISSION_DENIED' | 'TIMEOUT' | 'UNAVAILABLE' | 'UNSUPPORTED';

export class PositionError extends Error {
  constructor(public readonly code: PositionErrorCode, message: string) {
    super(message);
    this.name = 'PositionError';
  }
}

export interface TrackingState {
  isRunning: boolean;
  isPaused: boolean;
}

const { SyncPointLocationBridge } = NativeModules;
const isAvailable = Platform.OS === 'android' && Boolean(SyncPointLocationBridge);

class LocationBridgeService {
  private eventEmitter: NativeEventEmitter | null = isAvailable
    ? new NativeEventEmitter(SyncPointLocationBridge)
    : null;

  /** Starts the Android foreground service. Call from a visible user action (Start Journey). */
  async startTracking(
    journeyId: string,
    journeyName: string,
    destinationName: string
  ): Promise<boolean> {
    if (!isAvailable) return false;
    return SyncPointLocationBridge.startTracking(journeyId, journeyName, destinationName);
  }

  async pauseTracking(): Promise<boolean> {
    return isAvailable ? SyncPointLocationBridge.pauseTracking() : false;
  }

  async resumeTracking(): Promise<boolean> {
    return isAvailable ? SyncPointLocationBridge.resumeTracking() : false;
  }

  /** Stops the foreground service and all sensor updates. */
  async finishTracking(): Promise<boolean> {
    return isAvailable ? SyncPointLocationBridge.finishTracking() : false;
  }

  async getTrackingState(): Promise<TrackingState> {
    if (!isAvailable) return { isRunning: false, isPaused: false };
    try {
      return await SyncPointLocationBridge.getTrackingState();
    } catch {
      return { isRunning: false, isPaused: false };
    }
  }

  /** One high-accuracy GPS fix. Throws PositionError. */
  async getCurrentPosition(timeoutMs: number = 15000): Promise<CurrentPosition> {
    if (!isAvailable) throw new PositionError('UNSUPPORTED', 'Location is only available on Android.');
    try {
      return await SyncPointLocationBridge.getCurrentPosition(timeoutMs);
    } catch (error) {
      const code = ((error as { code?: string })?.code ?? 'UNAVAILABLE') as PositionErrorCode;
      throw new PositionError(code, (error as Error)?.message ?? 'Location unavailable.');
    }
  }

  /** Speaks `text` with Android text-to-speech, interrupting anything already being said. */
  speak(text: string): void {
    if (isAvailable) SyncPointLocationBridge.speak(text);
  }

  stopSpeaking(): void {
    if (isAvailable) SyncPointLocationBridge.stopSpeaking();
  }

  /** Posts an Android notification (used for journey alerts while the app is in the background). */
  notify(title: string, message: string, urgent: boolean = false): void {
    if (isAvailable) SyncPointLocationBridge.notify(title, message, urgent);
  }

  /** Every GPS fix from the native engine (not only the ones worth publishing). */
  addLocationListener(callback: (location: RawLocationUpdate) => void): () => void {
    if (!this.eventEmitter) return () => undefined;
    const subscription = this.eventEmitter.addListener('onLocationUpdate', callback);
    return () => subscription.remove();
  }

  /** Service state changes, including Pause/Resume pressed in the notification. */
  addStatusListener(callback: (status: NativeTrackingStatus) => void): () => void {
    if (!this.eventEmitter) return () => undefined;
    const subscription = this.eventEmitter.addListener(
      'onLocationStatusChange',
      (event: { status: NativeTrackingStatus }) => callback(event.status)
    );
    return () => subscription.remove();
  }
}

export const LocationBridge = new LocationBridgeService();
