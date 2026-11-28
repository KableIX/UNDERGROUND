import { validateFinish } from './routes/route-finishes';
import { validateRunAttempt } from './routes/run-attempts';
import { createEditorialHandler } from './routes/editorial';
import { createServer } from 'node:http';
import { MemoryStore } from '@underground/persistence';
import { loadEnv } from './env';
import { identifySpot } from './routes/spotted';
import { getHealth } from './routes/health';
import { planFounderProvision } from './routes/founder';
import { postChallenge } from './routes/challenge-http';
import { createRunStore, handleRunTransition } from './routes/runs';
import { handleEvidenceReview } from './routes/evidence';
import { handleClubInviteAction } from './routes/clubs';
import { issueAuthorizedGarageUpload } from './routes/garage-upload-auth';
import { finalizeGarageUpload } from './routes/garage-upload-complete';
import { handleSimCapture } from './routes/sim-capture';
import {
  handleFriendshipAction,
  handleTopEight,
  handleGuestbook,
  handleDm,
} from './routes/social';
import { handleCreateRoutePlan, handleRouteArchitecture } from './routes/route-plans';
import { getPersistenceStatus } from './routes/persistence-status';
import { mutationGate } from './routes/mutation-gate';
import { authenticateMember, createSupabaseMemberGateway } from './supabase-gateway';
import { assessPhotoProof, attestChallenge, loadIntegrityConfig, registerDeviceKey } from './integrity/photo-proof';
import { issueFinishNonce, nonceSecretUsable } from './integrity/finish-nonce';
import { createSupabaseMessagesGateway } from './messages-gateway';
import { createMessagesHandlers, type MessagesReply } from './routes/messages';

const env = loadEnv();
const handleEditorial = createEditorialHandler(env, process.env.NEWSWIRE_EDITORIAL_TOKEN_SHA256);
const health = getHealth(env);
const runStore = createRunStore();
const memoryStore = new MemoryStore();
const memberGateway = createSupabaseMemberGateway(env);
const integrity = loadIntegrityConfig(process.env, env.APP_ENV);
const messages = createMessagesHandlers(createSupabaseMessagesGateway(env));

console.info(
  JSON.stringify({
    message: 'underground-api skeleton ready',
    listen: `${env.API_HOST}:${env.API_PORT}`,
    health,
    persistence: getPersistenceStatus(process.env),
  }),
);

async function readJsonBody(req: import('node:http').IncomingMessage, limit = 1024 * 1024): Promise<unknown> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const data = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += data.length;
    if (total > limit) throw new Error('request_body_too_large');
    chunks.push(data);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

/**
 * Minimal HTTP surface without pulling a framework yet.
 * Replace with a full server (e.g. Hono) once routes expand.
 */
