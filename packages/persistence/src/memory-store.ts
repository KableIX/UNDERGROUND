import {
  type Member,
  type Profile,
  type Friendship,
  type Follow,
  type Vehicle,
  type VehicleMod,
  type VehicleMedia,
  type MemberInvitation,
  type Notification,
  type DmThread,
  type DmMessage,
  type GuestbookEntry,
  type GarageCreditEntry,
  type Sighting,
  type RoutePlan,
  type CloutLedgerEntry,
  type OwnershipLedgerEntry,
  acceptMemberInvitation,
  applyFriendshipAccept,
  applyTopEight,
  canViewGarage,
  createGuestbookEntry,
  sendDmMessage,
  appendGarageCreditEntry,
  registerSighting,
  appendCloutLedgerEntry,
  appendOwnershipLedgerEntry,
  sumGarageCredits,
  sumClout,
  rankingPrivilegeFromFounder,
  FOUNDER_MEMBER_NUMBER,
  FOUNDER_DISPLAY_NAME,
} from '@underground/domain';

export type MemoryStoreSnapshot = {
  members: Member[];
  profiles: Profile[];
  friendships: Friendship[];
  follows: Follow[];
  vehicles: Vehicle[];
  vehicleMods: VehicleMod[];
  vehicleMedia: VehicleMedia[];
  invitations: MemberInvitation[];
  notifications: Notification[];
  dmThreads: DmThread[];
  dmMessages: DmMessage[];
  guestbook: GuestbookEntry[];
  garageCredits: GarageCreditEntry[];
  sightings: Sighting[];
  routePlans: RoutePlan[];
  cloutLedger: CloutLedgerEntry[];
  ownershipLedger: OwnershipLedgerEntry[];
  previewEntitlements: Array<{
    memberId: string;
    vehicleId: string;
    grantedByMemberId: string;
  }>;
  visitStats: Map<string, { viewCount: number; uniqueVisitorApprox: number }>;
};

/** In-memory persistent-shaped store with server authz. Not durable across process. */
export class MemoryStore {
  members = new Map<string, Member>();
  profiles = new Map<string, Profile>();
  friendships = new Map<string, Friendship>();
  follows: Follow[] = [];
  vehicles = new Map<string, Vehicle>();
  vehicleMods: VehicleMod[] = [];
  vehicleMedia: VehicleMedia[] = [];
  invitations = new Map<string, MemberInvitation>();
  notifications: Notification[] = [];
  dmThreads = new Map<string, DmThread>();
  dmMessages: DmMessage[] = [];
  guestbook: GuestbookEntry[] = [];
  garageCredits: GarageCreditEntry[] = [];
  sightings: Sighting[] = [];
  routePlans = new Map<string, RoutePlan>();
  cloutLedger: CloutLedgerEntry[] = [];
  ownershipLedger: OwnershipLedgerEntry[] = [];
  previewEntitlements: Array<{
    memberId: string;
    vehicleId: string;
    grantedByMemberId: string;
  }> = [];
  visitStats = new Map<string, { viewCount: number; uniqueVisitorApprox: number }>();

