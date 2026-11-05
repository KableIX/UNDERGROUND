import { z } from 'zod';
import type { CloutLedgerEntry } from './clout';

export const NewswireStorySchema = z.object({
  id: z.string().uuid(),
  memberId: z.string().uuid(),
  runId: z.string().uuid(),
  territorySlug: z.string().min(1),
  territoryName: z.string().min(1),
  templateId: z.literal('capture_accepted_v1'),
  headline: z.string().min(1),
  body: z.string().min(1),
  cloutDelta: z.number().int(),
  createdAt: z.string().datetime(),
});

export type NewswireStory = z.infer<typeof NewswireStorySchema>;

/**
 * Deterministic Newswire template on ACCEPTED.
 * No fabricated achievements — only verified capture acceptance facts.
 */
export function buildCaptureAcceptedStory(input: {
  storyId: string;
  memberId: string;
  displayName: string;
  runId: string;
  territorySlug: string;
  territoryName: string;
  clout: Pick<CloutLedgerEntry, 'delta'>;
  createdAt: string;
}): NewswireStory {
  return NewswireStorySchema.parse({
    id: input.storyId,
    memberId: input.memberId,
    runId: input.runId,
    territorySlug: input.territorySlug,
    territoryName: input.territoryName,
    templateId: 'capture_accepted_v1',
    headline: `${input.displayName} secured ${input.territoryName}`,
    body: `Verified run accepted on ${input.territoryName}. CLOUT +${input.clout.delta}.`,
    cloutDelta: input.clout.delta,
    createdAt: input.createdAt,
  });
}
