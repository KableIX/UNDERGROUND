/**
 * Simulated capture → Newswire fixtures.
 * Hard-gated: isSimulation + ownershipWriteAllowed false + cloutDelta 0.
 */
import { buildSimCaptureStory, type SimNewswireStory } from '../../packages/domain/src/sim-newswire';
import { siliconValleyDevTerritories } from './silicon-valley-dev-territories';

const route = siliconValleyDevTerritories[0]!;

export const simNewswireStoryFixture: SimNewswireStory = buildSimCaptureStory({
  storyId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee01',
  memberId: '33333333-3333-4333-8333-333333333301',
  displayName: 'STARK',
  runId: 'dddddddd-dddd-4ddd-8ddd-dddddddddd01',
  territorySlug: route.slug,
  territoryName: route.name,
  createdAt: '2026-11-05T00:00:00.000Z',
});
