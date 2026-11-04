import { createServer } from 'node:http';
import { loadEnv } from './env';
import { getHealth } from './routes/health';
import { planFounderProvision } from './routes/founder';
import { postChallenge } from './routes/challenge-http';

const env = loadEnv();
const health = getHealth(env);

console.info(
  JSON.stringify({
    message: 'underground-api skeleton ready',
    listen: `${env.API_HOST}:${env.API_PORT}`,
    health,
  }),
);

/**
 * Minimal HTTP surface without pulling a framework yet.
 * Replace with a full server (e.g. Hono) once routes expand.
 */
const server = createServer(async (req, res) => {
  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(getHealth(env)));
    return;
  }

  if (req.url === '/v1/founder/provision' && req.method === 'POST') {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    try {
      const body: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
      const plan = planFounderProvision(body);
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(plan));
    } catch (error) {
      res.writeHead(400, { 'content-type': 'application/json' });
      res.end(
        JSON.stringify({
          ok: false,
          error: error instanceof Error ? error.message : 'invalid_request',
        }),
      );
    }
    return;
  }

  if (req.url === '/v1/territories/challenge' && req.method === 'POST') {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    try {
      const body: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
      const result = postChallenge(env, body);
      res.writeHead(result.ok ? 200 : 409, { 'content-type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (error) {
      res.writeHead(400, { 'content-type': 'application/json' });
      res.end(
        JSON.stringify({
          ok: false,
          error: error instanceof Error ? error.message : 'invalid_request',
        }),
      );
    }
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

export { server, env };
