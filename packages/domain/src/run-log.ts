import { z } from 'zod';

/**
 * Run log: private per-run analytics, abort reasons, finish-photo credit tiers and
 * per-route personal history.
 *
 * Rules (TJ, 2026-11-27):
 * - Entry is by vetting; a run never re-proves car ownership.
 * - GPS proves completion. There is no start photo.
 * - Finish photo tiers: dash only = verified (base points), car only = more points,
 *   both = top points. Photo location is cross-checked against the finish privately
 *   and never shown to other members.
 * - Speed and time are PRIVATE stats. They are never ranked between members and
 *   never decide who holds a route. Nothing in this module compares members.
 */

// ---------------------------------------------------------------------------
// Abort
// ---------------------------------------------------------------------------

export const RUN_ABORT_REASONS = [
  'traffic',
  'road_closed',
  'weather',
  'car_trouble',
  'lost_gps',
  'phone_issue',
] as const;
export const RunAbortReasonSchema = z.enum(RUN_ABORT_REASONS);
export type RunAbortReason = z.infer<typeof RunAbortReasonSchema>;

/** Short, declarative labels for the End run sheet. */
export const RUN_ABORT_LABELS: Record<RunAbortReason, string> = {
  traffic: 'Traffic',
  road_closed: 'Road closed',
  weather: 'Weather',
  car_trouble: 'Car trouble',
  lost_gps: 'Lost GPS',
  phone_issue: 'Phone issue',
};

export const RunOutcomeSchema = z.enum(['completed', 'aborted']);
export type RunOutcome = z.infer<typeof RunOutcomeSchema>;

/** Progress along the route at the moment a run ended, clamped to 0..100. */
export function runProgressPct(progressM: number, routeLengthM: number): number {
  if (!Number.isFinite(progressM) || !Number.isFinite(routeLengthM) || routeLengthM <= 0) return 0;
  const pct = (100 * Math.max(0, progressM)) / routeLengthM;
  return Math.round(Math.min(100, pct) * 10) / 10;
}

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

export type RunSample = {
  timestampMs: number;
  latitude: number;
  longitude: number;
  altitudeM: number | null;
  accuracyM: number | null;
  /** Provider speed (m/s). Private. */
  speedMps: number | null;
};

export type TimeOfDay = 'dawn' | 'morning' | 'afternoon' | 'evening' | 'night';

export type RunAnalytics = {
  distanceM: number;
  /** Active recording time (excludes paused intervals). Completion time for a finished run. */
  activeMs: number;
  movingMs: number;
  stoppedMs: number;
  /** distance / active time. Private. */
  avgSpeedMps: number | null;
  /** distance / moving time. Private. */
  avgMovingSpeedMps: number | null;
  /** Highest plausible sustained provider speed. Private. */
  maxSpeedMps: number | null;
  elevationGainM: number | null;
  elevationLossM: number | null;
  minAltitudeM: number | null;
  maxAltitudeM: number | null;
  startedAtMs: number | null;
  startLocalHour: number | null;
  timeOfDay: TimeOfDay | null;
  /** Share of active time covered by GPS fixes without a signal gap, 0..100. */
  gpsCoveragePct: number;
  /** Share of fixes with accuracy <= 15 m, 0..100. */
  goodFixPct: number;
  sampleCount: number;
  signalGapCount: number;
};

/** Below this ground speed the car counts as stopped (≈ 2.2 mph). */
export const MOVING_SPEED_MPS = 1;
/** A gap between fixes longer than this is uncovered time (matches drive-tracking). */
export const ANALYTICS_GAP_MS = 15_000;
/** Ignore fixes worse than this for speed and elevation. */
export const ANALYTICS_MAX_ACCURACY_M = 50;
/** Altitude must move this far before it counts as climb or descent (GPS noise). */
export const ELEVATION_HYSTERESIS_M = 3;
/** Implausible ground speed (m/s ≈ 306 km/h) — matches drive-tracking. */
const MAX_PLAUSIBLE_MPS = 85;

const EARTH_RADIUS_M = 6_371_008.8;
export function distanceBetweenM(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const toRad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * toRad;
  const dLng = (b.longitude - a.longitude) * toRad;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.latitude * toRad) * Math.cos(b.latitude * toRad) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(x)));
}

export function timeOfDayForHour(hour: number): TimeOfDay {
  if (hour >= 5 && hour < 8) return 'dawn';
  if (hour >= 8 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

/** Hour 0..23 in the given IANA zone (device zone when omitted). */
export function localHour(epochMs: number, timeZone?: string): number {
  const text = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    hourCycle: 'h23',
    timeZone,
  }).format(new Date(epochMs));
  const hour = Number.parseInt(text, 10);
  return Number.isFinite(hour) ? hour % 24 : new Date(epochMs).getHours();
}

