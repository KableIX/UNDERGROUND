import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import {
  decidePublication,
  fuzzToCell,
  publicWindow,
  verifyCapture,
  type CaptureProblem,
  type SupercargoTier,
} from '@underground/domain';

/**
 * SupercarGO API. The server is the only writer of sightings, so every
 * theft-safety and anti-cheat rule is enforced here before anything is stored.
 * Reads (map, Ledger, envelopes near me, reports, the Exchange) go straight to
 * Supabase under row-level security; see the migration.
 */

export interface RedactionResult {
  status: 'done';
  jpeg: string;
  plates: number;
  faces: number;
}

/** Blurs plates and faces. Must fail closed: anything uncertain is 'unavailable'. */
export interface RedactionEngine {
  redact(jpegBase64: string): Promise<RedactionResult | { status: 'unavailable' }>;
}

/** Default until a detector is wired: nothing is ever published. */
export const failClosedRedaction: RedactionEngine = {
  async redact() {
    return { status: 'unavailable' };
  },
};

export interface SupercargoFix {
  lat: number;
  lng: number;
  accuracyM: number;
  at: Date;
}

export interface SightingRecord {
  spotter: string;
  catalogId: string | null;
  make: string;
  model: string;
  tier: SupercargoTier;
  credited: boolean;
  visibility: 'private' | 'held' | 'public';
  holdReason: string | null;
  redaction: 'pending' | 'done' | 'failed';
  capturedAt: Date;
  publishAt: Date;
  expiresAt: Date;
  cell: { id: string; lat: number; lng: number };
  point: { lat: number; lng: number; accuracyM: number };
  imageHash: string;
  redactedJpeg: string | null;
}

export interface SupercargoStore {
  lastCreditedFix(member: string): Promise<{ lat: number; lng: number; at: Date } | null>;
  creditedSince(member: string, since: Date): Promise<number>;
  imageSeen(hash: string): Promise<boolean>;
  findCatalog(make: string, model: string): Promise<{ id: string; tier: SupercargoTier } | null>;
  privacyFlags(member: string, make: string, model: string, lat: number, lng: number): Promise<{ nearHome: boolean; ownCar: boolean; optedOut: boolean }>;
  saveSighting(record: SightingRecord): Promise<string>;
  claimEnvelope(member: string, envelope: string, fix: SupercargoFix): Promise<string>;
}

export interface SupercargoDeps {
  store: SupercargoStore;
  nonceSecret: string;
  redaction: RedactionEngine;
  now?: () => Date;
}

const fixSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracyM: z.number().positive().max(10000),
  at: z.string().datetime(),
});

const sightingSchema = z.object({
  nonce: z.string().min(10).max(400),
  jpeg: z.string().min(8).max(850000).regex(/^\/9j\/[a-z0-9+/=]+$/i),
  source: z.enum(['camera', 'library']),
  capturedAt: z.string().datetime(),
  fix: fixSchema.nullable(),
  make: z.string().trim().min(1).max(80),
  model: z.string().trim().min(1).max(100),
});

const claimSchema = z.object({ envelope: z.string().uuid(), fix: fixSchema });

const NONCE_VERSION = 'sg1';

export function issueCaptureNonce(member: string, secret: string, now: Date): string {
  const payload = Buffer.from(JSON.stringify({ v: NONCE_VERSION, m: member, t: now.getTime() })).toString('base64url');
  const mac = createHmac('sha256', secret).update(payload).digest('base64url');
  return payload + '.' + mac;
}

/** Returns the issue time if the nonce was minted by us for this member. */
export function readCaptureNonce(nonce: string, member: string, secret: string): Date | null {
  const [payload, mac] = nonce.split('.');
  if (!payload || !mac) return null;
  const expected = createHmac('sha256', secret).update(payload).digest();
  let given: Buffer;
  try {
    given = Buffer.from(mac, 'base64url');
  } catch {
    return null;
  }
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { v?: string; m?: string; t?: number };
    if (data.v !== NONCE_VERSION || data.m !== member || typeof data.t !== 'number') return null;
    return new Date(data.t);
  } catch {
    return null;
  }
}

const problemText: Partial<Record<CaptureProblem, string>> = {
  library_photo: 'Library photos stay in your private album. SupercarGO logs only fresh captures.',
  stale_nonce: 'That capture took too long to start. Open the camera again.',
  no_nonce: 'Open the camera from SupercarGO to log a sighting.',
  weak_fix: 'Location is too rough. Step into the open and try again.',
  no_fix: 'Location is needed to log a sighting. It is never shown precisely.',
  stale_fix: 'Location is out of date. Try again.',
  teleport: 'That location does not follow from your last sighting.',
  daily_limit: 'Thirty sightings is the daily limit.',
  duplicate: 'That photo has already been logged.',
  late_submit: 'Sightings must be sent within 30 minutes of capture.',
  clock: 'Your phone clock looks wrong.',
};

type Result = { status: number; body: Record<string, unknown> };

