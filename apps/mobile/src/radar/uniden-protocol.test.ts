import { describe, expect, it } from 'vitest';
import { isUnidenHeartbeat, parseUnidenAlerts, unidenModel } from './uniden-protocol';

describe('community-documented Uniden packets', () => {
  it('decodes the published eight-field Ka example', () => {
    expect(parseUnidenAlerts('1,00,KA,3,33,33.7850,R,1&0&0&0')).toEqual({
      recognized: true,
      alerts: [{ band: 'KA', strength: 3, direction: 'rear', frequencyGhz: 33.785, muted: false }],
    });
  });
  it('supports multiple observations and the optional ninth field', () => {
    const parsed = parseUnidenAlerts('1,00,K,1,14,24.1230,F,2,0&1,00,KA,8,77,35.4780,S,1&0&0');
    expect(parsed.recognized).toBe(true);
    expect(parsed.alerts).toHaveLength(2);
    expect(parsed.alerts[0]?.muted).toBe(true);
  });
  it('distinguishes an explicit empty snapshot from missing/corrupted data', () => {
    expect(parseUnidenAlerts('0&0&0&0')).toEqual({ recognized: true, alerts: [] });
    for (const packet of [
      '',
      '0',
      '0&0&0',
      '0&bad&0&0',
      '1,00,KA,9,12,34.7,F,1&0&0&0',
      '1,00,NEW,3,12,34.7,F,1&0&0&0',
    ]) {
      expect(parseUnidenAlerts(packet).recognized).toBe(false);
    }
  });
  it('keeps valid warnings when another slot is unreadable', () => {
    const parsed = parseUnidenAlerts('1,00,KA,3,33,33.7850,F,1&garbled&0&0');
    expect(parsed.recognized).toBe(false);
    expect(parsed.alerts).toHaveLength(1);
  });
  it('does not confuse laser identifiers with GHz; unknown mute stays unknown', () => {
    const parsed = parseUnidenAlerts('1,00,LASER,8,40,4,F,9&0&0&0');
    expect(parsed.alerts[0]).toMatchObject({ frequencyGhz: null, muted: null });
  });
  it('recognizes heartbeat shape without inventing coordinates or units', () => {
    expect(isUnidenHeartbeat('12.1&0&W,0,193,C&0&12&D&D')).toBe(true);
    expect(isUnidenHeartbeat('12.1&0&W,0,193,C')).toBe(false);
  });
  it('does not offer stock R7, R4, or arbitrary device names', () => {
    expect(unidenModel('R8W@123')).toBe('uniden_r8w');
    expect(unidenModel('R8@456')).toBe('uniden_r8');
    for (const name of ['R7', 'R4', 'R80', 'R8fake', 'My headphones', null])
      expect(unidenModel(name)).toBeNull();
  });
});
