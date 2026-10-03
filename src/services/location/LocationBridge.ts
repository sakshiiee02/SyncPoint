import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

export interface RawLocationUpdate {
  latitude: number;
  longitude: number;
  speedMps: number;
  heading: number;
  accuracy: number;
  timestamp: number;
  shouldPublish: boolean;
}

export interface TrackingState {
  isRunning: boolean;
  isPaused: boolean;
}

const { SyncPointLocationBridge } = NativeModules;

class LocationBridgeService {
  private eventEmitter: NativeEventEmitter | null = null;
  private isSimulatorRunning = false;
  private simulatorInterval: any = null;
  private listeners: Array<(loc: RawLocationUpdate) => void> = [];

  constructor() {
    if (Platform.OS === 'android' && SyncPointLocationBridge) {
      this.eventEmitter = new NativeEventEmitter(SyncPointLocationBridge);
    }
  }

  /**
   * Starts the Android Foreground Service (JourneyLocationService)
   * Matches Section 8.2 of Developer Handoff.
   */
  async startTracking(
    journeyId: string,
    journeyName: string,
    destinationName: string
  ): Promise<boolean> {
    if (Platform.OS === 'android' && SyncPointLocationBridge) {
      try {
        return await SyncPointLocationBridge.startTracking(journeyId, journeyName, destinationName);
      } catch (e) {
        console.warn('[LocationBridge] Native start failed, falling back to simulator:', e);
      }
    }

    // Development / Simulator fallback
    this.isSimulatorRunning = true;
    return true;
  }

  /**
   * Pauses location tracking while leaving last known fix visible in UI.
   */
  async pauseTracking(): Promise<boolean> {
    if (Platform.OS === 'android' && SyncPointLocationBridge) {
      try {
        return await SyncPointLocationBridge.pauseTracking();
      } catch (e) {
        console.warn('[LocationBridge] Native pause failed:', e);
      }
    }
    return true;
  }

  /**
   * Resumes location tracking after being paused.
   */
  async resumeTracking(): Promise<boolean> {
    if (Platform.OS === 'android' && SyncPointLocationBridge) {
      try {
        return await SyncPointLocationBridge.resumeTracking();
      } catch (e) {
        console.warn('[LocationBridge] Native resume failed:', e);
      }
    }
    return true;
  }

  /**
   * Terminates the native foreground service and stops all sensor updates.
   */
  async finishTracking(): Promise<boolean> {
    if (this.simulatorInterval) {
      clearInterval(this.simulatorInterval);
      this.simulatorInterval = null;
    }
    this.isSimulatorRunning = false;

    if (Platform.OS === 'android' && SyncPointLocationBridge) {
      try {
        return await SyncPointLocationBridge.finishTracking();
      } catch (e) {
        console.warn('[LocationBridge] Native finish failed:', e);
      }
    }
    return true;
  }

  /**
   * Fetches the current native service state.
   */
  async getTrackingState(): Promise<TrackingState> {
    if (Platform.OS === 'android' && SyncPointLocationBridge) {
      try {
        return await SyncPointLocationBridge.getTrackingState();
      } catch (e) {
        console.warn('[LocationBridge] Native getTrackingState failed:', e);
      }
    }
    return { isRunning: this.isSimulatorRunning, isPaused: false };
  }

  /**
   * Adds a listener for high-frequency location fixes from Kotlin engine.
   */
  addLocationListener(callback: (location: RawLocationUpdate) => void): () => void {
    this.listeners.push(callback);

    let nativeSub: any = null;
    if (this.eventEmitter) {
      nativeSub = this.eventEmitter.addListener('onLocationUpdate', callback);
    }

    return () => {
      this.listeners = this.listeners.filter((cb) => cb !== callback);
      if (nativeSub) {
        nativeSub.remove();
      }
    };
  }

  /**
   * Injects a location fix (used by MovementSimulator and tests)
   */
  emitLocation(update: RawLocationUpdate) {
    for (const listener of this.listeners) {
      listener(update);
    }
  }
}

export const LocationBridge = new LocationBridgeService();
