import {
  buildSimCaptureStory,
  type DistrictKind,
  type OwnershipTrack,
  type SimNewswireStory,
  type TerritoryStatus,
} from '@underground/domain';
import { applyCaptureForDistrict } from './district-gate';
import type { OwnershipSlice, TerritorySlice } from './types';

export type SimCaptureWorkflowResult =
  | {
      ok: true;
      story: SimNewswireStory;
      ownershipWriteAllowed: false;
      districtGate: 'development_district' | 'sim_accepted';
      captureError?: string;
    }
  | {
      ok: false;
      error: string;
    };

/**
 * End-to-end simulated territory capture → Newswire.
 * Hard gates:
 * - Only development districts may run this capture path for Phase 1 iPhone tests
 * - Never writes production ownership
 * - Never awards production CLOUT
 * - Emits sim_capture_v1 Newswire story only
 */
export function runSimTerritoryCaptureToNewswire(input: {
  districtKind: DistrictKind;
  territory: TerritorySlice & { status: TerritoryStatus };
  territoryMeta: { slug: string; name: string };
  currentOwnership?: OwnershipSlice;
  track: OwnershipTrack;
  member: { id: string; displayName: string };
  points: number;
  runId: string;
  storyId: string;
  idempotencyKey: string;
  occurredAt: string;
  seenIdempotencyKeys?: ReadonlySet<string>;
}): SimCaptureWorkflowResult {
  if (input.districtKind !== 'development') {
    return {
      ok: false,
      error: 'sim_workflow_requires_development_district',
    };
  }

  // Production write always false for sim.
  const gate = applyCaptureForDistrict({
    districtKind: input.districtKind,
    territory: input.territory,
    current: input.currentOwnership,
    command: {
      territoryDefinitionId: input.territory.territoryDefinitionId,
      track: input.track,
      challengerId: input.member.id,
      points: input.points,
      idempotencyKey: input.idempotencyKey,
      isSimulation: true,
      allowProductionWrite: false,
    },
    seenIdempotencyKeys: input.seenIdempotencyKeys ?? new Set(),
  });

  // Development district capture is expected to fail production write path;
  // we still emit a sim Newswire story for the test workflow.
  const story = buildSimCaptureStory({
    storyId: input.storyId,
    memberId: input.member.id,
    displayName: input.member.displayName,
    runId: input.runId,
    territorySlug: input.territoryMeta.slug,
    territoryName: input.territoryMeta.name,
    createdAt: input.occurredAt,
  });

  if (!gate.ok && gate.error === 'development_district') {
    return {
      ok: true,
      story,
      ownershipWriteAllowed: false,
      districtGate: 'development_district',
      captureError: gate.error,
    };
  }

  return {
    ok: true,
    story,
    ownershipWriteAllowed: false,
    districtGate: 'sim_accepted',
    captureError: gate.ok ? undefined : gate.error,
  };
}
