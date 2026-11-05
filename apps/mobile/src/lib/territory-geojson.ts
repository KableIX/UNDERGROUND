import type { TerritoryDefinition } from '@underground/domain';

export type TerritoryFeatureCollection = {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    id: string;
    properties: {
      slug: string;
      name: string;
      districtSlug: string;
      status: TerritoryDefinition['status'];
      eligibleWeight: number;
      geometryLabel: string;
      selected: boolean;
    };
    geometry: TerritoryDefinition['geometry'];
  }>;
};

export function territoriesToFeatureCollection(
  territories: readonly TerritoryDefinition[],
  selectedSlug: string | null,
): TerritoryFeatureCollection {
  return {
    type: 'FeatureCollection',
    features: territories.map((t) => ({
      type: 'Feature' as const,
      id: t.id,
      properties: {
        slug: t.slug,
        name: t.name,
        districtSlug: t.districtSlug,
        status: t.status,
        eligibleWeight: t.eligibleWeight,
        geometryLabel: t.geometryLabel,
        selected: t.slug === selectedSlug,
      },
      geometry: t.geometry,
    })),
  };
}

export function startFinishForTerritory(territory: TerritoryDefinition): {
  start: [number, number];
  finish: [number, number];
} {
  const coords = territory.geometry.coordinates;
  return {
    start: coords[0] as [number, number],
    finish: coords[coords.length - 1] as [number, number],
  };
}

export function selectTerritoryBySlug(
  territories: readonly TerritoryDefinition[],
  slug: string | null,
): TerritoryDefinition | null {
  if (!slug) return null;
  return territories.find((t) => t.slug === slug) ?? null;
}

/** Hit-test helper for fallback plane — nearest route by projected midpoint proximity. */
export function pickNearestTerritorySlug(
  territories: readonly TerritoryDefinition[],
  lng: number,
  lat: number,
): string | null {
  let best: { slug: string; dist: number } | null = null;
  for (const t of territories) {
    for (const [x, y] of t.geometry.coordinates) {
      const dist = (x - lng) ** 2 + (y - lat) ** 2;
      if (!best || dist < best.dist) best = { slug: t.slug, dist };
    }
  }
  return best?.slug ?? null;
}
