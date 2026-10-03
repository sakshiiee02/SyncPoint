import { LatLng, calculateDistanceMeters } from '@/utils/geoMath';
import { RouteRecord, RouteStep } from '@/types/route';
import { CONFIG } from '@/constants/config';

export interface NavigationProgress {
  currentStepIndex: number;
  currentStep: RouteStep | null;
  distanceToNextManeuverM: number;
  instruction: string;
  maneuverIcon: string;
  isOffRoute: boolean;
  distanceRemainingM: number;
  durationRemainingS: number;
}

/**
 * Calculates the shortest distance from a point to a line segment in meters.
 */
export function distanceToSegmentMeters(p: LatLng, a: LatLng, b: LatLng): number {
  const dAB = calculateDistanceMeters(a, b);
  if (dAB === 0) return calculateDistanceMeters(p, a);

  const dAP = calculateDistanceMeters(a, p);
  const dBP = calculateDistanceMeters(b, p);

  // If projection falls outside segment endpoints
  if (dAP * dAP >= dBP * dBP + dAB * dAB) return dBP;
  if (dBP * dBP >= dAP * dAP + dAB * dAB) return dAP;

  // Triangular area / base = perpendicular height
  const s = (dAB + dAP + dBP) / 2;
  const area = Math.sqrt(Math.max(0, s * (s - dAB) * (s - dAP) * (s - dBP)));
  return (2 * area) / dAB;
}

/**
 * Maps OSRM maneuver type and modifier to a clean visual icon.
 */
export function getManeuverIcon(type: string, modifier?: string): string {
  if (type === 'arrive') return '🏁';
  if (type === 'depart') return '🚗';

  switch (modifier) {
    case 'left':
    case 'sharp left':
    case 'slight left':
      return '↰';
    case 'right':
    case 'sharp right':
    case 'slight right':
      return '↱';
    case 'u-turn':
      return '↩';
    case 'straight':
    default:
      return '⬆️';
  }
}

/**
 * Evaluates live vehicle progress against the active route geometry.
 * Matches Section 11.2 of Developer Handoff.
 */
export function evaluateNavigationProgress(
  currentLocation: LatLng,
  route: RouteRecord
): NavigationProgress {
  const coords = route.geometry.coordinates; // [lng, lat]
  let minCrossTrackDistanceM = Infinity;

  // Find minimum perpendicular distance from current point to any segment on the polyline
  for (let i = 0; i < coords.length - 1; i++) {
    const a: LatLng = { lat: coords[i][1], lng: coords[i][0] };
    const b: LatLng = { lat: coords[i + 1][1], lng: coords[i + 1][0] };
    const distM = distanceToSegmentMeters(currentLocation, a, b);
    if (distM < minCrossTrackDistanceM) {
      minCrossTrackDistanceM = distM;
    }
  }

  // Detect off-route (Section 11.2: off-route threshold 50-100m, default 75m)
  const isOffRoute = minCrossTrackDistanceM > CONFIG.ROUTE_REROUTE_THRESHOLD_M;

  // Determine current step and upcoming maneuver
  let activeStepIndex = 0;
  const destinationCoord: LatLng = {
    lat: coords[coords.length - 1][1],
    lng: coords[coords.length - 1][0],
  };
  const distanceRemainingM = calculateDistanceMeters(currentLocation, destinationCoord);

  // Approximate current step based on distance remaining
  if (route.steps.length > 0) {
    let distCounter = route.distanceM;
    for (let i = 0; i < route.steps.length; i++) {
      distCounter -= route.steps[i].distanceM;
      if (distanceRemainingM >= distCounter) {
        activeStepIndex = i;
        break;
      }
    }
  }

  const currentStep = route.steps[activeStepIndex] || route.steps[0] || null;
  const nextStep = route.steps[activeStepIndex + 1] || currentStep;

  let distanceToNextManeuverM = currentStep ? Math.round(currentStep.distanceM * 0.4) : 300;
  if (nextStep && nextStep.maneuver.location) {
    distanceToNextManeuverM = Math.round(
      calculateDistanceMeters(currentLocation, {
        lat: nextStep.maneuver.location[1],
        lng: nextStep.maneuver.location[0],
      })
    );
  }

  const instruction = nextStep?.maneuver.instruction || currentStep?.maneuver.instruction || 'Continue on route';
  const maneuverIcon = getManeuverIcon(
    nextStep?.maneuver.type || 'continue',
    nextStep?.maneuver.modifier
  );

  const durationRemainingS = Math.round((distanceRemainingM / Math.max(route.distanceM / route.durationS, 5)));

  return {
    currentStepIndex: activeStepIndex,
    currentStep,
    distanceToNextManeuverM,
    instruction,
    maneuverIcon,
    isOffRoute,
    distanceRemainingM,
    durationRemainingS,
  };
}
