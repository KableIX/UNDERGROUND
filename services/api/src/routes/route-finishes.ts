import { z } from 'zod';
import california from '../../../../apps/mobile/src/data/california-catalog.json';
import florida from '../../../../apps/mobile/src/data/florida-catalog.json';
import caRoads from '../../../../apps/mobile/src/data/california-road-routes.json';
import flRoads from '../../../../apps/mobile/src/data/florida-road-routes.json';
import valleyRoads from '../../../../apps/mobile/src/data/silicon-valley-road-routes.json';
import { verifiedDuration } from '../../../../apps/mobile/src/drive/finish-proof';
import { routeDistances, type RoutePoint } from '../../../../apps/mobile/src/drive/route-navigation';

type Road = { coordinates: number[][]; signalGap?: {entryIndex: number; exitIndex: number} };
const roads: Record<string, Road> = { ...caRoads, ...flRoads };
const valley: Record<string, Road> = valleyRoads;
const routes = new Map<string, {category: string; road?: Road}>();
for (const route of [...california, ...florida]) {
  routes.set(route.slug, {category: route.category, road: roads[route.id] ?? valley[route.slug]});
}
routes.set('half-moon-bay-coast', { category: 'RUN', road: caRoads.HMB });
for (const [slug, road] of Object.entries(valley)) {
  if (!routes.has(slug)) routes.set(slug, { category: slug === 'santa-clara-cupertino' ? 'TEST' : 'RUN', road });
}
routes.set('jenner-to-point-arena', { category: 'RUN', road: {
  coordinates: [...caRoads.N04.coordinates, ...caRoads.N06.coordinates.slice(1)],
} });

const fix = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90),
  z.number().min(0).max(50), z.number().int().positive().safe()]);
const request = z.discriminatedUnion('kind', [
  z.object({kind: z.literal('RUN'), route: z.string(), attempt: z.string().min(1).max(100), trace: z.array(fix).min(2).max(100000)}).strict(),
  z.object({kind: z.literal('CRUISE'), route: z.string()}).strict(),
]);
/** RUN: `finishedAtMs` is the phone time of the fix that crossed the finish (start fix + verified duration). */
export type FinishWrite = {route: string; attempt: string; duration: number; finishedAtMs: number} | {route: string};
export function validateFinish(body: unknown, now = Date.now()): FinishWrite | null {
  const parsed = request.safeParse(body);
  if (!parsed.success) return null;
  const data = parsed.data;
  const catalog = routes.get(data.route);
  if (!catalog?.road || catalog.category !== data.kind) return null;
  if (data.kind === 'CRUISE') return {route: data.route};
  if (data.trace.some((point, i) => point[3] > now + 15000 || (i > 0 && point[3] <= data.trace[i - 1]![3]))) return null;
  const duration = verifiedDuration(catalog.road.coordinates as RoutePoint[], data.trace, catalog.road.signalGap);
  return duration === null ? null : {route: data.route, attempt: data.attempt, duration, finishedAtMs: data.trace[0]![3] + duration};
}

/** Finish point of a catalog Run (last mapped coordinate). Null for Cruises, test loops and unknown routes. */
export function runFinishPoint(slug: string): {latitude: number; longitude: number; lengthM: number} | null {
  const catalog = routes.get(slug);
  const coordinates = catalog?.road?.coordinates;
  if (!catalog || catalog.category !== 'RUN' || !coordinates || coordinates.length < 2) return null;
  const last = coordinates[coordinates.length - 1]!;
  return {longitude: last[0]!, latitude: last[1]!, lengthM: routeDistances(coordinates as RoutePoint[]).at(-1)!};
}
