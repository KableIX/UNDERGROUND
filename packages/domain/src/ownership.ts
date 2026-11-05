import { z } from 'zod';

export const OwnershipTrackSchema = z.enum(['solo', 'club']);

export const OwnershipLedgerEntrySchema = z.object({
  id: z.string().uuid(),
  territoryDefinitionId: z.string().uuid(),
  track: OwnershipTrackSchema,
  ownerId: z.string().uuid().nullable(),
  previousOwnerId: z.string().uuid().nullable(),
  points: z.number().nonnegative(),
  reason: z.enum(['capture', 'challenge', 'defense', 'takeover', 'neutralize']),
  idempotencyKey: z.string().min(1),
  createdAt: z.string().datetime(),
});

export const DistrictCrownSchema = z.object({
  districtSlug: z.string().min(1),
  track: OwnershipTrackSchema,
  /** null when no owner holds >50% of eligible weight. */
  crownOwnerId: z.string().uuid().nullable(),
  ownerEligibleWeight: z.number().nonnegative(),
  totalEligibleWeight: z.number().positive(),
  isNeutral: z.boolean(),
});

export type OwnershipTrack = z.infer<typeof OwnershipTrackSchema>;
export type OwnershipLedgerEntry = z.infer<typeof OwnershipLedgerEntrySchema>;
export type DistrictCrown = z.infer<typeof DistrictCrownSchema>;
