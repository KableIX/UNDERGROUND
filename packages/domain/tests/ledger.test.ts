import { describe, expect, it } from 'vitest';
import {
  appendCloutLedgerEntry,
  appendOwnershipLedgerEntry,
  sumClout,
} from '../src/ledger';
import type { CloutLedgerEntry } from '../src/clout';
import type { OwnershipLedgerEntry } from '../src/ownership';

const baseOwnership: OwnershipLedgerEntry = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  territoryDefinitionId: '11111111-1111-4111-8111-111111111101',
  track: 'solo',
  ownerId: '33333333-3333-4333-8333-333333333301',
  previousOwnerId: null,
  points: 10,
  reason: 'capture',
  idempotencyKey: 'own-1',
  createdAt: '2026-11-04T00:00:00.000Z',
};

describe('append-only ownership ledger', () => {
  it('appends and refuses rewrites of existing ids', () => {
    const first = appendOwnershipLedgerEntry([], baseOwnership);
    expect(first.result).toEqual({ ok: true, kind: 'appended' });
    expect(first.ledger).toHaveLength(1);

    const rewrite = appendOwnershipLedgerEntry(first.ledger, {
      ...baseOwnership,
      points: 99,
      idempotencyKey: 'own-2',
    });
    expect(rewrite.result).toEqual({ ok: false, error: 'immutable_rewrite_forbidden' });
    expect(rewrite.ledger[0]?.points).toBe(10);
  });

  it('is idempotent for the same idempotency key + payload', () => {
    const first = appendOwnershipLedgerEntry([], baseOwnership);
    const second = appendOwnershipLedgerEntry(first.ledger, {
      ...baseOwnership,
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
    });
    expect(second.result).toEqual({ ok: true, kind: 'noop_idempotent' });
    expect(second.ledger).toHaveLength(1);
  });

  it('conflicts when idempotency key maps to different payload', () => {
    const first = appendOwnershipLedgerEntry([], baseOwnership);
    const conflict = appendOwnershipLedgerEntry(first.ledger, {
      ...baseOwnership,
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
      points: 50,
    });
    expect(conflict.result).toEqual({ ok: false, error: 'idempotency_conflict' });
  });
});

describe('append-only CLOUT ledger', () => {
  const entry: CloutLedgerEntry = {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
    memberId: '33333333-3333-4333-8333-333333333301',
    runId: '22222222-2222-4222-8222-222222222201',
    territoryDefinitionId: '11111111-1111-4111-8111-111111111101',
    delta: 25,
    reason: 'verified_capture_accepted',
    idempotencyKey: 'clout-1',
    createdAt: '2026-11-04T00:00:00.000Z',
  };

  it('sums clout without mutating history', () => {
    const a = appendCloutLedgerEntry([], entry);
    const b = appendCloutLedgerEntry(a.ledger, {
      ...entry,
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
      idempotencyKey: 'clout-2',
      delta: 10,
      reason: 'territory_defense',
    });
    expect(sumClout(b.ledger, entry.memberId)).toBe(35);
    expect(a.ledger).toHaveLength(1);
  });
});
