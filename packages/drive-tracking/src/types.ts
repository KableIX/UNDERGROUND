/**
 * Drive session + trip history contracts.
 * Local trips are private by default and never award ownership or CLOUT.
 * Territory capture remains server-authoritative and separate.
 */

export type DriveSessionStatus =
  | 'idle'
  | 'recording'
  | 'paused'
  | 'ended'
  | 'interrupted'
  | 'permission_denied'
  | 'unavailable';

/** Trip classification — local trips cannot self-promote to verified_capture. */
export type TripClassification = 'ordinary' | 'territory_attempt' | 'verified_capture';

export type GpsQualityBand = 'good' | 'fair' | 'poor' | 'unknown';

export type GpsSampleFlags = {
  /** Accuracy exceeded soft threshold; sample kept but excluded from distance. */
  poorAccuracy: boolean;
  /** Jump / impossible speed vs previous accepted sample. */
  discontinuity: boolean;
  /** Duplicate or non-monotonic timestamp relative to last stored sample. */
  duplicateOrStale: boolean;
};

/**
 * Raw GPS sample. Never fabricate coordinates — only store device-reported fixes.
 * Speed is private telemetry; do not publish to analytics or public feeds.
 */
export type GpsSample = {
  id: string;
  sessionId: string;
  /** Unix epoch ms from the location provider. */
  timestampMs: number;
  latitude: number;
  longitude: number;
  altitudeM: number | null;
  accuracyM: number | null;
  /** m/s from provider; private — never log or publish. */
  speedMps: number | null;
  headingDeg: number | null;
  flags: GpsSampleFlags;
};

export type SignalEventKind = 'signal_lost' | 'signal_recovered' | 'permission_lost' | 'app_interrupted';

export type SignalEvent = {
  id: string;
  sessionId: string;
  kind: SignalEventKind;
  atMs: number;
  detail?: string;
};

export type DriveSession = {
  id: string;
  status: DriveSessionStatus;
  classification: TripClassification;
  /** Optional garage vehicle id — local association only. */
  vehicleId: string | null;
  /** Optional curated route id when marking territory_attempt (no ownership). */
  curatedRouteId: string | null;
  /** Server run id once a capture is verified — never invent. */
  serverVerifiedRunId: string | null;
  startedAtMs: number | null;
  endedAtMs: number | null;
  /** Accumulated active recording ms (excludes paused intervals). */
  activeDurationMs: number;
  /** Distance from accepted segments only (meters). */
  distanceM: number;
  /** Coarse place labels — never reverse-geocode home precisely for publish. */
  startLabel: string | null;
  finishLabel: string | null;
  gpsQuality: GpsQualityBand;
  privacy: 'private';
  createdAtMs: number;
  updatedAtMs: number;
  /** Last sample timestamp successfully persisted. */
  lastSampleAtMs: number | null;
  interruptionCount: number;
};

export type TripSummary = {
  id: string;
  startedAtMs: number;
  endedAtMs: number | null;
  distanceM: number;
  durationMs: number;
  startLabel: string | null;
  finishLabel: string | null;
  vehicleId: string | null;
  gpsQuality: GpsQualityBand;
  classification: TripClassification;
  sampleCount: number;
  status: DriveSessionStatus;
};

/** Clean handoff for future server-side territory adjudication. */
export type TerritoryEvidenceBundle = {
  localSessionId: string;
  classification: TripClassification;
  curatedRouteId: string | null;
  vehicleId: string | null;
  startedAtMs: number;
  endedAtMs: number;
  distanceM: number;
  activeDurationMs: number;
  sampleCount: number;
  /** Ordered samples excluding duplicate/stale; discontinuities flagged in place. */
  samples: ReadonlyArray<{
    timestampMs: number;
    latitude: number;
    longitude: number;
    altitudeM: number | null;
    accuracyM: number | null;
    discontinuity: boolean;
    poorAccuracy: boolean;
  }>;
  signalEvents: ReadonlyArray<Pick<SignalEvent, 'kind' | 'atMs'>>;
  /**
   * Explicit non-claims — client never asserts ownership or CLOUT.
   * Server must re-validate geometry, route membership, and evidence.
   */
  clientClaims: {
    awardsOwnership: false;
    awardsClout: false;
    isServerAuthoritative: false;
    publishesRoute: false;
  };
};

export type ReplayCursor = {
  /** Progress 0..1 along active duration. */
  progress: number;
  /** Interpolated position between real adjacent samples only. */
  latitude: number;
  longitude: number;
  /** Distance covered up to this cursor (accepted segments). */
  distanceM: number;
  /** Elapsed active ms represented by cursor. */
  elapsedMs: number;
  sampleIndex: number;
};

export type IngestResult =
  | { accepted: true; sample: GpsSample; distanceDeltaM: number }
  | {
      accepted: false;
      reason: 'invalid_coords' | 'duplicate_or_stale' | 'session_not_recording' | 'cap_reached';
    };
