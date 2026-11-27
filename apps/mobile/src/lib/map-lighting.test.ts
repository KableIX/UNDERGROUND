import { describe, expect, it } from 'vitest';
import { mapLighting, solarElevation } from './map-lighting';

const santaClara = { lat: 37.35, lon: -121.96 };
const at = (iso: string) => mapLighting(santaClara.lat, santaClara.lon, Date.parse(iso));
const elevation = (iso: string) => solarElevation(santaClara.lat, santaClara.lon, Date.parse(iso));

describe('map lighting at the visible location', () => {
  it('matches the Santa Clara almanac on November 10, including its UTC date rollover', () => {
    // Approximate apparent sunrise 06:42, solar noon 11:51, sunset 17:01 PST.
    expect(Math.abs(elevation('2026-11-10T06:42:00-08:00') + 0.833)).toBeLessThan(0.6);
    expect(Math.abs(elevation('2026-11-10T11:51:00-08:00') - 35.3)).toBeLessThan(0.6);
    expect(Math.abs(elevation('2026-11-10T17:01:00-08:00') + 0.833)).toBeLessThan(0.6);
  });
  it('fades from dawn into daylight and from daylight through dusk to night', () => {
    const dawn = at('2026-11-10T06:30:00-08:00');
    const noon = at('2026-11-10T12:00:00-08:00');
    const dusk = at('2026-11-10T17:20:00-08:00');
    const night = at('2026-11-10T19:12:00-08:00');
    expect(noon.daylight).toBe(1);
    expect(night.daylight).toBe(0);
    for (const twilight of [dawn, dusk]) {
      expect(twilight.daylight).toBeGreaterThan(0);
      expect(twilight.daylight).toBeLessThan(1);
      expect(twilight.tint).not.toBe(noon.tint);
      expect(twilight.tint).not.toBe(night.tint);
    }
    expect(night.interfaceStyle).toBe('dark');
    expect(noon.interfaceStyle).toBe('light');
  });
  it('uses map longitude for remote previews and latitude for polar seasons', () => {
    const timestamp = Date.parse('2026-11-11T03:12:00Z');
    expect(mapLighting(35.68, 139.69, timestamp).daylight).toBe(1);
    expect(mapLighting(santaClara.lat, santaClara.lon, timestamp).daylight).toBe(0);
    const summer = Date.parse('2028-06-21T00:00Z');
    expect(mapLighting(90, 180, summer).daylight).toBe(1);
    expect(mapLighting(-90, -180, summer).daylight).toBe(0);
  });
});
