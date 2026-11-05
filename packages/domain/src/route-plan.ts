import { z } from 'zod';

/**
 * Route planning contracts.
 * Road-following: geometry must come from a map provider or operator review.
 * Clients MUST NOT invent road centerlines. Unreviewed plans stay DRAFT.
 * CarPlay: architecture stubs only — no entitlement assumption.
 */

export const RouteClassSchema = z.enum(['scenic', 'technical']);
export const RoutePlanStatusSchema = z.enum(['draft', 'shared', 'archived']);
export const WaypointKindSchema = z.enum([
  'start',
  'checkpoint',
  'finish',
  'stage_break',
]);

export const RouteWaypointSchema = z.object({
  id: z.string().uuid(),
  kind: WaypointKindSchema,
  seq: z.number().int().nonnegative(),
  label: z.string().max(120).nullable(),
  lng: z.number(),
  lat: z.number(),
});

export const RouteStageSchema = z.object({
  stageIndex: z.number().int().nonnegative(),
  title: z.string().min(1).max(120),
});

export const RoutePlanSchema = z.object({
  id: z.string().uuid(),
  ownerMemberId: z.string().uuid(),
  title: z.string().min(1).max(120),
  routeClass: RouteClassSchema,
  status: RoutePlanStatusSchema,
  distanceM: z.number().nonnegative().nullable(),
  /** Null until provider/operator supplies road-following geometry. */
  coordinates: z
    .array(z.tuple([z.number(), z.number()]))
    .min(2)
    .nullable(),
  geometrySource: z.enum([
    'unreviewed_draft',
    'mapbox_directions',
    'operator_reviewed',
    'gpx_import',
  ]),
  roadFollowingContract: z.literal('provider_or_operator_required'),
  gpxSha256: z.string().nullable(),
  shareVisibility: z.enum(['private', 'friends', 'public']),
  waypoints: z.array(RouteWaypointSchema),
  stages: z.array(RouteStageSchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type RouteClass = z.infer<typeof RouteClassSchema>;
export type RoutePlan = z.infer<typeof RoutePlanSchema>;
export type RouteWaypoint = z.infer<typeof RouteWaypointSchema>;
export type RouteStage = z.infer<typeof RouteStageSchema>;

export type RoadFollowingViolation =
  | 'fabricated_geometry_forbidden'
  | 'missing_start'
  | 'missing_finish'
  | 'empty_title';

/**
 * Reject client-fabricated road geometry. Distance/preview OK without coords;
 * attaching coordinates requires an allowed geometrySource.
 */
export function assertRoadFollowingContract(plan: {
  title: string;
  coordinates: RoutePlan['coordinates'];
  geometrySource: RoutePlan['geometrySource'];
  waypoints: readonly RouteWaypoint[];
}): { ok: true } | { ok: false; error: RoadFollowingViolation } {
  if (!plan.title.trim()) return { ok: false, error: 'empty_title' };
  const hasStart = plan.waypoints.some((w) => w.kind === 'start');
  const hasFinish = plan.waypoints.some((w) => w.kind === 'finish');
  if (!hasStart) return { ok: false, error: 'missing_start' };
  if (!hasFinish) return { ok: false, error: 'missing_finish' };
  if (plan.coordinates && plan.geometrySource === 'unreviewed_draft') {
    return { ok: false, error: 'fabricated_geometry_forbidden' };
  }
  return { ok: true };
}

export type GpxIoContract = {
  import: 'parse_gpx_track_to_waypoints_then_provider_snap';
  export: 'emit_gpx_from_provider_or_operator_geometry_only';
  offline: 'cache_provider_geometry_and_tbt_steps; no invent roads';
};

export const GPX_IO_CONTRACT: GpxIoContract = {
  import: 'parse_gpx_track_to_waypoints_then_provider_snap',
  export: 'emit_gpx_from_provider_or_operator_geometry_only',
  offline: 'cache_provider_geometry_and_tbt_steps; no invent roads',
};

/** Turn-by-turn architecture — not a live navigation SDK wiring. */
export type TbtArchitecture = {
  status: 'architecture_only';
  steps: readonly [
    'resolve_road_following_geometry',
    'slice_maneuvers_from_provider',
    'cache_offline_pack',
    'voice_prompt_queue',
    'rejoin_forward_on_off_route',
  ];
  carPlay: {
    status: 'architecture_only';
    entitlementAssumed: false;
    notes: 'CPTemplate / map draw planned; requires Apple entitlement + Mapbox CarPlay support';
  };
};

export const TBT_ARCHITECTURE: TbtArchitecture = {
  status: 'architecture_only',
  steps: [
    'resolve_road_following_geometry',
    'slice_maneuvers_from_provider',
    'cache_offline_pack',
    'voice_prompt_queue',
    'rejoin_forward_on_off_route',
  ],
  carPlay: {
    status: 'architecture_only',
    entitlementAssumed: false,
    notes:
      'CPTemplate / map draw planned; requires Apple entitlement + Mapbox CarPlay support',
  },
};

export function estimatePreviewDistanceM(
  coordinates: readonly [number, number][],
): number {
  // Haversine sum — preview only; not scoring.
  let total = 0;
  for (let i = 1; i < coordinates.length; i += 1) {
    const [lng1, lat1] = coordinates[i - 1]!;
    const [lng2, lat2] = coordinates[i]!;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const R = 6371000;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    total += 2 * R * Math.asin(Math.sqrt(a));
  }
  return Math.round(total);
}