const server = createServer(async (req, res) => {
  if (await handleEditorial(req, res, () => readJsonBody(req))) return;
  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(
      JSON.stringify({
        ...getHealth(env),
        persistence: getPersistenceStatus(process.env),
      }),
    );
    return;
  }

  if (req.url === '/v1/persistence/status' && req.method === 'GET') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, ...getPersistenceStatus(process.env) }));
    return;
  }

  if (req.url === '/v1/routes/architecture' && req.method === 'GET') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(handleRouteArchitecture()));
    return;
  }

  // The only live member routes: server-verified Supabase JWT and trusted membership
  // lookups. All other mutations continue to fail closed below.
  if (
    (req.url === '/v1/route-finishes' && req.method === 'POST') ||
    (req.url === '/v1/run-attempts' && req.method === 'POST') ||
    (req.url === '/v1/attest/challenge' && req.method === 'POST') ||
    (req.url === '/v1/attest/register' && req.method === 'POST') ||
    (req.url === '/v1/spotted/identify' && req.method === 'POST') ||
    (req.url === '/v1/me' && req.method === 'GET') ||
    (req.url === '/v1/garage/media/upload-intent' && req.method === 'POST') ||
    (req.url === '/v1/garage/media/complete' && req.method === 'POST')
  ) {
    const auth = await authenticateMember(req.headers.authorization, memberGateway);
    if (!auth.ok) {
      res.writeHead(auth.status, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: auth.error }));
      return;
    }
    try {
      if (req.url === '/v1/me' && req.method === 'GET') {
        const profile = await memberGateway!.getOwnProfile(auth.session.memberId);
        res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
        res.end(JSON.stringify({ ok: true, profile }));
        return;
      }
      if (req.url === '/v1/route-finishes') {
        const result = validateFinish(await readJsonBody(req, 8 * 1024 * 1024));
        if (result) await memberGateway!.recordRouteFinish(auth.session.memberId, result);
        // Accepted Run finish: a short-lived, single-use nonce that finish photo proofs must carry.
        const finishNonce = result && 'duration' in result && nonceSecretUsable(integrity.nonceSecret)
          ? issueFinishNonce(integrity.nonceSecret, { member: auth.session.memberId, attempt: result.attempt, route: result.route, finishedAtMs: result.finishedAtMs })
          : null;
        res.writeHead(result ? 200 : 422, { 'content-type': 'application/json', 'cache-control': 'no-store' });
        res.end(JSON.stringify(finishNonce ? { ok: !!result, finishNonce } : { ok: !!result }));
        return;
      }
      if (req.url === '/v1/attest/challenge' || req.url === '/v1/attest/register') {
        const out = req.url === '/v1/attest/challenge'
          ? attestChallenge(auth.session.memberId, integrity)
          : await registerDeviceKey(await readJsonBody(req), auth.session.memberId, integrity, memberGateway);
        res.writeHead(out.status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
        res.end(JSON.stringify(out.body));
        return;
      }
      if (req.url === '/v1/run-attempts') {
        const raw = await readJsonBody(req);
        const shape = validateRunAttempt(raw, auth.session.memberId);
        if (!shape.ok) {
          res.writeHead(422, { 'content-type': 'application/json', 'cache-control': 'no-store' });
          res.end(JSON.stringify(shape));
          return;
        }
        // Finish nonce + device attestation. An untrusted proof keeps the run but earns no photo credit.
        const proof = await assessPhotoProof(raw, auth.session.memberId, integrity, memberGateway);
        const checked = validateRunAttempt(raw, auth.session.memberId, Date.now(), proof);
        if (!checked.ok) {
          res.writeHead(422, { 'content-type': 'application/json', 'cache-control': 'no-store' });
          res.end(JSON.stringify(checked));
          return;
        }
        try {
          await memberGateway!.recordRunAttempt(auth.session.memberId, checked.write);
        } catch (error) {
          if (error instanceof Error && error.message === 'finish_not_recorded') {
            res.writeHead(409, { 'content-type': 'application/json', 'cache-control': 'no-store' });
            res.end(JSON.stringify({ ok: false, error: 'finish_not_recorded' }));
            return;
          }
          if (error instanceof Error && error.message === 'photo_reused') {
            res.writeHead(422, { 'content-type': 'application/json', 'cache-control': 'no-store' });
            res.end(JSON.stringify({ ok: false, error: 'photo_reused' }));
            return;
          }
          throw error;
        }
        // Tier and points only. Photo location never leaves the server.
        const credit = checked.write.credit;
        res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
        res.end(JSON.stringify({ ok: true, credit: credit ? { tier: credit.tier, points: credit.points, car: credit.car, dash: credit.dash, proofError: credit.proofError } : null }));
        return;
      }
      const body = await readJsonBody(req);
      if (req.url === '/v1/spotted/identify') {
        const { status, ...result } = await identifySpot(auth.session.memberId, body);
        res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
        res.end(JSON.stringify(result));
        return;
      }
      const upload = req.url === '/v1/garage/media/complete'
        ? await finalizeGarageUpload({
            raw: body,
            session: auth.session,
            gateway: memberGateway!,
          })
        : await issueAuthorizedGarageUpload({
            raw: body,
            session: auth.session,
            gateway: memberGateway!,
          });
      res.writeHead(upload.ok ? (req.url === '/v1/garage/media/complete' ? 200 : 201) : upload.status, {
        'content-type': 'application/json',
        'cache-control': 'no-store',
      });
      res.end(JSON.stringify(upload));
    } catch {
      res.writeHead(502, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      res.end(JSON.stringify({ ok: false, error: req.url === '/v1/route-finishes' || req.url?.startsWith('/v1/run-') ? 'route_result_unavailable' : req.url?.startsWith('/v1/attest/') ? 'integrity_unavailable' : 'garage_backend_unavailable' }));
    }
    return;
  }

  // Messages: direct messages and club chat. The member comes from the verified token only.
  if (req.url?.startsWith('/v1/messages')) {
    const auth = await authenticateMember(req.headers.authorization, memberGateway);
    if (!auth.ok) {
      res.writeHead(auth.status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      res.end(JSON.stringify({ ok: false, error: auth.error }));
      return;
    }
    const me = auth.session.memberId;
    const url = new URL(req.url, 'http://localhost');
    const parts = url.pathname.split('/').filter(Boolean); // v1, messages, ...
    let reply: MessagesReply = { status: 404, body: { ok: false, error: 'not_found' } };
    try {
      if (req.method === 'GET' && url.pathname === '/v1/messages/threads') {
        reply = await messages.listThreads(me);
      } else if (req.method === 'GET' && parts[2] === 'threads' && parts.length === 4) {
        reply = await messages.listMessages(me, parts[3] ?? '', url.searchParams.get('limit'), url.searchParams.get('before'));
      } else if (req.method === 'POST' && parts[2] === 'threads' && parts.length === 4) {
        reply = await messages.sendMessage(me, parts[3] ?? '', await readJsonBody(req));
      } else if (req.method === 'POST' && parts[2] === 'threads' && parts[4] === 'read' && parts.length === 5) {
        reply = await messages.markRead(me, parts[3] ?? '');
      } else if (req.method === 'POST' && url.pathname === '/v1/messages/open/direct') {
        reply = await messages.openDirect(me, await readJsonBody(req));
      } else if (req.method === 'POST' && url.pathname === '/v1/messages/open/club') {
        reply = await messages.openClub(me, await readJsonBody(req));
      } else if (req.method === 'POST' && url.pathname === '/v1/messages/block') {
        reply = await messages.block(me, await readJsonBody(req));
      } else if (req.method === 'POST' && url.pathname === '/v1/messages/report') {
        reply = await messages.report(me, await readJsonBody(req));
      }
    } catch {
      reply = { status: 400, body: { ok: false, error: 'invalid_request' } };
    }
    res.writeHead(reply.status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    res.end(JSON.stringify(reply.body));
    return;
  }

  const gate = mutationGate({
    method: req.method,
    pathname: req.url,
    appEnv: env.APP_ENV,
    remoteAddress: req.socket.remoteAddress,
  });
  if (!gate.allowed) {
    res.writeHead(gate.status, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: gate.error }));
    return;
  }

  try {
    if (req.url === '/v1/founder/provision' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const plan = planFounderProvision(body);
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(plan));
      return;
    }

    if (req.url === '/v1/territories/challenge' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const result = postChallenge(env, body);
      res.writeHead(result.ok ? 200 : 409, { 'content-type': 'application/json' });
      res.end(JSON.stringify(result));
      return;
    }

    if (req.url === '/v1/runs/transition' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const result = handleRunTransition({ env, store: runStore, raw: body });
      res.writeHead(result.ok ? 200 : 409, { 'content-type': 'application/json' });
      res.end(JSON.stringify(result));
      return;
    }

    if (req.url === '/v1/runs/evidence/review' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const result = handleEvidenceReview(body);
      res.writeHead(result.ok ? 200 : 422, { 'content-type': 'application/json' });
      res.end(JSON.stringify(result));
      return;
    }

    if (req.url === '/v1/clubs/invitations/action' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const result = handleClubInviteAction(body);
      res.writeHead(result.ok ? 200 : 409, { 'content-type': 'application/json' });
      res.end(JSON.stringify(result));
      return;
    }

    if (req.url === '/v1/sim/capture' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const result = handleSimCapture(body);
      res.writeHead(result.ok ? 200 : 409, { 'content-type': 'application/json' });
      res.end(JSON.stringify(result));
      return;
    }

    if (req.url === '/v1/social/friendships/action' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const result = handleFriendshipAction(memoryStore, body);
      res.writeHead(result.ok ? 200 : 409, { 'content-type': 'application/json' });
      res.end(JSON.stringify(result));
      return;
    }

    if (req.url === '/v1/social/top8' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const result = handleTopEight(memoryStore, body);
      res.writeHead(result.ok ? 200 : 422, { 'content-type': 'application/json' });
      res.end(JSON.stringify(result));
      return;
    }

    if (req.url === '/v1/social/guestbook' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const result = handleGuestbook(memoryStore, body);
      res.writeHead(result.ok ? 200 : 409, { 'content-type': 'application/json' });
      res.end(JSON.stringify(result));
      return;
    }

    if (req.url === '/v1/social/dm' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const result = handleDm(memoryStore, body);
      res.writeHead(result.ok ? 200 : 409, { 'content-type': 'application/json' });
      res.end(JSON.stringify(result));
      return;
    }

    if (req.url === '/v1/routes/plans' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const result = handleCreateRoutePlan(memoryStore, body);
      res.writeHead(result.ok ? 200 : 422, { 'content-type': 'application/json' });
      res.end(JSON.stringify(result));
      return;
    }
  } catch (error) {
    res.writeHead(400, { 'content-type': 'application/json' });
    res.end(
      JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : 'invalid_request',
      }),
    );
    return;
  }

  res.writeHead(404, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ ok: false, error: 'not_found' }));
});

if (process.env.UNDERGROUND_API_AUTOSTART !== '0') {
  server.listen(env.API_PORT, env.API_HOST, () => {
    console.info(`underground-api listening on ${env.API_HOST}:${env.API_PORT}`);
  });
}

export { server, env, runStore, memoryStore };
