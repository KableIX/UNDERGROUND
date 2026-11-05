import { describe, expect, it } from 'vitest';
import {
  HAPPY_PATH,
  RUN_PIPELINE_STATES,
  RUN_TRANSITIONS,
  canTransitionRun,
  processRunEvent,
  transitionRun,
} from '../src/run-pipeline';
import type { RunPipelineState } from '../src/run';

describe('run pipeline state machine', () => {
  it('allows the happy path to ACCEPTED', () => {
    let state: RunPipelineState = 'CREATED';
    for (let i = 1; i < HAPPY_PATH.length; i += 1) {
      const next = HAPPY_PATH[i]!;
      const result = transitionRun(state, next);
      expect(result.ok).toBe(true);
      if (result.ok) state = result.state;
    }
    expect(state).toBe('ACCEPTED');
  });

  it('enumerates only legal transitions for every state', () => {
    const all = RUN_PIPELINE_STATES;
    for (const from of all) {
      for (const to of all) {
        const legal = RUN_TRANSITIONS[from].includes(to);
        expect(canTransitionRun(from, to)).toBe(legal);
        expect(transitionRun(from, to).ok).toBe(legal);
      }
    }
  });

  it('rejects skipping evidence review and backward jumps', () => {
    expect(transitionRun('RECORDING', 'ACCEPTED')).toEqual({
      ok: false,
      error: 'invalid_transition',
    });
    expect(transitionRun('EVIDENCE_REVIEW', 'RECORDING')).toEqual({
      ok: false,
      error: 'invalid_transition',
    });
    expect(transitionRun('ACCEPTED', 'REJECTED')).toEqual({
      ok: false,
      error: 'invalid_transition',
    });
  });

  it('allows REJECTED from every non-terminal state', () => {
    for (const from of RUN_PIPELINE_STATES) {
      if (from === 'ACCEPTED' || from === 'REJECTED') {
        expect(canTransitionRun(from, 'REJECTED')).toBe(false);
      } else {
        expect(canTransitionRun(from, 'REJECTED')).toBe(true);
      }
    }
  });

  it('processRunEvent is idempotent and blocks sim ownership writes', () => {
    const event = {
      runId: '22222222-2222-4222-8222-222222222201',
      from: 'EVIDENCE_REVIEW' as const,
      to: 'ACCEPTED' as const,
      evidenceSource: 'simulation' as const,
      idempotencyKey: 'evt-1',
      occurredAt: '2026-11-04T00:00:00.000Z',
    };
    const first = processRunEvent({
      currentState: 'EVIDENCE_REVIEW',
      event,
      seen: new Map(),
      appEnv: 'production',
    });
    expect(first.ok).toBe(true);
    if (first.ok) {
      expect(first.kind).toBe('applied');
      expect(first.ownershipWriteAllowed).toBe(false);
    }

    const second = processRunEvent({
      currentState: 'ACCEPTED',
      event,
      seen: new Map([['evt-1', 'ACCEPTED']]),
      appEnv: 'production',
    });
    expect(second).toMatchObject({ ok: true, kind: 'noop_idempotent' });
  });

  it('processRunEvent flags duplicate conflict on key reuse with different target', () => {
    const result = processRunEvent({
      currentState: 'EVIDENCE_REVIEW',
      event: {
        runId: '22222222-2222-4222-8222-222222222201',
        from: 'EVIDENCE_REVIEW',
        to: 'REJECTED',
        evidenceSource: 'production',
        idempotencyKey: 'evt-1',
        occurredAt: '2026-11-04T00:00:00.000Z',
      },
      seen: new Map([['evt-1', 'ACCEPTED']]),
      appEnv: 'production',
    });
    expect(result).toEqual({ ok: false, error: 'duplicate_conflict' });
  });
});
