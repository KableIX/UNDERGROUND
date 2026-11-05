import { describe, expect, it } from 'vitest';
import {
  adjudicateConcurrentCaptures,
  createAdjudicationStore,
} from '../src/adjudication';
import type { CaptureCommand, TerritorySlice } from '../src/types';

const approved: TerritorySlice = {
  territoryDefinitionId: 'terr-1',
  districtSlug: 'monterey',
  status: 'approved',
  eligibleWeight: 10,
  version: 1,
};

function cmd(partial: Partial<CaptureCommand> & Pick<CaptureCommand, 'challengerId' | 'idempotencyKey' | 'points'>): CaptureCommand {
  return {
    territoryDefinitionId: 'terr-1',
    track: 'solo',
    isSimulation: false,
    allowProductionWrite: true,
    ...partial,
  };
}

describe('concurrent capture adjudication', () => {
  it('resolves conflicting concurrent claims deterministically by idempotency key order', () => {
    const store = createAdjudicationStore();
    const { store: next, results } = adjudicateConcurrentCaptures({
      store,
      territory: approved,
      commands: [
        cmd({ challengerId: 'm-b', points: 8, idempotencyKey: 'k-b' }),
        cmd({ challengerId: 'm-a', points: 5, idempotencyKey: 'k-a' }),
      ],
    });

    expect(results).toHaveLength(2);
    expect(results.every((r) => r.ok)).toBe(true);
    // k-a sorts before k-b → m-a captures first, then m-b takeovers with higher points
    const ownership = next.ownershipByKey.get('solo:terr-1');
    expect(ownership?.ownerId).toBe('m-b');
    expect(ownership?.points).toBe(8);
  });

  it('keeps first owner when later concurrent claim does not exceed points', () => {
    const store = createAdjudicationStore();
    const { store: next } = adjudicateConcurrentCaptures({
      store,
      territory: approved,
      commands: [
        cmd({ challengerId: 'm-a', points: 10, idempotencyKey: 'k-a' }),
        cmd({ challengerId: 'm-b', points: 4, idempotencyKey: 'k-b' }),
      ],
    });
    expect(next.ownershipByKey.get('solo:terr-1')?.ownerId).toBe('m-a');
  });

  it('is idempotent when the same key is replayed in a later batch', () => {
    const initial = createAdjudicationStore();
    const first = adjudicateConcurrentCaptures({
      store: initial,
      territory: approved,
      commands: [cmd({ challengerId: 'm-a', points: 5, idempotencyKey: 'k-a' })],
    });
    const second = adjudicateConcurrentCaptures({
      store: first.store,
      territory: approved,
      commands: [cmd({ challengerId: 'm-a', points: 5, idempotencyKey: 'k-a' })],
    });
    expect(second.results[0]).toMatchObject({ ok: true, kind: 'noop_idempotent' });
    expect(second.store.applied).toHaveLength(1);
  });
});
