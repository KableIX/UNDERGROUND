import { applyCapture } from './capture';
import { rememberIdempotencyKey } from './idempotency';
import type { CaptureCommand, CaptureResult, OwnershipSlice, TerritorySlice } from './types';

export type AdjudicationStore = {
  ownershipByKey: Map<string, OwnershipSlice>;
  seenIdempotencyKeys: Set<string>;
  /** Ordered log of applied capture results for audit/tests. */
  applied: Array<{ command: CaptureCommand; result: Extract<CaptureResult, { ok: true }> }>;
};

export function createAdjudicationStore(): AdjudicationStore {
  return {
    ownershipByKey: new Map(),
    seenIdempotencyKeys: new Set(),
    applied: [],
  };
}

function ownershipKey(territoryDefinitionId: string, track: string): string {
  return `${track}:${territoryDefinitionId}`;
}

/**
 * Serial (transactional stub) adjudication of concurrent capture commands.
 * Commands are sorted by idempotencyKey for deterministic conflict resolution
 * when submitted as a concurrent batch with the same logical arrival window.
 */
export function adjudicateConcurrentCaptures(input: {
  store: AdjudicationStore;
  territory: TerritorySlice;
  commands: readonly CaptureCommand[];
}): {
  store: AdjudicationStore;
  results: CaptureResult[];
} {
  const ordered = [...input.commands].sort((a, b) =>
    a.idempotencyKey.localeCompare(b.idempotencyKey),
  );

  const next: AdjudicationStore = {
    ownershipByKey: new Map(input.store.ownershipByKey),
    seenIdempotencyKeys: new Set(input.store.seenIdempotencyKeys),
    applied: [...input.store.applied],
  };

  const results: CaptureResult[] = [];

  for (const command of ordered) {
    const key = ownershipKey(command.territoryDefinitionId, command.track);
    const current = next.ownershipByKey.get(key);
    const result = applyCapture({
      territory: input.territory,
      current,
      command,
      seenIdempotencyKeys: next.seenIdempotencyKeys,
    });
    results.push(result);

    if (!result.ok) continue;

    next.seenIdempotencyKeys = rememberIdempotencyKey(
      next.seenIdempotencyKeys,
      command.idempotencyKey,
    );

    if (result.kind === 'noop_idempotent') continue;

    next.ownershipByKey.set(key, {
      territoryDefinitionId: command.territoryDefinitionId,
      track: command.track,
      ownerId: result.ownerId,
      points: result.points,
    });
    next.applied.push({ command, result });
  }

  return { store: next, results };
}
