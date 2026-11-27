import { z } from 'zod';
import type { RedactionEngine } from './supercargo';

const reply = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('done'),
    jpeg: z.string().min(8).max(2_000_000).regex(/^\/9j\/[a-z0-9+/=]+$/i),
    faces: z.number().int().min(0).max(500),
    plates: z.number().int().min(0).max(500),
    dhash: z.string().regex(/^-?\d{1,20}$/).optional(),
  }),
  z.object({ status: z.literal('unavailable'), reason: z.string().max(80).optional() }),
]);

/**
 * Client for the Atlas blur service (services/blur). Every failure, timeout or
 * odd reply is 'unavailable', which keeps the sighting private.
 */
export function createHttpRedaction(url: string, token: string, timeoutMs = 20_000): RedactionEngine {
  return {
    async redact(jpeg) {
      if (!url || token.length < 32) return { status: 'unavailable' };
      try {
        const response = await fetch(url, {
          method: 'POST',
          signal: AbortSignal.timeout(timeoutMs),
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
          body: JSON.stringify({ jpeg }),
        });
        if (!response.ok) return { status: 'unavailable' };
        const parsed = reply.safeParse(await response.json());
        if (!parsed.success || parsed.data.status !== 'done') return { status: 'unavailable' };
        return parsed.data;
      } catch {
        return { status: 'unavailable' };
      }
    },
  };
}
