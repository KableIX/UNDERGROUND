import { POOR_ACCURACY_M } from './constants';
import type { GpsQualityBand, GpsSample } from './types';

export function bandForAccuracy(accuracyM: number | null): GpsQualityBand {
  if (accuracyM == null || !Number.isFinite(accuracyM)) return 'unknown';
  if (accuracyM <= 15) return 'good';
  if (accuracyM <= POOR_ACCURACY_M) return 'fair';
  return 'poor';
}

/** Aggregate session quality from sample accuracies (ignores nulls). */
export function aggregateGpsQuality(samples: readonly GpsSample[]): GpsQualityBand {
  const accuracies = samples
    .map(s => s.accuracyM)
    .filter((v): v is number => v != null && Number.isFinite(v));
  if (accuracies.length === 0) return 'unknown';
  const mean = accuracies.reduce((a, b) => a + b, 0) / accuracies.length;
  return bandForAccuracy(mean);
}
