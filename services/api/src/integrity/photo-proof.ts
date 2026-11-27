import { proofClientData } from '@underground/domain';
import { z } from 'zod';
import { verifyAssertion, verifyAttestation, type AttestEnvironment } from './app-attest';
import { issueAttestChallenge, nonceSecretUsable, verifyNonce } from './finish-nonce';
import { verifyPlayIntegrity } from './play-integrity';

/**
 * Anti-cheat for finish photo proofs (TJ, 2026-11-27).
 *
 * - Finish nonce: always checked when FINISH_NONCE_SECRET is set. Without a secret, development
 *   stays permissive; production (or the integrity flag on) fails closed.
 * - Device attestation (App Attest on iOS, Play Integrity stub on Android): enforced only when
 *   APP_INTEGRITY_REQUIRED=true. Then a missing or bad assertion means no photo credit.
 *
 * Images never reach the server; only the non-image proof is checked.
 */
export type IntegrityConfig = {
  appEnv: string;
  required: boolean;
  nonceSecret: string | undefined;
  appleAppId: string | undefined;
  attestEnvironment: AttestEnvironment;
  androidPackage: string | undefined;
  /** Test hook: App Attest root CA override. */
  attestRootPem?: string;
};

export function loadIntegrityConfig(raw: NodeJS.ProcessEnv, appEnv: string): IntegrityConfig {
  return {
    appEnv,
    required: raw.APP_INTEGRITY_REQUIRED === 'true',
    nonceSecret: raw.FINISH_NONCE_SECRET || undefined,
    appleAppId: raw.APPLE_APP_ATTEST_APP_ID || undefined,
    attestEnvironment: raw.APPLE_APP_ATTEST_ENVIRONMENT === 'development' ? 'development' : 'production',
    androidPackage: raw.ANDROID_PACKAGE_NAME || undefined,
  };
}

/** Server-side storage for device keys and nonce redemptions (service role). */
export interface IntegrityStore {
  saveDeviceKey(input: { member: string; keyId: string; platform: 'ios'; publicKeyPem: string; environment: AttestEnvironment }): Promise<'saved' | 'exists'>;
  loadDeviceKey(keyId: string): Promise<{ member: string; publicKeyPem: string; signCount: number } | null>;
  /** Compare-and-set; false if another request moved the counter first. */
  advanceDeviceCounter(keyId: string, from: number, to: number): Promise<boolean>;
  /** Records a redemption. True when new, or a retry for the same member and attempt. */
  consumeFinishNonce(input: { jti: string; member: string; attempt: string; route: string }): Promise<boolean>;
}

export const AttestationSchema = z.discriminatedUnion('platform', [
  z.object({ platform: z.literal('ios'), keyId: z.string().min(1).max(100), assertion: z.string().min(1).max(10_000) }).strict(),
  z.object({ platform: z.literal('android'), token: z.string().min(1).max(20_000) }).strict(),
]);

/** Undefined: development, nothing to check. */
export type ProofDecision =
  | { trusted: true; finishedAtMs: number; notBeforeMs: number; attested: boolean; nonceJti: string }
  | { trusted: false; error: string };

const failClosed = (config: IntegrityConfig) => config.required || config.appEnv === 'production';

export async function assessPhotoProof(
  raw: unknown,
  member: string,
  config: IntegrityConfig,
  store: IntegrityStore | null,
  now = Date.now(),
): Promise<ProofDecision | undefined> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { trusted: false, error: 'invalid_proof' };
  const body = raw as Record<string, unknown>;
  if (!Array.isArray(body.photos) || body.photos.length === 0) return undefined;
  if (!nonceSecretUsable(config.nonceSecret)) {
    return failClosed(config) ? { trusted: false, error: 'finish_nonce_unconfigured' } : undefined;
  }
  if (!store) return { trusted: false, error: 'integrity_store_unavailable' };
  const nonce = verifyNonce(config.nonceSecret, body.finishNonce, {
    kind: 'finish', member, attempt: String(body.attempt ?? ''), route: String(body.route ?? ''),
  }, now);
  if (!nonce.ok) return { trusted: false, error: nonce.error };

  let attested = false;
  const attestation = AttestationSchema.safeParse(body.attestation);
  if (config.required) {
    if (!attestation.success) return { trusted: false, error: 'attestation_required' };
    const result = await checkAssertion(attestation.data, proofClientData(body), member, config, store);
    if (!result.ok) return { trusted: false, error: result.error };
    attested = true;
  } else if (attestation.success && attestation.data.platform === 'ios' && config.appleAppId) {
    // Flag off: verify if offered, record the result, never block.
    attested = (await checkAssertion(attestation.data, proofClientData(body), member, config, store)).ok;
  }

  if (!(await store.consumeFinishNonce({ jti: nonce.claims.jti, member, attempt: nonce.claims.a, route: nonce.claims.r }))) {
    return { trusted: false, error: 'finish_nonce_used' };
  }
  return { trusted: true, finishedAtMs: nonce.claims.fin, notBeforeMs: nonce.claims.iat, attested, nonceJti: nonce.claims.jti };
}