const round = (value: number, places = 2) => {
  const f = 10 ** places;
  return Math.round(value * f) / f;
};

function usable(sample: RunSample): boolean {
  return (
    Number.isFinite(sample.latitude) &&
    Number.isFinite(sample.longitude) &&
    (sample.accuracyM == null || sample.accuracyM <= ANALYTICS_MAX_ACCURACY_M)
  );
}

/**
 * Compute private run analytics from real device fixes only.
 * `distanceM` and `activeMs` come from the recorder (which already rejects jumps
 * and excludes paused time); everything else is derived from the samples.
 */
export function computeRunAnalytics(input: {
  samples: readonly RunSample[];
  activeMs: number;
  distanceM: number;
  startedAtMs: number | null;
  timeZone?: string;
}): RunAnalytics {
  const samples = [...input.samples].sort((a, b) => a.timestampMs - b.timestampMs);
  const activeMs = Math.max(0, input.activeMs);
  const distanceM = Math.max(0, input.distanceM);

  let coveredMs = 0;
  let movingMs = 0;
  let gaps = 0;
  let maxSpeed: number | null = null;
  for (let i = 1; i < samples.length; i++) {
    const prev = samples[i - 1]!;
    const cur = samples[i]!;
    const dt = cur.timestampMs - prev.timestampMs;
    if (dt <= 0) continue;
    if (dt > ANALYTICS_GAP_MS) {
      gaps++;
      continue;
    }
    coveredMs += dt;
    let speed: number | null = null;
    if (usable(cur) && cur.speedMps != null && Number.isFinite(cur.speedMps) && cur.speedMps >= 0) {
      speed = cur.speedMps;
    } else if (usable(prev) && usable(cur)) {
      speed = distanceBetweenM(prev, cur) / (dt / 1000);
    }
    if (speed == null || speed > MAX_PLAUSIBLE_MPS) continue;
    if (speed >= MOVING_SPEED_MPS) movingMs += dt;
    if (usable(cur) && (maxSpeed == null || speed > maxSpeed)) maxSpeed = speed;
  }
  coveredMs = Math.min(coveredMs, activeMs);
  movingMs = Math.min(movingMs, activeMs);

  // Elevation with hysteresis so GPS altitude noise does not inflate climb.
  let gain: number | null = null;
  let loss: number | null = null;
  let minAlt: number | null = null;
  let maxAlt: number | null = null;
  let anchor: number | null = null;
  for (const s of samples) {
    if (!usable(s) || s.altitudeM == null || !Number.isFinite(s.altitudeM)) continue;
    const alt = s.altitudeM;
    minAlt = minAlt == null ? alt : Math.min(minAlt, alt);
    maxAlt = maxAlt == null ? alt : Math.max(maxAlt, alt);
    if (anchor == null) {
      anchor = alt;
      gain = 0;
      loss = 0;
      continue;
    }
    const delta = alt - anchor;
    if (delta >= ELEVATION_HYSTERESIS_M) {
      gain = (gain ?? 0) + delta;
      anchor = alt;
    } else if (delta <= -ELEVATION_HYSTERESIS_M) {
      loss = (loss ?? 0) - delta;
      anchor = alt;
    }
  }

  const accurate = samples.filter(s => s.accuracyM != null && Number.isFinite(s.accuracyM));
  const good = accurate.filter(s => (s.accuracyM as number) <= 15).length;
  const startedAtMs = input.startedAtMs ?? samples[0]?.timestampMs ?? null;
  const hour = startedAtMs == null ? null : localHour(startedAtMs, input.timeZone);

  return {
    distanceM: round(distanceM, 1),
    activeMs: Math.round(activeMs),
    movingMs: Math.round(movingMs),
    stoppedMs: Math.round(Math.max(0, activeMs - movingMs)),
    avgSpeedMps: activeMs > 0 && distanceM > 0 ? round(distanceM / (activeMs / 1000)) : null,
    avgMovingSpeedMps: movingMs > 0 && distanceM > 0 ? round(distanceM / (movingMs / 1000)) : null,
    maxSpeedMps: maxSpeed == null ? null : round(maxSpeed),
    elevationGainM: gain == null ? null : round(gain, 1),
    elevationLossM: loss == null ? null : round(loss, 1),
    minAltitudeM: minAlt == null ? null : round(minAlt, 1),
    maxAltitudeM: maxAlt == null ? null : round(maxAlt, 1),
    startedAtMs,
    startLocalHour: hour,
    timeOfDay: hour == null ? null : timeOfDayForHour(hour),
    gpsCoveragePct: activeMs > 0 ? round((100 * coveredMs) / activeMs, 1) : 0,
    goodFixPct: accurate.length ? round((100 * good) / accurate.length, 1) : 0,
    sampleCount: samples.length,
    signalGapCount: gaps,
  };
}

