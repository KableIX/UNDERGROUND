/**
 * Android Play Integrity: stub. Not implemented yet, so it never passes. With the integrity
 * flag on, Android proofs therefore earn no photo credit (fail closed). With the flag off,
 * nothing is checked. To implement: decode the integrity token with the Play Integrity API
 * (@googleapis/playintegrity, service account), check requestHash = SHA-256(client data),
 * packageName, appRecognitionVerdict = PLAY_RECOGNIZED and deviceRecognitionVerdict.
 */
export type PlayIntegrityResult = { ok: true } | { ok: false; error: string };
export async function verifyPlayIntegrity(_input: { token: string; clientData: string; packageName: string | undefined }): Promise<PlayIntegrityResult> {
  return { ok: false, error: 'play_integrity_not_implemented' };
}
