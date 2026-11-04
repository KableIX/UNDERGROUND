import { z } from 'zod';

export const FoundingMarketSchema = z.enum(['california', 'miami']);

export const DirectoryOptInSchema = z.object({
  memberId: z.string().uuid(),
  optedIn: z.boolean(),
  market: FoundingMarketSchema,
  visibleDisplayName: z.string().min(1).max(64),
  updatedAt: z.string().datetime(),
});

export type FoundingMarket = z.infer<typeof FoundingMarketSchema>;
export type DirectoryOptIn = z.infer<typeof DirectoryOptInSchema>;

/**
 * Local opt-in member directory gate.
 * Only opted-in members in the requested founding market are listed.
 */
export function listDirectoryMembers(
  entries: readonly DirectoryOptIn[],
  market: FoundingMarket,
): DirectoryOptIn[] {
  return entries.filter((e) => e.optedIn && e.market === market);
}

export function isVisibleInDirectory(
  entry: DirectoryOptIn | undefined,
  market: FoundingMarket,
): boolean {
  return Boolean(entry?.optedIn && entry.market === market);
}
