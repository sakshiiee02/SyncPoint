import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// Import RDP and math logic for standalone node testing
function perpendicularDistanceMeters(point, lineStart, lineEnd) {
  const [lngP, latP] = point;
  const [lngA, latA] = lineStart;
  const [lngB, latB] = lineEnd;

  if (lngA === lngB && latA === latB) {
    return Math.hypot((lngP - lngA) * 111320 * Math.cos(latA * Math.PI / 180), (latP - latA) * 110574);
  }

  const rad = Math.PI / 180;
  const midLat = ((latA + latB) / 2) * rad;
  const cosLat = Math.cos(midLat);

  const xP = lngP * cosLat;
  const yP = latP;
  const xA = lngA * cosLat;
  const yA = latA;
  const xB = lngB * cosLat;
  const yB = latB;

  const dx = xB - xA;
  const dy = yB - yA;
  const lenSq = dx * dx + dy * dy;

  let t = ((xP - xA) * dx + (yP - yA) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const projX = xA + t * dx;
  const projY = yA + t * dy;

  const dXDeg = (xP - projX) / cosLat;
  const dYDeg = yP - projY;

  return Math.hypot(dXDeg * 111320 * cosLat, dYDeg * 110574);
}

function simplifyPolylineRdp(coordinates, epsilonMeters = 20) {
  if (coordinates.length <= 2) {
    return coordinates;
  }

  let maxDistance = 0;
  let maxIndex = 0;
  const first = coordinates[0];
  const last = coordinates[coordinates.length - 1];

  for (let i = 1; i < coordinates.length - 1; i++) {
    const dist = perpendicularDistanceMeters(coordinates[i], first, last);
    if (dist > maxDistance) {
      maxDistance = dist;
      maxIndex = i;
    }
  }

  if (maxDistance > epsilonMeters) {
    const left = simplifyPolylineRdp(coordinates.slice(0, maxIndex + 1), epsilonMeters);
    const right = simplifyPolylineRdp(coordinates.slice(maxIndex), epsilonMeters);
    return left.slice(0, left.length - 1).concat(right);
  }

  return [first, last];
}

function computeTravelerSummary(rawSamples, member, epsilonMeters = 20) {
  const sorted = [...rawSamples].sort((a, b) => a.timestamp - b.timestamp);
  let totalDistanceM = 0;
  let maxSpeedMps = 0;

  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].speedMps > maxSpeedMps) {
      maxSpeedMps = sorted[i].speedMps;
    }
    if (i > 0) {
      const p1 = sorted[i - 1];
      const p2 = sorted[i];
      const dist = Math.hypot((p2.lng - p1.lng) * 111320 * Math.cos(p1.lat * Math.PI / 180), (p2.lat - p1.lat) * 110574);
      totalDistanceM += dist;
    }
  }

  const startedAt = member.startedAt || sorted[0].timestamp;
  const finishedAt = member.finishedAt || sorted[sorted.length - 1].timestamp;
  const durationS = Math.max(1, Math.round((finishedAt - startedAt) / 1000));
  const avgSpeedKmh = Math.round((totalDistanceM / durationS) * 3.6 * 10) / 10;
  const maxSpeedKmh = Math.round(maxSpeedMps * 3.6 * 10) / 10;

  const rawCoords = sorted.map((p) => [p.lng, p.lat]);
  const compressedPolyline = simplifyPolylineRdp(rawCoords, epsilonMeters);

  return {
    uid: member.uid,
    name: member.name,
    travelMode: member.travelMode,
    startedAt,
    finishedAt,
    totalDistanceM: Math.round(totalDistanceM),
    durationS,
    avgSpeedKmh,
    maxSpeedKmh,
    compressedPolyline,
    pointsSampleCount: sorted.length,
  };
}

