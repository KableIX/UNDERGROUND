import { describe, expect, it } from 'vitest';
import { handleChallenge } from '../src/routes/challenge';
import { loadEnv } from '../src/env';
import type { TerritorySlice } from '@underground/territory-engine';

const approved: TerritorySlice = {
  territoryDefinitionId: 'terr-1',
  districtSlug: 'monterey',
  status: 'approved',
  eligibleWeight: 10,
  version: 1,
};

describe('handleChallenge', () => {
  it('blocks simulation from production ownership via domain gate', () => {
    const env = loadEnv({ NODE_ENV: 'test', APP_ENV: 'production' });
    const result = handleChallenge({
      env,
      request: {
        territoryDefinitionId: 'terr-1',
        track: 'solo',
        challengerId: 'm1',
        points: 5,
        idempotencyKey: 'k1',
        isSimulation: true,
      },
      territory: approved,
      current: undefined,
      seenIdempotencyKeys: new Set(),
    });
    expect(result).toEqual({ ok: false, error: 'simulation_blocked' });
  });

  it('applies capture when production evidence allowed', () => {
    const env = loadEnv({ NODE_ENV: 'test', APP_ENV: 'production' });
    const result = handleChallenge({
      env,
      request: {
        territoryDefinitionId: 'terr-1',
        track: 'solo',
        challengerId: 'm1',
        points: 5,
        idempotencyKey: 'k1',
        isSimulation: false,
      },
      territory: approved,
      current: undefined,
      seenIdempotencyKeys: new Set(),
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.kind).toBe('capture');
      expect(result.ownerId).toBe('m1');
    }
  });
});
