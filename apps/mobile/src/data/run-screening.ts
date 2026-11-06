/** Editorial screening for candidate driving events.
 * Only all-PASS evidence enables a future RUN review; this does not authorize
 * production GPS capture or confer territory ownership.
 */
export type ScreeningResult = 'pass' | 'fail' | 'unverified';
export type RunScreening = {
  legalRoadAndTurns: ScreeningResult;
  sustainedFlow: ScreeningResult;
  minimalPedestrians: ScreeningResult;
  lowStopAndGo: ScreeningResult;
  supercarClearance: ScreeningResult;
  accessAndClosures: ScreeningResult;
  roadSnappedGeometry: ScreeningResult;
};

export const UNVERIFIED_SCREENING: RunScreening = {
  legalRoadAndTurns: 'unverified',
  sustainedFlow: 'unverified',
  minimalPedestrians: 'unverified',
  lowStopAndGo: 'unverified',
  supercarClearance: 'unverified',
  accessAndClosures: 'unverified',
  roadSnappedGeometry: 'unverified',
};

export function runScreeningReady(screening: RunScreening): boolean {
  return Object.values(screening).every(result => result === 'pass');
}

export function runScreeningBlockers(screening: RunScreening): string[] {
  return Object.entries(screening)
    .filter(([, result]) => result !== 'pass')
    .map(([key, value]) => key + ': ' + value);
}
