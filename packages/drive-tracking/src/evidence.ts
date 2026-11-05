import type { SessionEngineState } from './session';
import type { TerritoryEvidenceBundle } from './types';

/**
 * Build a handoff bundle for the territory engine / API.
 * Explicitly asserts no ownership or CLOUT from the client.
 * Speed is stripped — private telemetry never leaves the device via this path.
 */
export function buildTerritoryEvidenceBundle(
  state: SessionEngineState,
): TerritoryEvidenceBundle | null {
  const { session, samples, events } = state;
  if (!session.startedAtMs || !session.endedAtMs) return null;
  if (session.status !== 'ended') return null;

  return {
    localSessionId: session.id,
    classification: session.classification,
    curatedRouteId: session.curatedRouteId,
    vehicleId: session.vehicleId,
    startedAtMs: session.startedAtMs,
    endedAtMs: session.endedAtMs,
    distanceM: session.distanceM,
    activeDurationMs: session.activeDurationMs,
    sampleCount: samples.length,
    samples: samples
      .filter(s => !s.flags.duplicateOrStale)
      .map(s => ({
        timestampMs: s.timestampMs,
        latitude: s.latitude,
        longitude: s.longitude,
        altitudeM: s.altitudeM,
        accuracyM: s.accuracyM,
        discontinuity: s.flags.discontinuity,
        poorAccuracy: s.flags.poorAccuracy,
      })),
    signalEvents: events.map(e => ({ kind: e.kind, atMs: e.atMs })),
    clientClaims: {
      awardsOwnership: false,
      awardsClout: false,
      isServerAuthoritative: false,
      publishesRoute: false,
    },
  };
}

/** Production capture remains gated — local ordinary trips are never production evidence. */
export function isEligibleAsProductionCaptureEvidence(
  bundle: TerritoryEvidenceBundle,
): { ok: false; reason: string } | { ok: true } {
  if (bundle.classification === 'ordinary') {
    return { ok: false, reason: 'ordinary_trip_not_capture_evidence' };
  }
  if (bundle.clientClaims.awardsOwnership || bundle.clientClaims.awardsClout) {
    return { ok: false, reason: 'client_must_not_claim_rewards' };
  }
  if (!bundle.curatedRouteId && bundle.classification === 'territory_attempt') {
    return { ok: false, reason: 'territory_attempt_requires_curated_route' };
  }
  if (bundle.sampleCount < 2) {
    return { ok: false, reason: 'insufficient_samples' };
  }
  // Even territory_attempt / verified_capture bundles require server re-validation.
  return { ok: true };
}
