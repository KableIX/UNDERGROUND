import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHttpRedaction } from '../src/routes/supercargo-blur';
import {
  failClosedRedaction,
  handleSupercargo,
  issueCaptureNonce,
  MemorySupercargoStore,
  readCaptureNonce,
  type RedactionEngine,
} from '../src/routes/supercargo';

const secret = 'x'.repeat(40);
const member = '11111111-1111-4111-8111-111111111111';
const now = new Date('2026-11-27T18:00:00Z');
let nextHash = 1n;
const blur: RedactionEngine = {
  async redact(jpeg) {
    nextHash = nextHash * 1103515245n + 12345n;
    return { status: 'done', jpeg, plates: 1, faces: 0, dhash: BigInt.asIntN(64, nextHash * 0x9e3779b97f4a7c15n).toString() };
  },
};

function body(extra: Record<string, unknown> = {}) {
  return {
    nonce: issueCaptureNonce(member, secret, new Date(now.getTime() - 60_000)),
    jpeg: '/9j/' + Buffer.from(String(Math.random())).toString('base64'),
    source: 'camera',
    capturedAt: new Date(now.getTime() - 10_000).toISOString(),
    fix: { lat: 36.5725, lng: -121.9486, accuracyM: 9, at: new Date(now.getTime() - 10_000).toISOString() },
    make: 'Ferrari',
    model: 'LaFerrari',
    ...extra,
  };
}

function deps(store = new MemorySupercargoStore(), redaction: RedactionEngine = blur) {
  store.catalog.set('ferrari laferrari', { id: 'ferrari-laferrari', tier: 'allocated' });
  return { store, nonceSecret: secret, redaction, now: () => now };
}

describe('SupercarGO capture nonce', () => {
  it('binds the nonce to the member and the secret', () => {
    const n = issueCaptureNonce(member, secret, now);
    expect(readCaptureNonce(n, member, secret)?.getTime()).toBe(now.getTime());
    expect(readCaptureNonce(n, 'someone-else', secret)).toBeNull();
    expect(readCaptureNonce(n, member, 'y'.repeat(40))).toBeNull();
    expect(readCaptureNonce(n.replace(/.$/, 'A'), member, secret)).toBeNull();
  });
  it('refuses to run without a real secret', async () => {
    expect((await handleSupercargo('/v1/supercargo/capture-nonce', member, {}, { ...deps(), nonceSecret: '' })).status).toBe(503);
  });
});

describe('SupercarGO sightings', () => {
  it('logs a fresh capture as a held-then-public cell, credited, with only the redacted photo', async () => {
    const d = deps();
    const r = await handleSupercargo('/v1/supercargo/sightings', member, body(), d);
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ ok: true, tier: 'allocated', credited: true, folio: true, visibility: 'public' });
    const saved = d.store.sightings[0]!;
    expect(saved.publishAt.getTime() - saved.capturedAt.getTime()).toBe(12 * 3600_000);
    expect(saved.cell.lat).not.toBe(36.5725);
    expect(saved.redactedJpeg).not.toBeNull();
  });

  it('never accepts library photos', async () => {
    const d = deps();
    const r = await handleSupercargo('/v1/supercargo/sightings', member, body({ source: 'library' }), d);
    expect(r.status).toBe(422);
    expect(d.store.sightings).toHaveLength(0);
  });

  it('refuses a forged or stale nonce and a weak fix, storing nothing', async () => {
    const d = deps();
    const forged = issueCaptureNonce(member, 'z'.repeat(40), now);
    expect((await handleSupercargo('/v1/supercargo/sightings', member, body({ nonce: forged }), d)).body.problems).toContain('no_nonce');
    const stale = issueCaptureNonce(member, secret, new Date(now.getTime() - 20 * 60_000));
    expect((await handleSupercargo('/v1/supercargo/sightings', member, body({ nonce: stale }), d)).body.problems).toContain('stale_nonce');
    const weak = { lat: 36.5, lng: -121.9, accuracyM: 900, at: now.toISOString() };
    expect((await handleSupercargo('/v1/supercargo/sightings', member, body({ fix: weak }), d)).body.problems).toContain('weak_fix');
    expect(d.store.sightings).toHaveLength(0);
  });

  it('refuses the same photo twice', async () => {
    const d = deps();
    const b = body();
    expect((await handleSupercargo('/v1/supercargo/sightings', member, b, d)).status).toBe(201);
    const again = await handleSupercargo('/v1/supercargo/sightings', member, { ...b, nonce: issueCaptureNonce(member, secret, now) }, d);
    expect(again.body.problems).toContain('duplicate');
  });

  it('keeps everything private when blurring is unavailable', async () => {
    const d = deps(new MemorySupercargoStore(), failClosedRedaction);
    const r = await handleSupercargo('/v1/supercargo/sightings', member, body(), d);
    expect(r.body).toMatchObject({ visibility: 'private', credited: true, reason: 'redaction_failed' });
    expect(d.store.sightings[0]!.redactedJpeg).toBeNull();
  });

  it('keeps home zones, opted-out cars and the spotter\'s own car off the map', async () => {
    for (const [flag, reason, credited] of [['nearHome', 'home_zone', true], ['optedOut', 'owner_opt_out', true], ['ownCar', 'own_car', false]] as const) {
      const store = new MemorySupercargoStore();
      store.flags = { nearHome: false, ownCar: false, optedOut: false, [flag]: true };
      let redactions = 0;
      const counting: RedactionEngine = { async redact(j) { redactions++; return { status: 'done', jpeg: j, plates: 0, faces: 0 }; } };
      const r = await handleSupercargo('/v1/supercargo/sightings', member, body(), deps(store, counting));
      expect(r.body).toMatchObject({ visibility: 'private', reason, credited });
      expect(redactions).toBe(0);
    }
  });
});

