import { describe, expect, it } from 'vitest';
import { MemoryStore, hashInviteCode, resolvePersistenceMode } from '../src';
import type { Friendship, MemberInvitation } from '@underground/domain';

const NOW = '2026-11-05T12:00:00.000Z';
const FOUNDER_ID = '11111111-1111-4111-8111-111111111111';
const AUTH_ID = '22222222-2222-4222-8222-222222222222';
const VEHICLE_ID = '33333333-3333-4333-8333-333333333333';
const FRIEND_ID = '44444444-4444-4444-8444-444444444444';
const FRIEND_AUTH = '55555555-5555-4555-8555-555555555555';
const STRANGER_ID = '66666666-6666-4666-8666-666666666666';

describe('resolvePersistenceMode', () => {
  it('defaults to non-durable memory without credentials', () => {
    const status = resolvePersistenceMode({});
    expect(status.mode).toBe('memory');
    expect(status.durable).toBe(false);
  });

  it('selects local-postgis when DATABASE_URL present', () => {
    const status = resolvePersistenceMode({
      DATABASE_URL: 'postgres://underground@localhost:54322/underground',
    });
    expect(status.mode).toBe('local-postgis');
    expect(status.durable).toBe(true);
  });
});

describe('MemoryStore authz + founder garage', () => {
  it('seeds founder STARK #000001 without admin or ranking privilege', () => {
    const store = new MemoryStore();
    const { member, vehicle } = store.seedFounder({
      memberId: FOUNDER_ID,
      authUserId: AUTH_ID,
      vehicleId: VEHICLE_ID,
      nowIso: NOW,
    });
    expect(member.memberNumber).toBe('000001');
    expect(member.displayName).toBe('STARK');
    expect(member.isFounder).toBe(true);
    expect(member.role).toBe('member');
    expect(vehicle.make).toBe('Audi');
    expect(vehicle.model).toBe('R8');
    expect(vehicle.visibility).toBe('friends');
    expect(store.cloutBalance(FOUNDER_ID)).toBe(0);
  });

  it('blocks stranger garage view; allows friend after accept', () => {
    const store = new MemoryStore();
    store.seedFounder({
      memberId: FOUNDER_ID,
      authUserId: AUTH_ID,
      vehicleId: VEHICLE_ID,
      nowIso: NOW,
    });
    store.members.set(FRIEND_ID, {
      id: FRIEND_ID,
      authUserId: FRIEND_AUTH,
      memberNumber: '000002',
      displayName: 'ALLY',
      isFounder: false,
      role: 'member',
      createdAt: NOW,
    });
    store.profiles.set(FRIEND_ID, {
      memberId: FRIEND_ID,
      bio: null,
      coverAssetId: null,
      avatarAssetId: null,
      friendCount: 0,
      followerCount: 0,
      topEight: [],
      updatedAt: NOW,
    });
    store.members.set(STRANGER_ID, {
      id: STRANGER_ID,
      authUserId: '77777777-7777-4777-8777-777777777777',
      memberNumber: '000003',
      displayName: 'GHOST',
      isFounder: false,
      role: 'member',
      createdAt: NOW,
    });

    expect(store.viewVehicle(STRANGER_ID, VEHICLE_ID).ok).toBe(false);

    const friendship: Friendship = {
      id: '88888888-8888-4888-8888-888888888888',
      requesterId: FOUNDER_ID,
      addresseeId: FRIEND_ID,
      status: 'pending',
      createdAt: NOW,
      updatedAt: NOW,
    };
    store.friendships.set(friendship.id, friendship);
    const accepted = store.acceptFriendship(friendship.id, FRIEND_ID, NOW);
    expect(accepted.ok).toBe(true);

    const viewed = store.viewVehicle(FRIEND_ID, VEHICLE_ID);
    expect(viewed.ok).toBe(true);
    if (viewed.ok) {
      expect(viewed.mods).toHaveLength(3);
      expect(viewed.media.every((m) => m.isPlaceholder)).toBe(true);
    }
  });

  it('Top8 only accepts accepted friends', () => {
    const store = new MemoryStore();
    store.seedFounder({
      memberId: FOUNDER_ID,
      authUserId: AUTH_ID,
      vehicleId: VEHICLE_ID,
      nowIso: NOW,
    });
    store.members.set(FRIEND_ID, {
      id: FRIEND_ID,
      authUserId: FRIEND_AUTH,
      memberNumber: '000002',
      displayName: 'ALLY',
      isFounder: false,
      role: 'member',
      createdAt: NOW,
    });
    store.profiles.set(FRIEND_ID, {
      memberId: FRIEND_ID,
      bio: null,
      coverAssetId: null,
      avatarAssetId: null,
      friendCount: 0,
      followerCount: 0,
      topEight: [],
      updatedAt: NOW,
    });
    const friendship: Friendship = {
      id: '88888888-8888-4888-8888-888888888888',
      requesterId: FOUNDER_ID,
      addresseeId: FRIEND_ID,
      status: 'accepted',
      createdAt: NOW,
      updatedAt: NOW,
    };
    store.friendships.set(friendship.id, friendship);

    const bad = store.setTopEight(FOUNDER_ID, [STRANGER_ID], NOW);
    expect(bad.ok).toBe(false);

    const good = store.setTopEight(FOUNDER_ID, [FRIEND_ID], NOW);
    expect(good.ok).toBe(true);
    if (good.ok) expect(good.profile.topEight).toEqual([FRIEND_ID]);
  });

  it('guestbook and DMs enforce participant authz', () => {
    const store = new MemoryStore();
    store.seedFounder({
      memberId: FOUNDER_ID,
      authUserId: AUTH_ID,
      vehicleId: VEHICLE_ID,
      nowIso: NOW,
    });
    store.members.set(FRIEND_ID, {
      id: FRIEND_ID,
      authUserId: FRIEND_AUTH,
      memberNumber: '000002',
      displayName: 'ALLY',
      isFounder: false,
      role: 'member',
      createdAt: NOW,
    });
    store.friendships.set('88888888-8888-4888-8888-888888888888', {
      id: '88888888-8888-4888-8888-888888888888',
      requesterId: FOUNDER_ID,
      addresseeId: FRIEND_ID,
      status: 'accepted',
      createdAt: NOW,
      updatedAt: NOW,
    });

    const gb = store.postGuestbook({
      id: '99999999-9999-4999-8999-999999999901',
      profileMemberId: FOUNDER_ID,
      authorMemberId: FRIEND_ID,
      body: 'Iconic R8.',
      createdAt: NOW,
    });
    expect(gb.ok).toBe(true);

    const thread = store.openDmThread(
      'aaaa1111-aaaa-4aaa-8aaa-aaaaaaaaaa11',
      [FOUNDER_ID, FRIEND_ID],
      NOW,
    );
    const msg = store.postDm(thread.id, {
      id: 'aaaa1111-aaaa-4aaa-8aaa-aaaaaaaaaa12',
      senderId: FRIEND_ID,
      body: 'See you on El Camino.',
      createdAt: NOW,
    });
    expect(msg.ok).toBe(true);

    const forbidden = store.postDm(thread.id, {
      id: 'aaaa1111-aaaa-4aaa-8aaa-aaaaaaaaaa13',
      senderId: STRANGER_ID,
      body: 'Nope',
      createdAt: NOW,
    });
    expect(forbidden.ok).toBe(false);
  });

  it('hashes invite codes and accepts pending invites', () => {
    const store = new MemoryStore();
    const invite: MemberInvitation = {
      id: 'bbbb1111-bbbb-4bbb-8bbb-bbbbbbbbbb11',
      codeHash: hashInviteCode('TEST-INVITE-CODE'),
      invitedByMemberId: null,
      inviteeEmailHash: null,
      status: 'pending',
      acceptedMemberId: null,
      expiresAt: null,
      createdAt: NOW,
      updatedAt: NOW,
    };
    store.invitations.set(invite.id, invite);
    store.seedFounder({
      memberId: FOUNDER_ID,
      authUserId: AUTH_ID,
      vehicleId: VEHICLE_ID,
      nowIso: NOW,
    });
    const accepted = store.acceptInvite(invite.id, FOUNDER_ID, NOW);
    expect(accepted.ok).toBe(true);
    expect(hashInviteCode('TEST-INVITE-CODE')).toHaveLength(64);
  });
});
