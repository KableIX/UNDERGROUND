import { describe, expect, it } from 'vitest';
import {
  TripClassificationSchema,
  canLocallyPromoteToVerifiedCapture,
  isServerVerifiedCapture,
} from '../src/trip';

describe('trip classification contracts', () => {
  it('parses classifications and blocks local verified promotion', () => {
    expect(TripClassificationSchema.parse('ordinary')).toBe('ordinary');
    expect(isServerVerifiedCapture('verified_capture')).toBe(true);
    expect(isServerVerifiedCapture('ordinary')).toBe(false);
    expect(canLocallyPromoteToVerifiedCapture()).toBe(false);
  });
});
