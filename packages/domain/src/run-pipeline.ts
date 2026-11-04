import type { EvidenceSource, RunPipelineState } from './run';
import { canWriteProductionOwnership } from './run';

/** Legal directed edges for the verified run pipeline. */
export const RUN_TRANSITIONS: Record<RunPipelineState, readonly RunPipelineState[]> = {
  CREATED: ['START_VERIFIED', 'REJECTED'],
  START_VERIFIED: ['RECORDING', 'REJECTED'],
  RECORDING: ['ROUTE_COMPLETE', 'REJECTED'],
  ROUTE_COMPLETE: ['FINISH_PENDING', 'REJECTED'],
  FINISH_PENDING: ['EVIDENCE_REVIEW', 'REJECTED'],
  EVIDENCE_REVIEW: ['ACCEPTED', 'REJECTED'],
  ACCEPTED: [],
  REJECTED: [],
};

export const RUN_PIPELINE_STATES = Object.keys(RUN_TRANSITIONS) as RunPipelineState[];

export function canTransitionRun(from: RunPipelineState, to: RunPipelineState): boolean {
  return RUN_TRANSITIONS[from].includes(to);
}

export function transitionRun(
  from: RunPipelineState,
  to: RunPipelineState,
): { ok: true; state: RunPipelineState } | { ok: false; error: 'invalid_transition' } {
  if (!canTransitionRun(from, to)) {
    return { ok: false, error: 'invalid_transition' };
  }
  return { ok: true, state: to };
}

export type RunEvent = {
  runId: string;
  from: RunPipelineState;
  to: RunPipelineState;
  evidenceSource: EvidenceSource;
  idempotencyKey: string;
  occurredAt: string;
};

export type ProcessedRunEvent =
  | {
      ok: true;
      kind: 'applied' | 'noop_idempotent';
      state: RunPipelineState;
      ownershipWriteAllowed: boolean;
    }
  | {
      ok: false;
      error: 'invalid_transition' | 'terminal_state' | 'duplicate_conflict';
    };

/**
 * Idempotent run-event processor (pure).
 * Same idempotency key with same to-state ⇒ noop; conflicting to-state ⇒ error.
 */
export function processRunEvent(input: {
  currentState: RunPipelineState;
  event: RunEvent;
  seen: ReadonlyMap<string, RunPipelineState>;
  appEnv: 'development' | 'staging' | 'production';
}): ProcessedRunEvent {
  const prior = input.seen.get(input.event.idempotencyKey);
  if (prior !== undefined) {
    if (prior === input.event.to) {
      return {
        ok: true,
        kind: 'noop_idempotent',
        state: input.currentState,
        ownershipWriteAllowed: false,
      };
    }
    return { ok: false, error: 'duplicate_conflict' };
  }

  if (input.currentState === 'ACCEPTED' || input.currentState === 'REJECTED') {
    return { ok: false, error: 'terminal_state' };
  }

  if (input.event.from !== input.currentState) {
    return { ok: false, error: 'invalid_transition' };
  }

  const transition = transitionRun(input.event.from, input.event.to);
  if (!transition.ok) {
    return { ok: false, error: 'invalid_transition' };
  }

  const ownershipWriteAllowed =
    transition.state === 'ACCEPTED' &&
    canWriteProductionOwnership(input.event.evidenceSource, input.appEnv);

  return {
    ok: true,
    kind: 'applied',
    state: transition.state,
    ownershipWriteAllowed,
  };
}

/** Happy-path sequence used by tests and docs. */
export const HAPPY_PATH: readonly RunPipelineState[] = [
  'CREATED',
  'START_VERIFIED',
  'RECORDING',
  'ROUTE_COMPLETE',
  'FINISH_PENDING',
  'EVIDENCE_REVIEW',
  'ACCEPTED',
] as const;
