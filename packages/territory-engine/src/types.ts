import type { OwnershipTrack, TerritoryStatus } from '@underground/domain';

export type TerritorySlice = {
  territoryDefinitionId: string;
  districtSlug: string;
  status: TerritoryStatus;
  eligibleWeight: number;
  version: number;
};

export type OwnershipSlice = {
  territoryDefinitionId: string;
  track: OwnershipTrack;
  ownerId: string | null;
  points: number;
};

export type CaptureCommand = {
  territoryDefinitionId: string;
  track: OwnershipTrack;
  challengerId: string;
  points: number;
  idempotencyKey: string;
  /** Must be false for production path; sim captures never write prod ownership. */
  isSimulation: boolean;
  allowProductionWrite: boolean;
};

export type CaptureResult =
  | {
      ok: true;
      kind: 'capture' | 'takeover' | 'defense' | 'noop_idempotent';
      previousOwnerId: string | null;
      ownerId: string;
      points: number;
      ledgerReason: 'capture' | 'challenge' | 'defense' | 'takeover';
    }
  | {
      ok: false;
      error:
        | 'draft_territory'
        | 'simulation_blocked'
        | 'invalid_points'
        | 'territory_not_found';
    };
