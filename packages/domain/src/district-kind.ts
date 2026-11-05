import { z } from 'zod';

/** Production candidate vs development-only districts. */
export const DistrictKindSchema = z.enum(['production_candidate', 'development']);

export type DistrictKind = z.infer<typeof DistrictKindSchema>;

export const SILICON_VALLEY_DISTRICT_SLUG = 'silicon-valley-dev' as const;

/**
 * Development districts must never accept production ownership writes,
 * even if a territory row were mistakenly marked approved.
 */
export function allowsProductionOwnership(kind: DistrictKind): boolean {
  return kind === 'production_candidate';
}
