import { describe, expect, it, beforeEach } from 'vitest';
import { FOUNDER_DISPLAY_NAME, FOUNDER_MEMBER_NUMBER } from '@underground/domain';
import { siliconValleyDevTerritories } from '../data/silicon-valley-dev';
import { draftMontereyTerritories } from '../data/monterey-draft';
import { founderGarageSeed } from '../data/founder-garage';
import { pendingClubInvite, pendingFriendship } from '../data/clubs';
import { rankingFixtures } from '../data/rankings';
import {
  appendSimNewswireStory,
  clearSimNewswireStories,
  listNewswireFeed,
  runSimCaptureWorkflow,
} from './sim-workflow';

describe('mobile sim capture → newswire workflow', () => {
  beforeEach(() => {
    clearSimNewswireStories();
  });

  it('publishes sim story with ownershipWriteAllowed false and CLOUT +0', () => {
    const territory = siliconValleyDevTerritories[0]!;
    const result = runSimCaptureWorkflow({
      territory,
      track: 'solo',
      challengerId: '33333333-3333-4333-8333-333333333301',
      displayName: 'STARK',
      points: 10,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.ownershipWriteAllowed).toBe(false);
    expect(result.story.cloutDelta).toBe(0);
    expect(result.story.templateId).toBe('sim_capture_v1');
    appendSimNewswireStory(result.story);
    const feed = listNewswireFeed();
    expect(feed.sim).toHaveLength(1);
    expect(feed.sim[0]?.id).toBe(result.story.id);
  });

  it('dedupes identical story ids on append', () => {
    const territory = siliconValleyDevTerritories[0]!;
    const result = runSimCaptureWorkflow({
      territory,
      track: 'solo',
      challengerId: '33333333-3333-4333-8333-333333333301',
      displayName: 'STARK',
      points: 10,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    appendSimNewswireStory(result.story);
    appendSimNewswireStory(result.story);
    expect(listNewswireFeed().sim).toHaveLength(1);
  });

  it('keeps Monterey draft fixtures labeled draft / production_candidate only', () => {
    expect(draftMontereyTerritories.length).toBeGreaterThan(0);
    for (const t of draftMontereyTerritories) {
      expect(t.status).toBe('draft');
      expect(t.districtSlug).toBe('monterey');
      expect(t.geometryLabel).toMatch(/DRAFT|PLACEHOLDER/i);
    }
  });

  it('keeps founder R8 garage + friends fixtures consistent without Supabase', () => {
    expect(founderGarageSeed.memberNumber).toBe(FOUNDER_MEMBER_NUMBER);
    expect(founderGarageSeed.displayName).toBe(FOUNDER_DISPLAY_NAME);
    expect(founderGarageSeed.isFounder).toBe(true);
    expect(founderGarageSeed.role).toBe('member');
    expect(founderGarageSeed.vehicle.make).toBe('Audi');
    expect(founderGarageSeed.vehicle.model).toBe('R8');
    expect(founderGarageSeed.media.every((m) => m.isPlaceholder)).toBe(true);
    expect(pendingFriendship.status).toBe('pending');
    expect(pendingClubInvite.status).toBe('pending');
    expect(rankingFixtures.length).toBeGreaterThan(0);
  });
});
