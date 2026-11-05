import { describe, expect, it } from 'vitest';
import { postChallenge } from '../src/routes/challenge-http';
import { loadEnv } from '../src/env';
import { draftMontereyTerritories } from '../../../tests/fixtures/monterey-draft-territories';

describe('postChallenge HTTP adapter', () => {
  it('rejects draft Monterey territories', () => {
    const env = loadEnv({ NODE_ENV: 'test', APP_ENV: 'production' });
    const territory = draftMontereyTerritories[0]!;
    const result = postChallenge(env, {
      territoryDefinitionId: territory.id,
      track: 'solo',
      challengerId: 'm1',
      points: 10,
      idempotencyKey: 'http-k1',
      isSimulation: false,
    });
    expect(result).toEqual({ ok: false, error: 'draft_territory' });
  });

  it('rejects simulation evidence', () => {
    const env = loadEnv({ NODE_ENV: 'test', APP_ENV: 'production' });
    const territory = draftMontereyTerritories[0]!;
    const result = postChallenge(env, {
      territoryDefinitionId: territory.id,
      track: 'solo',
      challengerId: 'm1',
      points: 10,
      idempotencyKey: 'http-k2',
      isSimulation: true,
    });
    expect(result.ok).toBe(false);
  });
});
