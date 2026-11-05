/** Worldwide basemap settings. Territory geometry is intentionally not an input. */
export type WorldMapStyle = 'standard' | 'satellite' | 'hybrid';
export type WorldRegion = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

export const SANTA_CLARA_START: WorldRegion = Object.freeze({
  latitude: 37.3706,
  longitude: -121.9677,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
});

export const WORLD_START: WorldRegion = Object.freeze({
  latitude: 15,
  longitude: 0,
  latitudeDelta: 90,
  longitudeDelta: 120,
});

export function regionAround(latitude: number, longitude: number, delta = 0.015): WorldRegion {
  if (!Number.isFinite(latitude) || Math.abs(latitude) > 90 ||
      !Number.isFinite(longitude) || Math.abs(longitude) > 180) {
    throw new Error('invalid_world_map_position');
  }
  if (!Number.isFinite(delta) || delta <= 0 || delta > 180) {
    throw new Error('invalid_world_map_zoom');
  }
  return {
    latitude, longitude, latitudeDelta: delta, longitudeDelta: delta,
  };
}

export function nextMapStyle(current: WorldMapStyle): WorldMapStyle {
  return current === 'standard' ? 'satellite' : current === 'satellite' ? 'hybrid' : 'standard';
}