  seedFounder(input: {
    memberId: string;
    authUserId: string;
    vehicleId: string;
    nowIso: string;
  }): { member: Member; vehicle: Vehicle; profile: Profile } {
    const member: Member = {
      id: input.memberId,
      authUserId: input.authUserId,
      memberNumber: FOUNDER_MEMBER_NUMBER,
      displayName: FOUNDER_DISPLAY_NAME,
      isFounder: true,
      role: 'member',
      createdAt: input.nowIso,
    };
    const profile: Profile = {
      memberId: input.memberId,
      bio: 'Founder. Ownership is the entry.',
      coverAssetId: null,
      avatarAssetId: null,
      friendCount: 0,
      followerCount: 0,
      topEight: [],
      updatedAt: input.nowIso,
    };
    const vehicle: Vehicle = {
      id: input.vehicleId,
      ownerMemberId: input.memberId,
      year: 2010,
      make: 'Audi',
      model: 'R8',
      trim: 'V10 5.2 Quattro',
      color: 'black',
      transmission: 'R-Tronic',
      wheels: 'Vossen HF-5',
      brakes: 'red ceramics',
      verificationStatus: 'verified',
      visibility: 'friends',
      createdAt: input.nowIso,
    };
    this.members.set(member.id, member);
    this.profiles.set(profile.memberId, profile);
    this.vehicles.set(vehicle.id, vehicle);
    this.vehicleMods.push(
      {
        id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb01',
        vehicleId: vehicle.id,
        title: 'Vossen HF-5 wheels',
        description: 'Installed wheel set',
        status: 'installed',
        installedAt: input.nowIso,
      },
      {
        id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb02',
        vehicleId: vehicle.id,
        title: 'Red ceramic brakes',
        description: 'Red-finished ceramics',
        status: 'installed',
        installedAt: input.nowIso,
      },
      {
        id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb03',
        vehicleId: vehicle.id,
        title: 'Exhaust tune (pending)',
        description: 'Awaiting install',
        status: 'pending',
        installedAt: null,
      },
    );
    this.vehicleMedia.push(
      {
        id: 'cccccccc-cccc-4ccc-8ccc-cccccccccc01',
        vehicleId: vehicle.id,
        storagePath: 'placeholders/garage/r8-front.PLACEHOLDER.jpg',
        isPlaceholder: true,
        caption: 'PLACEHOLDER — licensed R8 photography needed',
        sortOrder: 0,
      },
      {
        id: 'cccccccc-cccc-4ccc-8ccc-cccccccccc02',
        vehicleId: vehicle.id,
        storagePath: 'placeholders/garage/r8-rear.PLACEHOLDER.jpg',
        isPlaceholder: true,
        caption: 'PLACEHOLDER — licensed R8 photography needed',
        sortOrder: 1,
      },
    );
    this.visitStats.set(vehicle.id, { viewCount: 0, uniqueVisitorApprox: 0 });
    // Founder ranking privilege must remain 0.
    void rankingPrivilegeFromFounder(member);
    return { member, vehicle, profile };
  }

  acceptInvite(
    inviteId: string,
    memberId: string,
    nowIso: string,
  ):
    | { ok: true; invitation: MemberInvitation }
    | { ok: false; error: string } {
    const invite = this.invitations.get(inviteId);
    if (!invite) return { ok: false, error: 'not_found' };
    const result = acceptMemberInvitation(invite, memberId, nowIso);
    if (!result.ok) return result;
    this.invitations.set(inviteId, result.invitation);
    return result;
  }

  acceptFriendship(
    friendshipId: string,
    actorId: string,
    nowIso: string,
  ):
    | { ok: true; friendship: Friendship }
    | { ok: false; error: string } {
    const friendship = this.friendships.get(friendshipId);
    if (!friendship) return { ok: false, error: 'not_found' };
    const result = applyFriendshipAccept(friendship, actorId, nowIso);
    if (!result.ok) return result;
    this.friendships.set(friendshipId, result.friendship);
    const profile = this.profiles.get(result.friendship.requesterId);
    const other = this.profiles.get(result.friendship.addresseeId);
    if (profile) {
      this.profiles.set(profile.memberId, {
        ...profile,
        friendCount: profile.friendCount + 1,
        updatedAt: nowIso,
      });
    }
    if (other) {
      this.profiles.set(other.memberId, {
        ...other,
        friendCount: other.friendCount + 1,
        updatedAt: nowIso,
      });
    }
    return result;
  }

  setTopEight(
    actorId: string,
    friendIds: readonly string[],
    nowIso: string,
  ):
    | { ok: true; profile: Profile }
    | { ok: false; error: string } {
    const profile = this.profiles.get(actorId);
    if (!profile) return { ok: false, error: 'not_found' };
    const result = applyTopEight(
      profile,
      actorId,
      friendIds,
      [...this.friendships.values()],
      nowIso,
    );
    if (!result.ok) return result;
    this.profiles.set(actorId, result.profile);
    return result;
  }

