export {
  formatDistanceM,
  formatDurationMs,
} from '@underground/drive-tracking';

export function formatTripStart(startedAtMs: number): string {
  const d = new Date(startedAtMs);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function classificationLabel(
  c: 'ordinary' | 'territory_attempt' | 'verified_capture',
): string {
  switch (c) {
    case 'ordinary':
      return 'Ordinary drive';
    case 'territory_attempt':
      return 'Territory attempt';
    case 'verified_capture':
      return 'Verified capture';
    default:
      return c;
  }
}

export function gpsQualityLabel(q: string): string {
  switch (q) {
    case 'good':
      return 'GPS good';
    case 'fair':
      return 'GPS fair';
    case 'poor':
      return 'GPS poor';
    default:
      return 'GPS unknown';
  }
}
