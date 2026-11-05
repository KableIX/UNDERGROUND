import {
  MAX_SAMPLES_PER_SESSION,
  MAX_SEGMENT_SPEED_MPS,
  MAX_USABLE_ACCURACY_M,
  POOR_ACCURACY_M,
} from './constants';
import { haversineM } from './geo';
import { createId } from './ids';
import type { DriveSession, GpsSample, IngestResult } from './types';

export type RawFix = {
  timestampMs: number;
  latitude: number;
  longitude: number;
  altitudeM: number | null;
  accuracyM: number | null;
  /** Provider speed m/s — stored privately, never required. */
  speedMps: number | null;
  headingDeg: number | null;
};

/**
 * Ingest a single device GPS fix into a recording session.
 * Never fabricates samples. Duplicates / stale timestamps rejected.
 * Jumps and poor accuracy are stored with flags but excluded from distance.
 */
export function ingestGpsFix(
  session: DriveSession,
  samples: readonly GpsSample[],
  fix: RawFix,
  idFactory: (prefix: string) => string = createId,
): IngestResult {
  if (session.status !== 'recording') {
    return { accepted: false, reason: 'session_not_recording' };
  }
  if (samples.length >= MAX_SAMPLES_PER_SESSION) {
    return { accepted: false, reason: 'cap_reached' };
  }
  if (
    !Number.isFinite(fix.latitude) ||
    !Number.isFinite(fix.longitude) ||
    !Number.isFinite(fix.timestampMs) ||
    Math.abs(fix.latitude) > 90 ||
    Math.abs(fix.longitude) > 180
  ) {
    return { accepted: false, reason: 'invalid_coords' };
  }

  const last = samples[samples.length - 1];
  if (last && fix.timestampMs <= last.timestampMs) {
    return { accepted: false, reason: 'duplicate_or_stale' };
  }

  let poorAccuracy = false;
  let discontinuity = false;
  let distanceDeltaM = 0;

  if (fix.accuracyM != null && fix.accuracyM > POOR_ACCURACY_M) {
    poorAccuracy = true;
  }

  if (last) {
    const dtSec = (fix.timestampMs - last.timestampMs) / 1000;
    const segment = haversineM(last.latitude, last.longitude, fix.latitude, fix.longitude);
    const speed = dtSec > 0 ? segment / dtSec : Number.POSITIVE_INFINITY;
    if (speed > MAX_SEGMENT_SPEED_MPS) {
      discontinuity = true;
    } else if (
      !poorAccuracy &&
      !last.flags.poorAccuracy &&
      !last.flags.discontinuity &&
      (fix.accuracyM == null || fix.accuracyM <= MAX_USABLE_ACCURACY_M) &&
      (last.accuracyM == null || last.accuracyM <= MAX_USABLE_ACCURACY_M)
    ) {
      distanceDeltaM = segment;
    }
  }

  const sample: GpsSample = {
    id: idFactory('gps'),
    sessionId: session.id,
    timestampMs: fix.timestampMs,
    latitude: fix.latitude,
    longitude: fix.longitude,
    altitudeM: fix.altitudeM != null && Number.isFinite(fix.altitudeM) ? fix.altitudeM : null,
    accuracyM: fix.accuracyM != null && Number.isFinite(fix.accuracyM) ? fix.accuracyM : null,
    speedMps:
      fix.speedMps != null && Number.isFinite(fix.speedMps) && fix.speedMps >= 0
        ? fix.speedMps
        : null,
    headingDeg:
      fix.headingDeg != null && Number.isFinite(fix.headingDeg) ? fix.headingDeg : null,
    flags: {
      poorAccuracy,
      discontinuity,
      duplicateOrStale: false,
    },
  };

  return { accepted: true, sample, distanceDeltaM };
}
