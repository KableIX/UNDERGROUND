import {
  processRunEvent,
  type EvidenceSource,
  type RunPipelineState,
} from '@underground/domain';
import { z } from 'zod';
import type { RuntimeEnv } from '../env';

export const RunTransitionRequestSchema = z.object({
  runId: z.string().uuid(),
  from: z.enum([
    'CREATED',
    'START_VERIFIED',
    'RECORDING',
    'ROUTE_COMPLETE',
    'FINISH_PENDING',
    'EVIDENCE_REVIEW',
    'ACCEPTED',
    'REJECTED',
  ]),
  to: z.enum([
    'CREATED',
    'START_VERIFIED',
    'RECORDING',
    'ROUTE_COMPLETE',
    'FINISH_PENDING',
    'EVIDENCE_REVIEW',
    'ACCEPTED',
    'REJECTED',
  ]),
  evidenceSource: z.enum(['production', 'simulation']),
  idempotencyKey: z.string().min(1),
  occurredAt: z.string().datetime(),
});

/** In-memory run store for API contract tests until Supabase is wired. */
export type RunStore = {
  states: Map<string, RunPipelineState>;
  seen: Map<string, RunPipelineState>;
};

export function createRunStore(): RunStore {
  return { states: new Map(), seen: new Map() };
}

export function handleRunTransition(input: {
  env: RuntimeEnv;
  store: RunStore;
  raw: unknown;
}) {
  const request = RunTransitionRequestSchema.parse(input.raw);
  const currentState = input.store.states.get(request.runId) ?? 'CREATED';

  const processed = processRunEvent({
    currentState,
    event: {
      runId: request.runId,
      from: request.from as RunPipelineState,
      to: request.to as RunPipelineState,
      evidenceSource: request.evidenceSource as EvidenceSource,
      idempotencyKey: request.idempotencyKey,
      occurredAt: request.occurredAt,
    },
    seen: input.store.seen,
    appEnv: input.env.APP_ENV,
  });

  if (!processed.ok) {
    return { ok: false as const, error: processed.error };
  }

  if (processed.kind === 'applied') {
    input.store.states.set(request.runId, processed.state);
    input.store.seen.set(request.idempotencyKey, processed.state);
  }

  return {
    ok: true as const,
    kind: processed.kind,
    state: processed.state,
    ownershipWriteAllowed: processed.ownershipWriteAllowed,
  };
}
