import type { DistrictCrown, OwnershipTrack } from '@underground/domain';
import type { OwnershipSlice, TerritorySlice } from './types';

/**
 * District crown only when an owner holds >50% of eligible weight among
 * approved territories in the district. Otherwise neutral.
 * Solo and club tracks are independent.
 */
export function computeDistrictCrown(input: {
  districtSlug: string;
  track: OwnershipTrack;
  territories: readonly TerritorySlice[];
  ownerships: readonly OwnershipSlice[];
}): DistrictCrown {
  const eligible = input.territories.filter(
    (t) => t.districtSlug === input.districtSlug && t.status === 'approved',
  );

  const totalEligibleWeight = eligible.reduce((sum, t) => sum + t.eligibleWeight, 0);

  if (totalEligibleWeight <= 0) {
    return {
      districtSlug: input.districtSlug,
      track: input.track,
      crownOwnerId: null,
      ownerEligibleWeight: 0,
      totalEligibleWeight: 1,
      isNeutral: true,
    };
  }

  const ownershipByTerritory = new Map(
    input.ownerships
      .filter((o) => o.track === input.track)
      .map((o) => [o.territoryDefinitionId, o] as const),
  );

  const weightByOwner = new Map<string, number>();

  for (const territory of eligible) {
    const ownership = ownershipByTerritory.get(territory.territoryDefinitionId);
    if (!ownership?.ownerId) continue;
    weightByOwner.set(
      ownership.ownerId,
      (weightByOwner.get(ownership.ownerId) ?? 0) + territory.eligibleWeight,
    );
  }

  let bestOwner: string | null = null;
  let bestWeight = 0;
  for (const [ownerId, weight] of weightByOwner) {
    if (weight > bestWeight) {
      bestWeight = weight;
      bestOwner = ownerId;
    }
  }

  const majorityThreshold = totalEligibleWeight * 0.5;
  const hasMajority = bestOwner !== null && bestWeight > majorityThreshold;

  return {
    districtSlug: input.districtSlug,
    track: input.track,
    crownOwnerId: hasMajority ? bestOwner : null,
    ownerEligibleWeight: bestWeight,
    totalEligibleWeight,
    isNeutral: !hasMajority,
  };
}
