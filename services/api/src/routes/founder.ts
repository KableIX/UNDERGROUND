import {
  FOUNDER_DISPLAY_NAME,
  FOUNDER_MEMBER_NUMBER,
  type Member,
} from '@underground/domain';
import { ProvisionFounderRequestSchema } from '../contracts';

/**
 * Audited founder provisioning skeleton.
 * Binds auth user → member 000001 / STARK.
 * Founder flag is independent of admin role.
 *
 * Real persistence requires SUPABASE_SERVICE_ROLE_KEY + operator audit token.
 * This module returns a dry-run plan when credentials are absent.
 */
export type FounderProvisionPlan = {
  mode: 'dry_run' | 'persist';
  member: Pick<
    Member,
    'authUserId' | 'memberNumber' | 'displayName' | 'isFounder' | 'role'
  >;
  notes: string[];
};

export function planFounderProvision(raw: unknown): FounderProvisionPlan {
  const request = ProvisionFounderRequestSchema.parse(raw);

  return {
    mode: 'dry_run',
    member: {
      authUserId: request.authUserId,
      memberNumber: FOUNDER_MEMBER_NUMBER,
      displayName: FOUNDER_DISPLAY_NAME,
      isFounder: true,
      role: 'member',
    },
    notes: [
      'Founder is not admin — role remains member unless separately granted.',
      'Persistence blocked until Supabase service role and operator audit path are configured.',
      'Use supabase/seed/founder_000001.sql when credentials exist.',
    ],
  };
}
