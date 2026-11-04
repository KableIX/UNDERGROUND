import { describe, expect, it } from 'vitest';
import { reviewEvidenceBundle } from '../src/evidence';
import {
  mockProductionEvidence,
  mockSimulationEvidence,
} from '../../../tests/fixtures/evidence-bundles';

describe('reviewEvidenceBundle', () => {
  it('accepts consistent production evidence', () => {
    expect(
      reviewEvidenceBundle(mockProductionEvidence, { allowSimulationAccept: false }),
    ).toEqual({ ok: true, decision: 'ACCEPTED' });
  });

  it('rejects simulation unless explicitly allowed', () => {
    expect(
      reviewEvidenceBundle(mockSimulationEvidence, { allowSimulationAccept: false }).ok,
    ).toBe(false);
  });
});
