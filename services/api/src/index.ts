import { loadEnv } from './env';
import { getHealth } from './routes/health';

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
import { createServer } from 'node:http';

const server = createServer((req, res) => {
  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(getHealth(env)));
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
