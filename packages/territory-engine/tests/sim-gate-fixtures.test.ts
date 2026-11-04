import { describe, expect, it } from 'vitest';
import {
  assertSimCannotWriteProduction,
  simRunFixture,
} from '../../../tests/fixtures/sim-captures';
import { draftMontereyTerritories } from '../../../tests/fixtures/monterey-draft-territories';
import { applyCapture } from '../src/capture';

describe('sim fixtures hard-gate', () => {
  it('marks sim run evidence as simulation', () => {
    expect(simRunFixture.evidenceSource).toBe('simulation');
    expect(() => assertSimCannotWriteProduction(simRunFixture.evidenceSource)).toThrow(
      /HARD_GATE/,
    );
  });

  it('seeds seven draft Monterey territories', () => {
    expect(draftMontereyTerritories).toHaveLength(7);
    expect(draftMontereyTerritories.every((t) => t.status === 'draft')).toBe(true);
    expect(
      draftMontereyTerritories.every((t) => t.geometryLabel.includes('DRAFT')),
    ).toBe(true);
  });

  it('engine rejects capture against draft seed', () => {
    const territory = draftMontereyTerritories[0]!;
    const result = applyCapture({
      territory: {
        territoryDefinitionId: territory.id,
        districtSlug: territory.districtSlug,
        status: territory.status,
        eligibleWeight: territory.eligibleWeight,
        version: territory.version,
      },
      current: undefined,
      command: {
        territoryDefinitionId: territory.id,
        track: 'solo',
        challengerId: 'm1',
        points: 10,
        idempotencyKey: 'sim-k',
        isSimulation: false,
        allowProductionWrite: true,
      },
      seenIdempotencyKeys: new Set(),
    });
    expect(result).toEqual({ ok: false, error: 'draft_territory' });
  });
});
