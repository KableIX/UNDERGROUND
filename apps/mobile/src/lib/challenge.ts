import {
  applyCaptureForDistrict,
  computeDistrictCrown,
  type OwnershipSlice,
  type TerritorySlice,
} from '@underground/territory-engine';
import type { OwnershipTrack, TerritoryDefinition } from '@underground/domain';
import { draftMontereyTerritories } from '../data/monterey-draft';
import { siliconValleyDevTerritories } from '../data/silicon-valley-dev';

export type ChallengePreview = {
  track: OwnershipTrack;
  selectedTerritoryId: string;
  capture: ReturnType<typeof applyCaptureForDistrict>;
  crown: ReturnType<typeof computeDistrictCrown>;
};

function toSlices(list: TerritoryDefinition[]): TerritorySlice[] {
  return list.map((t) => ({
    territoryDefinitionId: t.id,
    districtSlug: t.districtSlug,
    status: t.status,
    eligibleWeight: t.eligibleWeight,
    version: t.version,
  }));
}

/**
 * Client-side engine contract preview for the Conquest panel.
 * Production writes still require verified evidence via the API;
 * draft territories and sim evidence remain hard-gated by the engine.
 */
export function previewChallenge(input: {
  territoryDefinitionId: string;
  track: OwnershipTrack;
  challengerId: string;
  points: number;
  isSimulation: boolean;
  ownerships?: OwnershipSlice[];
  districtSlug?: string;
  territories?: TerritoryDefinition[];
}): ChallengePreview {
  const source =
    input.territories ??
    (input.districtSlug === 'silicon-valley-dev'
      ? siliconValleyDevTerritories
      : draftMontereyTerritories);
  const territories = toSlices(source);
  const territory = territories.find(
    (t) => t.territoryDefinitionId === input.territoryDefinitionId,
  );
  const current = (input.ownerships ?? []).find(
    (o) =>
      o.territoryDefinitionId === input.territoryDefinitionId && o.track === input.track,
  );

  const districtSlug = territory?.districtSlug ?? input.districtSlug ?? 'monterey';
  const districtKind = districtSlug === 'silicon-valley-dev' ? 'development' : 'production_candidate';

  const capture = applyCaptureForDistrict({
    districtKind,
    territory,
    current,
    command: {
      territoryDefinitionId: input.territoryDefinitionId,
      track: input.track,
      challengerId: input.challengerId,
      points: input.points,
      idempotencyKey: `preview:${input.territoryDefinitionId}:${Date.now()}`,
      isSimulation: input.isSimulation,
      allowProductionWrite: !input.isSimulation,
    },
    seenIdempotencyKeys: new Set(),
  });

  const crown = computeDistrictCrown({
    districtSlug,
    track: input.track,
    territories,
    ownerships: input.ownerships ?? [],
  });

  return {
    track: input.track,
    selectedTerritoryId: input.territoryDefinitionId,
    capture,
    crown,
  };
}
