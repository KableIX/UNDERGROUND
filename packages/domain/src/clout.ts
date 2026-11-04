import { z } from 'zod';

export const CloutReasonSchema = z.enum([
  'verified_capture_accepted',
  'territory_defense',
  'district_crown',
]);

export const CloutLedgerEntrySchema = z.object({
  id: z.string().uuid(),
  memberId: z.string().uuid(),
  runId: z.string().uuid().nullable(),
  territoryDefinitionId: z.string().uuid().nullable(),
  delta: z.number().int(),
  reason: CloutReasonSchema,
  idempotencyKey: z.string().min(1),
  createdAt: z.string().datetime(),
});

export type CloutReason = z.infer<typeof CloutReasonSchema>;
export type CloutLedgerEntry = z.infer<typeof CloutLedgerEntrySchema>;

/** Fixed point awards — deterministic, not fabricated achievements. */
export const CLOUT_AWARDS = {
  verified_capture_accepted: 25,
  territory_defense: 10,
  district_crown: 50,
} as const satisfies Record<CloutReason, number>;

export function cloutDeltaForReason(reason: CloutReason): number {
  return CLOUT_AWARDS[reason];
}
