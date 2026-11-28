/**
 * Optional native modules. This app can run on an older development build that
 * lacks them, so a load that throws (a missing native module throws on import)
 * or returns nothing just means "not here". Callers fall back.
 */
export function safeLoad<T>(load: () => T | null | undefined): T | null {
  try {
    return load() ?? null;
  } catch {
    return null;
  }
}
