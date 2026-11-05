import { describe, expect, it } from 'vitest';
import {
  GarageMediaUploadIntentSchema,
  buildGarageStoragePath,
  planGarageMediaUpload,
} from '../src/storage';

describe('private garage storage contracts', () => {
  it('builds member/vehicle scoped paths', () => {
    expect(
      buildGarageStoragePath({
        memberId: '33333333-3333-4333-8333-333333333301',
        vehicleId: '44444444-4444-4444-8444-444444444401',
        fileName: 'r8-front.jpg',
      }),
    ).toBe(
      'garage/33333333-3333-4333-8333-333333333301/44444444-4444-4444-8444-444444444401/r8-front.jpg',
    );
  });

  it('returns placeholder plan when Supabase credentials are absent', () => {
    const intent = GarageMediaUploadIntentSchema.parse({
      vehicleId: '44444444-4444-4444-8444-444444444401',
      memberId: '33333333-3333-4333-8333-333333333301',
      contentType: 'image/jpeg',
      caption: 'R8 front',
      sortOrder: 0,
      localUri: 'file://local/r8-front.jpg',
    });
    const plan = planGarageMediaUpload({ intent, supabaseReady: false });
    expect(plan.mode).toBe('placeholder');
    expect(plan.isPlaceholder).toBe(true);
    expect(plan.uploadUrl).toBeNull();
    expect(plan.storagePath).toContain('PLACEHOLDER');
    expect(plan.bucket).toBe('garage-originals');
  });

  it('returns signed upload plan when credentials + URL provided', () => {
    const intent = GarageMediaUploadIntentSchema.parse({
      vehicleId: '44444444-4444-4444-8444-444444444401',
      memberId: '33333333-3333-4333-8333-333333333301',
      contentType: 'image/jpeg',
      caption: null,
      sortOrder: 1,
      localUri: 'file://local/r8-rear.jpg',
    });
    const plan = planGarageMediaUpload({
      intent,
      supabaseReady: true,
      signedUploadUrl: 'https://example.supabase.co/storage/v1/upload/sign/test',
      expiresAt: '2026-11-05T01:00:00.000Z',
    });
    expect(plan.mode).toBe('signed_upload');
    expect(plan.isPlaceholder).toBe(false);
    expect(plan.uploadUrl).toContain('https://');
  });
});
