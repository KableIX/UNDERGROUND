import { z } from 'zod';

/**
 * Simulation Newswire stories — clearly marked, never production ownership.
 * Template is distinct from capture_accepted_v1 so feeds can hard-gate display.
 */
export const SimNewswireStorySchema = z.object({
  id: z.string().uuid(),
  memberId: z.string().uuid(),
  runId: z.string().uuid(),
  territorySlug: z.string().min(1),
  territoryName: z.string().min(1),
  templateId: z.literal('sim_capture_v1'),
  headline: z.string().min(1),
  body: z.string().min(1),
  /** Sim stories never award production CLOUT. */
  cloutDelta: z.literal(0),
  isSimulation: z.literal(true),
  ownershipWriteAllowed: z.literal(false),
  createdAt: z.string().datetime(),
});

export type SimNewswireStory = z.infer<typeof SimNewswireStorySchema>;

export function buildSimCaptureStory(input: {
  storyId: string;
  memberId: string;
  displayName: string;
  runId: string;
  territorySlug: string;
  territoryName: string;
  createdAt: string;
}): SimNewswireStory {
  return SimNewswireStorySchema.parse({
    id: input.storyId,
    memberId: input.memberId,
    runId: input.runId,
    territorySlug: input.territorySlug,
    territoryName: input.territoryName,
    templateId: 'sim_capture_v1',
    headline: `[SIM] ${input.displayName} tested ${input.territoryName}`,
    body: `Simulated capture on ${input.territoryName}. No production ownership. CLOUT +0.`,
    cloutDelta: 0,
    isSimulation: true,
    ownershipWriteAllowed: false,
    createdAt: input.createdAt,
  });
}
