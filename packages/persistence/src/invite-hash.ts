import { createHash } from 'node:crypto';

/** Server-only invite code hashing — never log plaintext codes. */
export function hashInviteCode(code: string): string {
  return createHash('sha256').update(`ug-invite:${code.trim()}`).digest('hex');
}
