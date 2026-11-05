import { describe, expect, it } from 'vitest';
import { serverAdvanceRun, type ServerRunState } from '../src/server-run';
import { adjudicateConcurrentCaptures, createAdjudicationStore } from '../src/adjudication';
import { applyCaptureForDistrict } from '../src/district-gate';
import type { TerritorySlice } from '../src/types';
import {
  mockProductionEvidence,
  mockRejectedFinishZoneEvidence,
  mockSimulationEvidence,
} from '../../../tests/fixtures/evidence-bundles';
import { siliconValleyDevTerritories } from '../../../tests/fixtures/silicon-valley-dev-territories';
import { appendCloutLedgerEntry } from '@underground/domain';

const approved: TerritorySlice = {
  territoryDefinitionId: '11111111-1111-4111-8111-111111111199',
  districtSlug: 'monterey',
  status: 'approved',
  eligibleWeight: 20,
  version: 1,
};

const member = {
  id: '33333333-3333-4333-8333-333333333301',
  displayName: 'STARK',
};

function baseRun(partial?: Partial<ServerRunState>): ServerRunState {
  return {
    runId: mockProductionEvidence.runId,
    state: 'EVIDENCE_REVIEW',
    evidenceSource: 'production',
    seenEventKeys: new Map(),
    interrupted: false,
    ...partial,
  };
}

const ids = {
  ownershipEntryId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa11',
  cloutEntryId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb11',
  storyId: 'cccccccc-cccc-4ccc-8ccc-cccccccccc11',
};

