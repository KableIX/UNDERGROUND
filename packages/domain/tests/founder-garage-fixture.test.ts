import { describe, expect, it } from 'vitest';
import { founderGarageSeed } from '../../../tests/fixtures/founder-garage';

describe('founder garage fixture', () => {
  it('keeps founder ≠ admin and marks all media as placeholders', () => {
    expect(founderGarageSeed.memberNumber).toBe('000001');
    expect(founderGarageSeed.displayName).toBe('STARK');
    expect(founderGarageSeed.isFounder).toBe(true);
    expect(founderGarageSeed.role).toBe('member');
    expect(founderGarageSeed.vehicle.visibility).toBe('friends');
    expect(founderGarageSeed.media.every((m) => m.isPlaceholder)).toBe(true);
    expect(founderGarageSeed.media.every((m) => m.storagePath.includes('PLACEHOLDER'))).toBe(
      true,
    );
    expect(founderGarageSeed.mods.some((m) => m.status === 'installed')).toBe(true);
    expect(founderGarageSeed.mods.some((m) => m.status === 'pending')).toBe(true);
  });
});
