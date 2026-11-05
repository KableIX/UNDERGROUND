import { z } from 'zod';
import { OwnershipTrackSchema } from '@underground/domain';

export const HealthResponseSchema = z.object({
  ok: z.literal(true),
  service: z.literal('underground-api'),
  appEnv: z.string(),
  supabaseReady: z.boolean(),
});

export const ChallengeRequestSchema = z.object({
  territoryDefinitionId: z.string().min(1),
  track: OwnershipTrackSchema,
  challengerId: z.string().min(1),
  points: z.number().positive(),
  idempotencyKey: z.string().min(1),
  isSimulation: z.boolean(),
});

export const ChallengeResponseSchema = z.discriminatedUnion('ok', [
  z.object({
    ok: z.literal(true),
    kind: z.enum(['capture', 'takeover', 'defense', 'noop_idempotent']),
    ownerId: z.string(),
    previousOwnerId: z.string().nullable(),
    points: z.number(),
  }),
  z.object({
    ok: z.literal(false),
    error: z.string(),
  }),
]);

export const ProvisionFounderRequestSchema = z.object({
  authUserId: z.string().uuid(),
  operatorToken: z.string().min(1),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;
export type ChallengeRequest = z.infer<typeof ChallengeRequestSchema>;
export type ChallengeResponse = z.infer<typeof ChallengeResponseSchema>;
export type ProvisionFounderRequest = z.infer<typeof ProvisionFounderRequestSchema>;
