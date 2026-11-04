import { describe, expect, it } from 'vitest';
import { computeDistrictCrown } from '../src/crown';
import type { OwnershipSlice, TerritorySlice } from '../src/types';

const territories: TerritorySlice[] = [
  {
    territoryDefinitionId: 'a',
    districtSlug: 'monterey',
    status: 'approved',
    eligibleWeight: 40,
    version: 1,
  },
  {
    territoryDefinitionId: 'b',
    districtSlug: 'monterey',
    status: 'approved',
    eligibleWeight: 30,
    version: 1,
  },
  {
    territoryDefinitionId: 'c',
    districtSlug: 'monterey',
    status: 'approved',
    eligibleWeight: 30,
    version: 1,
  },
  {
    territoryDefinitionId: 'draft-x',
    districtSlug: 'monterey',
    status: 'draft',
    eligibleWeight: 100,
    version: 1,
  },
];

describe('computeDistrictCrown', () => {
  it('is neutral when no owner has >50% eligible weight', () => {
    const ownerships: OwnershipSlice[] = [
      { territoryDefinitionId: 'a', track: 'solo', ownerId: 'm1', points: 1 },
      { territoryDefinitionId: 'b', track: 'solo', ownerId: 'm2', points: 1 },
      { territoryDefinitionId: 'c', track: 'solo', ownerId: 'm3', points: 1 },
    ];
    const crown = computeDistrictCrown({
      districtSlug: 'monterey',
      track: 'solo',
      territories,
      ownerships,
    });
    expect(crown.isNeutral).toBe(true);
    expect(crown.crownOwnerId).toBeNull();
    expect(crown.totalEligibleWeight).toBe(100);
  });

  it('awards crown only when owner holds >50%', () => {
    const ownerships: OwnershipSlice[] = [
      { territoryDefinitionId: 'a', track: 'solo', ownerId: 'm1', points: 1 },
      { territoryDefinitionId: 'b', track: 'solo', ownerId: 'm1', points: 1 },
      { territoryDefinitionId: 'c', track: 'solo', ownerId: 'm2', points: 1 },
    ];
    const crown = computeDistrictCrown({
      districtSlug: 'monterey',
      track: 'solo',
      territories,
      ownerships,
    });
    expect(crown.isNeutral).toBe(false);
    expect(crown.crownOwnerId).toBe('m1');
    expect(crown.ownerEligibleWeight).toBe(70);
  });

  it('keeps solo and club tracks independent', () => {
    const ownerships: OwnershipSlice[] = [
      { territoryDefinitionId: 'a', track: 'solo', ownerId: 'm1', points: 1 },
      { territoryDefinitionId: 'b', track: 'solo', ownerId: 'm1', points: 1 },
      { territoryDefinitionId: 'c', track: 'solo', ownerId: 'm1', points: 1 },
      { territoryDefinitionId: 'a', track: 'club', ownerId: 'club-x', points: 1 },
    ];
    const solo = computeDistrictCrown({
      districtSlug: 'monterey',
      track: 'solo',
      territories,
      ownerships,
    });
    const club = computeDistrictCrown({
      districtSlug: 'monterey',
      track: 'club',
      territories,
      ownerships,
    });
    expect(solo.crownOwnerId).toBe('m1');
    expect(club.isNeutral).toBe(true);
    expect(club.crownOwnerId).toBeNull();
  });

  it('ignores draft territories in eligible weight', () => {
    const ownerships: OwnershipSlice[] = [
      { territoryDefinitionId: 'draft-x', track: 'solo', ownerId: 'm9', points: 1 },
    ];
    const crown = computeDistrictCrown({
      districtSlug: 'monterey',
      track: 'solo',
      territories,
      ownerships,
    });
    expect(crown.totalEligibleWeight).toBe(100);
    expect(crown.isNeutral).toBe(true);
  });
});
