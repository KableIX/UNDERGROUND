import { describe, expect, it } from 'vitest';
import { siliconValleyDevTerritories } from '../../../tests/fixtures/silicon-valley-dev-territories';
import { handleSimCapture } from '../src/routes/sim-capture';

describe('POST /v1/sim/capture handler', () => {
  it('publishes sim newswire for SV dev territory without ownership write', () => {
    const territory = siliconValleyDevTerritories[0]!;
    const result = handleSimCapture({
      territoryDefinitionId: territory.id,
      track: 'solo',
      memberId: '33333333-3333-4333-8333-333333333301',
      displayName: 'STARK',
      points: 10,
      runId: 'dddddddd-dddd-4ddd-8ddd-dddddddddd21',
      storyId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee21',
      idempotencyKey: 'api-sim-1',
      occurredAt: '2026-11-05T00:00:00.000Z',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.ownershipWriteAllowed).toBe(false);
    expect(result.story.templateId).toBe('sim_capture_v1');
    expect(result.story.isSimulation).toBe(true);
  });

  it('rejects unknown territory ids outside SV fixtures', () => {
    const result = handleSimCapture({
      territoryDefinitionId: '11111111-1111-4111-8111-111111111101',
      track: 'solo',
      memberId: '33333333-3333-4333-8333-333333333301',
      displayName: 'STARK',
      points: 10,
      runId: 'dddddddd-dddd-4ddd-8ddd-dddddddddd22',
      storyId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee22',
      idempotencyKey: 'api-sim-2',
      occurredAt: '2026-11-05T00:00:00.000Z',
    });
    expect(result).toEqual({ ok: false, error: 'territory_not_in_sv_dev_district' });
  });
});
