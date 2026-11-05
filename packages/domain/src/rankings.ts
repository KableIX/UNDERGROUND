import { z } from 'zod';

export const RankingEntrySchema = z.object({
  memberId: z.string().uuid(),
  displayName: z.string().min(1),
  memberNumber: z.string().regex(/^\d{6}$/),
  cloutTotal: z.number().int().nonnegative(),
  territoriesHeld: z.number().int().nonnegative(),
  rank: z.number().int().positive(),
});

export type RankingEntry = z.infer<typeof RankingEntrySchema>;

/** Sort by CLOUT desc, then territories held, then member number asc. */
export function rankMembers(
  rows: Array<Omit<RankingEntry, 'rank'>>,
): RankingEntry[] {
  const sorted = [...rows].sort((a, b) => {
    if (b.cloutTotal !== a.cloutTotal) return b.cloutTotal - a.cloutTotal;
    if (b.territoriesHeld !== a.territoriesHeld) {
      return b.territoriesHeld - a.territoriesHeld;
    }
    return a.memberNumber.localeCompare(b.memberNumber);
  });
  return sorted.map((row, index) =>
    RankingEntrySchema.parse({ ...row, rank: index + 1 }),
  );
}
