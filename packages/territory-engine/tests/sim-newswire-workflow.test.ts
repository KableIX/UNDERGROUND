import { describe, expect, it } from 'vitest';
import { siliconValleyDevTerritories } from '../../../tests/fixtures/silicon-valley-dev-territories';
import { draftMontereyTerritories } from '../../../tests/fixtures/monterey-draft-territories';
import { runSimTerritoryCaptureToNewswire } from '../src/sim-newswire-workflow';

describe('sim capture → newswire workflow', () => {
  it('emits sim story for SV development district without ownership write', () => {
    const territory = siliconValleyDevTerritories[0]!;
    const result = runSimTerritoryCaptureToNewswire({
      districtKind: 'development',
      territory: {
        territoryDefinitionId: territory.id,
        districtSlug: territory.districtSlug,
        status: territory.status,
        eligibleWeight: territory.eligibleWeight,
        version: territory.version,
      },
      territoryMeta: { slug: territory.slug, name: territory.name },
      track: 'solo',
      member: {
        id: '33333333-3333-4333-8333-333333333301',
        displayName: 'STARK',
      },
      points: 10,
      runId: 'dddddddd-dddd-4ddd-8ddd-dddddddddd11',
      storyId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee11',
      idempotencyKey: 'sim-workflow-1',
      occurredAt: '2026-11-05T00:00:00.000Z',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.ownershipWriteAllowed).toBe(false);
    expect(result.story.templateId).toBe('sim_capture_v1');
    expect(result.story.cloutDelta).toBe(0);
    expect(result.districtGate).toBe('development_district');
  });

  it('rejects non-development districts', () => {
    const territory = draftMontereyTerritories[0]!;
    const result = runSimTerritoryCaptureToNewswire({
      districtKind: 'production_candidate',
      territory: {
        territoryDefinitionId: territory.id,
        districtSlug: territory.districtSlug,
        status: territory.status,
        eligibleWeight: territory.eligibleWeight,
        version: territory.version,
      },
      territoryMeta: { slug: territory.slug, name: territory.name },
      track: 'solo',
      member: {
        id: '33333333-3333-4333-8333-333333333301',
        displayName: 'STARK',
      },
      points: 10,
      runId: 'dddddddd-dddd-4ddd-8ddd-dddddddddd12',
      storyId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee12',
      idempotencyKey: 'sim-workflow-2',
      occurredAt: '2026-11-05T00:00:00.000Z',
    });
    expect(result).toEqual({
      ok: false,
      error: 'sim_workflow_requires_development_district',
    });
  });
});
