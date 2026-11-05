/**
 * Public landmark anchors for Silicon Valley / Monterey cameras.
 * Coordinates are well-known public places — NOT claimed as verified road centerlines.
 * Route LineStrings remain DRAFT until operator/Mapbox road-following review.
 */

export type Landmark = {
  id: string;
  name: string;
  districtSlug: 'silicon-valley-dev' | 'monterey';
  longitude: number;
  latitude: number;
  kind: 'campus' | 'stadium' | 'corridor' | 'coast';
  source: 'public_landmark';
};

/** Santa Clara / NVIDIA-area public landmarks (approximate campus/venue centroids). */
export const siliconValleyLandmarks: Landmark[] = [
  {
    id: 'nvidia-santa-clara',
    name: 'NVIDIA Santa Clara campus area',
    districtSlug: 'silicon-valley-dev',
    longitude: -121.9677,
    latitude: 37.3706,
    kind: 'campus',
    source: 'public_landmark',
  },
  {
    id: 'levis-stadium',
    name: "Levi's Stadium",
    districtSlug: 'silicon-valley-dev',
    longitude: -121.9702,
    latitude: 37.4032,
    kind: 'stadium',
    source: 'public_landmark',
  },
  {
    id: 'santa-clara-university',
    name: 'Santa Clara University',
    districtSlug: 'silicon-valley-dev',
    longitude: -121.939,
    latitude: 37.3496,
    kind: 'campus',
    source: 'public_landmark',
  },
  {
    id: 'great-america',
    name: "California's Great America",
    districtSlug: 'silicon-valley-dev',
    longitude: -121.974,
    latitude: 37.3975,
    kind: 'corridor',
    source: 'public_landmark',
  },
];

export const montereyLandmarks: Landmark[] = [
  {
    id: 'cannery-row-anchor',
    name: 'Cannery Row area',
    districtSlug: 'monterey',
    longitude: -121.9015,
    latitude: 36.6177,
    kind: 'coast',
    source: 'public_landmark',
  },
  {
    id: 'carmel-gate',
    name: 'Carmel / Highway 1 gate',
    districtSlug: 'monterey',
    longitude: -121.9233,
    latitude: 36.5552,
    kind: 'coast',
    source: 'public_landmark',
  },
];

/** Default SV camera — NVIDIA campus area. */
export const SV_LANDMARK_CAMERA = {
  longitude: -121.9677,
  latitude: 37.3706,
  zoom: 12.2,
} as const;

export const MONTEREY_LANDMARK_CAMERA = {
  longitude: -121.9,
  latitude: 36.58,
  zoom: 10.2,
} as const;
