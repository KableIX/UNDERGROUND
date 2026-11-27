import { createHash, createPrivateKey, sign as ecSign } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { proofClientData } from '@underground/domain';
import catalog from '../../../apps/mobile/src/data/california-catalog.json';
import fx from './fixtures/app-attest-fixture.json';
import { verifyAssertion, verifyAttestation, APPLE_APP_ATTEST_ROOT_CA } from '../src/integrity/app-attest';
import { issueAttestChallenge, issueFinishNonce, verifyNonce } from '../src/integrity/finish-nonce';
import { assessPhotoProof, attestChallenge, registerDeviceKey, type IntegrityConfig, type IntegrityStore } from '../src/integrity/photo-proof';
import { verifyPlayIntegrity } from '../src/integrity/play-integrity';
import { runFinishPoint } from '../src/routes/route-finishes';
import { validateRunAttempt } from '../src/routes/run-attempts';
import { X509Certificate } from 'node:crypto';

const SECRET = 'test-secret-test-secret-test-secret-0001';
const member = '11111111-1111-4111-8111-111111111111';
const now = Date.UTC(2027, 0, 15, 18, 0, 0); // after the fixture certificates' notBefore
const sha = (b: Buffer | string) => createHash('sha256').update(b).digest();

// Tiny CBOR encoder for assertions in tests.
const head = (major: number, n: number) => n < 24 ? Buffer.from([major << 5 | n]) : n < 256 ? Buffer.from([major << 5 | 24, n]) : Buffer.from([major << 5 | 25, n >> 8, n & 255]);
const cbor = (v: Record<string, Buffer>) => Buffer.concat([head(5, Object.keys(v).length), ...Object.entries(v).flatMap(([k, b]) => [head(3, k.length), Buffer.from(k), head(2, b.length), b])]);
function assertion(clientData: string, counter: number, appId = fx.appId) {
  const auth = Buffer.concat([sha(appId), Buffer.from([0x00]), Buffer.from([0, 0, counter >> 8, counter & 255])]);
  const nonce = sha(Buffer.concat([auth, sha(clientData)]));
  const signature = ecSign('sha256', nonce, createPrivateKey(fx.leafPrivateKeyPem));
  return cbor({ signature, authenticatorData: auth }).toString('base64');
}

function memoryStore(): IntegrityStore & { keys: Map<string, { member: string; publicKeyPem: string; signCount: number }>; used: Map<string, string> } {
  const keys = new Map<string, { member: string; publicKeyPem: string; signCount: number }>();
  const used = new Map<string, string>();
  return {
    keys, used,
    async saveDeviceKey(i) { if (keys.has(i.keyId)) return 'exists'; keys.set(i.keyId, { member: i.member, publicKeyPem: i.publicKeyPem, signCount: 0 }); return 'saved'; },
    async loadDeviceKey(id) { return keys.get(id) ?? null; },
    async advanceDeviceCounter(id, from, to) { const k = keys.get(id); if (!k || k.signCount !== from) return false; k.signCount = to; return true; },
    async consumeFinishNonce(i) { const prev = used.get(i.jti); if (prev) return prev === i.member + ':' + i.attempt; used.set(i.jti, i.member + ':' + i.attempt); return true; },
  };
}
const config = (over: Partial<IntegrityConfig> = {}): IntegrityConfig => ({
  appEnv: 'development', required: false, nonceSecret: SECRET, appleAppId: fx.appId,
  attestEnvironment: 'development', androidPackage: 'com.kableix.underground', attestRootPem: fx.rootPem, ...over,
});

