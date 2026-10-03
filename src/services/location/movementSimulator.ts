import { LatLng, calculateDistanceMeters, calculateBearing } from '@/utils/geoMath';
import { LocationBridge, RawLocationUpdate } from './LocationBridge';

export interface SimulationConfig {
  origin: LatLng;
  destination: LatLng;
  speedKmh?: number; // default 60 km/h
  stepIntervalMs?: number; // default 2000 ms
  initialBatteryPct?: number; // default 92%
}

/**
 * Realistic movement simulator for multi-traveler testing and local simulation.
 * Interpolates positions along coordinate vectors and produces valid vehicle telemetry.
 */
export class MovementSimulator {
  private timer: any = null;
  private currentLat: number = 0;
  private currentLng: number = 0;
  private targetLat: number = 0;
  private targetLng: number = 0;
  private speedMps: number = 16.6; // 60 km/h
  private batteryPct: number = 95;
  private isRunning: boolean = false;

  start(config: SimulationConfig, onUpdate?: (loc: RawLocationUpdate) => void) {
    this.stop();

    this.currentLat = config.origin.lat;
    this.currentLng = config.origin.lng;
    this.targetLat = config.destination.lat;
    this.targetLng = config.destination.lng;
    this.speedMps = (config.speedKmh || 60) / 3.6;
    this.batteryPct = config.initialBatteryPct || 92;
    this.isRunning = true;

    const intervalMs = config.stepIntervalMs || 2000;

    this.timer = setInterval(() => {
      if (!this.isRunning) return;

      const remainingDistanceM = calculateDistanceMeters(
        { lat: this.currentLat, lng: this.currentLng },
        { lat: this.targetLat, lng: this.targetLng }
      );

      // If arrived at destination, hold position
      if (remainingDistanceM < 25) {
        this.speedMps = 0;
      } else {
        // Step forward by distance = speed * dt
        const stepDistanceM = this.speedMps * (intervalMs / 1000);
        const fraction = Math.min(stepDistanceM / remainingDistanceM, 1.0);

        this.currentLat += (this.targetLat - this.currentLat) * fraction;
        this.currentLng += (this.targetLng - this.currentLng) * fraction;

        // Slight battery drain every tick
        if (Math.random() < 0.05 && this.batteryPct > 5) {
          this.batteryPct -= 1;
        }
      }

      const bearing = calculateBearing(
        { lat: this.currentLat, lng: this.currentLng },
        { lat: this.targetLat, lng: this.targetLng }
      );

      const update: RawLocationUpdate = {
        latitude: this.currentLat,
        longitude: this.currentLng,
        speedMps: this.speedMps,
        heading: bearing,
        accuracy: 4.5,
        timestamp: Date.now(),
        shouldPublish: true,
      };

      LocationBridge.emitLocation(update);
      onUpdate?.(update);
    }, intervalMs);
  }

  stop() {
    this.isRunning = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  getCurrentLocation(): LatLng {
    return { lat: this.currentLat, lng: this.currentLng };
  }

  getBatteryPct(): number {
    return this.batteryPct;
  }
}

export const movementSimulator = new MovementSimulator();
