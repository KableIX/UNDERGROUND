import { ChallengeRequestSchema } from '../contracts';
import { handleChallenge } from './challenge';
import type { RuntimeEnv } from '../env';
import type { OwnershipSlice, TerritorySlice } from '@underground/territory-engine';
import { draftMontereyTerritories } from '../../../../tests/fixtures/monterey-draft-territories';

function territorySlices(): TerritorySlice[] {
  return draftMontereyTerritories.map((t) => ({
    territoryDefinitionId: t.id,
    districtSlug: t.districtSlug,
    status: t.status,
    eligibleWeight: t.eligibleWeight,
    version: t.version,
  }));
}

/** In-memory ownership for local API demos — not production persistence. */
const memoryOwnership = new Map<string, OwnershipSlice>();
const seenKeys = new Set<string>();

export function postChallenge(env: RuntimeEnv, raw: unknown) {
  const request = ChallengeRequestSchema.parse(raw);
  const territories = territorySlices();
  const territory = territories.find(
    (t) => t.territoryDefinitionId === request.territoryDefinitionId,
  );
  const key = `${request.track}:${request.territoryDefinitionId}`;
  const current = memoryOwnership.get(key);

  const result = handleChallenge({
    env,
    request,
    territory,
    current,
    seenIdempotencyKeys: seenKeys,
  });

  if (result.ok && result.kind !== 'noop_idempotent') {
    memoryOwnership.set(key, {
      territoryDefinitionId: request.territoryDefinitionId,
      track: request.track,
      ownerId: result.ownerId,
      points: result.points,
    });
    seenKeys.add(request.idempotencyKey);
  }

  return result;
}
