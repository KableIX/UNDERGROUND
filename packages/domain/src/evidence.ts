import { z } from 'zod';
import type { EvidenceSource } from './run';

export const OdometerEvidenceSchema = z.object({
  photoStoragePath: z.string().min(1),
  readingMiles: z.number().nonnegative().optional(),
  capturedAt: z.string().datetime(),
  isPlaceholder: z.boolean().default(false),
});

export const FinishLinePhotoSchema = z.object({
  photoStoragePath: z.string().min(1),
  capturedAt: z.string().datetime(),
  withinFinishZone: z.boolean(),
  isPlaceholder: z.boolean().default(false),
});

export const RunEvidenceBundleSchema = z.object({
  runId: z.string().uuid(),
  source: z.enum(['production', 'simulation']),
  startOdometer: OdometerEvidenceSchema,
  endOdometer: OdometerEvidenceSchema,
  finishLinePhoto: FinishLinePhotoSchema,
});

export type OdometerEvidence = z.infer<typeof OdometerEvidenceSchema>;
export type FinishLinePhoto = z.infer<typeof FinishLinePhotoSchema>;
export type RunEvidenceBundle = z.infer<typeof RunEvidenceBundleSchema>;

export type EvidenceReviewDecision =
  | { ok: true; decision: 'ACCEPTED' }
  | {
      ok: false;
      decision: 'REJECTED';
      reason:
        | 'missing_start_odometer'
        | 'missing_end_odometer'
        | 'missing_finish_photo'
        | 'finish_zone_miss'
        | 'simulation_not_allowed_for_production'
        | 'placeholder_not_allowed_in_production'
        | 'odometer_inconsistent';
    };

/**
 * Server-side evidence review stub. Production path rejects placeholders/sims.
 */
export function reviewEvidenceBundle(
  bundle: RunEvidenceBundle,
  opts: { allowSimulationAccept: boolean },
): EvidenceReviewDecision {
  if (bundle.source === 'simulation' && !opts.allowSimulationAccept) {
    return {
      ok: false,
      decision: 'REJECTED',
      reason: 'simulation_not_allowed_for_production',
    };
  }

  if (!bundle.startOdometer.photoStoragePath) {
    return { ok: false, decision: 'REJECTED', reason: 'missing_start_odometer' };
  }
  if (!bundle.endOdometer.photoStoragePath) {
    return { ok: false, decision: 'REJECTED', reason: 'missing_end_odometer' };
  }
  if (!bundle.finishLinePhoto.photoStoragePath) {
    return { ok: false, decision: 'REJECTED', reason: 'missing_finish_photo' };
  }
  if (!bundle.finishLinePhoto.withinFinishZone) {
    return { ok: false, decision: 'REJECTED', reason: 'finish_zone_miss' };
  }

  if (
    bundle.source === 'production' &&
    (bundle.startOdometer.isPlaceholder ||
      bundle.endOdometer.isPlaceholder ||
      bundle.finishLinePhoto.isPlaceholder)
  ) {
    return {
      ok: false,
      decision: 'REJECTED',
      reason: 'placeholder_not_allowed_in_production',
    };
  }

  if (
    bundle.startOdometer.readingMiles !== undefined &&
    bundle.endOdometer.readingMiles !== undefined &&
    bundle.endOdometer.readingMiles < bundle.startOdometer.readingMiles
  ) {
    return { ok: false, decision: 'REJECTED', reason: 'odometer_inconsistent' };
  }

  return { ok: true, decision: 'ACCEPTED' };
}

export function evidenceSourceLabel(source: EvidenceSource): string {
  return source;
}
