import { describe, expect, it } from 'vitest';
import { allowsProductionOwnership } from '../src/district-kind';

describe('district kind gate', () => {
  it('allows production_candidate and blocks development', () => {
    expect(allowsProductionOwnership('production_candidate')).toBe(true);
    expect(allowsProductionOwnership('development')).toBe(false);
  });
});
