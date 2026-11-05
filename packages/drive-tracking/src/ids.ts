let seq = 0;

/** Deterministic-friendly id helper for tests; production passes crypto.randomUUID. */
export function createId(prefix: string, nowMs: number = Date.now()): string {
  seq += 1;
  return `${prefix}_${nowMs.toString(36)}_${seq.toString(36)}`;
}

export function resetIdSeqForTests(): void {
  seq = 0;
}
