import { z } from 'zod';
import {
  OwnershipTrackSchema,
  type SimNewswireStory,
} from '@underground/domain';
import { runSimTerritoryCaptureToNewswire } from '@underground/territory-engine';
import { siliconValleyDevTerritories } from '../../../../tests/fixtures/silicon-valley-dev-territories';

export const SimCaptureRequestSchema = z.object({
  territoryDefinitionId: z.string().uuid(),
  track: OwnershipTrackSchema,
  memberId: z.string().uuid(),
  displayName: z.string().min(1),
  points: z.number().positive(),
  runId: z.string().uuid(),
  storyId: z.string().uuid(),
  idempotencyKey: z.string().min(1),
  occurredAt: z.string().datetime(),
});

export type SimCaptureRequest = z.infer<typeof SimCaptureRequestSchema>;

export type SimCaptureResponse =
  | {
      ok: true;
      story: SimNewswireStory;
      ownershipWriteAllowed: false;
      districtGate: string;
    }
  | { ok: false; error: string };

/**
 * API surface for sim capture → Newswire.
 * Hard-gated to Silicon Valley development district fixtures.
 */
export function handleSimCapture(raw: unknown): SimCaptureResponse {
  const parsed = SimCaptureRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: 'invalid_sim_capture_request' };
  }

  const territory = siliconValleyDevTerritories.find(
    (t) => t.id === parsed.data.territoryDefinitionId,
  );
  if (!territory) {
    return { ok: false, error: 'territory_not_in_sv_dev_district' };
  }

  const result = runSimTerritoryCaptureToNewswire({
    districtKind: 'development',
    territory: {
      territoryDefinitionId: territory.id,
      districtSlug: territory.districtSlug,
      status: territory.status,
      eligibleWeight: territory.eligibleWeight,
      version: territory.version,
    },
    territoryMeta: { slug: territory.slug, name: territory.name },
    track: parsed.data.track,
    member: {
      id: parsed.data.memberId,
      displayName: parsed.data.displayName,
    },
    points: parsed.data.points,
    runId: parsed.data.runId,
    storyId: parsed.data.storyId,
    idempotencyKey: parsed.data.idempotencyKey,
    occurredAt: parsed.data.occurredAt,
  });

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  return {
    ok: true,
    story: result.story,
    ownershipWriteAllowed: false,
    districtGate: result.districtGate,
  };
}