describe('finish nonce', () => {
  it('binds to member, attempt and route, and expires', () => {
    const issued = issueFinishNonce(SECRET, { member, attempt: 'trip_1', route: 'r', finishedAtMs: now - 60_000 }, now)!;
    expect(issued.expiresAtMs).toBe(now - 60_000 + 45 * 60_000);
    const check = (over: Record<string, string> = {}, at = now) => verifyNonce(SECRET, issued.token, { kind: 'finish', member, attempt: 'trip_1', route: 'r', ...over }, at);
    expect(check().ok).toBe(true);
    expect(check({ member: '22222222-2222-4222-8222-222222222222' })).toEqual({ ok: false, error: 'nonce_wrong_member' });
    expect(check({ attempt: 'trip_2' })).toEqual({ ok: false, error: 'nonce_wrong_attempt' });
    expect(check({ route: 'other' })).toEqual({ ok: false, error: 'nonce_wrong_route' });
    expect(check({}, issued.expiresAtMs + 1)).toEqual({ ok: false, error: 'nonce_expired' });
    const [body, mac] = issued.token.split('.');
    const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(body!, 'base64url').toString()), exp: now * 2 })).toString('base64url');
    expect(verifyNonce(SECRET, forged + '.' + mac, { kind: 'finish', member }, now)).toEqual({ ok: false, error: 'nonce_bad_signature' });
    expect(verifyNonce('another-secret-another-secret-another', issued.token, { kind: 'finish', member }, now).ok).toBe(false);
    expect(verifyNonce(SECRET, issueAttestChallenge(SECRET, member, now).challenge, { kind: 'finish', member }, now)).toEqual({ ok: false, error: 'nonce_wrong_kind' });
  });
  it('is not minted for an old finish (a re-sent trace cannot get a fresh nonce)', () => {
    expect(issueFinishNonce(SECRET, { member, attempt: 'a', route: 'r', finishedAtMs: now - 11 * 60_000 }, now)).toBeNull();
    expect(issueFinishNonce(SECRET, { member, attempt: 'a', route: 'r', finishedAtMs: now + 60_000 }, now)).toBeNull();
  });
});

describe('App Attest', () => {
  const at = new Date(now);
  const attest = (over: Record<string, unknown> = {}) => verifyAttestation({
    keyId: fx.keyId, attestation: fx.attestation, challenge: fx.challenge, appId: fx.appId, environment: 'development', rootPem: fx.rootPem, now: at, ...over,
  });
  it('embeds the real Apple App Attestation Root CA', () => {
    const root = new X509Certificate(APPLE_APP_ATTEST_ROOT_CA);
    expect(root.subject).toContain('Apple App Attestation Root CA');
    expect(root.fingerprint256).toBe('1C:B9:82:3B:A2:8B:A6:AD:2D:33:A0:06:94:1D:E2:AE:4F:51:3E:F1:D4:E8:31:B9:F7:E0:FA:7B:62:42:C9:32');
  });
  it('verifies an attestation and rejects tampering', () => {
    const ok = attest();
    expect(ok.ok).toBe(true);
    expect(attest({ challenge: 'other' })).toEqual({ ok: false, error: 'bad_nonce' });
    expect(attest({ appId: 'TEAMID1234.com.someone.else' })).toEqual({ ok: false, error: 'bad_app_id' });
    expect(attest({ environment: 'production' })).toEqual({ ok: false, error: 'bad_environment' });
    expect(attest({ keyId: Buffer.alloc(32, 1).toString('base64') })).toEqual({ ok: false, error: 'bad_key_id' });
    expect(attest({ rootPem: undefined })).toEqual({ ok: false, error: 'bad_chain' }); // test CA is not Apple's
    expect(attest({ attestation: Buffer.from('nonsense').toString('base64') }).ok).toBe(false);
  });
  it('verifies assertions over the exact client data and blocks counter replay', () => {
    const key = attest();
    if (!key.ok) throw new Error('fixture');
    const data = '{"a":1}';
    const verify = (a: string, d = data, stored = 0) => verifyAssertion({ assertion: a, clientData: d, publicKeyPem: key.publicKeyPem, storedSignCount: stored, appId: fx.appId });
    expect(verify(assertion(data, 1))).toEqual({ ok: true, signCount: 1 });
    expect(verify(assertion(data, 1), '{"a":2}')).toEqual({ ok: false, error: 'bad_signature' });
    expect(verify(assertion(data, 1), data, 1)).toEqual({ ok: false, error: 'replayed_counter' });
    expect(verify(assertion(data, 2, 'TEAMID1234.other'))).toEqual({ ok: false, error: 'bad_app_id' });
  });
  it('Play Integrity is a stub that never passes', async () => {
    expect(await verifyPlayIntegrity({ token: 't', clientData: '{}', packageName: 'x' })).toEqual({ ok: false, error: 'play_integrity_not_implemented' });
  });
});