/** Coarse ~1 km start label. Never a precise home location. */
export function coarseStartLabel(sample: { latitude: number; longitude: number } | null | undefined): string | null {
  if (!sample) return null;
  return `${sample.latitude.toFixed(2)}, ${sample.longitude.toFixed(2)}`;
}

// ---------------------------------------------------------------------------
// Finish photo credit
// ---------------------------------------------------------------------------

export const FinishPhotoKindSchema = z.enum(['car', 'dash']);
export type FinishPhotoKind = z.infer<typeof FinishPhotoKindSchema>;

/** Final (TJ, 2026-11-27). Photo must be taken within this window after the GPS finish, unlocking the phone included. */
export const FINISH_PHOTO_WINDOW_MS = 30 * 60 * 1000;
/** Small allowance for clock skew between the GPS fix and the camera. */
export const FINISH_PHOTO_EARLY_GRACE_MS = 2 * 60 * 1000;
/** Final (TJ, 2026-11-27). Photo location must be within this distance of the route finish. */
export const FINISH_PHOTO_RADIUS_M = 250;
/** Worse than this, a photo location cannot confirm anything. */
export const FINISH_PHOTO_MAX_ACCURACY_M = 100;

export type FinishTier = 'none' | 'verified' | 'car' | 'top';

/** Final points per tier (TJ, 2026-11-27): dash only 10, car only 20, both 30. */
export const FINISH_POINTS_DASH = 10;
export const FINISH_POINTS_CAR = 20;
export const FINISH_POINTS_BOTH = 30;
export const FINISH_TIER_POINTS: Record<FinishTier, number> = {
  none: 0,
  verified: FINISH_POINTS_DASH,
  car: FINISH_POINTS_CAR,
  top: FINISH_POINTS_BOTH,
};

// ---------------------------------------------------------------------------
// Retention
// ---------------------------------------------------------------------------

/**
 * Raw per-point GPS, speed and track data is kept for 90 days, then purged.
 * After that only the summary stays: average speed, completion time, distance
 * (plus non-speed counts). Server: public.purge_raw_run_data(). Device: purgeLocalRawRunData().
 */
export const RAW_TRACK_RETENTION_DAYS = 90;
export const RAW_TRACK_RETENTION_MS = RAW_TRACK_RETENTION_DAYS * 24 * 60 * 60 * 1000;

/** Epoch ms before which raw run data must be gone. */
export function rawTrackCutoffMs(nowMs: number = Date.now()): number {
  return nowMs - RAW_TRACK_RETENTION_MS;
}

/** Summary analytics kept after the retention window: speed-derived detail removed. */
export function retainedAnalytics(a: RunAnalytics): RunAnalytics {
  return { ...a, maxSpeedMps: null, avgMovingSpeedMps: null };
}

export const FinishPhotoClaimSchema = z
  .object({
    kind: FinishPhotoKindSchema,
    takenAtMs: z.number().int().positive().safe(),
    /** Where the photo was taken: device fix at capture, or EXIF GPS from a library pick. */
    latitude: z.number().min(-90).max(90).nullable(),
    longitude: z.number().min(-180).max(180).nullable(),
    accuracyM: z.number().min(0).max(10_000).nullable(),
    source: z.enum(['camera', 'library']),
  })
  .strict();
export type FinishPhotoClaim = z.infer<typeof FinishPhotoClaimSchema>;

export type FinishPhotoStatus = 'accepted' | 'early' | 'late' | 'off_location' | 'no_location';

export type FinishPoint = { latitude: number; longitude: number; finishedAtMs: number };

export function checkFinishPhoto(claim: FinishPhotoClaim, finish: FinishPoint): FinishPhotoStatus {
  if (claim.takenAtMs < finish.finishedAtMs - FINISH_PHOTO_EARLY_GRACE_MS) return 'early';
  if (claim.takenAtMs > finish.finishedAtMs + FINISH_PHOTO_WINDOW_MS) return 'late';
  if (claim.latitude == null || claim.longitude == null) return 'no_location';
  if (claim.accuracyM != null && claim.accuracyM > FINISH_PHOTO_MAX_ACCURACY_M) return 'no_location';
  const away = distanceBetweenM(claim as { latitude: number; longitude: number }, finish);
  const slack = Math.min(claim.accuracyM ?? 0, FINISH_PHOTO_MAX_ACCURACY_M);
  return away <= FINISH_PHOTO_RADIUS_M + slack ? 'accepted' : 'off_location';
}

