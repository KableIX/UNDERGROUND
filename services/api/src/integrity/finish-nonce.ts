import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import {
  FINISH_NONCE_GRACE_MS,
  FINISH_NONCE_ISSUE_MAX_DELAY_MS,
  FINISH_PHOTO_WINDOW_MS,
} from '@underground/domain';

/**
 * Finish nonce: issued by POST /v1/route-finishes when the server accepts a Run's GPS finish.
 * HMAC-signed, bound to one member, attempt and route, short-lived, and single-use
 * (redemption is recorded in public.run_finish_nonce_uses). Photo proofs must carry it,
 * and only camera photos taken after it was issued can earn credit.
 */
export type FinishNonceClaims = {
  v: 1;
  kind: 'finish' | 'attest';
  jti: string;
  /** member id */
  m: string;
  /** attempt id ('' for attest challenges) */
  a: string;
  /** route slug ('' for attest challenges) */
  r: string;
  /** issued at (server ms) */
  iat: number;
  /** GPS finish time (last trace fix, ms); 0 for attest challenges */
  fin: number;
  /** expires (server ms) */
  exp: number;
};

export const ATTEST_CHALLENGE_TTL_MS = 5 * 60 * 1000;
const MIN_SECRET = 32;

const b64url = (buf: Buffer) => buf.toString('base64url');
const sign = (secret: string, body: string) => createHmac('sha256', secret).update(body).digest();

export function nonceSecretUsable(secret: string | undefined): secret is string {
  return typeof secret === 'string' && secret.length >= MIN_SECRET;
}

function encode(secret: string, claims: FinishNonceClaims): string {
  const body = b64url(Buffer.from(JSON.stringify(claims)));
  return body + '.' + b64url(sign(secret, body));
}

/** Null when the finish is too old to deserve a nonce (re-sent traces cannot mint fresh ones). */
export function issueFinishNonce(secret: string, input: { member: string; attempt: string; route: string; finishedAtMs: number }, now = Date.now()) {
  if (input.finishedAtMs > now + 15_000 || now - input.finishedAtMs > FINISH_NONCE_ISSUE_MAX_DELAY_MS) return null;
  const claims: FinishNonceClaims = {
    v: 1, kind: 'finish', jti: randomUUID(), m: input.member, a: input.attempt, r: input.route,
    iat: now, fin: input.finishedAtMs, exp: input.finishedAtMs + FINISH_PHOTO_WINDOW_MS + FINISH_NONCE_GRACE_MS,
  };
  return { token: encode(secret, claims), issuedAtMs: claims.iat, finishedAtMs: claims.fin, expiresAtMs: claims.exp };
}

export function issueAttestChallenge(secret: string, member: string, now = Date.now()) {
  const claims: FinishNonceClaims = { v: 1, kind: 'attest', jti: randomUUID(), m: member, a: '', r: '', iat: now, fin: 0, exp: now + ATTEST_CHALLENGE_TTL_MS };
  return { challenge: encode(secret, claims), expiresAtMs: claims.exp };
}

export type NonceCheck = { ok: true; claims: FinishNonceClaims } | { ok: false; error: string };

export function verifyNonce(
  secret: string,
  token: unknown,
  expect: { kind: FinishNonceClaims['kind']; member: string; attempt?: string; route?: string },
  now = Date.now(),
): NonceCheck {
  if (typeof token !== 'string' || token.length > 2000) return { ok: false, error: 'nonce_missing' };
  const [body, mac, extra] = token.split('.');
  if (!body || !mac || extra !== undefined) return { ok: false, error: 'nonce_malformed' };
  const want = sign(secret, body);
  const got = Buffer.from(mac, 'base64url');
  if (got.length !== want.length || !timingSafeEqual(got, want)) return { ok: false, error: 'nonce_bad_signature' };
  let claims: FinishNonceClaims;
  try {
    claims = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as FinishNonceClaims;
  } catch {
    return { ok: false, error: 'nonce_malformed' };
  }
  if (claims.v !== 1 || claims.kind !== expect.kind) return { ok: false, error: 'nonce_wrong_kind' };
  if (claims.m !== expect.member) return { ok: false, error: 'nonce_wrong_member' };
  if (expect.attempt !== undefined && claims.a !== expect.attempt) return { ok: false, error: 'nonce_wrong_attempt' };
  if (expect.route !== undefined && claims.r !== expect.route) return { ok: false, error: 'nonce_wrong_route' };
  if (!(now <= claims.exp)) return { ok: false, error: 'nonce_expired' };
  return { ok: true, claims };
}
