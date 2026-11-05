import { describe, expect, it } from 'vitest';
import {
  nextMapStyle, regionAround, SANTA_CLARA_START, WORLD_START,
} from './world-map-config';

describe('worldwide map controls (independent from territory definitions)', () => {
  it('has real global and local starting cameras', () => {
    expect(SANTA_CLARA_START.latitudeDelta).toBeLessThan(1);
    expect(WORLD_START.latitudeDelta).toBeGreaterThan(60);
  });
  it('allows recentering at any valid world coordinate', () => {
    expect(regionAround(-33.8688, 151.2093).latitude).toBe(-33.8688);
    expect(regionAround(35.6895, 139.6917).longitude).toBe(139.6917);
    expect(regionAround(0, 180).longitude).toBe(180);
  });
  it('rejects invalid or non-finite GPS coordinates', () => {
    expect(() => regionAround(100, 0)).toThrow();
    expect(() => regionAround(0, -181)).toThrow();
    expect(() => regionAround(Number.NaN, 1)).toThrow();
    expect(() => regionAround(5, 8, -1)).toThrow();
  });
  it('cycles road, satellite, and hybrid basemaps', () => {
    expect(nextMapStyle('standard')).toBe('satellite');
    expect(nextMapStyle('satellite')).toBe('hybrid');
    expect(nextMapStyle('hybrid')).toBe('standard');
  });
});
