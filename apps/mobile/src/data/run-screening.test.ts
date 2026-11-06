import { describe, expect, it } from 'vitest';
import { runScreeningBlockers, runScreeningReady, UNVERIFIED_SCREENING } from './run-screening';

describe('RUN screening policy', () => {
  it('never approves an unsurveyed attractive scenic road', () => {
    expect(runScreeningReady(UNVERIFIED_SCREENING)).toBe(false);
    expect(runScreeningBlockers(UNVERIFIED_SCREENING)).toHaveLength(7);
  });

  it('blocks heavy pedestrian conflict even when every other criterion passes', () => {
    const allPass = Object.fromEntries(
      Object.keys(UNVERIFIED_SCREENING).map(key => [key, 'pass']),
    ) as unknown as typeof UNVERIFIED_SCREENING;
    expect(runScreeningReady(allPass)).toBe(true);

    const withPedestrians = { ...allPass, minimalPedestrians: 'fail' as const };
    expect(runScreeningReady(withPedestrians)).toBe(false);
    expect(runScreeningBlockers(withPedestrians)).toEqual(['minimalPedestrians: fail']);
  });

  it('blocks stop-and-go and uncertain supercar clearance', () => {
    const screening = {
      ...UNVERIFIED_SCREENING,
      legalRoadAndTurns: 'pass' as const,
      sustainedFlow: 'pass' as const,
      minimalPedestrians: 'pass' as const,
      lowStopAndGo: 'fail' as const,
    };
    expect(runScreeningReady(screening)).toBe(false);
    expect(runScreeningBlockers(screening)).toContain('lowStopAndGo: fail');
    expect(runScreeningBlockers(screening)).toContain('supercarClearance: unverified');
  });
});
