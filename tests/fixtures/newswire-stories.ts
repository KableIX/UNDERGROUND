/**
 * Deterministic Newswire fixtures — capture_accepted_v1 only.
 * No fabricated achievements.
 */
import { buildCaptureAcceptedStory, type NewswireStory } from '../../packages/domain/src/newswire';

export const newswireStoryFixtures: NewswireStory[] = [
  buildCaptureAcceptedStory({
    storyId: 'cccccccc-cccc-4ccc-8ccc-cccccccccc01',
    memberId: '33333333-3333-4333-8333-333333333301',
    displayName: 'STARK',
    runId: '22222222-2222-4222-8222-222222222201',
    territorySlug: 'highway-1-big-sur',
    territoryName: 'Highway 1 / Big Sur',
    clout: { delta: 25 },
    createdAt: '2026-11-04T01:00:00.000Z',
  }),
  buildCaptureAcceptedStory({
    storyId: 'cccccccc-cccc-4ccc-8ccc-cccccccccc02',
    memberId: '33333333-3333-4333-8333-333333333302',
    displayName: 'PACIFIC',
    runId: '22222222-2222-4222-8222-222222222202',
    territorySlug: 'seventeen-mile-drive',
    territoryName: '17-Mile Drive',
    clout: { delta: 25 },
    createdAt: '2026-11-04T02:00:00.000Z',
  }),
];
