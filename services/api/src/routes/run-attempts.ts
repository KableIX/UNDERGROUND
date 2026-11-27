import { z } from 'zod';
import {
  FinishPhotoClaimSchema,
  RunAbortReasonSchema,
  RunOutcomeSchema,
  finishCredit,
  type FinishCredit,
  type FinishPhotoKind,
  type RunAbortReason,
  type RunOutcome,
} from '@underground/domain';
import { runFinishPoint } from './route-finishes';

/**
 * Private run log: one record per attempt (completed or aborted) with the member's own
 * analytics, plus finish-photo credit for GPS-completed runs.
 *
 * Speed and time are private. Nothing here ranks members or feeds route holding.
 * Photo location is used only for the server-side finish check and is never returned.
 */

const ATTEMPT_ID = /^[A-Za-z0-9_-]{1,100}$/;
const CLOCK_SKEW_MS = 15_000;
const amount = (max: number) => z.number().finite().min(0).max(max);
const count = z.number().int().min(0).max(100_000);
const epoch = z.number().int().positive().safe();

const AnalyticsSchema = z
  .object({
    distanceM: amount(2_000_000),
    activeMs: amount(86_400_000),
    movingMs: amount(86_400_000),
    stoppedMs: amount(86_400_000),
    avgSpeedMps: amount(85).nullable(),
    avgMovingSpeedMps: amount(85).nullable(),
    maxSpeedMps: amount(85).nullable(),
    elevationGainM: amount(20_000).nullable(),
    elevationLossM: amount(20_000).nullable(),
    minAltitudeM: z.number().finite().min(-500).max(9_000).nullable(),
    maxAltitudeM: z.number().finite().min(-500).max(9_000).nullable(),
    startedAtMs: epoch.nullable(),
    startLocalHour: z.number().int().min(0).max(23).nullable(),
    timeOfDay: z.enum(['dawn', 'morning', 'afternoon', 'evening', 'night']).nullable(),
    gpsCoveragePct: amount(100),
    goodFixPct: amount(100),
    sampleCount: count,
    signalGapCount: count,
  })
  .strict();
export type RunAnalyticsBody = z.infer<typeof AnalyticsSchema>;

/** A credited photo must already be uploaded (stripped) to the private evidence bucket. */
const PhotoSchema = FinishPhotoClaimSchema.extend({ storagePath: z.string().max(300) }).strict();

const RequestSchema = z
  .object({
    attempt: z.string().regex(ATTEMPT_ID),
    route: z.string().min(1).max(120),
    outcome: RunOutcomeSchema,
    abortReason: RunAbortReasonSchema.nullable(),
    progressM: amount(2_000_000),
    progressPct: amount(100),
    startedAtMs: epoch,
    endedAtMs: epoch,
    finishedAtMs: epoch.nullable(),
    vehicleId: z.string().max(100).nullable(),
    startLabel: z.string().max(40).nullable(),
    analytics: AnalyticsSchema,
    photos: z.array(PhotoSchema).max(4),
  })
  .strict();

export type RunAttemptWrite = {
  attempt: string;
  route: string;
  outcome: RunOutcome;
  abortReason: RunAbortReason | null;
  progressM: number;
  progressPct: number;
  startedAtMs: number;
  endedAtMs: number;
  finishedAtMs: number | null;
  vehicleId: string | null;
  startLabel: string | null;
  analytics: RunAnalyticsBody;
  /** Present only for completed runs that sent at least one finish photo. */
  credit: (FinishCredit & { photos: Array<z.infer<typeof PhotoSchema>> }) | null;
};

export type RunAttemptResult = { ok: true; write: RunAttemptWrite } | { ok: false; error: string };

export function runPhotoPath(member: string, attempt: string, kind: FinishPhotoKind): string {
  return `runs/${member}/${attempt}/${kind}.jpg`;
}

export function validateRunAttempt(body: unknown, member: string, now = Date.now()): RunAttemptResult {
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) return { ok: false, error: 'invalid_run_attempt' };
  const data = parsed.data;
  const finish = runFinishPoint(data.route);
  if (!finish) return { ok: false, error: 'unknown_run_route' };
  if (data.endedAtMs < data.startedAtMs || data.endedAtMs > now + CLOCK_SKEW_MS) {
    return { ok: false, error: 'invalid_run_times' };
  }
  if (data.outcome === 'aborted') {
    if (!data.abortReason || data.photos.length || data.finishedAtMs !== null) {
      return { ok: false, error: 'invalid_abort' };
    }
  } else {
    if (data.abortReason || data.finishedAtMs === null) return { ok: false, error: 'invalid_completion' };
    if (data.finishedAtMs < data.startedAtMs || data.finishedAtMs > data.endedAtMs + 60_000) {
      return { ok: false, error: 'invalid_run_times' };
    }
  }
  for (const photo of data.photos) {
    if (photo.storagePath !== runPhotoPath(member, data.attempt, photo.kind)) {
      return { ok: false, error: 'invalid_photo_path' };
    }
    if (photo.takenAtMs > now + CLOCK_SKEW_MS) return { ok: false, error: 'invalid_photo_time' };
  }
  if (new Set(data.photos.map(p => p.kind)).size !== data.photos.length) {
    return { ok: false, error: 'duplicate_photo_kind' };
  }
  const credit =
    data.outcome === 'completed' && data.photos.length
      ? {
          ...finishCredit(
            data.photos,
            { latitude: finish.latitude, longitude: finish.longitude, finishedAtMs: data.finishedAtMs! },
            // GPS completion is enforced by the database: a credit row must reference a
            // server-validated route_run_finishes row for the same attempt.
            true,
          ),
          photos: data.photos,
        }
      : null;
  return {
    ok: true,
    write: {
      attempt: data.attempt,
      route: data.route,
      outcome: data.outcome,
      abortReason: data.abortReason,
      progressM: data.progressM,
      progressPct: data.progressPct,
      startedAtMs: data.startedAtMs,
      endedAtMs: data.endedAtMs,
      finishedAtMs: data.finishedAtMs,
      vehicleId: data.vehicleId,
      startLabel: data.startLabel,
      analytics: data.analytics,
      credit,
    },
  };
}

const PhotoIntentSchema = z
  .object({ attempt: z.string().regex(ATTEMPT_ID), kind: z.enum(['car', 'dash']), contentType: z.literal('image/jpeg') })
  .strict();

/** Where a member may upload one stripped finish photo. Never a caller-chosen path. */
export function validateRunPhotoIntent(body: unknown, member: string): { ok: true; path: string } | { ok: false; error: string } {
  const parsed = PhotoIntentSchema.safeParse(body);
  if (!parsed.success) return { ok: false, error: 'invalid_photo_intent' };
  return { ok: true, path: runPhotoPath(member, parsed.data.attempt, parsed.data.kind) };
}
