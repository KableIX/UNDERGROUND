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
it("passes on the model's own confidence and up to two alternatives, nothing invented", async () => {
  vi.stubEnv('SPOTTED_VISION_URL', 'https://example.test/vision');
  vi.stubEnv('SPOTTED_VISION_MODEL', 'vision');
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      Response.json({
        choices: [
          {
            message: {
              content:
                '{"make":"Ferrari","model":"F40","confidence":0.64,"alternatives":[{"make":"Ferrari","model":"F50","confidence":0.2},{"make":"","model":"x"},{"make":"Ferrari","model":"288 GTO"},{"make":"Ferrari","model":"Enzo","confidence":0.05}]}',
            },
          },
        ],
      }),
    ),
  );
  expect(await identifySpot('member-2', photo)).toEqual({
    status: 200,
    suggestion: { make: 'Ferrari', model: 'F40' },
    confidence: 0.64,
    candidates: [
      { make: 'Ferrari', model: 'F50', confidence: 0.2 },
      { make: 'Ferrari', model: '288 GTO' },
    ],
  });
});
it('ignores a confidence outside 0 to 1 instead of failing the scan', async () => {
  vi.stubEnv('SPOTTED_VISION_URL', 'https://example.test/vision');
  vi.stubEnv('SPOTTED_VISION_MODEL', 'vision');
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(Response.json({ choices: [{ message: { content: '{"make":"Audi","model":"R8","confidence":7}' } }] })),
  );
  expect(await identifySpot('member-3', photo)).toEqual({ status: 200, suggestion: { make: 'Audi', model: 'R8' } });
});
