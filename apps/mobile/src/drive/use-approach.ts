import { useCallback, useEffect, useRef, useState } from 'react';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { advanceRoute, atRouteStart, routeDistances, type Fix, type Progress, type RoutePoint } from './route-navigation';

type DrivingRoute = { points: RoutePoint[]; turns: { index: number; instruction: string }[] };
type Directions = { driveToStart(lat: number, lon: number, endLat: number, endLon: number): Promise<DrivingRoute> };
type Leg = DrivingRoute & { distances: number[] };

export function useApproach(enabled: boolean, fix: Fix | null, start: RoutePoint) {
  const [leg, setLeg] = useState<Leg | null>(null);
  const [progress, setProgress] = useState<Progress>({ meters: 0, matchedAt: 0, phase: 'following' });
  const [error, setError] = useState<'update' | 'routing' | null>(null);
  const pending = useRef(false);
  const revision = useRef(0);
  const lastRequest = useRef(0);
  const [endLon, endLat] = start;
  useEffect(() => {
    setLeg(null);
    setError(null);
    lastRequest.current = 0;
    return () => { revision.current++; pending.current = false; };
  }, [enabled, endLon, endLat]);
  useEffect(() => {
    if (!enabled || !fix || atRouteStart([endLon, endLat], fix) || error || pending.current) return;
    if (leg && progress.phase !== 'off-route') return;
    if (Date.now() - lastRequest.current < 30000) return;
    const api = requireOptionalNativeModule<Directions>('UndergroundDirections');
    if (!api) { setError('update'); return; }
    const request = revision.current;
    pending.current = true;
    lastRequest.current = Date.now();
    void api.driveToStart(fix.latitude, fix.longitude, endLat, endLon).then(result => {
      if (request !== revision.current) return;
      setLeg({ ...result, distances: routeDistances(result.points) });
      setProgress({ phase: 'following', meters: 0, matchedAt: fix.timestamp - 1 });
    }).catch(() => { if (request === revision.current) setError('routing'); })
      .finally(() => { if (request === revision.current) pending.current = false; });
  }, [enabled, fix, endLon, endLat, error, leg, progress.phase]);
  useEffect(() => {
    if (enabled && fix && leg) setProgress(old => advanceRoute(leg.points, leg.distances, old, fix, Date.now()));
  }, [enabled, fix, leg]);
  const retry = useCallback(() => { lastRequest.current = 0; setError(null); }, []);
  return { leg: enabled ? leg : null, progress, error, retry };
}
