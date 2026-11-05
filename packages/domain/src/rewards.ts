import { z } from 'zod';
import { AppendResultSchema, type AppendResult } from './ledger';

export const GarageCreditReasonSchema = z.enum([
  'verified_capture',
  'sighting_confirmed',
  'founder_grant',
  'inventory_spend',
  'dupe_reversed',
]);

export const GarageCreditEntrySchema = z.object({
  id: z.string().uuid(),
  memberId: z.string().uuid(),
  delta: z.number().int(),
  reason: GarageCreditReasonSchema,
  inventorySku: z.string().nullable(),
  runId: z.string().uuid().nullable(),
  idempotencyKey: z.string().min(1),
  createdAt: z.string().datetime(),
});

export const SightingStatusSchema = z.enum([
  'pending',
  'confirmed',
  'rejected',
  'duplicate',
]);

export const SightingSchema = z.object({
  id: z.string().uuid(),
  reporterMemberId: z.string().uuid(),
  subjectVehicleId: z.string().uuid(),
  status: SightingStatusSchema,
  photoStoragePath: z.string().nullable(),
  dedupeKey: z.string().min(1),
  idempotencyKey: z.string().min(1),
  createdAt: z.string().datetime(),
});

export type GarageCreditReason = z.infer<typeof GarageCreditReasonSchema>;
export type GarageCreditEntry = z.infer<typeof GarageCreditEntrySchema>;
export type Sighting = z.infer<typeof SightingSchema>;
export type SightingStatus = z.infer<typeof SightingStatusSchema>;

/** Soft credits only — explicitly not real-money. */
export const GARAGE_CREDIT_AWARDS = {
  verified_capture: 5,
  sighting_confirmed: 2,
  founder_grant: 0,
} as const;

export function appendGarageCreditEntry(
  ledger: readonly GarageCreditEntry[],
  entry: GarageCreditEntry,
): { result: AppendResult; ledger: GarageCreditEntry[] } {
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
    ledger: [...ledger, GarageCreditEntrySchema.parse(entry)],
  };
}

export function sumGarageCredits(
  ledger: readonly GarageCreditEntry[],
  memberId: string,
): number {
  return ledger.filter((e) => e.memberId === memberId).reduce((sum, e) => sum + e.delta, 0);
}

/**
 * Dedupe key: reporter + vehicle + UTC hour bucket.
 * Duplicate sightings in the same bucket are rejected as fraud/dupe.
 */
export function sightingDedupeKey(
  reporterMemberId: string,
  subjectVehicleId: string,
  createdAtIso: string,
): string {
  const hour = createdAtIso.slice(0, 13);
  return `${reporterMemberId}:${subjectVehicleId}:${hour}`;
}

export function registerSighting(
  existing: readonly Sighting[],
  sighting: Sighting,
):
  | { ok: true; sighting: Sighting; kind: 'created' | 'noop_idempotent' }
  | { ok: false; error: 'duplicate_dedupe' | 'idempotency_conflict' } {
  const byIdem = existing.find((s) => s.idempotencyKey === sighting.idempotencyKey);
  if (byIdem) {
    if (
      byIdem.reporterMemberId === sighting.reporterMemberId &&
      byIdem.subjectVehicleId === sighting.subjectVehicleId &&
      byIdem.dedupeKey === sighting.dedupeKey
    ) {
      return { ok: true, sighting: byIdem, kind: 'noop_idempotent' };
    }
    return { ok: false, error: 'idempotency_conflict' };
  }
  if (existing.some((s) => s.dedupeKey === sighting.dedupeKey)) {
    return { ok: false, error: 'duplicate_dedupe' };
  }
  return { ok: true, sighting: SightingSchema.parse(sighting), kind: 'created' };
}

export { AppendResultSchema };
