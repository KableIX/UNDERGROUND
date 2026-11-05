import { describe, expect, it } from 'vitest';
import { createChunkedSecureStorage } from './chunked-secure-storage';

function fixture() {
  const store = new Map<string, string>();
  const adapter = createChunkedSecureStorage({
    getItemAsync: async key => store.get(key) ?? null,
    setItemAsync: async (key, value) => { store.set(key, value); },
    deleteItemAsync: async key => { store.delete(key); },
  });
  return { store, adapter };
}

describe('Keychain session chunking', () => {
  it('round-trips a session larger than a single iOS SecureStore item', async () => {
    const { store, adapter } = fixture();
    const value = 'jwt'.repeat(2500);
    await adapter.setItem('session', value);
    expect(await adapter.getItem('session')).toBe(value);
    expect(store.get('session__part_count')).toBe('5');
    expect(store.has('session')).toBe(false);
  });
  it('removes trailing chunks when a token gets shorter', async () => {
    const { store, adapter } = fixture();
    await adapter.setItem('session', 'x'.repeat(9000));
    await adapter.setItem('session', 'short');
    expect(await adapter.getItem('session')).toBe('short');
    expect(store.has('session__part_4')).toBe(false);
  });
  it('does not return a partial session if a chunk is missing', async () => {
    const { store, adapter } = fixture();
    await adapter.setItem('session', 'x'.repeat(3000));
    store.delete('session__part_1');
    expect(await adapter.getItem('session')).toBeNull();
  });
  it('revokes all chunks and the legacy session on logout', async () => {
    const { store, adapter } = fixture();
    store.set('session', 'legacy');
    await adapter.setItem('session', 'x'.repeat(3500));
    await adapter.removeItem('session');
    expect(await adapter.getItem('session')).toBeNull();
    expect([...store.keys()].filter(k => k.startsWith('session'))).toHaveLength(0);
  });
});
