import { z } from 'zod';
import { OwnershipLedgerEntrySchema, type OwnershipLedgerEntry } from './ownership';
import { CloutLedgerEntrySchema, type CloutLedgerEntry } from './clout';

/**
 * Append-only ledger helpers. Mutations never rewrite prior entries;
 * callers must append or reject on idempotency collision.
 */

export const AppendResultSchema = z.discriminatedUnion('ok', [
  z.object({
    ok: z.literal(true),
    kind: z.enum(['appended', 'noop_idempotent']),
  }),
  z.object({
    ok: z.literal(false),
    error: z.enum(['idempotency_conflict', 'immutable_rewrite_forbidden']),
  }),
]);

export type AppendResult = z.infer<typeof AppendResultSchema>;

export function appendOwnershipLedgerEntry(
  ledger: readonly OwnershipLedgerEntry[],
  entry: OwnershipLedgerEntry,
): { result: AppendResult; ledger: OwnershipLedgerEntry[] } {
  const existing = ledger.find((e) => e.idempotencyKey === entry.idempotencyKey);
  if (existing) {
    if (existing.id === entry.id) {
      return { result: { ok: true, kind: 'noop_idempotent' }, ledger: [...ledger] };
    }
    const samePayload =
      existing.territoryDefinitionId === entry.territoryDefinitionId &&
      existing.track === entry.track &&
      existing.ownerId === entry.ownerId &&
      existing.points === entry.points &&
      existing.reason === entry.reason;
    if (samePayload) {
      return { result: { ok: true, kind: 'noop_idempotent' }, ledger: [...ledger] };
    }
    return { result: { ok: false, error: 'idempotency_conflict' }, ledger: [...ledger] };
  }

  // Guard: never allow replacing an entry at an existing index.
  if (ledger.some((e) => e.id === entry.id)) {
    return { result: { ok: false, error: 'immutable_rewrite_forbidden' }, ledger: [...ledger] };
  }

  return {
    result: { ok: true, kind: 'appended' },
    ledger: [...ledger, OwnershipLedgerEntrySchema.parse(entry)],
  };
}

export function appendCloutLedgerEntry(
  ledger: readonly CloutLedgerEntry[],
  entry: CloutLedgerEntry,
): { result: AppendResult; ledger: CloutLedgerEntry[] } {
  const existing = ledger.find((e) => e.idempotencyKey === entry.idempotencyKey);
  if (existing) {
    if (
      existing.memberId === entry.memberId &&
      existing.delta === entry.delta &&
      existing.reason === entry.reason
    ) {
      return { result: { ok: true, kind: 'noop_idempotent' }, ledger: [...ledger] };
    }
    return { result: { ok: false, error: 'idempotency_conflict' }, ledger: [...ledger] };
  }

  if (ledger.some((e) => e.id === entry.id)) {
    return { result: { ok: false, error: 'immutable_rewrite_forbidden' }, ledger: [...ledger] };
  }

  return {
    result: { ok: true, kind: 'appended' },
    ledger: [...ledger, CloutLedgerEntrySchema.parse(entry)],
  };
}

export function sumClout(ledger: readonly CloutLedgerEntry[], memberId: string): number {
  return ledger.filter((e) => e.memberId === memberId).reduce((sum, e) => sum + e.delta, 0);
}
