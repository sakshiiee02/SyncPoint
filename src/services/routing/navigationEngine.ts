import { LatLng } from '@/utils/geoMath';
import { RouteRecord, RouteStep } from '@/types/route';
import { CONFIG } from '@/constants/config';
import { indexRoute, projectOntoRoute } from '@/domain/routeProgress';

export interface NavigationProgress {
  currentStepIndex: number;
  currentStep: RouteStep | null;
  /** Metres until the next manoeuvre, measured along the route. */
  distanceToNextManeuverM: number;
  instruction: string;
  maneuverIcon: string;
  isOffRoute: boolean;
  /** Metres left to the destination, measured along the route. */
  distanceRemainingM: number;
  /** Metres from the start of the route (for the next evaluation's search window). */
  alongM: number;
  segmentIndex: number;
  crossTrackM: number;
  currentRoad: string;
}

/**
 * Maps a manoeuvre type/modifier to a clean direction glyph.
 */
export function getManeuverIcon(type: string, modifier?: string): string {
  if (type === 'arrive') return 'ARRIVE';
  if (type === 'depart') return 'DEPART';

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
      return '↑';
  }
}

/** Cumulative end distance of each step, rescaled so the last one lines up with the polyline. */
function stepEndDistances(route: RouteRecord, totalM: number): number[] {
  const raw: number[] = [];
  let sum = 0;
  for (const step of route.steps) {
    sum += step.distanceM;
    raw.push(sum);
  }
  const scale = sum > 0 ? totalM / sum : 1;
  return raw.map((d) => d * scale);
}

/**
 * Where is the traveler on the route, how far is the next turn, how much route is left, and are
 * they off it? `hintSegment` (the previous result's segmentIndex) keeps this cheap on long routes.
 */
export function evaluateNavigationProgress(
  currentLocation: LatLng,
  route: RouteRecord,
  hintSegment?: number
): NavigationProgress {
  const index = indexRoute(route.geometry.coordinates);
  const position = projectOntoRoute(index, currentLocation, hintSegment);
  const distanceRemainingM = Math.max(0, index.totalM - position.alongM);
  const isOffRoute = position.crossTrackM > CONFIG.ROUTE_REROUTE_THRESHOLD_M;

  let currentStepIndex = 0;
  let distanceToNextManeuverM = distanceRemainingM;
  const steps = route.steps;

  if (steps.length > 0) {
    const ends = stepEndDistances(route, index.totalM);
    currentStepIndex = ends.findIndex((end) => end > position.alongM);
    if (currentStepIndex === -1) currentStepIndex = steps.length - 1;
    distanceToNextManeuverM = Math.max(0, ends[currentStepIndex] - position.alongM);
  }

  const currentStep = steps[currentStepIndex] ?? null;
  const nextStep = steps[currentStepIndex + 1] ?? null;
  const upcoming = nextStep ?? currentStep;

  return {
    currentStepIndex,
    currentStep,
    distanceToNextManeuverM: Math.round(distanceToNextManeuverM),
    instruction: upcoming?.maneuver.instruction || 'Continue on route',
    maneuverIcon: getManeuverIcon(upcoming?.maneuver.type || 'continue', upcoming?.maneuver.modifier),
    isOffRoute,
    distanceRemainingM: Math.round(distanceRemainingM),
    alongM: position.alongM,
    segmentIndex: position.segmentIndex,
    crossTrackM: position.crossTrackM,
    currentRoad: currentStep?.name && currentStep.name !== 'Unnamed road' ? currentStep.name : '',
  };
}
