/**
 * DRAFT Monterey District territory seeds.
 *
 * Geometry is intentionally coarse placeholder LineStrings — NOT reviewed
 * road-following traces. Status is always `draft`. Do not accept production captures.
 */
import type { TerritoryDefinition } from '../../packages/domain/src/territory';

const DRAFT_CREATED_AT = '2026-11-04T00:00:00.000Z';

function draftTerritory(
  partial: Omit<TerritoryDefinition, 'status' | 'version' | 'createdAt' | 'geometryLabel'> & {
    geometryLabel?: string;
  },
): TerritoryDefinition {
  return {
    ...partial,
    version: 1,
    status: 'draft',
    geometryLabel: partial.geometryLabel ?? 'DRAFT_PLACEHOLDER_LINESTRING',
    createdAt: DRAFT_CREATED_AT,
  };
}

/** Approximate Monterey-area anchors (lng, lat) — placeholders only. */
export const draftMontereyTerritories: TerritoryDefinition[] = [
  draftTerritory({
    id: '11111111-1111-4111-8111-111111111101',
    slug: 'highway-1-big-sur',
    name: 'Highway 1 / Big Sur',
    districtSlug: 'monterey',
    eligibleWeight: 20,
    geometry: {
      type: 'LineString',
      coordinates: [
        [-121.95, 36.55],
        [-121.9, 36.4],
        [-121.8, 36.25],
      ],
    },
  }),
  draftTerritory({
    id: '11111111-1111-4111-8111-111111111102',
    slug: 'carmel-valley-road',
    name: 'Carmel Valley Road',
    districtSlug: 'monterey',
    eligibleWeight: 14,
    geometry: {
      type: 'LineString',
      coordinates: [
        [-121.92, 36.5],
        [-121.75, 36.48],
        [-121.6, 36.47],
      ],
    },
  }),
  draftTerritory({
    id: '11111111-1111-4111-8111-111111111103',
    slug: 'laureles-grade',
    name: 'Laureles Grade',
    districtSlug: 'monterey',
    eligibleWeight: 12,
    geometry: {
      type: 'LineString',
      coordinates: [
        [-121.78, 36.55],
        [-121.72, 36.52],
        [-121.68, 36.48],
      ],
    },
  }),
  draftTerritory({
    id: '11111111-1111-4111-8111-111111111104',
    slug: 'seventeen-mile-drive',
    name: '17-Mile Drive',
    districtSlug: 'monterey',
    eligibleWeight: 16,
    geometry: {
      type: 'LineString',
      coordinates: [
        [-121.95, 36.6],
        [-121.97, 36.57],
        [-121.95, 36.54],
      ],
    },
  }),
  draftTerritory({
    id: '11111111-1111-4111-8111-111111111105',
    slug: 'pacific-grove',
    name: 'Pacific Grove',
    districtSlug: 'monterey',
    eligibleWeight: 10,
    geometry: {
      type: 'LineString',
      coordinates: [
        [-121.92, 36.62],
        [-121.91, 36.62],
        [-121.9, 36.61],
      ],
    },
  }),
  draftTerritory({
    id: '11111111-1111-4111-8111-111111111106',
    slug: 'cannery-row',
    name: 'Cannery Row',
    districtSlug: 'monterey',
    eligibleWeight: 8,
    geometry: {
      type: 'LineString',
      coordinates: [
        [-121.9, 36.615],
        [-121.895, 36.616],
        [-121.89, 36.617],
      ],
    },
  }),
  draftTerritory({
    id: '11111111-1111-4111-8111-111111111107',
    slug: 'laguna-seca-area',
    name: 'Laguna Seca Area',
    districtSlug: 'monterey',
    eligibleWeight: 20,
    geometry: {
      type: 'LineString',
      coordinates: [
        [-121.75, 36.58],
        [-121.75, 36.584],
        [-121.753, 36.586],
        [-121.755, 36.582],
      ],
    },
  }),
];

export const montereyDistrict = {
  slug: 'monterey',
  name: 'Monterey District',
  region: 'California',
} as const;