describe('SupercarGO envelopes', () => {
  it('needs a live fix and claims once', async () => {
    const d = deps();
    const env = '22222222-2222-4222-8222-222222222222';
    const fresh = { lat: 37.3, lng: -122.2, accuracyM: 8, at: now.toISOString() };
    expect((await handleSupercargo('/v1/supercargo/envelopes/claim', member, { envelope: env, fix: { ...fresh, at: new Date(now.getTime() - 120_000).toISOString() } }, d)).status).toBe(422);
    expect((await handleSupercargo('/v1/supercargo/envelopes/claim', member, { envelope: env, fix: fresh }, d)).body).toEqual({ ok: true, result: 'claimed' });
    expect((await handleSupercargo('/v1/supercargo/envelopes/claim', member, { envelope: env, fix: fresh }, d)).status).toBe(409);
  });
});

describe('SupercarGO meets and near-duplicates', () => {
  it('shortens the hold to one hour inside a live curated meet', async () => {
    const store = new MemorySupercargoStore();
    store.meet = 'meet-1';
    const d = deps(store);
    const r = await handleSupercargo('/v1/supercargo/sightings', member, body(), d);
    expect(r.body).toMatchObject({ visibility: 'public', atMeet: true });
    const saved = d.store.sightings[0]!;
    expect(saved.publishAt.getTime() - saved.capturedAt.getTime()).toBe(3600_000);
    expect(saved.meetId).toBe('meet-1');
  });

  it('never uses the meet hold near a home', async () => {
    const store = new MemorySupercargoStore();
    store.meet = 'meet-1';
    store.flags = { nearHome: true, ownCar: false, optedOut: false };
    const r = await handleSupercargo('/v1/supercargo/sightings', member, body(), deps(store));
    expect(r.body).toMatchObject({ visibility: 'private', atMeet: false });
  });

  it('refuses a recompressed copy of a logged photo by its blur-service hash', async () => {
    const same: RedactionEngine = { async redact(jpeg) { return { status: 'done', jpeg, plates: 0, faces: 0, dhash: '123456789' }; } };
    const d = deps(new MemorySupercargoStore(), same);
    expect((await handleSupercargo('/v1/supercargo/sightings', member, body(), d)).status).toBe(201);
    const near: RedactionEngine = { async redact(jpeg) { return { status: 'done', jpeg, plates: 0, faces: 0, dhash: String(123456789 ^ 3) }; } };
    const r = await handleSupercargo('/v1/supercargo/sightings', member, body(), { ...d, redaction: near });
    expect(r.body.problems).toEqual(['duplicate']);
    expect(d.store.sightings).toHaveLength(1);
  });
});

describe('SupercarGO blur client', () => {
  afterEach(() => vi.unstubAllGlobals());
  const token = 'k'.repeat(40);
  it('passes through a clean blur and fails closed on anything else', async () => {
    const engine = createHttpRedaction('http://127.0.0.1:8791/v1/redact', token);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ status: 'done', jpeg: '/9j/AAAA', faces: 1, plates: 2, dhash: '-42' })));
    expect(await engine.redact('/9j/BBBB')).toEqual({ status: 'done', jpeg: '/9j/AAAA', faces: 1, plates: 2, dhash: '-42' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ status: 'done', jpeg: 'not-a-jpeg', faces: 0, plates: 0 })));
    expect(await engine.redact('/9j/BBBB')).toEqual({ status: 'unavailable' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 500 })));
    expect(await engine.redact('/9j/BBBB')).toEqual({ status: 'unavailable' });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')));
    expect(await engine.redact('/9j/BBBB')).toEqual({ status: 'unavailable' });
    expect(await createHttpRedaction('http://x', 'short').redact('/9j/BBBB')).toEqual({ status: 'unavailable' });
  });
});
