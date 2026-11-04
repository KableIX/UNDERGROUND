import { describe, expect, it } from 'vitest';
import { CLOUT_AWARDS, cloutDeltaForReason } from '../src/clout';
import { buildCaptureAcceptedStory } from '../src/newswire';

describe('CLOUT + Newswire on ACCEPTED', () => {
  it('uses deterministic capture award', () => {
    expect(cloutDeltaForReason('verified_capture_accepted')).toBe(
      CLOUT_AWARDS.verified_capture_accepted,
    );
  });

  it('builds capture_accepted_v1 story without fabricated achievements', () => {
    const story = buildCaptureAcceptedStory({
      storyId: 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
      memberId: '33333333-3333-4333-8333-333333333301',
      displayName: 'STARK',
      runId: '22222222-2222-4222-8222-222222222201',
      territorySlug: 'highway-1-big-sur',
      territoryName: 'Highway 1 / Big Sur',
      clout: { delta: 25 },
      createdAt: '2026-11-04T00:00:00.000Z',
    });
    expect(story.templateId).toBe('capture_accepted_v1');
    expect(story.headline).toBe('STARK secured Highway 1 / Big Sur');
    expect(story.body).toContain('CLOUT +25');
    expect(story.body.toLowerCase()).not.toContain('legendary');
    expect(story.body.toLowerCase()).not.toContain('first ever');
  });
});
