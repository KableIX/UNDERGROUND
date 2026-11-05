import { z } from 'zod';
import {
  reviewEvidenceBundle,
  type RunEvidenceBundle,
  type EvidenceReviewDecision,
} from './evidence';
import type { RunPipelineState } from './run';

/**
 * End-to-end verified capture workflow stages (server-side contracts).
 * Production captures stay disabled until district/geometry gates open.
 */

export const CaptureWorkflowStageSchema = z.enum([
  'odometer_start_photo',
  'gps_recording',
  'checkpoints',
  'finish_zone',
  'parking_window',
  'odometer_end_photo',
  'evidence_review',
  'ownership_transfer',
  'majority_crown',
  'newswire',
  'clout',
  'archive',
]);

export type CaptureWorkflowStage = z.infer<typeof CaptureWorkflowStageSchema>;

export const CAPTURE_WORKFLOW_ORDER: readonly CaptureWorkflowStage[] = [
  'odometer_start_photo',
  'gps_recording',
  'checkpoints',
  'finish_zone',
  'parking_window',
  'odometer_end_photo',
  'evidence_review',
  'ownership_transfer',
  'majority_crown',
  'newswire',
  'clout',
  'archive',
] as const;

export type CaptureWorkflowFixture = {
  runId: string;
  memberId: string;
  territoryDefinitionId: string;
  districtKind: 'development' | 'production_candidate' | 'production';
  evidenceSource: 'production' | 'simulation';
  productionCapturesEnabled: boolean;
  bundle: RunEvidenceBundle;
  checkpointsReached: number;
  checkpointsRequired: number;
  finishZoneOk: boolean;
  parkingWindowOk: boolean;
  pipelineState: RunPipelineState;
};

export type CaptureWorkflowResult = {
  stagesCompleted: CaptureWorkflowStage[];
  blockedAt: CaptureWorkflowStage | null;
  blockReason: string | null;
  evidence: EvidenceReviewDecision | null;
  ownershipWriteAllowed: boolean;
  cloutDelta: number;
  newswireEmitted: boolean;
  archived: boolean;
};

/**
 * Deterministic E2E workflow evaluator for fixtures/tests.
 * Never invents success for production when gates are closed.
 */
export function evaluateCaptureWorkflow(
  fixture: CaptureWorkflowFixture,
): CaptureWorkflowResult {
  const stagesCompleted: CaptureWorkflowStage[] = [];
  const fail = (
    blockedAt: CaptureWorkflowStage,
    blockReason: string,
  ): CaptureWorkflowResult => ({
    stagesCompleted,
    blockedAt,
    blockReason,
    evidence: null,
    ownershipWriteAllowed: false,
    cloutDelta: 0,
    newswireEmitted: false,
    archived: false,
  });

  if (!fixture.bundle.startOdometer.photoStoragePath) {
    return fail('odometer_start_photo', 'missing_start_odometer');
  }
  stagesCompleted.push('odometer_start_photo');

  if (fixture.pipelineState === 'CREATED') {
    return fail('gps_recording', 'gps_not_started');
  }
  stagesCompleted.push('gps_recording');

  if (fixture.checkpointsReached < fixture.checkpointsRequired) {
    return fail('checkpoints', 'checkpoint_miss');
  }
  stagesCompleted.push('checkpoints');

  if (!fixture.finishZoneOk) {
    return fail('finish_zone', 'finish_zone_miss');
  }
  stagesCompleted.push('finish_zone');

  if (!fixture.parkingWindowOk) {
    return fail('parking_window', 'parking_window_expired');
  }
  stagesCompleted.push('parking_window');

  if (!fixture.bundle.endOdometer.photoStoragePath) {
    return fail('odometer_end_photo', 'missing_end_odometer');
  }
  stagesCompleted.push('odometer_end_photo');

  const allowSim = fixture.districtKind === 'development';
  const evidence = reviewEvidenceBundle(fixture.bundle, {
    allowSimulationAccept: allowSim,
  });
  stagesCompleted.push('evidence_review');
  if (!evidence.ok) {
    return {
      stagesCompleted,
      blockedAt: 'evidence_review',
      blockReason: evidence.reason,
      evidence,
      ownershipWriteAllowed: false,
      cloutDelta: 0,
      newswireEmitted: false,
      archived: true,
    };
  }

  const productionOk =
    fixture.productionCapturesEnabled &&
    fixture.districtKind === 'production' &&
    fixture.evidenceSource === 'production';
  const ownershipWriteAllowed = productionOk;

  if (!ownershipWriteAllowed) {
    // Dev/sim path: may emit sim newswire without ownership/clout.
    const simPath =
      fixture.districtKind === 'development' && fixture.evidenceSource === 'simulation';
    return {
      stagesCompleted: [
        ...stagesCompleted,
        'ownership_transfer',
        'majority_crown',
        'newswire',
        'clout',
        'archive',
      ],
      blockedAt: null,
      blockReason: productionOk ? null : 'production_captures_disabled_or_non_prod_district',
      evidence,
      ownershipWriteAllowed: false,
      cloutDelta: 0,
      newswireEmitted: simPath,
      archived: true,
    };
  }

  stagesCompleted.push('ownership_transfer', 'majority_crown', 'newswire', 'clout', 'archive');
  return {
    stagesCompleted,
    blockedAt: null,
    blockReason: null,
    evidence,
    ownershipWriteAllowed: true,
    cloutDelta: 25,
    newswireEmitted: true,
    archived: true,
  };
}
