import { z } from 'zod';
import {
  FinishPhotoProofSchema,
  RunAbortReasonSchema,
  RunOutcomeSchema,
  dropPhotoLocation,
  finishCredit,
  unverifiedCredit,
  type FinishCredit,
  type RunAbortReason,
  type RunOutcome,
  type VerifiedFinishPhoto,
} from '@underground/domain';
import { runFinishPoint } from './route-finishes';
import { AttestationSchema, type ProofDecision } from '../integrity/photo-proof';

/**
 * Private run log: one record per attempt (completed or aborted) with the member's own
 * analytics, plus finish-photo credit for GPS-completed runs.
 *
 * Speed and time are private and never feed route holding.
 * Finish photos stay on the member's phone. The request carries only a non-image proof
 * (capture time, GPS fix, optional image hash). The fix is checked against the finish here,
 * in memory, and dropped: the validated write never contains a latitude or longitude.
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

/** Non-image proof only. Image bytes or storage paths are rejected by the strict schema. */
const PhotoSchema = FinishPhotoProofSchema;

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
    /** Signed finish nonce from POST /v1/route-finishes. Required for photo credit. */
    finishNonce: z.string().max(2000).nullable().optional(),
    /** App Attest assertion (or Play Integrity token) over the canonical body without this field. */
    attestation: AttestationSchema.nullable().optional(),
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
  /** Present only for completed runs that sent at least one finish photo. No location. */
  credit: (FinishCredit & {
    photos: VerifiedFinishPhoto[];
    /** Proof came from an attested app instance. */
    attested: boolean;
    /** Finish nonce redeemed for this credit, if any. */
    nonceJti: string | null;
    /** Why the photo proof was not trusted (credit is then none). */
    proofError: string | null;
  }) | null;
};

export type RunAttemptResult = { ok: true; write: RunAttemptWrite } | { ok: false; error: string };

/**
 * `proof`: the anti-cheat decision from assessPhotoProof. Undefined only in development
 * without a nonce secret, where photos are checked against the client's finish time.
 */
export function validateRunAttempt(body: unknown, _member: string, now = Date.now(), proof?: ProofDecision): RunAttemptResult {
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
    if (photo.takenAtMs > now + CLOCK_SKEW_MS) return { ok: false, error: 'invalid_photo_time' };
  }
  if (new Set(data.photos.map(p => p.kind)).size !== data.photos.length) {
    return { ok: false, error: 'duplicate_photo_kind' };
  }
  const hashes = data.photos.map(p => p.imageSha256).filter((h): h is string => !!h);
  if (new Set(hashes).size !== hashes.length) return { ok: false, error: 'duplicate_photo' };
  const result = (): FinishCredit => {
    if (proof && !proof.trusted) return unverifiedCredit(data.photos);
    return finishCredit(
      data.photos,
      // With a finish nonce, the server-signed finish time is used, not the client's claim.
      { latitude: finish.latitude, longitude: finish.longitude, finishedAtMs: proof?.trusted ? proof.finishedAtMs : data.finishedAtMs! },
      // GPS completion is enforced by the database: a credit row must reference a
      // server-validated route_run_finishes row for the same attempt.
      true,
      proof?.trusted ? { notBeforeMs: proof.notBeforeMs } : {},
    );
  };
  const credit =
    data.outcome === 'completed' && data.photos.length
      ? {
          ...result(),
          // Verified: keep the result, drop the location now.
          photos: data.photos.map(dropPhotoLocation),
          attested: proof?.trusted ? proof.attested : false,
          nonceJti: proof?.trusted ? proof.nonceJti : null,
          proofError: proof && !proof.trusted ? proof.error : null,
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
