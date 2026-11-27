import { X509Certificate, createHash, createPublicKey, verify as verifySignature } from 'node:crypto';
import { appleAttestNonce, cborField, decodeCbor } from './cbor';

/**
 * Apple App Attest verification, following "Validating apps that connect to your server".
 * Registration: verifyAttestation once per device key. Each proof: verifyAssertion over the
 * exact client data string the app signed.
 */

/** Apple App Attestation Root CA (valid to 2045-03-15). SHA-256 fingerprint
 * 1C:B9:82:3B:A2:8B:A6:AD:2D:33:A0:06:94:1D:E2:AE:4F:51:3E:F1:D4:E8:31:B9:F7:E0:FA:7B:62:42:C9:32 */
export const APPLE_APP_ATTEST_ROOT_CA = `-----BEGIN CERTIFICATE-----
MIICITCCAaegAwIBAgIQC/O+DvHN0uD7jG5yH2IXmDAKBggqhkjOPQQDAzBSMSYw
JAYDVQQDDB1BcHBsZSBBcHAgQXR0ZXN0YXRpb24gUm9vdCBDQTETMBEGA1UECgwK
QXBwbGUgSW5jLjETMBEGA1UECAwKQ2FsaWZvcm5pYTAeFw0yMDAzMTgxODMyNTNa
Fw00NTAzMTUwMDAwMDBaMFIxJjAkBgNVBAMMHUFwcGxlIEFwcCBBdHRlc3RhdGlv
biBSb290IENBMRMwEQYDVQQKDApBcHBsZSBJbmMuMRMwEQYDVQQIDApDYWxpZm9y
bmlhMHYwEAYHKoZIzj0CAQYFK4EEACIDYgAERTHhmLW07ATaFQIEVwTtT4dyctdh
NbJhFs/Ii2FdCgAHGbpphY3+d8qjuDngIN3WVhQUBHAoMeQ/cLiP1sOUtgjqK9au
Yen1mMEvRq9Sk3Jm5X8U62H+xTD3FE9TgS41o0IwQDAPBgNVHRMBAf8EBTADAQH/
MB0GA1UdDgQWBBSskRBTM72+aEH/pwyp5frq5eWKoTAOBgNVHQ8BAf8EBAMCAQYw
CgYIKoZIzj0EAwMDaAAwZQIwQgFGnByvsiVbpTKwSga0kP0e8EeDS4+sQmTvb7vn
53O5+FRXgeLhpJ06ysC5PrOyAjEAp5U4xDgEgllF7En3VcE3iexZZtKeYnpqtijV
oyFraWVIyd/dganmrduC1bmTBGwD
-----END CERTIFICATE-----`;

export type AttestEnvironment = 'production' | 'development';
const AAGUID: Record<AttestEnvironment, Buffer> = {
  development: Buffer.from('appattestdevelop', 'ascii'),
  production: Buffer.concat([Buffer.from('appattest', 'ascii'), Buffer.alloc(7)]),
};

const sha256 = (...parts: Buffer[]) => { const h = createHash('sha256'); for (const p of parts) h.update(p); return h.digest(); };

/** authenticatorData layout (WebAuthn): rpIdHash 32 | flags 1 | signCount 4 | [aaguid 16 | credIdLen 2 | credId ...] */
function parseAuthData(data: Buffer, attested: boolean) {
  if (data.length < 37) throw new Error('auth_data_short');
  const out = { rpIdHash: data.subarray(0, 32), flags: data[32]!, signCount: data.readUInt32BE(33), aaguid: null as Buffer | null, credentialId: null as Buffer | null };
  if (attested) {
    if (data.length < 55) throw new Error('auth_data_short');
    out.aaguid = data.subarray(37, 53);
    const len = data.readUInt16BE(53);
    if (data.length < 55 + len) throw new Error('auth_data_short');
    out.credentialId = data.subarray(55, 55 + len);
  }
  return out;
}

/** Uncompressed EC point 04||X||Y of a P-256 public key. */
function ecPoint(key: ReturnType<typeof createPublicKey>): Buffer {
  const jwk = key.export({ format: 'jwk' }) as { crv?: string; x?: string; y?: string };
  if (jwk.crv !== 'P-256' || !jwk.x || !jwk.y) throw new Error('key_not_p256');
  return Buffer.concat([Buffer.from([4]), Buffer.from(jwk.x, 'base64url'), Buffer.from(jwk.y, 'base64url')]);
}

export type AttestationInput = {
  keyId: string; // base64, as returned by generateKeyAsync
  attestation: string; // base64 attestation object
  challenge: string; // the exact string passed to attestKeyAsync
  appId: string; // TEAMID.bundle.id
  environment: AttestEnvironment;
  rootPem?: string;
  now?: Date;
};
export type AttestationResult = { ok: true; publicKeyPem: string; signCount: number; receipt: Buffer | null } | { ok: false; error: string };

