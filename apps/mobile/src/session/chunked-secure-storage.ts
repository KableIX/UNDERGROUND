/** Encrypted key-value adapter for Supabase sessions that exceed iOS Keychain item sizes. */
export type SecureStringStore = {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
};

const PART_SIZE = 1500;
const MAX_PARTS = 32;

function partKey(key: string, index: number): string {
  return `${key}__part_${index}`;
}

function metadataKey(key: string): string {
  return `${key}__part_count`;
}

/** No plaintext filesystem fallback. Missing or corrupt chunks force a fresh login. */
export function createChunkedSecureStorage(store: SecureStringStore) {
  return {
    async getItem(key: string): Promise<string | null> {
      const raw = await store.getItemAsync(metadataKey(key));
      if (raw == null) return store.getItemAsync(key); // legacy single-item session
      const count = Number(raw);
      if (!Number.isInteger(count) || count < 1 || count > MAX_PARTS) return null;
      const parts: string[] = [];
      for (let i = 0; i < count; i += 1) {
        const part = await store.getItemAsync(partKey(key, i));
        if (part == null) return null;
        parts.push(part);
      }
      return parts.join('');
    },
    async setItem(key: string, value: string): Promise<void> {
      const parts = value.match(new RegExp(`.{1,${PART_SIZE}}`, 'gs')) ?? [''];
      if (parts.length > MAX_PARTS) throw new Error('secure_session_too_large');
      const raw = await store.getItemAsync(metadataKey(key));
      const previousCount = raw && Number.isInteger(Number(raw)) ? Math.min(Number(raw), MAX_PARTS) : 0;
      // Write chunk count LAST. An interrupted update yields no usable session.
      for (let i = 0; i < parts.length; i += 1) {
        await store.setItemAsync(partKey(key, i), parts[i]!);
      }
      await store.setItemAsync(metadataKey(key), String(parts.length));
      for (let i = parts.length; i < previousCount; i += 1) {
        await store.deleteItemAsync(partKey(key, i));
      }
      await store.deleteItemAsync(key);
    },
    async removeItem(key: string): Promise<void> {
      const raw = await store.getItemAsync(metadataKey(key));
      const count = raw && Number.isInteger(Number(raw)) ? Math.min(Number(raw), MAX_PARTS) : 0;
      await store.deleteItemAsync(metadataKey(key));
      for (let i = 0; i < count; i += 1) {
        await store.deleteItemAsync(partKey(key, i));
      }
      await store.deleteItemAsync(key);
    },
  };
}
