/**
 * Silicon Valley DEVELOPMENT district — Santa Clara test routes.
 * Clearly separated from production / production-candidate territories.
 * Never capturable as production ownership.
 */
import type { TerritoryDefinition } from '../../packages/domain/src/territory';
import type { DistrictKind } from '../../packages/domain/src/district-kind';

export const siliconValleyDistrict = {
  slug: 'silicon-valley-dev',
  name: 'Silicon Valley Development',
  region: 'California',
  kind: 'development' as DistrictKind,
} as const;

const CREATED = '2026-11-04T00:00:00.000Z';

function devRoute(
  partial: Omit<TerritoryDefinition, 'status' | 'version' | 'createdAt' | 'geometryLabel' | 'districtSlug'>,
): TerritoryDefinition {
  return {
    ...partial,
    districtSlug: siliconValleyDistrict.slug,
    version: 1,
    status: 'draft',
    geometryLabel: 'DEV_ONLY_PLACEHOLDER_LINESTRING',
    createdAt: CREATED,
  };
}

/** Coarse Santa Clara area placeholders — not production road traces. */
export const siliconValleyDevTerritories: TerritoryDefinition[] = [
  devRoute({
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01',
    slug: 'santa-clara-el-camino',
    name: 'Santa Clara El Camino Test',
    eligibleWeight: 10,
    geometry: {
      type: 'LineString',
      coordinates: [
        [-121.96, 37.35],
        [-121.94, 37.35],
        [-121.92, 37.352],
      ],
    },
  }),
  devRoute({
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa02',
    slug: 'santa-clara-central-expressway',
    name: 'Santa Clara Central Expressway Test',
    eligibleWeight: 10,
    geometry: {
      type: 'LineString',
      coordinates: [
        [-121.98, 37.38],
        [-121.95, 37.38],
        [-121.92, 37.385],
      ],
    },
  }),
  devRoute({
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa03',
    slug: 'santa-clara-lawrence-loop',
    name: 'Lawrence Expressway Loop Test',
    eligibleWeight: 8,
    geometry: {
      type: 'LineString',
      coordinates: [
        [-121.995, 37.37],
        [-121.995, 37.39],
        [-121.99, 37.4],
      ],
    },
  }),
];
