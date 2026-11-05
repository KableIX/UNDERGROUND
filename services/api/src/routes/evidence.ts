import { RunEvidenceBundleSchema, reviewEvidenceBundle } from '@underground/domain';
import { z } from 'zod';

export const EvidenceReviewRequestSchema = z.object({
  bundle: RunEvidenceBundleSchema,
  allowSimulationAccept: z.boolean().default(false),
});

export function handleEvidenceReview(raw: unknown) {
  const request = EvidenceReviewRequestSchema.parse(raw);
  return reviewEvidenceBundle(request.bundle, {
    allowSimulationAccept: request.allowSimulationAccept,
  });
}
