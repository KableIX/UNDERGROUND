import {
  applyCapture,
  computeDistrictCrown,
  type OwnershipSlice,
  type TerritorySlice,
} from '@underground/territory-engine';
import type { OwnershipTrack } from '@underground/domain';
import { draftMontereyTerritories } from '../data/monterey-draft';

export type ChallengePreview = {
  track: OwnershipTrack;
  selectedTerritoryId: string;
  capture: ReturnType<typeof applyCapture>;
  crown: ReturnType<typeof computeDistrictCrown>;
};

function toSlices(): TerritorySlice[] {
  return draftMontereyTerritories.map((t) => ({
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
}): ChallengePreview {
  const territories = toSlices();
  const territory = territories.find(
    (t) => t.territoryDefinitionId === input.territoryDefinitionId,
  );
  const current = (input.ownerships ?? []).find(
    (o) =>
      o.territoryDefinitionId === input.territoryDefinitionId && o.track === input.track,
  );

  const capture = applyCapture({
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
    districtSlug: 'monterey',
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
