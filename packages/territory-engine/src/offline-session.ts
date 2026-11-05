import type { GpsPoint } from './gps-recovery';
import { findGpsGaps, mergeGpsBuffers } from './gps-recovery';
import type { RunPipelineState } from '@underground/domain';

/**
 * Offline session recovery contracts for interrupted verified runs.
 * Device background resume remains PLANNED (needs iOS entitlement + testing).
 * Pure merge/reconcile helpers are IMPLEMENTED for tests and API dry-runs.
 */

export type OfflineSessionSnapshot = {
  runId: string;
  memberId: string;
  pipelineState: RunPipelineState;
  lastCheckpointSeq: number;
  bufferedPoints: GpsPoint[];
  interruptedAt: number;
};

export type OfflineRecoveryPlan = {
  status: 'recoverable' | 'force_evidence_review' | 'abandoned';
  mergedPoints: GpsPoint[];
  gaps: Array<{ from: number; to: number; gapMs: number }>;
  resumeState: RunPipelineState;
  notes: string;
};

export const OFFLINE_SESSION_STATUS = {
  implemented: [
    'snapshot buffer merge',
    'gap detection → force EVIDENCE_REVIEW',
    'idempotent resume state recommendation',
  ],
  planned: [
    'iOS BGLocation resume after process death',
    'secure on-device encrypted session blob',
    'server watermark ack round-trip on reconnect',
  ],
} as const;

const MAX_GAP_MS = 120_000;
const ABANDON_AFTER_MS = 6 * 60 * 60 * 1000;

export function recoverOfflineSession(
  snapshot: OfflineSessionSnapshot,
  recoveredBatch: readonly GpsPoint[],
  nowMs: number,
): OfflineRecoveryPlan {
  if (nowMs - snapshot.interruptedAt > ABANDON_AFTER_MS) {
    return {
      status: 'abandoned',
      mergedPoints: snapshot.bufferedPoints,
      gaps: [],
      resumeState: 'REJECTED',
      notes: 'session_expired_max_interrupt',
    };
  }

  if (
    snapshot.pipelineState !== 'RECORDING' &&
    snapshot.pipelineState !== 'START_VERIFIED' &&
    snapshot.pipelineState !== 'ROUTE_COMPLETE'
  ) {
    return {
      status: 'force_evidence_review',
      mergedPoints: snapshot.bufferedPoints,
      gaps: [],
      resumeState: 'EVIDENCE_REVIEW',
      notes: 'non_recording_interrupt',
    };
  }

  const mergedPoints = mergeGpsBuffers(snapshot.bufferedPoints, recoveredBatch);
  const gaps = findGpsGaps(mergedPoints, MAX_GAP_MS);
  if (gaps.length > 0) {
    return {
      status: 'force_evidence_review',
      mergedPoints,
      gaps,
      resumeState: 'EVIDENCE_REVIEW',
      notes: 'gps_gap_exceeded',
    };
  }

  return {
    status: 'recoverable',
    mergedPoints,
    gaps: [],
    resumeState: snapshot.pipelineState,
    notes: 'merged_ok',
  };
}