async function checkAssertion(
  attestation: z.infer<typeof AttestationSchema>,
  clientData: string,
  member: string,
  config: IntegrityConfig,
  store: IntegrityStore,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (attestation.platform === 'android') {
    return verifyPlayIntegrity({ token: attestation.token, clientData, packageName: config.androidPackage });
  }
  if (!config.appleAppId) return { ok: false, error: 'app_attest_unconfigured' };
  const key = await store.loadDeviceKey(attestation.keyId);
  if (!key || key.member !== member) return { ok: false, error: 'device_key_unknown' };
  const result = verifyAssertion({ assertion: attestation.assertion, clientData, publicKeyPem: key.publicKeyPem, storedSignCount: key.signCount, appId: config.appleAppId });
  if (!result.ok) return result;
  if (!(await store.advanceDeviceCounter(attestation.keyId, key.signCount, result.signCount))) return { ok: false, error: 'replayed_counter' };
  return { ok: true };
}

const RegisterSchema = z.discriminatedUnion('platform', [
  z.object({ platform: z.literal('ios'), keyId: z.string().min(1).max(100), attestation: z.string().min(1).max(20_000), challenge: z.string().min(1).max(2000) }).strict(),
  z.object({ platform: z.literal('android') }).strict(),
]);

export type HttpResult = { status: number; body: Record<string, unknown> };

/** POST /v1/attest/challenge: a signed, 5-minute challenge bound to the member. */
export function attestChallenge(member: string, config: IntegrityConfig, now = Date.now()): HttpResult {
  if (!nonceSecretUsable(config.nonceSecret)) return { status: 503, body: { ok: false, error: 'attestation_unconfigured' } };
  return { status: 200, body: { ok: true, ...issueAttestChallenge(config.nonceSecret, member, now) } };
}

/** POST /v1/attest/register: verify an App Attest attestation once per device key and store the key. */
export async function registerDeviceKey(raw: unknown, member: string, config: IntegrityConfig, store: IntegrityStore | null, now = Date.now()): Promise<HttpResult> {
  const parsed = RegisterSchema.safeParse(raw);
  if (!parsed.success) return { status: 422, body: { ok: false, error: 'invalid_registration' } };
  if (parsed.data.platform === 'android') {
    // Play Integrity has no registration step; tokens are checked per request (stub for now).
    return config.required
      ? { status: 501, body: { ok: false, error: 'play_integrity_not_implemented' } }
      : { status: 200, body: { ok: true, registered: false } };
  }
  if (!nonceSecretUsable(config.nonceSecret) || !config.appleAppId || !store) {
    return { status: 503, body: { ok: false, error: 'attestation_unconfigured' } };
  }
  const challenge = verifyNonce(config.nonceSecret, parsed.data.challenge, { kind: 'attest', member }, now);
  if (!challenge.ok) return { status: 422, body: { ok: false, error: challenge.error } };
  const result = verifyAttestation({
    keyId: parsed.data.keyId, attestation: parsed.data.attestation, challenge: parsed.data.challenge,
    appId: config.appleAppId, environment: config.attestEnvironment, rootPem: config.attestRootPem, now: new Date(now),
  });
  if (!result.ok) return { status: 422, body: { ok: false, error: result.error } };
  const saved = await store.saveDeviceKey({ member, keyId: parsed.data.keyId, platform: 'ios', publicKeyPem: result.publicKeyPem, environment: config.attestEnvironment });
  if (saved === 'exists') return { status: 409, body: { ok: false, error: 'device_key_exists' } };
  return { status: 201, body: { ok: true, registered: true } };
}