export type FinishCredit = {
  tier: FinishTier;
  points: number;
  car: FinishPhotoStatus | null;
  dash: FinishPhotoStatus | null;
};

/**
 * Credit for a GPS-completed run. Only photos that pass the private time and
 * location check count; a photo that fails is held, not shown as a failure to others.
 */
export function finishCredit(
  photos: readonly FinishPhotoClaim[],
  finish: FinishPoint,
  gpsCompleted: boolean,
): FinishCredit {
  const best = (kind: FinishPhotoKind): FinishPhotoStatus | null => {
    const statuses = photos.filter(p => p.kind === kind).map(p => checkFinishPhoto(p, finish));
    if (!statuses.length) return null;
    return statuses.includes('accepted') ? 'accepted' : statuses[0]!;
  };
  const car = best('car');
  const dash = best('dash');
  if (!gpsCompleted) return { tier: 'none', points: 0, car, dash };
  const carOk = car === 'accepted';
  const dashOk = dash === 'accepted';
  const tier: FinishTier = carOk && dashOk ? 'top' : carOk ? 'car' : dashOk ? 'verified' : 'none';
  return { tier, points: FINISH_TIER_POINTS[tier], car, dash };
}

/** Fields of a photo claim that may ever leave the owner's private record. Location never does. */
export function shareablePhotoClaim(claim: FinishPhotoClaim): Pick<FinishPhotoClaim, 'kind' | 'takenAtMs'> {
  return { kind: claim.kind, takenAtMs: claim.takenAtMs };
}

// ---------------------------------------------------------------------------
// Per-route personal history
// ---------------------------------------------------------------------------

export type RunAttemptLite = {
  route: string;
  outcome: RunOutcome;
  endedAtMs: number;
  /** Completion time for completed runs. Private. */
  durationMs?: number | null;
  abortReason?: RunAbortReason | null;
};

export type RouteTrend = 'improving' | 'steady' | 'slower' | 'not_enough';

export type RouteHistory = {
  route: string;
  attempts: number;
  completed: number;
  aborted: number;
  abortReasons: Partial<Record<RunAbortReason, number>>;
  bestMs: number | null;
  lastMs: number | null;
  /** Up to the last 10 completion times, oldest first. Private to the member. */
  recentMs: number[];
  trend: RouteTrend;
};

/** Within ±2 % counts as steady. */
export const TREND_STEADY_PCT = 2;

/** Personal history for one member on one route. Never compares members. */
export function summarizeRouteHistory(attempts: readonly RunAttemptLite[], route: string): RouteHistory {
  const mine = attempts.filter(a => a.route === route).sort((a, b) => a.endedAtMs - b.endedAtMs);
  const done = mine.filter(
    a => a.outcome === 'completed' && a.durationMs != null && Number.isFinite(a.durationMs) && a.durationMs > 0,
  );
  const times = done.map(a => a.durationMs as number);
  const abortReasons: Partial<Record<RunAbortReason, number>> = {};
  for (const a of mine) {
    if (a.outcome === 'aborted' && a.abortReason) abortReasons[a.abortReason] = (abortReasons[a.abortReason] ?? 0) + 1;
  }
  return {
    route,
    attempts: mine.length,
    completed: mine.filter(a => a.outcome === 'completed').length,
    aborted: mine.filter(a => a.outcome === 'aborted').length,
    abortReasons,
    bestMs: times.length ? Math.min(...times) : null,
    lastMs: times.length ? times[times.length - 1]! : null,
    recentMs: times.slice(-10),
    trend: routeTrend(times),
  };
}

/** Compare the mean of the last three completions with the three before them. */
export function routeTrend(timesOldestFirst: readonly number[]): RouteTrend {
  if (timesOldestFirst.length < 4) return 'not_enough';
  const recent = timesOldestFirst.slice(-3);
  const earlier = timesOldestFirst.slice(-6, -3);
  const mean = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const change = (100 * (mean(recent) - mean(earlier))) / mean(earlier);
  if (change <= -TREND_STEADY_PCT) return 'improving';
  if (change >= TREND_STEADY_PCT) return 'slower';
  return 'steady';
}
