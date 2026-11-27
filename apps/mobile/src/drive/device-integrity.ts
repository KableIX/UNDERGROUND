import { Platform } from 'react-native';
import { readIntegrityKey, saveIntegrityKey, type ResultDatabase } from './result-sql';

/**
 * Device attestation for finish photo proofs.
 * iOS: Apple App Attest via @expo/app-integrity (native module; needs a dev build with the
 * App Attest capability). The key is registered once per member per device, then every proof
 * is signed: generateAssertionAsync(keyId, canonical body), which the server verifies.
 * Android: Play Integrity is a server-side stub for now; nothing is sent.
 * When the module is missing (Expo Go, simulator, older build) this returns null and the
 * server decides: permissive with the flag off, no photo credit with the flag on.
 */
type AppIntegrityModule = {
  isSupported: boolean;
  generateKeyAsync(): Promise<string>;
  attestKeyAsync(keyId: string, challenge: string): Promise<string>;
  generateAssertionAsync(keyId: string, challenge: string): Promise<string>;
};

function appIntegrity(): AppIntegrityModule | null {
  if (Platform.OS !== 'ios') return null;
  try {
    // Optional native dependency: absent until the dev build adds it.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@expo/app-integrity') as AppIntegrityModule;
    return mod?.isSupported ? mod : null;
  } catch {
    return null;
  }
}

export type ProofAttestation = {platform: 'ios'; keyId: string; assertion: string};
type Post = (path: string, body: unknown) => Promise<{status: number; json: Record<string, unknown> | null}>;

/** Register this device's key with the server once. Returns the key id, or null. */
export async function ensureDeviceKey(db: ResultDatabase, member: string, post: Post, mod: AppIntegrityModule | null = appIntegrity()): Promise<string | null> {
  if (!mod) return null;
  const known = await readIntegrityKey(db, member);
  if (known?.registered) return known.keyId;
  const keyId = known?.keyId ?? await mod.generateKeyAsync();
  await saveIntegrityKey(db, member, keyId, false);
  const challenge = await post('/v1/attest/challenge', {});
  const value = challenge.json?.challenge;
  if (challenge.status !== 200 || typeof value !== 'string') return null;
  let attestation: string;
  try {
    attestation = await mod.attestKeyAsync(keyId, value);
  } catch (error) {
    // Apple: retry later with the same key if the service was unavailable; otherwise start over.
    if (!String((error as {code?: string})?.code ?? error).includes('SERVER_UNAVAILABLE')) await saveIntegrityKey(db, member, null, false);
    return null;
  }
  const registered = await post('/v1/attest/register', {platform: 'ios', keyId, attestation, challenge: value});
  if (registered.status === 201) { await saveIntegrityKey(db, member, keyId, true); return keyId; }
  if (registered.status === 422 || registered.status === 409) await saveIntegrityKey(db, member, null, false);
  return null;
}

/** Sign the canonical proof body with the device key. Null when attestation is unavailable. */
export async function attestProof(db: ResultDatabase, member: string, clientData: string, post: Post, mod: AppIntegrityModule | null = appIntegrity()): Promise<ProofAttestation | null> {
  try {
    const keyId = await ensureDeviceKey(db, member, post, mod);
    if (!keyId || !mod) return null;
    return {platform: 'ios', keyId, assertion: await mod.generateAssertionAsync(keyId, clientData)};
  } catch {
    return null;
  }
}
