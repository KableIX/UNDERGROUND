import { z } from 'zod';

export const TerritoryStatusSchema = z.enum(['draft', 'approved', 'retired']);

export const GeoJsonLineStringSchema = z.object({
  type: z.literal('LineString'),
  coordinates: z.array(z.tuple([z.number(), z.number()])).min(2),
});

export const TerritoryDefinitionSchema = z.object({
  id: z.string().uuid(),
  slug: z.string().min(1),
  name: z.string().min(1),
  districtSlug: z.string().min(1),
  /** Immutable version number for this geometry definition. */
  version: z.number().int().positive(),
  status: TerritoryStatusSchema,
  /** Eligible weight toward district crown (relative units). */
  eligibleWeight: z.number().positive(),
  /** Draft geometries are placeholder LineStrings — not production road traces. */
  geometry: GeoJsonLineStringSchema,
  geometryLabel: z.string().min(1),
  createdAt: z.string().datetime(),
});

export const DistrictSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  region: z.string().min(1),
});

export type TerritoryStatus = z.infer<typeof TerritoryStatusSchema>;
export type TerritoryDefinition = z.infer<typeof TerritoryDefinitionSchema>;
export type District = z.infer<typeof DistrictSchema>;
export type GeoJsonLineString = z.infer<typeof GeoJsonLineStringSchema>;

export const MONTEREY_DISTRICT_SLUG = 'monterey' as const;
