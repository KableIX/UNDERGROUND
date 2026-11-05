import { describe, expect, it } from 'vitest';
import { evaluateCaptureWorkflow, CAPTURE_WORKFLOW_ORDER } from '../src/capture-workflow';
import type { RunEvidenceBundle } from '../src/evidence';

const RUN = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa99';
const MEMBER = '11111111-1111-4111-8111-111111111111';
const TERRITORY = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01';

function bundle(source: 'production' | 'simulation'): RunEvidenceBundle {
  return {
    runId: RUN,
    source,
    startOdometer: {
      photoStoragePath: 'evidence/start.jpg',
      readingMiles: 10000,
      capturedAt: '2026-11-05T10:00:00.000Z',
      isPlaceholder: false,
    },
    endOdometer: {
      photoStoragePath: 'evidence/end.jpg',
      readingMiles: 10012,
      capturedAt: '2026-11-05T10:40:00.000Z',
      isPlaceholder: false,
    },
    finishLinePhoto: {
      photoStoragePath: 'evidence/finish.jpg',
      capturedAt: '2026-11-05T10:39:00.000Z',
      withinFinishZone: true,
      isPlaceholder: false,
    },
  };
}

describe('verified capture workflow', () => {
  it('lists full stage order', () => {
    expect(CAPTURE_WORKFLOW_ORDER).toHaveLength(12);
    expect(CAPTURE_WORKFLOW_ORDER[0]).toBe('odometer_start_photo');
    expect(CAPTURE_WORKFLOW_ORDER.at(-1)).toBe('archive');
  });

  it('completes SV development sim without ownership or CLOUT', () => {
    const result = evaluateCaptureWorkflow({
      runId: RUN,
      memberId: MEMBER,
      territoryDefinitionId: TERRITORY,
      districtKind: 'development',
      evidenceSource: 'simulation',
      productionCapturesEnabled: false,
      bundle: bundle('simulation'),
      checkpointsReached: 2,
      checkpointsRequired: 2,
      finishZoneOk: true,
      parkingWindowOk: true,
      pipelineState: 'RECORDING',
    });
    expect(result.ownershipWriteAllowed).toBe(false);
    expect(result.cloutDelta).toBe(0);
    expect(result.newswireEmitted).toBe(true);
    expect(result.archived).toBe(true);
    expect(result.blockedAt).toBeNull();
  });

  it('blocks production path when captures disabled', () => {
    const result = evaluateCaptureWorkflow({
      runId: RUN,
      memberId: MEMBER,
      territoryDefinitionId: TERRITORY,
      districtKind: 'production',
      evidenceSource: 'production',
      productionCapturesEnabled: false,
      bundle: bundle('production'),
      checkpointsReached: 3,
      checkpointsRequired: 3,
      finishZoneOk: true,
      parkingWindowOk: true,
      pipelineState: 'EVIDENCE_REVIEW',
    });
    expect(result.ownershipWriteAllowed).toBe(false);
    expect(result.cloutDelta).toBe(0);
    expect(result.blockReason).toContain('production_captures_disabled');
  });

  it('rejects checkpoint miss', () => {
    const result = evaluateCaptureWorkflow({
      runId: RUN,
      memberId: MEMBER,
      territoryDefinitionId: TERRITORY,
      districtKind: 'development',
      evidenceSource: 'simulation',
      productionCapturesEnabled: false,
      bundle: bundle('simulation'),
      checkpointsReached: 0,
      checkpointsRequired: 2,
      finishZoneOk: true,
      parkingWindowOk: true,
      pipelineState: 'RECORDING',
    });
    expect(result.blockedAt).toBe('checkpoints');
  });
});
