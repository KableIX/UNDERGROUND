import {
  appendCloutLedgerEntry,
  appendOwnershipLedgerEntry,
  buildCaptureAcceptedStory,
  canWriteProductionOwnership,
  cloutDeltaForReason,
  processRunEvent,
  reviewEvidenceBundle,
  allowsProductionOwnership,
  type CloutLedgerEntry,
  type DistrictKind,
  type EvidenceSource,
  type NewswireStory,
  type OwnershipLedgerEntry,
  type RunEvidenceBundle,
  type RunPipelineState,
} from '@underground/domain';
import { applyCapture } from './capture';
import type { CaptureCommand, OwnershipSlice, TerritorySlice } from './types';

export type ServerRunState = {
  runId: string;
  state: RunPipelineState;
  evidenceSource: EvidenceSource;
  seenEventKeys: Map<string, RunPipelineState>;
  interrupted: boolean;
};

export type ServerAdjudicationResult = {
  run: ServerRunState;
  ownershipLedger: OwnershipLedgerEntry[];
  cloutLedger: CloutLedgerEntry[];
  story: NewswireStory | null;
  errors: string[];
};

/**
 * Server-authoritative run advancement + optional ACCEPTED materialization.
 * Client never writes ownership/CLOUT/newswire directly.
 */
export function serverAdvanceRun(input: {
  run: ServerRunState;
  to: RunPipelineState;
  idempotencyKey: string;
  occurredAt: string;
  appEnv: 'development' | 'staging' | 'production';
  evidence?: RunEvidenceBundle;
  allowSimulationAccept?: boolean;
  districtKind: DistrictKind;
  territory: TerritorySlice;
  currentOwnership: OwnershipSlice | undefined;
  captureCommand: CaptureCommand;
  ownershipLedger: readonly OwnershipLedgerEntry[];
  cloutLedger: readonly CloutLedgerEntry[];
  member: { id: string; displayName: string };
  territoryMeta: { slug: string; name: string };
  ids: { ownershipEntryId: string; cloutEntryId: string; storyId: string };
}): ServerAdjudicationResult {
  const errors: string[] = [];
  const run: ServerRunState = {
    ...input.run,
    seenEventKeys: new Map(input.run.seenEventKeys),
  };

  // Interrupted runs cannot skip to ACCEPTED without recovery.
  if (run.interrupted && input.to === 'ACCEPTED') {
    return {
      run,
      ownershipLedger: [...input.ownershipLedger],
      cloutLedger: [...input.cloutLedger],
      story: null,
      errors: ['interrupted_run_blocks_accept'],
    };
  }

  if (input.to === 'ACCEPTED') {
    if (!input.evidence) {
      return {
        run,
        ownershipLedger: [...input.ownershipLedger],
        cloutLedger: [...input.cloutLedger],
        story: null,
        errors: ['evidence_required'],
      };
    }
    const review = reviewEvidenceBundle(input.evidence, {
      allowSimulationAccept: Boolean(input.allowSimulationAccept),
    });
    if (!review.ok) {
      const reject = processRunEvent({
        currentState: run.state,
        event: {
          runId: run.runId,
          from: run.state,
          to: 'REJECTED',
          evidenceSource: run.evidenceSource,
          idempotencyKey: `${input.idempotencyKey}:reject`,
          occurredAt: input.occurredAt,
        },
        seen: run.seenEventKeys,
        appEnv: input.appEnv,
      });
      if (reject.ok && reject.kind === 'applied') {
        run.state = 'REJECTED';
        run.seenEventKeys.set(`${input.idempotencyKey}:reject`, 'REJECTED');
      }
      return {
        run,
        ownershipLedger: [...input.ownershipLedger],
        cloutLedger: [...input.cloutLedger],
        story: null,
        errors: [review.reason],
      };
    }
  }

  const processed = processRunEvent({
    currentState: run.state,
    event: {
      runId: run.runId,
      from: run.state,
      to: input.to,
      evidenceSource: run.evidenceSource,
      idempotencyKey: input.idempotencyKey,
      occurredAt: input.occurredAt,
    },
    seen: run.seenEventKeys,
    appEnv: input.appEnv,
  });

  if (!processed.ok) {
    return {
      run,
      ownershipLedger: [...input.ownershipLedger],
      cloutLedger: [...input.cloutLedger],
      story: null,
      errors: [processed.error],
    };
  }

  if (processed.kind === 'applied') {
    run.state = processed.state;
    run.seenEventKeys.set(input.idempotencyKey, processed.state);
  }

  if (processed.state !== 'ACCEPTED' || processed.kind === 'noop_idempotent') {
    return {
      run,
      ownershipLedger: [...input.ownershipLedger],
      cloutLedger: [...input.cloutLedger],
      story: null,
      errors,
    };
  }

  // Newswire + CLOUT + ownership only on ACCEPTED production path.
  const prodOk =
    canWriteProductionOwnership(run.evidenceSource, input.appEnv) &&
    allowsProductionOwnership(input.districtKind);

  if (!prodOk) {
    errors.push(
      run.evidenceSource === 'simulation'
        ? 'simulation_blocked_from_production_ownership'
        : 'development_district_blocks_production_ownership',
    );
    return {
      run,
      ownershipLedger: [...input.ownershipLedger],
      cloutLedger: [...input.cloutLedger],
      story: null,
      errors,
    };
  }

  const capture = applyCapture({
    territory: input.territory,
    current: input.currentOwnership,
    command: {
      ...input.captureCommand,
      isSimulation: false,
      allowProductionWrite: true,
    },
    seenIdempotencyKeys: new Set(input.ownershipLedger.map((e) => e.idempotencyKey)),
  });

  if (!capture.ok) {
    errors.push(capture.error);
    return {
      run,
      ownershipLedger: [...input.ownershipLedger],
      cloutLedger: [...input.cloutLedger],
      story: null,
      errors,
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
    createdAt: input.occurredAt,
  };
  const ownershipAppend = appendOwnershipLedgerEntry(input.ownershipLedger, ownershipEntry);

  const cloutEntry: CloutLedgerEntry = {
    id: input.ids.cloutEntryId,
    memberId: input.member.id,
    runId: run.runId,
    territoryDefinitionId: input.territory.territoryDefinitionId,
    delta: cloutDeltaForReason('verified_capture_accepted'),
    reason: 'verified_capture_accepted',
    idempotencyKey: `clout:${run.runId}:verified_capture_accepted`,
    createdAt: input.occurredAt,
  };
  const cloutAppend = appendCloutLedgerEntry(input.cloutLedger, cloutEntry);

  // Duplicate-award prevention: second call with same clout key is noop.
  if (!cloutAppend.result.ok) {
    errors.push(cloutAppend.result.error);
  }

  const story =
    cloutAppend.result.ok && cloutAppend.result.kind === 'appended'
      ? buildCaptureAcceptedStory({
          storyId: input.ids.storyId,
          memberId: input.member.id,
          displayName: input.member.displayName,
          runId: run.runId,
          territorySlug: input.territoryMeta.slug,
          territoryName: input.territoryMeta.name,
          clout: { delta: cloutEntry.delta },
          createdAt: input.occurredAt,
        })
      : null;

  return {
    run,
    ownershipLedger: ownershipAppend.ledger,
    cloutLedger: cloutAppend.ledger,
    story,
    errors,
  };
}
