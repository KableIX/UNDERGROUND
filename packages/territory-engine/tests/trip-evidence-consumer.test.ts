import { describe, expect, it } from 'vitest';
import { intakeLocalTripEvidence } from '../src/trip-evidence-consumer';

describe('trip evidence consumer', () => {
  const claims = {
    awardsOwnership: false as const,
    awardsClout: false as const,
    isServerAuthoritative: false as const,
    publishesRoute: false as const,
  };

  it('rejects ordinary local trips and never mutates ownership', () => {
    const result = intakeLocalTripEvidence({
      localSessionId: 't1',
      classification: 'ordinary',
      curatedRouteId: null,
      sampleCount: 10,
      clientClaims: claims,
    });
    expect(result.acceptForReview).toBe(false);
  });

  it('accepts territory_attempt for review only', () => {
    const result = intakeLocalTripEvidence({
      localSessionId: 't2',
      classification: 'territory_attempt',
      curatedRouteId: 'route-1',
      sampleCount: 10,
      clientClaims: claims,
    });
    expect(result.acceptForReview).toBe(true);
    if (result.acceptForReview) {
      expect(result.ownershipMutation).toBe('none');
      expect(result.cloutMutation).toBe('none');
      expect(result.nextPipelineHint).toBe('EVIDENCE_REVIEW');
    }
  });
});