export function verifyAttestation(input: AttestationInput): AttestationResult {
  try {
    const keyId = Buffer.from(input.keyId, 'base64');
    if (keyId.length !== 32) return { ok: false, error: 'bad_key_id' };
    const object = decodeCbor(Buffer.from(input.attestation, 'base64'));
    if (cborField(object, 'fmt') !== 'apple-appattest') return { ok: false, error: 'bad_format' };
    const statement = cborField(object, 'attStmt');
    const authData = cborField(object, 'authData');
    const x5c = cborField(statement ?? null, 'x5c');
    if (!Buffer.isBuffer(authData) || !Array.isArray(x5c) || x5c.length < 2 || !x5c.every(Buffer.isBuffer)) return { ok: false, error: 'bad_structure' };
    const receipt = cborField(statement ?? null, 'receipt');

    // 1. Certificate chain to the Apple App Attestation Root CA.
    const now = input.now ?? new Date();
    const chain = (x5c as Buffer[]).map(der => new X509Certificate(der));
    const root = new X509Certificate(input.rootPem ?? APPLE_APP_ATTEST_ROOT_CA);
    const anchors = [...chain, root];
    for (let i = 0; i < chain.length; i++) {
      const cert = anchors[i]!;
      const issuer = anchors[i + 1]!;
      if (!cert.checkIssued(issuer) || !cert.verify(issuer.publicKey)) return { ok: false, error: 'bad_chain' };
      if (now < new Date(cert.validFrom) || now > new Date(cert.validTo)) return { ok: false, error: 'cert_expired' };
    }
    if (now > new Date(root.validTo)) return { ok: false, error: 'cert_expired' };
    const leaf = chain[0]!;

    // 2-4. nonce = SHA256(authData || SHA256(challenge)) must equal the certificate extension.
    const nonce = sha256(authData, sha256(Buffer.from(input.challenge, 'utf8')));
    const certNonce = appleAttestNonce(Buffer.from(leaf.raw));
    if (!certNonce || !certNonce.equals(nonce)) return { ok: false, error: 'bad_nonce' };

    // 5. Key identifier is the SHA-256 of the credential public key.
    const point = ecPoint(leaf.publicKey);
    if (!sha256(point).equals(keyId)) return { ok: false, error: 'bad_key_id' };

    // 6-9. App ID, counter, environment, credential id.
    const auth = parseAuthData(authData, true);
    if (!auth.rpIdHash.equals(sha256(Buffer.from(input.appId, 'utf8')))) return { ok: false, error: 'bad_app_id' };
    if (auth.signCount !== 0) return { ok: false, error: 'bad_counter' };
    if (!auth.aaguid!.equals(AAGUID[input.environment])) return { ok: false, error: 'bad_environment' };
    if (!auth.credentialId!.equals(keyId)) return { ok: false, error: 'bad_credential' };

    return { ok: true, publicKeyPem: leaf.publicKey.export({ type: 'spki', format: 'pem' }).toString(), signCount: 0, receipt: Buffer.isBuffer(receipt) ? receipt : null };
  } catch {
    return { ok: false, error: 'bad_attestation' };
  }
}

export type AssertionInput = {
  assertion: string; // base64 assertion object from generateAssertionAsync
  clientData: string; // the exact string the app passed to generateAssertionAsync
  publicKeyPem: string;
  storedSignCount: number;
  appId: string;
};
export type AssertionResult = { ok: true; signCount: number } | { ok: false; error: string };

export function verifyAssertion(input: AssertionInput): AssertionResult {
  try {
    const object = decodeCbor(Buffer.from(input.assertion, 'base64'));
    const signature = cborField(object, 'signature');
    const authData = cborField(object, 'authenticatorData');
    if (!Buffer.isBuffer(signature) || !Buffer.isBuffer(authData)) return { ok: false, error: 'bad_structure' };
    const nonce = sha256(authData, sha256(Buffer.from(input.clientData, 'utf8')));
    // The Secure Enclave signs nonce with ECDSA P-256 / SHA-256.
    if (!verifySignature('sha256', nonce, createPublicKey(input.publicKeyPem), signature)) return { ok: false, error: 'bad_signature' };
    const auth = parseAuthData(authData, false);
    if (!auth.rpIdHash.equals(sha256(Buffer.from(input.appId, 'utf8')))) return { ok: false, error: 'bad_app_id' };
    if (auth.signCount <= input.storedSignCount) return { ok: false, error: 'replayed_counter' };
    return { ok: true, signCount: auth.signCount };
  } catch {
    return { ok: false, error: 'bad_assertion' };
  }
}