export async function handleSupercargo(path: string, member: string, raw: unknown, deps: SupercargoDeps): Promise<Result> {
  const now = deps.now?.() ?? new Date();
  if (!deps.nonceSecret || deps.nonceSecret.length < 32) return { status: 503, body: { ok: false, error: 'supercargo_not_configured' } };

  if (path === '/v1/supercargo/capture-nonce') {
    return { status: 200, body: { ok: true, nonce: issueCaptureNonce(member, deps.nonceSecret, now), expiresInMs: 5 * 60_000 } };
  }

  if (path === '/v1/supercargo/sightings') {
    const input = sightingSchema.safeParse(raw);
    if (!input.success) return { status: 400, body: { ok: false, error: 'invalid_sighting' } };
    const s = input.data;
    // Library photos never leave the phone. Nothing to store, nothing to credit.
    if (s.source === 'library') return { status: 422, body: { ok: false, error: 'library_photo', message: problemText.library_photo } };

    const capturedAt = new Date(s.capturedAt);
    const imageHash = createHash('sha256').update(Buffer.from(s.jpeg, 'base64')).digest('hex');
    const fix = s.fix ? { ...s.fix, at: new Date(s.fix.at) } : null;
    const [previous, creditedToday, duplicateImage] = await Promise.all([
      deps.store.lastCreditedFix(member),
      deps.store.creditedSince(member, new Date(now.getTime() - 24 * 3600_000)),
      deps.store.imageSeen(imageHash),
    ]);
    const check = verifyCapture({
      source: s.source,
      nonceIssuedAt: readCaptureNonce(s.nonce, member, deps.nonceSecret),
      capturedAt,
      submittedAt: now,
      fix,
      previous,
      creditedToday,
      duplicateImage,
    });
    if (!check.ok || !fix) {
      const first = check.problems[0];
      return { status: 422, body: { ok: false, error: 'capture_refused', problems: check.problems, message: (first && problemText[first]) ?? 'Not logged.' } };
    }

    const catalog = await deps.store.findCatalog(s.make, s.model);
    const tier: SupercargoTier = catalog?.tier ?? 'open';
    const flags = await deps.store.privacyFlags(member, s.make, s.model, fix.lat, fix.lng);
    // Only spend a detector pass on photos that could be published.
    const mayPublish = !flags.ownCar && !flags.optedOut && !flags.nearHome;
    const redacted = mayPublish ? await deps.redaction.redact(s.jpeg) : null;
    const redaction: SightingRecord['redaction'] = redacted?.status === 'done' ? 'done' : 'failed';
    const decision = decidePublication({
      source: 'camera',
      redaction,
      nearHomeZone: flags.nearHome,
      ownerOptedOut: flags.optedOut,
      spottersOwnCar: flags.ownCar,
      captureVerified: true,
    });
    const visibility = decision.visibility;
    const cell = fuzzToCell(fix.lat, fix.lng, tier);
    const window = publicWindow(capturedAt, tier);
    const id = await deps.store.saveSighting({
      spotter: member,
      catalogId: catalog?.id ?? null,
      make: s.make,
      model: s.model,
      tier,
      credited: decision.credited,
      visibility,
      holdReason: visibility === 'public' ? null : 'reason' in decision ? decision.reason : null,
      redaction,
      capturedAt,
      publishAt: window.publishAt,
      expiresAt: window.expiresAt,
      cell: { id: cell.id, lat: cell.lat, lng: cell.lng },
      point: { lat: fix.lat, lng: fix.lng, accuracyM: fix.accuracyM },
      imageHash,
      redactedJpeg: redacted?.status === 'done' && visibility === 'public' ? redacted.jpeg : null,
    });
    return {
      status: 201,
      body: {
        ok: true,
        id,
        tier,
        credited: decision.credited,
        folio: decision.credited && !!catalog,
        visibility,
        reason: 'reason' in decision ? decision.reason : null,
        publishAt: visibility === 'public' ? window.publishAt.toISOString() : null,
      },
    };
  }

  if (path === '/v1/supercargo/envelopes/claim') {
    const input = claimSchema.safeParse(raw);
    if (!input.success) return { status: 400, body: { ok: false, error: 'invalid_claim' } };
    const fix = { ...input.data.fix, at: new Date(input.data.fix.at) };
    if (Math.abs(now.getTime() - fix.at.getTime()) > 30_000) return { status: 422, body: { ok: false, error: 'stale_fix' } };
    const result = await deps.store.claimEnvelope(member, input.data.envelope, fix);
    return { status: result === 'claimed' ? 200 : 409, body: { ok: result === 'claimed', result } };
  }

  return { status: 404, body: { ok: false, error: 'not_found' } };
}

/** In-memory store for tests and local development. Never used in production. */
export class MemorySupercargoStore implements SupercargoStore {
  sightings: Array<SightingRecord & { id: string }> = [];
  hashes = new Set<string>();
  catalog = new Map<string, { id: string; tier: SupercargoTier }>();
  flags = { nearHome: false, ownCar: false, optedOut: false };
  claims: Array<{ member: string; envelope: string }> = [];

  async lastCreditedFix(member: string) {
    const last = this.sightings.filter((s) => s.spotter === member && s.credited).at(-1);
    return last ? { lat: last.point.lat, lng: last.point.lng, at: last.capturedAt } : null;
  }
  async creditedSince(member: string, since: Date) {
    return this.sightings.filter((s) => s.spotter === member && s.credited && s.capturedAt >= since).length;
  }
  async imageSeen(hash: string) {
    return this.hashes.has(hash);
  }
  async findCatalog(make: string, model: string) {
    return this.catalog.get((make + ' ' + model).toLowerCase()) ?? null;
  }
  async privacyFlags() {
    return this.flags;
  }
  async saveSighting(record: SightingRecord) {
    const id = 'sg-' + (this.sightings.length + 1);
    this.sightings.push({ ...record, id });
    this.hashes.add(record.imageHash);
    return id;
  }
  async claimEnvelope(member: string, envelope: string) {
    if (this.claims.some((c) => c.member === member && c.envelope === envelope)) return 'already';
    this.claims.push({ member, envelope });
    return 'claimed';
  }
}
