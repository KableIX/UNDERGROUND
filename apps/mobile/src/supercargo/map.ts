import { SupercargoTiers, type SupercargoTier } from '@underground/domain';
import type { Bounds } from './copy';

/** Map helpers for SupercarGO. Pure: no React Native, so they are unit-tested. */

/** One color per rarity. Gold stays reserved for Singular. */
export const tierColors: Record<SupercargoTier, string> = {
  open: '#9A9BA0',
  limited: '#6FA3D8',
  numbered: '#4FC3A1',
  allocated: '#A98BF0',
  atelier: '#E0875F',
  singular: '#C6B08B',
};

export function tierColor(tier: SupercargoTier) {
  return tierColors[tier] ?? tierColors.open;
}

/** Hard ceiling on zoom: the map never gets closer than a neighborhood. */
export const MAP_MAX_ZOOM = 13;

/** The grid step in degrees, read from a cell id like `c0.02:1866:-4849`. */
export function cellStep(cellId: string): number {
  const step = Number(/^c([0-9.]+):/.exec(cellId)?.[1]);
  return Number.isFinite(step) && step > 0 ? step : 0.02;
}

/**
 * Radius in meters of the soft area drawn for a cell: it covers the whole
 * grid square, so the circle says "somewhere in here", never a spot.
 */
export function cellRadiusM(cellId: string): number {
  return Math.round(cellStep(cellId) * 111_320 * 0.6);
}

type CellSighting = { id: string; cell_id: string; cell_lat: number; cell_lng: number; tier: SupercargoTier };

export type MapCell<T extends CellSighting> = {
  id: string;
  lat: number;
  lng: number;
  radiusM: number;
  tier: SupercargoTier;
  items: T[];
};

/** Group sightings by neighborhood cell. The cell takes the color of its rarest car. */
export function groupCells<T extends CellSighting>(sightings: T[]): MapCell<T>[] {
  const cells = new Map<string, MapCell<T>>();
  for (const s of sightings) {
    const cell = cells.get(s.cell_id) ?? { id: s.cell_id, lat: s.cell_lat, lng: s.cell_lng, radiusM: cellRadiusM(s.cell_id), tier: s.tier, items: [] };
    cell.items.push(s);
    if (SupercargoTiers.indexOf(s.tier) > SupercargoTiers.indexOf(cell.tier)) cell.tier = s.tier;
    cells.set(s.cell_id, cell);
  }
  for (const cell of cells.values()) {
    cell.items.sort((a, b) => SupercargoTiers.indexOf(b.tier) - SupercargoTiers.indexOf(a.tier));
  }
  return [...cells.values()];
}

export type Region = { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number };

/**
 * Opening view: the member's area with every loaded cell in frame, padded,
 * no tighter than about 10 km and no wider than the query cap.
 */
export function fitRegion(
  center: { lat: number; lng: number } | null,
  points: Array<{ lat: number; lng: number }>,
  maxSpan = 1.2,
): Region {
  const all = [...(center ? [center] : []), ...points];
  if (all.length === 0) return { latitude: 37.33, longitude: -121.9, latitudeDelta: 0.35, longitudeDelta: 0.35 };
  let south = all[0]!.lat, north = south, west = all[0]!.lng, east = west;
  for (const p of all) {
    south = Math.min(south, p.lat);
    north = Math.max(north, p.lat);
    west = Math.min(west, p.lng);
    east = Math.max(east, p.lng);
  }
  const clamp = (v: number) => Math.min(maxSpan, Math.max(0.1, v));
  return {
    latitude: (south + north) / 2,
    longitude: (west + east) / 2,
    latitudeDelta: clamp((north - south) * 1.35 + 0.04),
    longitudeDelta: clamp((east - west) * 1.35 + 0.04),
  };
}

export function regionToBounds(r: Region): Bounds {
  return {
    west: r.longitude - r.longitudeDelta / 2,
    east: r.longitude + r.longitudeDelta / 2,
    south: r.latitude - r.latitudeDelta / 2,
    north: r.latitude + r.latitudeDelta / 2,
  };
}

/** First query around the member: wide enough for the whole local scene (about 55 km each way). */
export const MAP_FIRST_SPAN = 0.5;

export function firstQueryBounds(fix: { lat: number; lng: number }): Bounds {
  return { west: fix.lng - MAP_FIRST_SPAN, east: fix.lng + MAP_FIRST_SPAN, south: fix.lat - MAP_FIRST_SPAN, north: fix.lat + MAP_FIRST_SPAN };
}

export function hoursUntilTradeable(acquiredAt: string, now = new Date()): number {
  const ms = new Date(acquiredAt).getTime() + 24 * 3600_000 - now.getTime();
  return ms <= 0 ? 0 : Math.ceil(ms / 3600_000);
}
