import type { RunPipelineState } from './run';

const TRANSITIONS: Record<RunPipelineState, readonly RunPipelineState[]> = {
  CREATED: ['START_VERIFIED', 'REJECTED'],
  START_VERIFIED: ['RECORDING', 'REJECTED'],
  RECORDING: ['ROUTE_COMPLETE', 'REJECTED'],
  ROUTE_COMPLETE: ['FINISH_PENDING', 'REJECTED'],
  FINISH_PENDING: ['EVIDENCE_REVIEW', 'REJECTED'],
  EVIDENCE_REVIEW: ['ACCEPTED', 'REJECTED'],
  ACCEPTED: [],
  REJECTED: [],
};

export function canTransitionRun(
  from: RunPipelineState,
  to: RunPipelineState,
): boolean {
  return TRANSITIONS[from].includes(to);
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
