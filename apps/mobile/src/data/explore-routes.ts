import { curatedRuns } from './curated-runs';
import saratoga from './saratoga-club-route.json';
import campus from './nvidia-campus-route.json';

function feature(slug: string, name: string, coordinates: number[][]) {
  let west = Infinity, south = Infinity, east = -Infinity, north = -Infinity;
  for (const [lon, lat] of coordinates) {
    west = Math.min(west, lon);
    east = Math.max(east, lon);
    south = Math.min(south, lat);
    north = Math.max(north, lat);
  }
  return {
    type: 'Feature' as const,
    properties: { slug, name },
    bbox: [west, south, east, north],
    geometry: { type: 'LineString' as const, coordinates },
  };
}

export const exploreRoutes = {
  type: 'FeatureCollection' as const,
  features: [
    ...curatedRuns.flatMap(run => {
      const campusLoop = run.slug === 'nvidia-campus-loop';
      const points = campusLoop ? campus.geometry.coordinates : run.mapped?.coordinates;
      return points && points.length > 1
        ? [feature(run.slug, campusLoop ? 'NVIDIA Campus Loop' : run.title, points)]
        : [];
    }),
    feature('saratoga-club-loop', 'Saratoga Club Loop', saratoga.geometry.coordinates),
  ],
};
