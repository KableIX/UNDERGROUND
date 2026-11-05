import { describe, expect, it } from 'vitest';
import { buildSimCaptureStory } from '../src/sim-newswire';
import { simNewswireStoryFixture } from '../../../tests/fixtures/sim-newswire';

describe('sim newswire', () => {
  it('builds sim_capture_v1 without production CLOUT or ownership claims', () => {
    const story = buildSimCaptureStory({
      storyId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee02',
      memberId: '33333333-3333-4333-8333-333333333301',
      displayName: 'STARK',
      runId: 'dddddddd-dddd-4ddd-8ddd-dddddddddd02',
      territorySlug: 'santa-clara-el-camino',
      territoryName: 'Santa Clara El Camino Test',
      createdAt: '2026-11-05T00:00:00.000Z',
    });
    expect(story.templateId).toBe('sim_capture_v1');
    expect(story.isSimulation).toBe(true);
    expect(story.ownershipWriteAllowed).toBe(false);
    expect(story.cloutDelta).toBe(0);
    expect(story.headline.startsWith('[SIM]')).toBe(true);
    expect(story.body.toLowerCase()).toContain('no production ownership');
  });

  it('fixture stays hard-gated', () => {
    expect(simNewswireStoryFixture.isSimulation).toBe(true);
    expect(simNewswireStoryFixture.ownershipWriteAllowed).toBe(false);
    expect(simNewswireStoryFixture.cloutDelta).toBe(0);
  });
});
