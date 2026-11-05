/**
 * Privacy helpers — trips are private by default.
 * Never put precise coordinates into analytics payloads or console logs.
 */

const ANALYTICS_FORBIDDEN_KEYS = new Set([
  'latitude',
  'longitude',
  'lat',
  'lng',
  'lon',
  'coords',
  'coordinate',
  'speedMps',
  'speedKph',
  'speed',
  'altitudeM',
  'altitude',
  'headingDeg',
  'heading',
  'route',
  'polyline',
  'samples',
]);

export type SafeAnalyticsTripEvent = {
  name: 'trip_started' | 'trip_paused' | 'trip_ended' | 'trip_deleted' | 'trip_replayed';
  tripIdHash: string;
  classification: string;
  distanceBand: '0' | '<1km' | '1-10km' | '10-50km' | '>50km';
  durationBand: '<5m' | '5-30m' | '30-120m' | '>120m';
  gpsQuality: string;
  sampleCountBand: '0' | '1-100' | '100-1000' | '>1000';
};

function hashId(id: string): string {
  let h = 2166136261;
  for (let i = 0; i < id.length; i += 1) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `t_${(h >>> 0).toString(16)}`;
}

function distanceBand(m: number): SafeAnalyticsTripEvent['distanceBand'] {
  if (m <= 0) return '0';
  if (m < 1000) return '<1km';
  if (m < 10_000) return '1-10km';
  if (m < 50_000) return '10-50km';
  return '>50km';
}

function durationBand(ms: number): SafeAnalyticsTripEvent['durationBand'] {
  const m = ms / 60_000;
  if (m < 5) return '<5m';
  if (m < 30) return '5-30m';
  if (m < 120) return '30-120m';
  return '>120m';
}

function sampleBand(n: number): SafeAnalyticsTripEvent['sampleCountBand'] {
  if (n <= 0) return '0';
  if (n <= 100) return '1-100';
  if (n <= 1000) return '100-1000';
  return '>1000';
}

export function toSafeAnalyticsEvent(input: {
  name: SafeAnalyticsTripEvent['name'];
  tripId: string;
  classification: string;
  distanceM: number;
  durationMs: number;
  gpsQuality: string;
  sampleCount: number;
}): SafeAnalyticsTripEvent {
  return {
    name: input.name,
    tripIdHash: hashId(input.tripId),
    classification: input.classification,
    distanceBand: distanceBand(input.distanceM),
    durationBand: durationBand(input.durationMs),
    gpsQuality: input.gpsQuality,
    sampleCountBand: sampleBand(input.sampleCount),
  };
}

/** Strip location/speed keys from an arbitrary log payload. */
export function scrubLocationFromLogPayload(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (ANALYTICS_FORBIDDEN_KEYS.has(key)) continue;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      out[key] = scrubLocationFromLogPayload(value as Record<string, unknown>);
    } else {
      out[key] = value;
    }
  }
  return out;
}

export const TRIP_PRIVACY_POLICY = {
  defaultVisibility: 'private' as const,
  autoPublishHomeOrPreciseRoute: false,
  publicRoadSpeedLeaderboards: false,
  locationInAnalyticsOrLogs: false,
  serverVerifiedDistinctFromLocal: true,
} as const;
