/**
 * Deterministic idempotency helpers for capture mutations.
 * Same key + payload hash ⇒ same logical operation; callers skip duplicate ledger writes.
 */

export function buildIdempotencyKey(parts: {
  territoryDefinitionId: string;
  track: string;
  actorId: string;
  clientNonce: string;
}): string {
  return [
    parts.territoryDefinitionId,
    parts.track,
    parts.actorId,
    parts.clientNonce,
  ].join(':');
}

export function hasSeenIdempotencyKey(
  seen: ReadonlySet<string>,
  key: string,
): boolean {
  return seen.has(key);
}

export function rememberIdempotencyKey(
  seen: Set<string>,
  key: string,
): Set<string> {
  const next = new Set(seen);
  next.add(key);
  return next;
}
