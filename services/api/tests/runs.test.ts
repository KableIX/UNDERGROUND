import { describe, expect, it } from 'vitest';
import { createRunStore, handleRunTransition } from '../src/routes/runs';
import { loadEnv } from '../src/env';

const runId = '22222222-2222-4222-8222-222222222210';

describe('handleRunTransition API contract', () => {
  it('walks happy path and blocks sim ownership on ACCEPTED', () => {
    const env = loadEnv({ NODE_ENV: 'test', APP_ENV: 'production' });
    const store = createRunStore();
    const steps = [
      ['CREATED', 'START_VERIFIED'],
      ['START_VERIFIED', 'RECORDING'],
      ['RECORDING', 'ROUTE_COMPLETE'],
      ['ROUTE_COMPLETE', 'FINISH_PENDING'],
      ['FINISH_PENDING', 'EVIDENCE_REVIEW'],
      ['EVIDENCE_REVIEW', 'ACCEPTED'],
    ] as const;

    let last: ReturnType<typeof handleRunTransition> | undefined;
    steps.forEach(([from, to], index) => {
      last = handleRunTransition({
        env,
        store,
        raw: {
          runId,
          from,
          to,
          evidenceSource: 'simulation',
          idempotencyKey: `step-${index}`,
          occurredAt: '2026-11-04T00:00:00.000Z',
        },
      });
      expect(last.ok).toBe(true);
    });

    expect(last).toMatchObject({
      ok: true,
      state: 'ACCEPTED',
      ownershipWriteAllowed: false,
    });
  });

  it('rejects illegal transitions', () => {
    const env = loadEnv({ NODE_ENV: 'test', APP_ENV: 'production' });
    const store = createRunStore();
    const result = handleRunTransition({
      env,
      store,
      raw: {
        runId,
        from: 'CREATED',
        to: 'ACCEPTED',
        evidenceSource: 'production',
        idempotencyKey: 'bad',
        occurredAt: '2026-11-04T00:00:00.000Z',
      },
    });
    expect(result).toEqual({ ok: false, error: 'invalid_transition' });
  });
});
