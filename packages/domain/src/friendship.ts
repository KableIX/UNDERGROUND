import { z } from 'zod';

export const FriendshipStatusSchema = z.enum([
  'pending',
  'accepted',
  'rejected',
  'removed',
]);

export const FriendshipSchema = z.object({
  id: z.string().uuid(),
  requesterId: z.string().uuid(),
  addresseeId: z.string().uuid(),
  status: FriendshipStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Friendship = z.infer<typeof FriendshipSchema>;
export type FriendshipStatus = z.infer<typeof FriendshipStatusSchema>;
