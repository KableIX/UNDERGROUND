import {
  appendCloutLedgerEntry,
  appendOwnershipLedgerEntry,
  buildCaptureAcceptedStory,
  canWriteProductionOwnership,
  cloutDeltaForReason,
  processRunEvent,
  type CloutLedgerEntry,
  type EvidenceSource,
  type NewswireStory,
  type OwnershipLedgerEntry,
  type RunPipelineState,
} from '@underground/domain';
import { applyCapture } from './capture';
import type { CaptureCommand, OwnershipSlice, TerritorySlice } from './types';

export type AcceptedRunArtifacts = {
  runState: RunPipelineState;
  ownershipWriteAllowed: boolean;
  ownershipLedger: OwnershipLedgerEntry[];
  cloutLedger: CloutLedgerEntry[];
  story: NewswireStory | null;
  capture: ReturnType<typeof applyCapture> | null;
};

/**
 * On pipeline ACCEPTED: optionally append ownership + CLOUT + Newswire story.
 * Simulation evidence never writes production ownership; CLOUT/story still
 * generate only when ownershipWriteAllowed (production path).
 */
export function materializeAcceptedRun(input: {
  currentState: RunPipelineState;
  event: {
    runId: string;
    from: RunPipelineState;
    to: RunPipelineState;
    evidenceSource: EvidenceSource;
    idempotencyKey: string;
    occurredAt: string;
  };
  seenRunKeys: ReadonlyMap<string, RunPipelineState>;
  appEnv: 'development' | 'staging' | 'production';
  territory: TerritorySlice;
  currentOwnership: OwnershipSlice | undefined;
  captureCommand: CaptureCommand;
  ownershipLedger: readonly OwnershipLedgerEntry[];
  cloutLedger: readonly CloutLedgerEntry[];
  member: { id: string; displayName: string };
  territoryMeta: { slug: string; name: string };
  ids: {
    ownershipEntryId: string;
    cloutEntryId: string;
    storyId: string;
  };
}): AcceptedRunArtifacts {
  const processed = processRunEvent({
    currentState: input.currentState,
    event: input.event,
    seen: input.seenRunKeys,
    appEnv: input.appEnv,
  });

  if (!processed.ok) {
    return {
      runState: input.currentState,
      ownershipWriteAllowed: false,
      ownershipLedger: [...input.ownershipLedger],
      cloutLedger: [...input.cloutLedger],
      story: null,
      capture: null,
    };
  }

  if (processed.state !== 'ACCEPTED' || processed.kind === 'noop_idempotent') {
    return {
      runState: processed.state,
      ownershipWriteAllowed: processed.ownershipWriteAllowed,
      ownershipLedger: [...input.ownershipLedger],
      cloutLedger: [...input.cloutLedger],
      story: null,
      capture: null,
    };
  }

  const allowProductionWrite = canWriteProductionOwnership(
    input.event.evidenceSource,
    input.appEnv,
  );

  const capture = applyCapture({
    territory: input.territory,
    current: input.currentOwnership,
    command: {
      ...input.captureCommand,
      isSimulation: input.event.evidenceSource === 'simulation',
      allowProductionWrite,
    },
    seenIdempotencyKeys: new Set(
      input.ownershipLedger.map((e) => e.idempotencyKey),
    ),
  });

  if (!capture.ok || !allowProductionWrite) {
    return {
      runState: 'ACCEPTED',
      ownershipWriteAllowed: false,
      ownershipLedger: [...input.ownershipLedger],
      cloutLedger: [...input.cloutLedger],
      story: null,
      capture,
    };
  }

  const ownershipEntry: OwnershipLedgerEntry = {
    id: input.ids.ownershipEntryId,
    territoryDefinitionId: input.territory.territoryDefinitionId,
    track: input.captureCommand.track,
    ownerId: capture.ownerId,
    previousOwnerId: capture.previousOwnerId,
    points: capture.points,
    reason: capture.ledgerReason,
    idempotencyKey: input.captureCommand.idempotencyKey,
    createdAt: input.event.occurredAt,
  };

  const ownershipAppend = appendOwnershipLedgerEntry(input.ownershipLedger, ownershipEntry);

  const cloutEntry: CloutLedgerEntry = {
    id: input.ids.cloutEntryId,
    memberId: input.member.id,
    runId: input.event.runId,
    territoryDefinitionId: input.territory.territoryDefinitionId,
    delta: cloutDeltaForReason('verified_capture_accepted'),
    reason: 'verified_capture_accepted',
    idempotencyKey: `clout:${input.event.runId}:verified_capture_accepted`,
    createdAt: input.event.occurredAt,
  };

  const cloutAppend = appendCloutLedgerEntry(input.cloutLedger, cloutEntry);

  const story = buildCaptureAcceptedStory({
    storyId: input.ids.storyId,
    memberId: input.member.id,
    displayName: input.member.displayName,
    runId: input.event.runId,
    territorySlug: input.territoryMeta.slug,
    territoryName: input.territoryMeta.name,
    clout: { delta: cloutEntry.delta },
    createdAt: input.event.occurredAt,
  });

  return {
    runState: 'ACCEPTED',
    ownershipWriteAllowed: true,
    ownershipLedger: ownershipAppend.ledger,
    cloutLedger: cloutAppend.ledger,
    story,
    capture,
  };
}
