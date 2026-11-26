import { afterEach, expect, it, vi } from 'vitest';
import { identifySpot } from '../src/routes/spotted';
const photo = { jpeg: '/9j/AAAA' };
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
it('does not invent a suggestion when vision is disconnected', async () => {
  vi.stubEnv('SPOTTED_VISION_URL', '');
  expect((await identifySpot('member', photo)).status).toBe(503);
});
it('returns only an editable make and model from a vision response', async () => {
  vi.stubEnv('SPOTTED_VISION_URL', 'https://example.test/vision');
  vi.stubEnv('SPOTTED_VISION_MODEL', 'vision');
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValue(
        Response.json({
          choices: [{ message: { content: '{"make":"Audi","model":"R8","plate":"ignored"}' } }],
        }),
      ),
  );
  expect(await identifySpot('member', photo)).toEqual({
    status: 200,
    suggestion: { make: 'Audi', model: 'R8' },
  });
  expect((await identifySpot('member', { jpeg: 'bad' })).status).toBe(400);
});
