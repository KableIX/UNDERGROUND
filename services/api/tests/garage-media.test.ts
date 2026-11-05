import { describe, expect, it } from 'vitest';
import { loadEnv } from '../src/env';
import { handleGarageMediaUploadIntent } from '../src/routes/garage-media';

describe('garage media upload intent', () => {
  it('returns placeholder plan when supabase is not ready', () => {
    const env = loadEnv({ NODE_ENV: 'test', APP_ENV: 'development' });
    const result = handleGarageMediaUploadIntent({
      env,
      raw: {
        vehicleId: '44444444-4444-4444-8444-444444444401',
        memberId: '33333333-3333-4333-8333-333333333301',
        contentType: 'image/jpeg',
        caption: 'R8',
        sortOrder: 0,
        localUri: 'file://local/r8.jpg',
      },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.mode).toBe('placeholder');
    expect(result.plan.isPlaceholder).toBe(true);
  });

  it('rejects invalid payloads', () => {
    const env = loadEnv({ NODE_ENV: 'test', APP_ENV: 'development' });
    const result = handleGarageMediaUploadIntent({ env, raw: { nope: true } });
    expect(result).toEqual({ ok: false, error: 'invalid_upload_intent' });
  });
});
