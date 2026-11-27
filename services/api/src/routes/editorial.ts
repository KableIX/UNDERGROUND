import { createHash, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { RuntimeEnv } from '../env';

const prefix = '/v1/newswire/editorial/';
const storyId = /^[a-z0-9][a-z0-9._-]*(?:\/[a-z0-9][a-z0-9._-]*)*$/;
const instant = z.string().datetime({ offset: true });
const story = z.object({
  headline: z.string().trim().min(1).max(160),
  body: z.string().trim().min(1).max(4000),
  action_label: z.string().trim().min(1).max(80),
  source_url: z.string().url().max(2048).refine((value) => {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && !url.username && !url.password;
    } catch { return false; }
  }),
  verified_at: instant,
  expires_at: instant,
  withdrawn: z.boolean(),
}).strict();

export function createEditorialHandler(env: RuntimeEnv, tokenHash: string | undefined) {
  const enabled = env.APP_ENV !== 'production' && /^[a-f0-9]{64}$/.test(tokenHash ?? '');
  const db = enabled && env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;
  return async (req: IncomingMessage, res: ServerResponse, read: () => Promise<unknown>) => {
    if (!req.url?.startsWith(prefix)) return false;
    function send(status: number, payload: unknown) {
      res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      res.end(JSON.stringify(payload));
      return true;
    }
    if (!db) return send(503, { error: 'editorial_not_configured' });
    const bearer = /^Bearer ([A-Za-z0-9_-]{32,256})$/.exec(req.headers.authorization ?? '');
    if (!bearer?.[1] || !timingSafeEqual(createHash('sha256').update(bearer[1]).digest(), Buffer.from(tokenHash!, 'hex')))
      return send(401, { error: 'invalid_editorial_token' });
    let id: string;
    try { id = decodeURIComponent(req.url.slice(prefix.length)); }
    catch { return send(400, { error: 'invalid_story_id' }); }
    if (id.length > 160 || !storyId.test(id)) return send(400, { error: 'invalid_story_id' });
    try {
      if (req.method === 'GET') {
        const { data, error } = await db.from('newswire_editorial').select('*').eq('story_id', id).maybeSingle();
        if (error) throw error;
        return data ? send(200, data) : send(404, { error: 'story_not_found' });
      }
      if (req.method !== 'PUT') return send(405, { error: 'method_not_allowed' });
      let raw: unknown;
      try { raw = await read(); }
      catch { return send(400, { error: 'invalid_body' }); }
      const parsed = story.safeParse(raw);
      if (!parsed.success) return send(422, { error: 'invalid_story', fields: parsed.error.flatten() });
      const { data, error } = await db.rpc('put_newswire_editorial', { p: { ...parsed.data, story_id: id } });
      if (error) throw error;
      return data?.length ? send(200, data[0]) : send(409, { error: 'story_version_conflict' });
    } catch { return send(502, { error: 'editorial_storage_unavailable' }); }
  };
}
