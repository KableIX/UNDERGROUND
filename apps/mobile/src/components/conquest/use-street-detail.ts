import { useEffect, useState } from 'react';
import type { LatLng, Region } from 'react-native-maps';

type Line = { id: string; points: LatLng[]; road: boolean; center: LatLng };
type Feature = { type: number; properties: { class?: string }; extent: number; loadGeometry(): { x: number; y: number }[][] };
type Tile = { layers: Record<string, { length: number; feature(index: number): Feature }> };
// These releases support Metro's CommonJS resolver.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { VectorTile } = require('@mapbox/vector-tile') as { VectorTile: new (reader: unknown) => Tile };
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Pbf = require('pbf') as new (bytes: Uint8Array) => unknown;

const count = 2 ** 14;
const cache = new Map<string, Promise<Line[]>>();
let source: Promise<string> | undefined;
function tileY(lat: number) {
  return (1 - Math.asinh(Math.tan(lat * Math.PI / 180)) / Math.PI) * count / 2;
}
function load(x: number, y: number) {
  const key = x + '/' + y;
  const existing = cache.get(key);
  if (existing) return existing;
  const job = (async () => {
    source ??= fetch('https://tiles.openfreemap.org/planet').then(async response => {
      if (!response.ok) throw Error('Tile index unavailable');
      const metadata = await response.json();
      return String(metadata.tiles[0]);
    }).catch(error => { source = undefined; throw error; });
    const url = (await source).replace('{z}', '14').replace('{x}', String(x)).replace('{y}', String(y));
    const result = await fetch(url);
    if (!result.ok) throw Error('Tile unavailable');
    const tile = new VectorTile(new Pbf(new Uint8Array(await result.arrayBuffer())));
    const lines: Line[] = [];
    for (const layerName of ['building', 'transportation']) {
      const road = layerName === 'transportation';
      const layer = tile.layers[layerName];
      for (let i = 0; i < (layer?.length ?? 0); i++) {
        const feature = layer.feature(i);
        if (road && (feature.type !== 2 || !['primary', 'trunk', 'motorway'].includes(feature.properties.class ?? ''))) continue;
        if (!road && feature.type !== 3) continue;
        for (const [part, path] of feature.loadGeometry().entries()) {
          if (path.length < 2) continue;
          const points = path.map(p => ({
            longitude: (x + p.x / feature.extent) / count * 360 - 180,
            latitude: Math.atan(Math.sinh(Math.PI * (1 - 2 * (y + p.y / feature.extent) / count))) * 180 / Math.PI,
          }));
          lines.push({ id: key + layerName + i + '-' + part, road, points, center: points[Math.floor(points.length / 2)] });
        }
      }
    }
    return lines;
  })().catch(error => { cache.delete(key); throw error; });
  cache.set(key, job);
  if (cache.size > 12) cache.delete(cache.keys().next().value!);
  return job;
}

export function useStreetDetail(region: Region | null) {
  const [lines, setLines] = useState<Line[]>([]);
  useEffect(() => {
    if (!region || region.longitudeDelta > 0.032 || region.latitudeDelta > 0.05 || Math.abs(region.latitude) > 84) {
      setLines([]);
      return;
    }
    let current = true;
    const { latitude, longitude, latitudeDelta, longitudeDelta } = region;
    const jobs: Promise<Line[]>[] = [];
    for (let x = Math.floor((longitude + 180 - longitudeDelta / 2) / 360 * count); x <= Math.floor((longitude + 180 + longitudeDelta / 2) / 360 * count); x++) {
      for (let y = Math.floor(tileY(latitude + latitudeDelta / 2)); y <= Math.floor(tileY(latitude - latitudeDelta / 2)); y++) {
        jobs.push(load((x + count) % count, y).catch(() => []));
      }
    }
    void Promise.all(jobs).then(tiles => {
      if (!current) return;
      const distance = (l: Line) => Math.abs((l.center.latitude - latitude) / latitudeDelta) + Math.abs((l.center.longitude - longitude) / longitudeDelta);
      const visible = tiles.flat().filter(l => l.points.some(p => Math.abs(p.latitude - latitude) <= latitudeDelta * 0.55 && Math.abs(p.longitude - longitude) <= longitudeDelta * 0.55));
      visible.sort((a, b) => distance(a) - distance(b));
      setLines([...visible.filter(l => !l.road).slice(0, 160), ...visible.filter(l => l.road).slice(0, 40)]);
    });
    return () => { current = false; };
  }, [region]);
  return lines;
}
