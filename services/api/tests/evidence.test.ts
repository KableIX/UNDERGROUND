import { describe, expect, it } from 'vitest';
import { handleEvidenceReview } from '../src/routes/evidence';
import {
  mockProductionEvidence,
  mockRejectedFinishZoneEvidence,
  mockSimulationEvidence,
} from '../../../tests/fixtures/evidence-bundles';

describe('handleEvidenceReview', () => {
  it('accepts production mock evidence', () => {
    const result = handleEvidenceReview({
      bundle: mockProductionEvidence,
      allowSimulationAccept: false,
    });
    expect(result).toEqual({ ok: true, decision: 'ACCEPTED' });
  });

  it('rejects finish zone miss', () => {
    const result = handleEvidenceReview({
      bundle: mockRejectedFinishZoneEvidence,
      allowSimulationAccept: false,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('finish_zone_miss');
  });

  it('rejects simulation for production path', () => {
    const result = handleEvidenceReview({
      bundle: mockSimulationEvidence,
      allowSimulationAccept: false,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('simulation_not_allowed_for_production');
  });
});