describe('device registration', () => {
  it('registers a key once with a fresh challenge bound to the member', async () => {
    const store = memoryStore();
    // The fixture was attested over a fixed string; a real challenge is a signed token.
    const challenge = attestChallenge(member, config(), now);
    expect(challenge.status).toBe(200);
    const body = { platform: 'ios', keyId: fx.keyId, attestation: fx.attestation, challenge: fx.challenge };
    expect((await registerDeviceKey(body, member, config(), store, now)).body).toEqual({ ok: false, error: 'nonce_malformed' });
    expect((await registerDeviceKey({ ...body, challenge: challenge.body.challenge }, member, config(), store, now)).body).toEqual({ ok: false, error: 'bad_nonce' });
    expect((await registerDeviceKey({ platform: 'android' }, member, config({ required: true }), store, now)).status).toBe(501);
    expect((await registerDeviceKey({ platform: 'android' }, member, config(), store, now)).status).toBe(200);
    expect(attestChallenge(member, config({ nonceSecret: undefined }), now).status).toBe(503);
  });
});

describe('photo proof decisions', () => {
  const route = catalog.find(row => row.id === 'M01')!.slug;
  const finish = runFinishPoint(route)!;
  const finishedAtMs = now - 100_000;
  const nonce = () => issueFinishNonce(SECRET, { member, attempt: 'trip_abc_1', route, finishedAtMs }, now - 90_000)!;
  const photo = (kind: 'car' | 'dash', over: Record<string, unknown> = {}) => ({
    kind, takenAtMs: now - 60_000, latitude: finish.latitude, longitude: finish.longitude, accuracyM: 8, source: 'camera',
    imageSha256: (kind === 'car' ? 'c' : 'd').repeat(64), ...over,
  });
  const body = (over: Record<string, unknown> = {}) => ({
    attempt: 'trip_abc_1', route, outcome: 'completed', abortReason: null, progressM: finish.lengthM, progressPct: 100,
    startedAtMs: now - 1_000_000, endedAtMs: now - 99_000, finishedAtMs, vehicleId: null, startLabel: null,
    analytics: { distanceM: 12_000, activeMs: 900_000, movingMs: 840_000, stoppedMs: 60_000, avgSpeedMps: 13, avgMovingSpeedMps: 14, maxSpeedMps: 24,
      elevationGainM: null, elevationLossM: null, minAltitudeM: null, maxAltitudeM: null, startedAtMs: null, startLocalHour: null, timeOfDay: null,
      gpsCoveragePct: 98, goodFixPct: 91, sampleCount: 640, signalGapCount: 1 },
    photos: [photo('car'), photo('dash')], finishNonce: nonce().token, ...over,
  });
  const credit = async (raw: Record<string, unknown>, cfg = config(), store = memoryStore()) => {
    const proof = await assessPhotoProof(raw, member, cfg, store, now);
    const result = validateRunAttempt(raw, member, now, proof);
    return result.ok ? result.write.credit : result.error;
  };

  it('dev without a nonce secret stays permissive; production fails closed', async () => {
    expect(await credit(body({ finishNonce: null }), config({ nonceSecret: undefined }))).toMatchObject({ tier: 'top', proofError: null });
    expect(await credit(body({ finishNonce: null }), config({ nonceSecret: undefined, appEnv: 'production' })))
      .toMatchObject({ tier: 'none', points: 0, car: 'unverified', dash: 'unverified', proofError: 'finish_nonce_unconfigured' });
  });
  it('requires a valid finish nonce for credit', async () => {
    expect(await credit(body())).toMatchObject({ tier: 'top', points: 30, attested: false, proofError: null });
    expect(await credit(body({ finishNonce: null }))).toMatchObject({ tier: 'none', proofError: 'nonce_missing' });
    const other = issueFinishNonce(SECRET, { member, attempt: 'trip_other', route, finishedAtMs }, now)!.token;
    expect(await credit(body({ finishNonce: other }))).toMatchObject({ tier: 'none', proofError: 'nonce_wrong_attempt' });
  });
  it('is single-use, except a retry of the same attempt', async () => {
    const store = memoryStore();
    const raw = body();
    expect(await credit(raw, config(), store)).toMatchObject({ tier: 'top' });
    expect(await credit(raw, config(), store)).toMatchObject({ tier: 'top' }); // retry; the DB keeps the first credit
    store.used.set(JSON.parse(Buffer.from(String(raw.finishNonce).split('.')[0]!, 'base64url').toString()).jti, 'someone:else');
    expect(await credit(raw, config(), store)).toMatchObject({ tier: 'none', proofError: 'finish_nonce_used' });
  });
  it('counts only in-app camera photos taken after the nonce was issued', async () => {
    expect(await credit(body({ photos: [photo('car', { source: 'library' }), photo('dash')] }))).toMatchObject({ tier: 'verified', car: 'library', dash: 'accepted' });
    expect(await credit(body({ photos: [photo('car', { takenAtMs: now - 150_000 }), photo('dash')] }))).toMatchObject({ tier: 'verified', car: 'early' });
  });
  it('flag on: needs an App Attest assertion over the proof; fails closed otherwise', async () => {
    const on = config({ required: true });
    const store = memoryStore();
    const key = verifyAttestation({ keyId: fx.keyId, attestation: fx.attestation, challenge: fx.challenge, appId: fx.appId, environment: 'development', rootPem: fx.rootPem, now: new Date(now) });
    if (!key.ok) throw new Error('fixture');
    store.keys.set(fx.keyId, { member, publicKeyPem: key.publicKeyPem, signCount: 0 });
    expect(await credit(body(), on, store)).toMatchObject({ tier: 'none', proofError: 'attestation_required' });
    const raw = body();
    const signed = { ...raw, attestation: { platform: 'ios', keyId: fx.keyId, assertion: assertion(proofClientData(raw), 1) } };
    expect(await credit(signed, on, store)).toMatchObject({ tier: 'top', attested: true, proofError: null });
    // Same assertion again: counter replay.
    expect(await credit(signed, on, store)).toMatchObject({ tier: 'none', proofError: 'replayed_counter' });
    // Signed over different data (e.g. location edited after signing).
    const edited = { ...signed, photos: [photo('car', { latitude: finish.latitude + 0.0001 }), photo('dash')], attestation: { ...signed.attestation, assertion: assertion(proofClientData(raw), 5) } };
    expect(await credit(edited, on, store)).toMatchObject({ tier: 'none', proofError: 'bad_signature' });
    // Someone else's device key.
    store.keys.get(fx.keyId)!.member = '22222222-2222-4222-8222-222222222222';
    expect(await credit({ ...raw, attestation: { platform: 'ios', keyId: fx.keyId, assertion: assertion(proofClientData(raw), 9) } }, on, store))
      .toMatchObject({ tier: 'none', proofError: 'device_key_unknown' });
    // Android: stub fails closed.
    expect(await credit({ ...raw, attestation: { platform: 'android', token: 'x' } }, on, store)).toMatchObject({ tier: 'none', proofError: 'play_integrity_not_implemented' });
    // Flag on without a nonce secret, even in development: fail closed.
    expect(await credit(body(), config({ required: true, nonceSecret: undefined }), store)).toMatchObject({ tier: 'none', proofError: 'finish_nonce_unconfigured' });
  });
  it('flag off: an offered assertion is recorded but never blocks', async () => {
    const store = memoryStore();
    expect(await credit({ ...body(), attestation: { platform: 'ios', keyId: 'unknown', assertion: 'AA==' } }, config(), store)).toMatchObject({ tier: 'top', attested: false });
  });
  it('runs without photos need no proof', async () => {
    expect(await credit(body({ photos: [], finishNonce: null }), config({ required: true }))).toBeNull();
  });
});
