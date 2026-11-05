import { z } from 'zod';

export const ProfileSchema = z.object({
  memberId: z.string().uuid(),
  bio: z.string().max(500).nullable(),
  coverAssetId: z.string().uuid().nullable(),
  avatarAssetId: z.string().uuid().nullable(),
  friendCount: z.number().int().nonnegative(),
  followerCount: z.number().int().nonnegative(),
  /** Up to 8 friend member IDs featured on profile. */
  topEight: z.array(z.string().uuid()).max(8),
  updatedAt: z.string().datetime(),
});

export type Profile = z.infer<typeof ProfileSchema>;
