import { canWriteProductionOwnership } from '@underground/domain';
import { applyCapture, type OwnershipSlice, type TerritorySlice } from '@underground/territory-engine';
import type { ChallengeRequest, ChallengeResponse } from '../contracts';
import type { RuntimeEnv } from '../env';

/**
 * Challenge handler skeleton — wires typed contracts to the pure engine.
 * Persistence is stubbed until Supabase credentials exist.
 */
export function handleChallenge(input: {
  env: RuntimeEnv;
  request: ChallengeRequest;
  territory: TerritorySlice | undefined;
  current: OwnershipSlice | undefined;
  seenIdempotencyKeys: ReadonlySet<string>;
}): ChallengeResponse {
  const allowProductionWrite = canWriteProductionOwnership(
    input.request.isSimulation ? 'simulation' : 'production',
    input.env.APP_ENV,
  );

  const result = applyCapture({
    territory: input.territory,
    current: input.current,
    command: {
      territoryDefinitionId: input.request.territoryDefinitionId,
      track: input.request.track,
      challengerId: input.request.challengerId,
      points: input.request.points,
      idempotencyKey: input.request.idempotencyKey,
      isSimulation: input.request.isSimulation,
      allowProductionWrite,
    },
    seenIdempotencyKeys: input.seenIdempotencyKeys,
  });

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  return {
    ok: true,
    kind: result.kind,
    ownerId: result.ownerId,
    previousOwnerId: result.previousOwnerId,
    points: result.points,
  };
}
