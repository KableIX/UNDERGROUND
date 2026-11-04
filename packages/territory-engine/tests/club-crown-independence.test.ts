import { describe, expect, it } from 'vitest';
import { computeDistrictCrown } from '../src/crown';
import type { OwnershipSlice, TerritorySlice } from '../src/types';
import { clubFixture } from '../../../tests/fixtures/clubs-social';

const territories: TerritorySlice[] = [
  {
    territoryDefinitionId: 'a',
    districtSlug: 'monterey',
    status: 'approved',
    eligibleWeight: 50,
    version: 1,
  },
  {
    territoryDefinitionId: 'b',
    districtSlug: 'monterey',
    status: 'approved',
    eligibleWeight: 50,
    version: 1,
  },
];

describe('club crown independence from solo', () => {
  it('awards club crown without affecting solo neutrality', () => {
    const ownerships: OwnershipSlice[] = [
      {
        territoryDefinitionId: 'a',
        track: 'club',
        ownerId: clubFixture.id,
        points: 10,
      },
      {
        territoryDefinitionId: 'b',
        track: 'club',
        ownerId: clubFixture.id,
        points: 10,
      },
      // Solo 50/50 — no owner holds >50%
      { territoryDefinitionId: 'a', track: 'solo', ownerId: 'm1', points: 1 },
      { territoryDefinitionId: 'b', track: 'solo', ownerId: 'm2', points: 1 },
    ];

    const club = computeDistrictCrown({
      districtSlug: 'monterey',
      track: 'club',
      territories,
      ownerships,
    });
    const solo = computeDistrictCrown({
      districtSlug: 'monterey',
      track: 'solo',
      territories,
      ownerships,
    });

    expect(club.isNeutral).toBe(false);
    expect(club.crownOwnerId).toBe(clubFixture.id);
    expect(solo.isNeutral).toBe(true);
    expect(solo.crownOwnerId).toBeNull();
  });
});
