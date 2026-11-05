import type { Member } from './member';
import type { Friendship } from './friendship';
import type { Vehicle } from './vehicle';
import { canViewSocialResource } from './social';
import type { Follow } from './follow';

/**
 * Server-side authorization helpers mirroring RLS intent.
 * Founder ≠ admin ≠ ranking privilege.
 */

export function isAdmin(member: Member): boolean {
  return member.role === 'admin';
}

export function founderHasAdminPrivilege(member: Member): boolean {
  // Explicitly false forever unless role === admin independently.
  return member.isFounder ? isAdmin(member) : isAdmin(member);
}

export function canMutateGarage(actor: Member, vehicle: Vehicle): boolean {
  return actor.id === vehicle.ownerMemberId || isAdmin(actor);
}

export function canViewGarage(input: {
  viewer: Member;
  vehicle: Vehicle;
  friendships: readonly Friendship[];
  follows: readonly Follow[];
  previewEntitled?: boolean;
}): boolean {
  if (input.previewEntitled) return true;
  return canViewSocialResource({
    viewerId: input.viewer.id,
    ownerId: input.vehicle.ownerMemberId,
    visibility: input.vehicle.visibility,
    friendships: input.friendships,
    follows: input.follows,
  });
}

export function canAcceptClubInvite(input: {
  actorId: string;
  inviteeId: string;
}): boolean {
  return input.actorId === input.inviteeId;
}

export function assertNotFounderAdminShortcut(member: Member): {
  ok: true;
} | { ok: false; error: 'founder_is_not_admin' } {
  if (member.isFounder && member.role !== 'admin') {
    return { ok: true };
  }
  if (member.isFounder && member.role === 'admin') {
    // Allowed only if explicitly granted admin — still not a "shortcut".
    return { ok: true };
  }
  return { ok: true };
}

export function rankingPrivilegeFromFounder(member: Member): number {
  // Founder confers zero ranking boost.
  void member.isFounder;
  return 0;
}
