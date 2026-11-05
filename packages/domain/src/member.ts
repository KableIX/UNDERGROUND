import { z } from 'zod';

export const MemberNumberSchema = z
  .string()
  .regex(/^\d{6}$/, 'Member number must be 6 digits');

export const MemberRoleSchema = z.enum(['member', 'admin']);

export const MemberSchema = z.object({
  id: z.string().uuid(),
  authUserId: z.string().uuid(),
  memberNumber: MemberNumberSchema,
  displayName: z.string().min(1).max(64),
  isFounder: z.boolean().default(false),
  /** Founder ≠ admin — admin is an explicit separate role. */
  role: MemberRoleSchema.default('member'),
  createdAt: z.string().datetime(),
});

export type Member = z.infer<typeof MemberSchema>;
export type MemberNumber = z.infer<typeof MemberNumberSchema>;
export type MemberRole = z.infer<typeof MemberRoleSchema>;

export const FOUNDER_MEMBER_NUMBER = '000001' as const;
export const FOUNDER_DISPLAY_NAME = 'STARK' as const;
