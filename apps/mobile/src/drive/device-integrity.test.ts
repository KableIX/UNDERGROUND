import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';

vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
import { attestProof, ensureDeviceKey } from './device-integrity';
import { readIntegrityKey, resultSchema, type ResultDatabase } from './result-sql';

const database = new DatabaseSync(':memory:');
const db: ResultDatabase = {
  runAsync: async (sql: string, ...args: (string | number | null)[]) => database.prepare(sql).run(...args),
  getAllAsync: async <T,>(sql: string, ...args: (string | number | null)[]) => database.prepare(sql).all(...args) as T[],
};
const fakeModule = () => ({
  isSupported: true,
  generateKeyAsync: vi.fn(async () => 'key-1'),
  attestKeyAsync: vi.fn(async (_k: string, c: string) => 'attestation-for-' + c),
  generateAssertionAsync: vi.fn(async (k: string, data: string) => `assert(${k},${data})`),
});

describe('device attestation (App Attest)', () => {
  beforeEach(() => { database.exec(resultSchema); database.exec('DELETE FROM integrity_keys;'); });

  it('registers once per member, then signs each proof body', async () => {
    const mod = fakeModule();
    const calls: string[] = [];
    const post = vi.fn(async (path: string, body: unknown) => {
      calls.push(path);
      if (path === '/v1/attest/challenge') return { status: 200, json: { ok: true, challenge: 'ch-1' } };
      expect(body).toEqual({ platform: 'ios', keyId: 'key-1', attestation: 'attestation-for-ch-1', challenge: 'ch-1' });
      return { status: 201, json: { ok: true } };
    });
    expect(await attestProof(db, 'm', '{"a":1}', post, mod)).toEqual({ platform: 'ios', keyId: 'key-1', assertion: 'assert(key-1,{"a":1})' });
    expect(await attestProof(db, 'm', '{"a":2}', post, mod)).toEqual({ platform: 'ios', keyId: 'key-1', assertion: 'assert(key-1,{"a":2})' });
    expect(calls).toEqual(['/v1/attest/challenge', '/v1/attest/register']);
    expect(mod.generateKeyAsync).toHaveBeenCalledTimes(1);
    expect(await readIntegrityKey(db, 'm')).toEqual({ keyId: 'key-1', registered: true });
  });

  it('returns null without the native module or when registration is refused', async () => {
    const post = vi.fn(async () => ({ status: 200, json: { challenge: 'x' } }));
    expect(await attestProof(db, 'm', '{}', post, null)).toBeNull();
    expect(post).not.toHaveBeenCalled();
    const mod = fakeModule();
    const refuse = vi.fn(async (path: string) => path === '/v1/attest/challenge' ? { status: 200, json: { challenge: 'c' } } : { status: 422, json: { ok: false } });
    expect(await ensureDeviceKey(db, 'm', refuse, mod)).toBeNull();
    expect(await readIntegrityKey(db, 'm')).toBeNull(); // discarded; a new key next time
  });

  it('keeps the key when Apple is temporarily unavailable', async () => {
    const mod = fakeModule();
    mod.attestKeyAsync.mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'ERR_APP_INTEGRITY_SERVER_UNAVAILABLE' }));
    const post = vi.fn(async () => ({ status: 200, json: { challenge: 'c' } }));
    expect(await ensureDeviceKey(db, 'm', post, mod)).toBeNull();
    expect(await readIntegrityKey(db, 'm')).toEqual({ keyId: 'key-1', registered: false });
  });
});
