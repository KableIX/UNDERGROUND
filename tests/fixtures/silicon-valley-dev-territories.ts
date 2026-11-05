/**
 * Silicon Valley DEVELOPMENT district — Santa Clara / NVIDIA-area test routes.
 *
 * Landmark cameras use public venue/campus centroids.
 * Route LineStrings are UNVERIFIED DRAFT corridors for UX/engine — NOT road-snapped
 * GPS claiming production accuracy. Never capturable as production ownership.
 */
import type { TerritoryDefinition } from '../../packages/domain/src/territory';
import type { DistrictKind } from '../../packages/domain/src/district-kind';

export const siliconValleyDistrict = {
  slug: 'silicon-valley-dev',
  name: 'Silicon Valley Development',
  region: 'California',
  kind: 'development' as DistrictKind,
} as const;

const CREATED = '2026-11-05T00:00:00.000Z';
const GEOM = 'UNVERIFIED_DRAFT_CORRIDOR_NOT_ROAD_SNAPPED';

function devRoute(
  partial: Omit<
    TerritoryDefinition,
    'status' | 'version' | 'createdAt' | 'geometryLabel' | 'districtSlug'
  >,
): TerritoryDefinition {
  return {
    ...partial,
    districtSlug: siliconValleyDistrict.slug,
    version: 2,
    status: 'draft',
    geometryLabel: GEOM,
    createdAt: CREATED,
  };
}

/**
 * Draft corridors anchored near public Santa Clara landmarks (NVIDIA campus area,
 * Central Expressway, El Camino, Lawrence). Vertices are coarse placeholders —
 * replace with Mapbox Directions / operator-reviewed centerlines before approval.
 */
export const siliconValleyDevTerritories: TerritoryDefinition[] = [
  devRoute({
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01',
    slug: 'santa-clara-el-camino',
    name: 'El Camino — Santa Clara',
    eligibleWeight: 10,
    geometry: {
      type: 'LineString',
      coordinates: [
        [-121.99, 37.352],
        [-121.975, 37.3525],
        [-121.96, 37.353],
        [-121.945, 37.352],
        [-121.93, 37.351],
      ],
    },
  }),
  devRoute({
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa02',
    slug: 'santa-clara-central-expressway',
    name: 'Central Expressway — NVIDIA corridor',
    eligibleWeight: 12,
    geometry: {
      type: 'LineString',
      coordinates: [
        [-121.995, 37.378],
        [-121.98, 37.375],
        [-121.9677, 37.3706],
        [-121.95, 37.368],
        [-121.935, 37.366],
      ],
    },
  }),
  devRoute({
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa03',
    slug: 'santa-clara-lawrence-loop',
    name: 'Lawrence Expressway loop',
    eligibleWeight: 8,
    geometry: {
      type: 'LineString',
      coordinates: [
        [-121.996, 37.36],
        [-121.996, 37.375],
        [-121.995, 37.39],
        [-121.985, 37.4],
        [-121.975, 37.403],
      ],
    },
  }),
  devRoute({
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa04',
    slug: 'san-tomas-expressway',
    name: 'San Tomas Expressway',
    eligibleWeight: 9,
    geometry: {
      type: 'LineString',
      coordinates: [
        [-121.968, 37.35],
        [-121.9677, 37.360],
        [-121.9677, 37.3706],
        [-121.9685, 37.385],
        [-121.97, 37.4],
      ],
    },
  }),
];
