import {
  type OwnershipTrack,
  type SimNewswireStory,
  type TerritoryDefinition,
} from '@underground/domain';
import { runSimTerritoryCaptureToNewswire } from '@underground/territory-engine';
import { newswireStoryFixtures } from '../data/newswire';

type FeedListener = () => void;

const simStories: SimNewswireStory[] = [];
const listeners = new Set<FeedListener>();
let simSeq = 0;

function notify() {
  for (const listener of listeners) listener();
}

export function subscribeSimNewswire(listener: FeedListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function listSimNewswireStories(): SimNewswireStory[] {
  return [...simStories];
}

export function appendSimNewswireStory(story: SimNewswireStory): void {
  if (simStories.some((s) => s.id === story.id)) return;
  simStories.unshift(story);
  notify();
}

export function clearSimNewswireStories(): void {
  simStories.length = 0;
  notify();
}

/** Combined feed: live sim stories first, then production fixtures. */
export function listNewswireFeed() {
  return {
    sim: listSimNewswireStories(),
    productionFixtures: newswireStoryFixtures,
  };
}

function nextSimUuid(kind: 'run' | 'story'): string {
  simSeq += 1;
  const n = simSeq.toString(16).padStart(12, '0');
  if (kind === 'run') {
    return `dddddddd-dddd-4dd1-8dd1-${n}`;
  }
  return `eeeeeeee-eeee-4ee1-8ee1-${n}`;
}

export function runSimCaptureWorkflow(input: {
  territory: TerritoryDefinition;
  track: OwnershipTrack;
  challengerId: string;
  displayName: string;
  points: number;
}):
  | { ok: true; story: SimNewswireStory; ownershipWriteAllowed: false }
  | { ok: false; error: string } {
  const occurredAt = new Date().toISOString();
  const runId = nextSimUuid('run');
  const storyId = nextSimUuid('story');
  const result = runSimTerritoryCaptureToNewswire({
    districtKind: 'development',
    territory: {
      territoryDefinitionId: input.territory.id,
      districtSlug: input.territory.districtSlug,
      status: input.territory.status,
      eligibleWeight: input.territory.eligibleWeight,
      version: input.territory.version,
    },
    territoryMeta: {
      slug: input.territory.slug,
      name: input.territory.name,
    },
    track: input.track,
    member: {
      id: input.challengerId,
      displayName: input.displayName,
    },
    points: input.points,
    runId,
    storyId,
    idempotencyKey: `sim:${input.territory.slug}:${runId}`,
    occurredAt,
  });

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  return {
    ok: true,
    story: result.story,
    ownershipWriteAllowed: false,
  };
}
