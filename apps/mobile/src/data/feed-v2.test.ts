import { describe, expect, it } from 'vitest';
import { feedFixtureCards } from './feed-v2';

describe('newswire v2 feed fixtures', () => {
  it('labels every fixture card as fixture provenance', () => {
    expect(feedFixtureCards.length).toBeGreaterThan(0);
    for (const card of feedFixtureCards) {
      expect(card.provenance).toBe('fixture');
      expect(card.badge.toUpperCase()).toContain('FIXTURE');
    }
  });

  it('does not invent verified capture provenance for presentation fixtures', () => {
    const captures = feedFixtureCards.filter((c) => c.kind === 'capture');
    expect(captures.every((c) => c.provenance !== 'live')).toBe(true);
  });
});
