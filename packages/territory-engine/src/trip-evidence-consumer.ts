/**
 * Server-side consumer contract for local trip evidence.
 * Client bundles never award ownership or CLOUT — this module enforces that gate.
 */

export type ClientTripEvidenceClaims = {
  awardsOwnership: false;
  awardsClout: false;
  isServerAuthoritative: false;
  publishesRoute: false;
};

export type IncomingTripEvidence = {
  localSessionId: string;
  classification: 'ordinary' | 'territory_attempt' | 'verified_capture';
  curatedRouteId: string | null;
  sampleCount: number;
  clientClaims: ClientTripEvidenceClaims;
};

export type TripEvidenceIntakeResult =
  | { acceptForReview: false; reason: string }
  | {
      acceptForReview: true;
      /** Explicit: intake does not mutate ownership ledgers. */
      ownershipMutation: 'none';
      cloutMutation: 'none';
      nextPipelineHint: 'EVIDENCE_REVIEW';
    };

/**
 * Intake gate for future API wiring. Production capture restrictions preserved:
 * ordinary local drives are rejected; client reward claims are rejected.
 */
export function intakeLocalTripEvidence(bundle: IncomingTripEvidence): TripEvidenceIntakeResult {
  if (bundle.clientClaims.awardsOwnership || bundle.clientClaims.awardsClout) {
    return { acceptForReview: false, reason: 'client_reward_claim_forbidden' };
  }
  if (bundle.clientClaims.publishesRoute) {
    return { acceptForReview: false, reason: 'auto_publish_forbidden' };
  }
  if (bundle.classification === 'ordinary') {
    return { acceptForReview: false, reason: 'ordinary_local_trip' };
  }
  if (bundle.classification === 'territory_attempt' && !bundle.curatedRouteId) {
    return { acceptForReview: false, reason: 'missing_curated_route' };
  }
  if (bundle.sampleCount < 2) {
    return { acceptForReview: false, reason: 'insufficient_samples' };
  }
  return {
    acceptForReview: true,
    ownershipMutation: 'none',
    cloutMutation: 'none',
    nextPipelineHint: 'EVIDENCE_REVIEW',
  };
}
