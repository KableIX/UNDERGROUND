import { z } from 'zod';

export const FollowSchema = z.object({
  id: z.string().uuid(),
  followerId: z.string().uuid(),
  followeeId: z.string().uuid(),
  createdAt: z.string().datetime(),
});

export type Follow = z.infer<typeof FollowSchema>;

export function canFollow(followerId: string, followeeId: string): boolean {
  return followerId !== followeeId;
}
