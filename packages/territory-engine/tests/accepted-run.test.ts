import { describe, expect, it } from 'vitest';
import { materializeAcceptedRun } from '../src/accepted-run';
import type { TerritorySlice } from '../src/types';
import { SIM_CAMERA_EVIDENCE } from '../../../tests/fixtures/sim-evidence';

const approved: TerritorySlice = {
  territoryDefinitionId: '11111111-1111-4111-8111-111111111101',
  districtSlug: 'monterey',
  status: 'approved',
  eligibleWeight: 20,
  version: 1,
};

const member = {
  id: '33333333-3333-4333-8333-333333333301',
  displayName: 'STARK',
};

describe('materializeAcceptedRun', () => {
  it('hard-gates simulation evidence from production ownership and skips clout/story', () => {
    const result = materializeAcceptedRun({
      currentState: 'EVIDENCE_REVIEW',
      event: {
        runId: '22222222-2222-4222-8222-222222222201',
        from: 'EVIDENCE_REVIEW',
        to: 'ACCEPTED',
        evidenceSource: SIM_CAMERA_EVIDENCE.source,
        idempotencyKey: 'run-evt-sim',
        occurredAt: '2026-11-04T00:00:00.000Z',
      },
      seenRunKeys: new Map(),
      appEnv: 'production',
      territory: approved,
      currentOwnership: undefined,
      captureCommand: {
        territoryDefinitionId: approved.territoryDefinitionId,
        track: 'solo',
        challengerId: member.id,
        points: 10,
        idempotencyKey: 'cap-sim',
        isSimulation: true,
        allowProductionWrite: false,
      },
      ownershipLedger: [],
      cloutLedger: [],
      member,
      territoryMeta: { slug: 'highway-1-big-sur', name: 'Highway 1 / Big Sur' },
      ids: {
        ownershipEntryId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
        cloutEntryId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
        storyId: 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
      },
    });

    expect(result.runState).toBe('ACCEPTED');
    expect(result.ownershipWriteAllowed).toBe(false);
    expect(result.ownershipLedger).toHaveLength(0);
    expect(result.cloutLedger).toHaveLength(0);
    expect(result.story).toBeNull();
    expect(result.capture).toEqual({ ok: false, error: 'simulation_blocked' });
  });

  it('on production ACCEPTED appends ownership, CLOUT, and newswire story', () => {
    const result = materializeAcceptedRun({
      currentState: 'EVIDENCE_REVIEW',
      event: {
        runId: '22222222-2222-4222-8222-222222222202',
        from: 'EVIDENCE_REVIEW',
        to: 'ACCEPTED',
        evidenceSource: 'production',
        idempotencyKey: 'run-evt-prod',
        occurredAt: '2026-11-04T00:00:00.000Z',
      },
      seenRunKeys: new Map(),
      appEnv: 'production',
      territory: approved,
      currentOwnership: undefined,
      captureCommand: {
        territoryDefinitionId: approved.territoryDefinitionId,
        track: 'solo',
        challengerId: member.id,
        points: 10,
        idempotencyKey: 'cap-prod',
        isSimulation: false,
        allowProductionWrite: true,
      },
      ownershipLedger: [],
      cloutLedger: [],
      member,
      territoryMeta: { slug: 'highway-1-big-sur', name: 'Highway 1 / Big Sur' },
      ids: {
        ownershipEntryId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
        cloutEntryId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
        storyId: 'cccccccc-cccc-4ccc-8ccc-ccccccccccc2',
      },
    });

    expect(result.ownershipWriteAllowed).toBe(true);
    expect(result.ownershipLedger).toHaveLength(1);
    expect(result.cloutLedger[0]?.delta).toBe(25);
    expect(result.story?.templateId).toBe('capture_accepted_v1');
    expect(result.story?.headline).toContain('STARK');
  });
});
