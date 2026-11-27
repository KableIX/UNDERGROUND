import type { RouteProof } from '../../src/route-proof';

/** Synthetic coordinates for unit tests, NEVER a production roadway. */
export const validRouteProof: RouteProof = {
  geometry: {
    polyline: [{ lng: 0, lat: 0 }, { lng: 0.004, lat: 0 }],
    checkpoints: [{ lng: 0.002, lat: 0, radiusM: 75 }],
    startZone: { lng: 0, lat: 0, radiusM: 75 },
    finishZone: { lng: 0.004, lat: 0, radiusM: 75 },
  },
  samples: [0, 0.001, 0.002, 0.003, 0.004].map((lng, i) => ({
    lng, lat: 0, t: i * 30000, accuracyM: 8,
  })),
  startOdometerMiles: 1000,
  finishOdometerMiles: 1000.28,
};
