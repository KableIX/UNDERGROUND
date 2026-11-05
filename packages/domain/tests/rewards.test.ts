import { describe, expect, it } from 'vitest';
import {
  appendGarageCreditEntry,
  registerSighting,
  sightingDedupeKey,
  sumGarageCredits,
  GARAGE_CREDIT_AWARDS,
} from '../src/rewards';

const MEMBER = '11111111-1111-4111-8111-111111111111';
const VEHICLE = '33333333-3333-4333-8333-333333333333';
const NOW = '2026-11-05T12:30:00.000Z';

describe('garage credits + sightings', () => {
  it('appends credits idempotently and sums balance', () => {
    const entry = {
      id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee01',
      memberId: MEMBER,
      delta: GARAGE_CREDIT_AWARDS.verified_capture,
      reason: 'verified_capture' as const,
      inventorySku: null,
      runId: null,
      idempotencyKey: 'credit:run:1',
      createdAt: NOW,
    };
    const first = appendGarageCreditEntry([], entry);
    expect(first.result).toEqual({ ok: true, kind: 'appended' });
    const second = appendGarageCreditEntry(first.ledger, entry);
    expect(second.result).toEqual({ ok: true, kind: 'noop_idempotent' });
    expect(sumGarageCredits(second.ledger, MEMBER)).toBe(5);
  });

  it('prevents duplicate sightings in the same hour bucket', () => {
    const dedupe = sightingDedupeKey(MEMBER, VEHICLE, NOW);
    const sighting = {
      id: 'ffffffff-ffff-4fff-8fff-ffffffffff01',
      reporterMemberId: MEMBER,
      subjectVehicleId: VEHICLE,
      status: 'pending' as const,
      photoStoragePath: null,
      dedupeKey: dedupe,
      idempotencyKey: 'sight:1',
      createdAt: NOW,
    };
    const first = registerSighting([], sighting);
    expect(first.ok).toBe(true);
    const dup = registerSighting([sighting], {
      ...sighting,
      id: 'ffffffff-ffff-4fff-8fff-ffffffffff02',
      idempotencyKey: 'sight:2',
    });
    expect(dup).toEqual({ ok: false, error: 'duplicate_dedupe' });
  });
});
