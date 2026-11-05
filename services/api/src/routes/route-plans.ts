import { z } from 'zod';
import {
  RoutePlanSchema,
  assertRoadFollowingContract,
  estimatePreviewDistanceM,
  GPX_IO_CONTRACT,
  TBT_ARCHITECTURE,
} from '@underground/domain';
import type { MemoryStore } from '@underground/persistence';

const CreateRoutePlanSchema = RoutePlanSchema.omit({
  roadFollowingContract: true,
}).extend({
  roadFollowingContract: z.literal('provider_or_operator_required').default(
    'provider_or_operator_required',
  ),
});

export function handleCreateRoutePlan(store: MemoryStore, raw: unknown) {
  const parsed = CreateRoutePlanSchema.parse(raw);
  const plan = {
    ...parsed,
    roadFollowingContract: 'provider_or_operator_required' as const,
  };
  const gate = assertRoadFollowingContract(plan);
  if (!gate.ok) return { ok: false as const, error: gate.error };

  const distanceM =
    plan.distanceM ??
    (plan.coordinates ? estimatePreviewDistanceM(plan.coordinates) : null);

  const saved = { ...plan, distanceM };
  store.saveRoutePlan(saved);
  return {
    ok: true as const,
    plan: saved,
    contracts: {
      gpx: GPX_IO_CONTRACT,
      tbt: TBT_ARCHITECTURE,
    },
  };
}

export function handleRouteArchitecture() {
  return {
    ok: true as const,
    gpx: GPX_IO_CONTRACT,
    tbt: TBT_ARCHITECTURE,
    carPlayEntitlementAssumed: false,
  };
}
