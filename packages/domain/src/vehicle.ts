import { z } from 'zod';

export const VerificationStatusSchema = z.enum([
  'unverified',
  'pending_review',
  'verified',
  'rejected',
]);

export const ModStatusSchema = z.enum(['installed', 'pending']);

export const VehicleModSchema = z.object({
  id: z.string().uuid(),
  vehicleId: z.string().uuid(),
  title: z.string().min(1).max(120),
  description: z.string().max(1000).nullable(),
  status: ModStatusSchema,
  installedAt: z.string().datetime().nullable(),
});

export const VehicleMediaSchema = z.object({
  id: z.string().uuid(),
  vehicleId: z.string().uuid(),
  storagePath: z.string().min(1),
  /** Placeholder assets must be clearly marked until licensed media exists. */
  isPlaceholder: z.boolean(),
  caption: z.string().max(280).nullable(),
  sortOrder: z.number().int().nonnegative(),
});

export const GarageVisibilitySchema = z.enum(['private', 'friends', 'public']);

export const VehicleSchema = z.object({
  id: z.string().uuid(),
  ownerMemberId: z.string().uuid(),
  year: z.number().int().min(1900).max(2100),
  make: z.string().min(1),
  model: z.string().min(1),
  trim: z.string().nullable(),
  color: z.string().min(1),
  transmission: z.string().nullable(),
  wheels: z.string().nullable(),
  brakes: z.string().nullable(),
  verificationStatus: VerificationStatusSchema,
  visibility: GarageVisibilitySchema,
  createdAt: z.string().datetime(),
});

export type Vehicle = z.infer<typeof VehicleSchema>;
export type VehicleMod = z.infer<typeof VehicleModSchema>;
export type VehicleMedia = z.infer<typeof VehicleMediaSchema>;
export type VerificationStatus = z.infer<typeof VerificationStatusSchema>;
export type ModStatus = z.infer<typeof ModStatusSchema>;
export type GarageVisibility = z.infer<typeof GarageVisibilitySchema>;