describe('SyncPoint Phase 7: History Retention & Security Hardening', () => {
  test('perpendicularDistanceMeters returns ~0 for points on segment', () => {
    const start = [77.0, 28.0];
    const end = [77.0, 29.0];
    const midPoint = [77.0, 28.5];

    const dist = perpendicularDistanceMeters(midPoint, start, end);
    assert.ok(dist < 1.0, `Expected distance near 0, got ${dist}`);
  });

  test('simplifyPolylineRdp achieves >80% compression on collinear highway segments', () => {
    // 50 collinear points heading north
    const points = [];
    for (let i = 0; i <= 50; i++) {
      points.push([77.0, 28.0 + i * 0.01]);
    }
    // Add one sharp turn to the east
    points.push([77.05, 28.51]);
    points.push([77.10, 28.52]);

    const simplified = simplifyPolylineRdp(points, 20);

    assert.ok(simplified.length <= 5, `Expected <= 5 points, got ${simplified.length}`);
    assert.equal(simplified[0][0], 77.0);
    assert.equal(simplified[0][1], 28.0);
    assert.equal(simplified[simplified.length - 1][0], 77.10);
  });

  test('computeTravelerSummary derives accurate duration, speeds, and compression ratio', () => {
    const startTime = Date.now() - 3600000; // 1 hour ago
    const samples = [];

    // Simulate 60 GPS points at 60s intervals (100km total, ~100 km/h)
    for (let i = 0; i < 60; i++) {
      samples.push({
        lat: 28.0 + (i * 0.9) / 60,
        lng: 77.0,
        timestamp: startTime + i * 60000,
        speedMps: 27.7, // ~100 km/h
      });
    }

    const summary = computeTravelerSummary(
      samples,
      {
        uid: 'user_aarav',
        name: 'Aarav Sharma',
        travelMode: 'CAR',
        startedAt: startTime,
        finishedAt: startTime + 3600000,
      },
      25
    );

    assert.equal(summary.uid, 'user_aarav');
    assert.equal(summary.durationS, 3600);
    assert.ok(summary.avgSpeedKmh >= 95 && summary.avgSpeedKmh <= 105);
    assert.ok(summary.maxSpeedKmh >= 99 && summary.maxSpeedKmh <= 101);
    assert.ok(summary.compressedPolyline.length < 5, 'Polyline should be reduced to endpoints');
    assert.equal(summary.pointsSampleCount, 60);
  });

  test('Security Rules Simulation: live location writes blocked when journey is COMPLETED or EXPIRED', () => {
    function evaluateLiveWriteRule(auth, pathUid, journeyMeta, now) {
      return (
        auth !== null &&
        auth.uid === pathUid &&
        journeyMeta.status === 'ACTIVE' &&
        journeyMeta.expiresAt > now
      );
    }

    const authUser = { uid: 'user_aarav' };
    const now = Date.now();

    // Active journey within window -> ALLOWED
    const activeMeta = { status: 'ACTIVE', expiresAt: now + 3600000 };
    assert.equal(evaluateLiveWriteRule(authUser, 'user_aarav', activeMeta, now), true);

    // Completed journey -> BLOCKED
    const completedMeta = { status: 'COMPLETED', expiresAt: now + 3600000 };
    assert.equal(evaluateLiveWriteRule(authUser, 'user_aarav', completedMeta, now), false);

    // Expired journey by status -> BLOCKED
    const expiredMeta = { status: 'EXPIRED', expiresAt: now + 3600000 };
    assert.equal(evaluateLiveWriteRule(authUser, 'user_aarav', expiredMeta, now), false);

    // Past expiry time -> BLOCKED
    const pastExpiryMeta = { status: 'ACTIVE', expiresAt: now - 1000 };
    assert.equal(evaluateLiveWriteRule(authUser, 'user_aarav', pastExpiryMeta, now), false);

    // Impersonating another user UID -> BLOCKED
    assert.equal(evaluateLiveWriteRule(authUser, 'user_priya', activeMeta, now), false);
  });

  test('Security Rules Simulation: non-members cannot read journey data', () => {
    function evaluateJourneyReadRule(auth, journey) {
      if (!auth) return false;
      const isMember = Boolean(journey.members && journey.members[auth.uid]);
      const isCreator = journey.meta && journey.meta.creatorUid === auth.uid;
      return isMember || isCreator;
    }

    const journey = {
      meta: { creatorUid: 'user_aarav' },
      members: { user_aarav: true, user_priya: true },
    };

    assert.equal(evaluateJourneyReadRule({ uid: 'user_aarav' }, journey), true);
    assert.equal(evaluateJourneyReadRule({ uid: 'user_priya' }, journey), true);
    assert.equal(evaluateJourneyReadRule({ uid: 'user_stranger' }, journey), false);
    assert.equal(evaluateJourneyReadRule(null, journey), false);
  });
});