describe('integration: server-authoritative pipeline', () => {
  it('rejects bad finish-line evidence and does not write ownership/newswire', () => {
    const result = serverAdvanceRun({
      run: baseRun({ runId: mockRejectedFinishZoneEvidence.runId }),
      to: 'ACCEPTED',
      idempotencyKey: 'int-reject-1',
      occurredAt: '2026-11-04T11:00:00.000Z',
      appEnv: 'production',
      evidence: mockRejectedFinishZoneEvidence,
      districtKind: 'production_candidate',
      territory: approved,
      currentOwnership: undefined,
      captureCommand: {
        territoryDefinitionId: approved.territoryDefinitionId,
        track: 'solo',
        challengerId: member.id,
        points: 10,
        idempotencyKey: 'cap-reject-1',
        isSimulation: false,
        allowProductionWrite: true,
      },
      ownershipLedger: [],
      cloutLedger: [],
      member,
      territoryMeta: { slug: 'test', name: 'Test Route' },
      ids,
    });
    expect(result.run.state).toBe('REJECTED');
    expect(result.errors).toContain('finish_zone_miss');
    expect(result.ownershipLedger).toHaveLength(0);
    expect(result.story).toBeNull();
  });

  it('hard-fails simulation into production ownership', () => {
    const result = serverAdvanceRun({
      run: baseRun({
        runId: mockSimulationEvidence.runId,
        evidenceSource: 'simulation',
      }),
      to: 'ACCEPTED',
      idempotencyKey: 'int-sim-1',
      occurredAt: '2026-11-04T11:00:00.000Z',
      appEnv: 'production',
      evidence: mockSimulationEvidence,
      allowSimulationAccept: false,
      districtKind: 'production_candidate',
      territory: approved,
      currentOwnership: undefined,
      captureCommand: {
        territoryDefinitionId: approved.territoryDefinitionId,
        track: 'solo',
        challengerId: member.id,
        points: 10,
        idempotencyKey: 'cap-sim-1',
        isSimulation: true,
        allowProductionWrite: false,
      },
      ownershipLedger: [],
      cloutLedger: [],
      member,
      territoryMeta: { slug: 'test', name: 'Test Route' },
      ids,
    });
    expect(result.run.state).toBe('REJECTED');
    expect(result.errors).toContain('simulation_not_allowed_for_production');
    expect(result.ownershipLedger).toHaveLength(0);
    expect(result.story).toBeNull();
  });

  it('blocks interrupted runs from accepting', () => {
    const result = serverAdvanceRun({
      run: baseRun({ interrupted: true }),
      to: 'ACCEPTED',
      idempotencyKey: 'int-interrupt-1',
      occurredAt: '2026-11-04T11:00:00.000Z',
      appEnv: 'production',
      evidence: mockProductionEvidence,
      districtKind: 'production_candidate',
      territory: approved,
      currentOwnership: undefined,
      captureCommand: {
        territoryDefinitionId: approved.territoryDefinitionId,
        track: 'solo',
        challengerId: member.id,
        points: 10,
        idempotencyKey: 'cap-int-1',
        isSimulation: false,
        allowProductionWrite: true,
      },
      ownershipLedger: [],
      cloutLedger: [],
      member,
      territoryMeta: { slug: 'test', name: 'Test Route' },
      ids,
    });
    expect(result.errors).toContain('interrupted_run_blocks_accept');
    expect(result.run.state).toBe('EVIDENCE_REVIEW');
  });

  it('accepts production evidence, emits newswire once, prevents duplicate CLOUT', () => {
    const first = serverAdvanceRun({
      run: baseRun(),
      to: 'ACCEPTED',
      idempotencyKey: 'int-ok-1',
      occurredAt: '2026-11-04T11:00:00.000Z',
      appEnv: 'production',
      evidence: mockProductionEvidence,
      districtKind: 'production_candidate',
      territory: approved,
      currentOwnership: undefined,
      captureCommand: {
        territoryDefinitionId: approved.territoryDefinitionId,
        track: 'solo',
        challengerId: member.id,
        points: 10,
        idempotencyKey: 'cap-ok-1',
        isSimulation: false,
        allowProductionWrite: true,
      },
      ownershipLedger: [],
      cloutLedger: [],
      member,
      territoryMeta: { slug: 'test', name: 'Test Route' },
      ids,
    });
    expect(first.run.state).toBe('ACCEPTED');
    expect(first.story?.templateId).toBe('capture_accepted_v1');
    expect(first.cloutLedger).toHaveLength(1);

    const dup = appendCloutLedgerEntry(first.cloutLedger, first.cloutLedger[0]!);
    expect(dup.result).toEqual({ ok: true, kind: 'noop_idempotent' });
    expect(dup.ledger).toHaveLength(1);
  });

  it('resolves simultaneous takeovers deterministically', () => {
    const store = createAdjudicationStore();
    const { store: next } = adjudicateConcurrentCaptures({
      store,
      territory: approved,
      commands: [
        {
          territoryDefinitionId: approved.territoryDefinitionId,
          track: 'solo',
          challengerId: 'm-z',
          points: 12,
          idempotencyKey: 'takeover-z',
          isSimulation: false,
          allowProductionWrite: true,
        },
        {
          territoryDefinitionId: approved.territoryDefinitionId,
          track: 'solo',
          challengerId: 'm-a',
          points: 15,
          idempotencyKey: 'takeover-a',
          isSimulation: false,
          allowProductionWrite: true,
        },
      ],
    });
    const owner = next.ownershipByKey.get(`solo:${approved.territoryDefinitionId}`);
    // takeover-a sorts before takeover-z; m-a captures first at 15, m-z cannot exceed
    expect(owner?.ownerId).toBe('m-a');
    expect(owner?.points).toBe(15);
  });

  it('blocks Silicon Valley development district from production ownership', () => {
    const territory = siliconValleyDevTerritories[0]!;
    const slice: TerritorySlice = {
      territoryDefinitionId: territory.id,
      districtSlug: territory.districtSlug,
      status: 'approved', // even if wrongly approved
      eligibleWeight: territory.eligibleWeight,
      version: territory.version,
    };
    const gated = applyCaptureForDistrict({
      districtKind: 'development',
      territory: slice,
      current: undefined,
      command: {
        territoryDefinitionId: territory.id,
        track: 'solo',
        challengerId: member.id,
        points: 10,
        idempotencyKey: 'sv-1',
        isSimulation: false,
        allowProductionWrite: true,
      },
      seenIdempotencyKeys: new Set(),
    });
    expect(gated).toEqual({ ok: false, error: 'development_district' });
  });

  it('treats replayed accept event as idempotent without second story', () => {
    const first = serverAdvanceRun({
      run: baseRun({ runId: '22222222-2222-4222-8222-222222222399' }),
      to: 'ACCEPTED',
      idempotencyKey: 'replay-1',
      occurredAt: '2026-11-04T11:00:00.000Z',
      appEnv: 'production',
      evidence: { ...mockProductionEvidence, runId: '22222222-2222-4222-8222-222222222399' },
      districtKind: 'production_candidate',
      territory: approved,
      currentOwnership: undefined,
      captureCommand: {
        territoryDefinitionId: approved.territoryDefinitionId,
        track: 'solo',
        challengerId: member.id,
        points: 10,
        idempotencyKey: 'cap-replay-1',
        isSimulation: false,
        allowProductionWrite: true,
      },
      ownershipLedger: [],
      cloutLedger: [],
      member,
      territoryMeta: { slug: 'test', name: 'Test Route' },
      ids: {
        ownershipEntryId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa22',
        cloutEntryId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb22',
        storyId: 'cccccccc-cccc-4ccc-8ccc-cccccccccc22',
      },
    });
    const second = serverAdvanceRun({
      run: first.run,
      to: 'ACCEPTED',
      idempotencyKey: 'replay-1',
      occurredAt: '2026-11-04T11:00:00.000Z',
      appEnv: 'production',
      evidence: { ...mockProductionEvidence, runId: '22222222-2222-4222-8222-222222222399' },
      districtKind: 'production_candidate',
      territory: approved,
      currentOwnership: {
        territoryDefinitionId: approved.territoryDefinitionId,
        track: 'solo',
        ownerId: member.id,
        points: 10,
      },
      captureCommand: {
        territoryDefinitionId: approved.territoryDefinitionId,
        track: 'solo',
        challengerId: member.id,
        points: 10,
        idempotencyKey: 'cap-replay-1',
        isSimulation: false,
        allowProductionWrite: true,
      },
      ownershipLedger: first.ownershipLedger,
      cloutLedger: first.cloutLedger,
      member,
      territoryMeta: { slug: 'test', name: 'Test Route' },
      ids: {
        ownershipEntryId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa23',
        cloutEntryId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb23',
        storyId: 'cccccccc-cccc-4ccc-8ccc-cccccccccc23',
      },
    });
    expect(second.story).toBeNull();
    expect(second.ownershipLedger).toHaveLength(1);
    expect(second.cloutLedger).toHaveLength(1);
  });
});
