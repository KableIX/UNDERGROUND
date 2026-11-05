import { describe, expect, it } from 'vitest';
import { allowsProductionOwnership, canWriteProductionOwnership } from '@underground/domain';
import { applyCaptureForDistrict } from '@underground/territory-engine';
import { siliconValleyDevTerritories } from '../data/silicon-valley-dev';
import { draftMontereyTerritories } from '../data/monterey-draft';
import { runSimCaptureWorkflow } from './sim-workflow';

describe('conquest v2 integrity gates', () => {
  it('blocks production ownership from simulation evidence', () => {
    expect(canWriteProductionOwnership('simulation', 'production')).toBe(false);
    expect(canWriteProductionOwnership('production', 'production')).toBe(true);
  });

  it('blocks production captures on SV development district', () => {
    expect(allowsProductionOwnership('development')).toBe(false);
    const territory = siliconValleyDevTerritories[0]!;
    const gate = applyCaptureForDistrict({
      districtKind: 'development',
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
        challengerId: '33333333-3333-4333-8333-333333333301',
        points: 10,
        idempotencyKey: 'test-key-1',
        isSimulation: false,
        allowProductionWrite: true,
      },
      seenIdempotencyKeys: new Set(),
    });
    expect(gate).toEqual({ ok: false, error: 'development_district' });
  });

  it('keeps Monterey draft and SV sim newswire without ownership', () => {
    expect(draftMontereyTerritories.every((t) => t.status === 'draft')).toBe(true);
    const territory = siliconValleyDevTerritories[0]!;
    const result = runSimCaptureWorkflow({
      territory,
      track: 'solo',
      challengerId: '33333333-3333-4333-8333-333333333301',
      displayName: 'STARK',
      points: 10,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.ownershipWriteAllowed).toBe(false);
      expect(result.story.cloutDelta).toBe(0);
    }
  });
});
