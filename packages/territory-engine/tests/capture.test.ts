import { describe, expect, it } from 'vitest';
import { applyCapture } from '../src/capture';
import { buildIdempotencyKey, rememberIdempotencyKey } from '../src/idempotency';
import type { OwnershipSlice, TerritorySlice } from '../src/types';

const approved: TerritorySlice = {
  territoryDefinitionId: 'terr-1',
  districtSlug: 'monterey',
  status: 'approved',
  eligibleWeight: 10,
  version: 1,
};

const draft: TerritorySlice = { ...approved, status: 'draft' };

describe('applyCapture', () => {
  it('rejects draft territories', () => {
    const result = applyCapture({
      territory: draft,
      current: undefined,
      command: {
        territoryDefinitionId: 'terr-1',
        track: 'solo',
        challengerId: 'm1',
        points: 5,
        idempotencyKey: 'k1',
        isSimulation: false,
        allowProductionWrite: true,
      },
      seenIdempotencyKeys: new Set(),
    });
    expect(result).toEqual({ ok: false, error: 'draft_territory' });
  });

  it('hard-gates simulation evidence from production ownership', () => {
    const result = applyCapture({
      territory: approved,
      current: undefined,
      command: {
        territoryDefinitionId: 'terr-1',
        track: 'solo',
        challengerId: 'm1',
        points: 5,
        idempotencyKey: 'k1',
        isSimulation: true,
        allowProductionWrite: true,
      },
      seenIdempotencyKeys: new Set(),
    });
    expect(result).toEqual({ ok: false, error: 'simulation_blocked' });
  });

  it('captures unowned territory', () => {
    const result = applyCapture({
      territory: approved,
      current: undefined,
      command: {
        territoryDefinitionId: 'terr-1',
        track: 'solo',
        challengerId: 'm1',
        points: 5,
        idempotencyKey: 'k1',
        isSimulation: false,
        allowProductionWrite: true,
      },
      seenIdempotencyKeys: new Set(),
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.kind).toBe('capture');
      expect(result.ownerId).toBe('m1');
    }
  });

  it('takeover when challenger points exceed owner', () => {
    const current: OwnershipSlice = {
      territoryDefinitionId: 'terr-1',
      track: 'solo',
      ownerId: 'm0',
      points: 3,
    };
    const result = applyCapture({
      territory: approved,
      current,
      command: {
        territoryDefinitionId: 'terr-1',
        track: 'solo',
        challengerId: 'm1',
        points: 8,
        idempotencyKey: 'k2',
        isSimulation: false,
        allowProductionWrite: true,
      },
      seenIdempotencyKeys: new Set(),
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.kind).toBe('takeover');
      expect(result.previousOwnerId).toBe('m0');
      expect(result.ownerId).toBe('m1');
    }
  });

  it('is idempotent for duplicate keys', () => {
    const key = buildIdempotencyKey({
      territoryDefinitionId: 'terr-1',
      track: 'solo',
      actorId: 'm1',
      clientNonce: 'n1',
    });
    const seen = rememberIdempotencyKey(new Set(), key);
    const current: OwnershipSlice = {
      territoryDefinitionId: 'terr-1',
      track: 'solo',
      ownerId: 'm1',
      points: 5,
    };
    const result = applyCapture({
      territory: approved,
      current,
      command: {
        territoryDefinitionId: 'terr-1',
        track: 'solo',
        challengerId: 'm1',
        points: 5,
        idempotencyKey: key,
        isSimulation: false,
        allowProductionWrite: true,
      },
      seenIdempotencyKeys: seen,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.kind).toBe('noop_idempotent');
  });
});
