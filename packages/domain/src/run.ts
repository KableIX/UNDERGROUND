import { z } from 'zod';

export const RunPipelineStateSchema = z.enum([
  'CREATED',
  'START_VERIFIED',
  'RECORDING',
  'ROUTE_COMPLETE',
  'FINISH_PENDING',
  'EVIDENCE_REVIEW',
  'ACCEPTED',
  'REJECTED',
]);

export const EvidenceSourceSchema = z.enum(['production', 'simulation']);

export const RunSchema = z.object({
  id: z.string().uuid(),
  memberId: z.string().uuid(),
  territoryDefinitionId: z.string().uuid(),
  state: RunPipelineStateSchema,
  evidenceSource: EvidenceSourceSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type RunPipelineState = z.infer<typeof RunPipelineStateSchema>;
export type EvidenceSource = z.infer<typeof EvidenceSourceSchema>;
export type Run = z.infer<typeof RunSchema>;

/** Simulation evidence must never write production ownership. */
export function canWriteProductionOwnership(
  evidenceSource: EvidenceSource,
  appEnv: 'development' | 'staging' | 'production',
): boolean {
  if (evidenceSource === 'simulation') return false;
  if (appEnv === 'development' && evidenceSource !== 'production') return false;
  return evidenceSource === 'production';
}
