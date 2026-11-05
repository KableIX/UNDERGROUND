import { describe, expect, it } from 'vitest';
import { recoverOfflineSession } from '../src/offline-session';
import { buildSimGpsReplay, checkpointsAlongReplay } from '../src/sim-gps-replay';

describe('offline session recovery', () => {
  it('merges recoverable RECORDING sessions without gaps', () => {
    const result = recoverOfflineSession(
      {
        runId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa99',
        memberId: '11111111-1111-4111-8111-111111111111',
        pipelineState: 'RECORDING',
        lastCheckpointSeq: 1,
        bufferedPoints: [
          { t: 1000, lng: -121.96, lat: 37.35 },
          { t: 2000, lng: -121.95, lat: 37.35 },
        ],
        interruptedAt: 2500,
      },
      [{ t: 3000, lng: -121.94, lat: 37.35 }],
      4000,
    );
    expect(result.status).toBe('recoverable');
    expect(result.mergedPoints).toHaveLength(3);
    expect(result.resumeState).toBe('RECORDING');
  });

  it('forces evidence review on large GPS gaps', () => {
    const result = recoverOfflineSession(
      {
        runId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa99',
        memberId: '11111111-1111-4111-8111-111111111111',
        pipelineState: 'RECORDING',
        lastCheckpointSeq: 0,
        bufferedPoints: [{ t: 1000, lng: -121.96, lat: 37.35 }],
        interruptedAt: 2000,
      },
      [{ t: 200_000, lng: -121.94, lat: 37.35 }],
      210_000,
    );
    expect(result.status).toBe('force_evidence_review');
    expect(result.resumeState).toBe('EVIDENCE_REVIEW');
  });
});

describe('sim GPS replay', () => {
  it('builds deterministic SV replay with checkpoints', () => {
    const replay = buildSimGpsReplay({
      territorySlug: 'santa-clara-el-camino',
      coordinates: [
        [-121.96, 37.35],
        [-121.94, 37.35],
        [-121.92, 37.352],
      ],
      startMs: 1_000_000,
      stepMs: 1000,
    });
    expect(replay.evidenceSource).toBe('simulation');
    expect(replay.points).toHaveLength(3);
    expect(checkpointsAlongReplay(replay, 2)).toHaveLength(2);
  });
});
