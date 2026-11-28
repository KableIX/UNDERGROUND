import { describe, expect, it } from 'vitest';
import { safeLoad } from './safe';

describe('safeLoad', () => {
  it('returns the module when it loads', () => {
    expect(safeLoad(() => ({ ok: 1 }))).toEqual({ ok: 1 });
  });
  it('returns null when the native module is missing and import throws', () => {
    expect(
      safeLoad(() => {
        throw new Error("Cannot find native module 'ExpoCamera'");
      }),
    ).toBeNull();
  });
  it('returns null for undefined or null', () => {
    expect(safeLoad(() => undefined)).toBeNull();
    expect(safeLoad(() => null)).toBeNull();
  });
});
