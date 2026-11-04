import { describe, expect, it } from 'vitest';
import { canWriteProductionOwnership } from '../src/run';

describe('canWriteProductionOwnership', () => {
  it('blocks simulation in every app env', () => {
    expect(canWriteProductionOwnership('simulation', 'development')).toBe(false);
    expect(canWriteProductionOwnership('simulation', 'staging')).toBe(false);
    expect(canWriteProductionOwnership('simulation', 'production')).toBe(false);
  });

  it('allows production evidence in production', () => {
    expect(canWriteProductionOwnership('production', 'production')).toBe(true);
  });
});
