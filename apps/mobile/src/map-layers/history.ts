import { routeDistances, type RoutePoint } from '../drive/route-navigation';

export type Zone = { start_m: number; end_m: number; occasions: number; last_month: string };
export function zoneLabel(z: Zone) {
  return z.occasions+' reporting days · latest '+z.last_month.slice(0,7)+' · UNDERGROUND members';
}
export function drawZones(points: RoutePoint[], zones: Zone[]) {
  if (points.length < 2 || !zones.length) return [];
  const distance = routeDistances(points);
  const total = distance[distance.length-1]!;
  function coordinate(m: number): RoutePoint {
    let end=1;
    while(end < distance.length-1 && distance[end]! < m) end++;
    const start=end-1;
    const fraction=(m-distance[start]!)/(distance[end]!-distance[start]! || 1);
    return [0,1].map(axis=>points[start]![axis]! + fraction*(points[end]![axis]!-points[start]![axis]!)) as RoutePoint;
  }
  return zones.flatMap(zone=>{
    const start=Math.max(0,zone.start_m), end=Math.min(total,zone.end_m);
    if (!(end>start)) return [];
    return [{...zone, coords:[coordinate(start),...points.filter((_,i)=>distance[i]!>start && distance[i]!<end),coordinate(end)]}];
  });
}
