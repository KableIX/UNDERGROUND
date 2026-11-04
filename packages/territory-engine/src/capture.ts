import type { CaptureCommand, CaptureResult, OwnershipSlice, TerritorySlice } from './types';
import { hasSeenIdempotencyKey } from './idempotency';

/**
 * Pure capture transition. Does not mutate inputs.
 * Draft territories reject production captures.
 * Simulation evidence is hard-gated from production ownership writes.
 */
export function applyCapture(input: {
  territory: TerritorySlice | undefined;
  current: OwnershipSlice | undefined;
  command: CaptureCommand;
  seenIdempotencyKeys: ReadonlySet<string>;
}): CaptureResult {
  const { territory, current, command, seenIdempotencyKeys } = input;

  if (!territory || territory.territoryDefinitionId !== command.territoryDefinitionId) {
    return { ok: false, error: 'territory_not_found' };
  }

  if (territory.status === 'draft' || territory.status === 'retired') {
    return { ok: false, error: 'draft_territory' };
  }

  if (command.isSimulation || !command.allowProductionWrite) {
    return { ok: false, error: 'simulation_blocked' };
  }

  if (!Number.isFinite(command.points) || command.points <= 0) {
    return { ok: false, error: 'invalid_points' };
  }

  if (hasSeenIdempotencyKey(seenIdempotencyKeys, command.idempotencyKey)) {
    return {
      ok: true,
      kind: 'noop_idempotent',
      previousOwnerId: current?.ownerId ?? null,
      ownerId: current?.ownerId ?? command.challengerId,
      points: current?.points ?? command.points,
      ledgerReason: 'capture',
    };
  }

  const previousOwnerId = current?.ownerId ?? null;
  const previousPoints = current?.points ?? 0;

  if (previousOwnerId === null) {
    return {
      ok: true,
      kind: 'capture',
      previousOwnerId: null,
      ownerId: command.challengerId,
      points: command.points,
      ledgerReason: 'capture',
    };
  }

  if (previousOwnerId === command.challengerId) {
    return {
      ok: true,
      kind: 'defense',
      previousOwnerId,
      ownerId: command.challengerId,
      points: previousPoints + command.points,
      ledgerReason: 'defense',
    };
  }

  if (command.points > previousPoints) {
    return {
      ok: true,
      kind: 'takeover',
      previousOwnerId,
      ownerId: command.challengerId,
      points: command.points,
      ledgerReason: 'takeover',
    };
  }

  // Challenger does not exceed current points — owner retains with challenge recorded.
  return {
    ok: true,
    kind: 'defense',
    previousOwnerId,
    ownerId: previousOwnerId,
    points: previousPoints,
    ledgerReason: 'challenge',
  };
}