  viewVehicle(
    viewerId: string,
    vehicleId: string,
  ):
    | { ok: true; vehicle: Vehicle; media: VehicleMedia[]; mods: VehicleMod[] }
    | { ok: false; error: 'not_found' | 'forbidden' } {
    const vehicle = this.vehicles.get(vehicleId);
    const viewer = this.members.get(viewerId);
    if (!vehicle || !viewer) return { ok: false, error: 'not_found' };
    const previewEntitled = this.previewEntitlements.some(
      (e) => e.memberId === viewerId && e.vehicleId === vehicleId,
    );
    const allowed = canViewGarage({
      viewer,
      vehicle,
      friendships: [...this.friendships.values()],
      follows: this.follows,
      previewEntitled,
    });
    if (!allowed) return { ok: false, error: 'forbidden' };
    const stats = this.visitStats.get(vehicleId) ?? {
      viewCount: 0,
      uniqueVisitorApprox: 0,
    };
    this.visitStats.set(vehicleId, {
      viewCount: stats.viewCount + 1,
      uniqueVisitorApprox: stats.uniqueVisitorApprox + (viewerId === vehicle.ownerMemberId ? 0 : 1),
    });
    return {
      ok: true,
      vehicle,
      media: this.vehicleMedia.filter((m) => m.vehicleId === vehicleId),
      mods: this.vehicleMods.filter((m) => m.vehicleId === vehicleId),
    };
  }

  postGuestbook(
    input: {
      id: string;
      profileMemberId: string;
      authorMemberId: string;
      body: string;
      createdAt: string;
    },
  ):
    | { ok: true; entry: GuestbookEntry }
    | { ok: false; error: string } {
    const result = createGuestbookEntry(input, [...this.friendships.values()]);
    if (!result.ok) return result;
    this.guestbook.push(result.entry);
    this.notifications.push({
      id: cryptoRandomUuid(),
      memberId: input.profileMemberId,
      kind: 'guestbook_entry',
      title: 'New guestbook entry',
      body: 'A friend signed your guestbook.',
      payload: { entryId: result.entry.id },
      readAt: null,
      createdAt: input.createdAt,
    });
    return result;
  }

  openDmThread(
    id: string,
    participantIds: [string, string],
    createdAt: string,
  ): DmThread {
    const thread: DmThread = {
      id,
      kind: 'direct',
      participantIds: [...participantIds],
      createdAt,
    };
    this.dmThreads.set(id, thread);
    return thread;
  }

  postDm(
    threadId: string,
    input: { id: string; senderId: string; body: string; createdAt: string },
  ):
    | { ok: true; message: DmMessage }
    | { ok: false; error: string } {
    const thread = this.dmThreads.get(threadId);
    if (!thread) return { ok: false, error: 'not_found' };
    const result = sendDmMessage(thread, input);
    if (!result.ok) return result;
    this.dmMessages.push(result.message);
    for (const pid of thread.participantIds) {
      if (pid === input.senderId) continue;
      this.notifications.push({
        id: cryptoRandomUuid(),
        memberId: pid,
        kind: 'dm_received',
        title: 'New message',
        body: 'You have a new direct message.',
        payload: { threadId, messageId: result.message.id },
        readAt: null,
        createdAt: input.createdAt,
      });
    }
    return result;
  }

  appendCredits(entry: GarageCreditEntry) {
    const { result, ledger } = appendGarageCreditEntry(this.garageCredits, entry);
    if (result.ok && result.kind === 'appended') this.garageCredits = ledger;
    return result;
  }

  appendClout(entry: CloutLedgerEntry) {
    const { result, ledger } = appendCloutLedgerEntry(this.cloutLedger, entry);
    if (result.ok && result.kind === 'appended') this.cloutLedger = ledger;
    return result;
  }

  appendOwnership(entry: OwnershipLedgerEntry) {
    const { result, ledger } = appendOwnershipLedgerEntry(this.ownershipLedger, entry);
    if (result.ok && result.kind === 'appended') this.ownershipLedger = ledger;
    return result;
  }

  addSighting(sighting: Sighting) {
    const result = registerSighting(this.sightings, sighting);
    if (result.ok && result.kind === 'created') this.sightings.push(result.sighting);
    return result;
  }

  creditBalance(memberId: string): number {
    return sumGarageCredits(this.garageCredits, memberId);
  }

  cloutBalance(memberId: string): number {
    return sumClout(this.cloutLedger, memberId);
  }

  saveRoutePlan(plan: RoutePlan): void {
    this.routePlans.set(plan.id, plan);
  }
}

function cryptoRandomUuid(): string {
  // Deterministic-enough for in-memory notifications in tests without importing node:crypto in RN path.
  return 'dddddddd-dddd-4ddd-8ddd-' + Math.floor(Math.random() * 1e12).toString().padStart(12, '0');
}
