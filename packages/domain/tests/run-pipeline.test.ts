import { describe, expect, it } from 'vitest';
import { transitionRun } from '../src/run-pipeline';

describe('run pipeline state machine', () => {
  it('allows the happy path to ACCEPTED', () => {
    const steps = [
      'START_VERIFIED',
      'RECORDING',
      'ROUTE_COMPLETE',
      'FINISH_PENDING',
      'EVIDENCE_REVIEW',
      'ACCEPTED',
    ] as const;
    let state: 'CREATED' | (typeof steps)[number] = 'CREATED';
    for (const next of steps) {
      const result = transitionRun(state, next);
      expect(result.ok).toBe(true);
      if (result.ok) state = result.state;
    }
    expect(state).toBe('ACCEPTED');
  });

  it('rejects skipping evidence review', () => {
    expect(transitionRun('RECORDING', 'ACCEPTED')).toEqual({
      ok: false,
      error: 'invalid_transition',
    });
  });
});
