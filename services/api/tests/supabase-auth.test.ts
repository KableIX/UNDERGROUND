import { describe, expect, it, vi } from 'vitest';
import { authenticateMember, type MemberGateway } from '../src/supabase-gateway';
import { issueAuthorizedGarageUpload } from '../src/routes/garage-upload-auth';
import { finalizeGarageUpload } from '../src/routes/garage-upload-complete';

const AUTH_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const MEMBER_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const VEHICLE_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const FILE_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

function fakeGateway(): MemberGateway {
  return {
    verifyUserJwt: vi.fn(async (jwt) => jwt === 'test-valid-token' ? AUTH_ID : null),
    lookupMemberId: vi.fn(async (authId) => authId === AUTH_ID ? MEMBER_ID : null),
    ownsVehicle: vi.fn(async (member, vehicle) => member === MEMBER_ID && vehicle === VEHICLE_ID),
    createSignedGarageUpload: vi.fn(async () => 'https://example.supabase.co/storage/v1/object/upload/sign/garage-originals/somepath?token=secret'),
    garageObjectExists: vi.fn(async () => true),
    registerGarageMedia: vi.fn(async () => 'ffffffff-ffff-4fff-8fff-ffffffffffff'),
    getOwnProfile: vi.fn(async () => ({ member: { id: MEMBER_ID } })),
  };
}

const intent = {
  vehicleId: VEHICLE_ID,
  memberId: MEMBER_ID,
  contentType: 'image/jpeg',
  caption: 'Black R8',
  sortOrder: 0,
  localUri: 'file:///private/path/secret.jpg',
};

describe('server-authenticated membership', () => {
  it('rejects requests without configured gateway', async () => {
    const result = await authenticateMember('Bearer test-valid-token', null);
    expect(result).toEqual({ ok: false, status: 503, error: 'member_backend_not_configured' });
  });
  it('rejects missing or invalid bearer JWT', async () => {
    const gateway = fakeGateway();
    expect((await authenticateMember(undefined, gateway)).ok).toBe(false);
    expect((await authenticateMember('Bearer garbagegarbage', gateway)).ok).toBe(false);
    expect(gateway.lookupMemberId).not.toHaveBeenCalled();
  });
  it('maps server-verified JWT identity to member record', async () => {
    const result = await authenticateMember('Bearer test-valid-token', fakeGateway());
    expect(result).toEqual({ ok: true, session: { authUserId: AUTH_ID, memberId: MEMBER_ID } });
  });
  it('rejects valid users without approved member record', async () => {
    const gateway = fakeGateway();
    gateway.lookupMemberId = vi.fn(async () => null);
    expect(await authenticateMember('Bearer test-valid-token', gateway))
      .toEqual({ ok: false, status: 403, error: 'membership_not_active' });
  });
  it('fails closed when auth provider errors', async () => {
    const gateway = fakeGateway();
    gateway.verifyUserJwt = vi.fn(async () => { throw new Error('offline'); });
    expect((await authenticateMember('Bearer test-valid-token', gateway)).ok).toBe(false);
  });
});

describe('authenticated garage upload capability', () => {
  const session = { authUserId: AUTH_ID, memberId: MEMBER_ID };

  it('rejects member ID spoofing and never signs', async () => {
    const gateway = fakeGateway();
    const result = await issueAuthorizedGarageUpload({
      raw: { ...intent, memberId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' },
      session, gateway,
    });
    expect(result).toEqual({ ok: false, status: 403, error: 'member_identity_mismatch' });
    expect(gateway.createSignedGarageUpload).not.toHaveBeenCalled();
  });
  it('rejects vehicle ownership spoofing before signing', async () => {
    const gateway = fakeGateway();
    const result = await issueAuthorizedGarageUpload({
      raw: { ...intent, vehicleId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' },
      session, gateway,
    });
    expect(result).toEqual({ ok: false, status: 403, error: 'vehicle_not_owned' });
    expect(gateway.createSignedGarageUpload).not.toHaveBeenCalled();
  });
  it('generates an opaque upload path under authenticated user namespace', async () => {
    const gateway = fakeGateway();
    const result = await issueAuthorizedGarageUpload({
      raw: intent, session, gateway, now: new Date('2026-11-04T20:00:00.000Z'),
      makeId: () => FILE_ID,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.mode).toBe('signed_upload');
    expect(result.plan.storagePath).toBe(`garage/${AUTH_ID}/${VEHICLE_ID}/${FILE_ID}.jpg`);
    expect(result.plan.storagePath).not.toContain('secret.jpg');
    expect(result.plan.isPlaceholder).toBe(false);
    expect(gateway.createSignedGarageUpload)
      .toHaveBeenCalledWith(`garage/${AUTH_ID}/${VEHICLE_ID}/${FILE_ID}.jpg`);
  });
  it('rejects malformed media requests', async () => {
    const result = await issueAuthorizedGarageUpload({
      raw: { ...intent, contentType: 'application/x-sh' }, session, gateway: fakeGateway(),
    });
    expect(result).toEqual({ ok: false, status: 400, error: 'invalid_upload_intent' });
  });
});

describe('garage media completion is scoped to the signed object namespace', () => {
  const session = { authUserId: AUTH_ID, memberId: MEMBER_ID };
  const path = `garage/${AUTH_ID}/${VEHICLE_ID}/${FILE_ID}.jpg`;
  const complete = { memberId: MEMBER_ID, vehicleId: VEHICLE_ID, storagePath: path, caption: 'Arrival photo', sortOrder: 1 };

  it('persists metadata for an existing object owned by caller', async () => {
    const gateway = fakeGateway();
    const result = await finalizeGarageUpload({ raw: complete, session, gateway });
    expect(result.ok).toBe(true);
    expect(gateway.garageObjectExists).toHaveBeenCalledWith(path);
    expect(gateway.registerGarageMedia).toHaveBeenCalledWith({
      vehicleId: VEHICLE_ID, storagePath: path, caption: 'Arrival photo', sortOrder: 1,
    });
  });
  it('rejects spoofed member and cross-vehicle paths', async () => {
    const gateway = fakeGateway();
    const other = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
    const wrongMember = await finalizeGarageUpload({ raw: { ...complete, memberId: other }, session, gateway });
    expect(wrongMember).toMatchObject({ ok: false, status: 403 });
    const wrongPath = await finalizeGarageUpload({ raw: { ...complete, storagePath: path.replace(AUTH_ID, other) }, session, gateway });
    expect(wrongPath).toMatchObject({ ok: false, status: 403 });
    expect(gateway.registerGarageMedia).not.toHaveBeenCalled();
  });
  it('never registers missing objects', async () => {
    const gateway = fakeGateway();
    gateway.garageObjectExists = vi.fn(async () => false);
    const result = await finalizeGarageUpload({ raw: complete, session, gateway });
    expect(result).toEqual({ ok: false, status: 404, error: 'uploaded_object_not_found' });
    expect(gateway.registerGarageMedia).not.toHaveBeenCalled();
  });
});
