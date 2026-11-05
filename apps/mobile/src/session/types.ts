export type SessionMember = {
  memberId: string;
  memberNumber: string;
  displayName: string;
  isFounder: boolean;
  /** Founder never implies admin. */
  role: 'member' | 'admin';
};

export type SessionState =
  | { status: 'loading' }
  | { status: 'anonymous' }
  | { status: 'authenticated'; member: SessionMember; via: 'login' | 'invite' | 'dev_bypass' };

export type InviteRedeemResult =
  | { ok: true; member: SessionMember }
  | { ok: false; error: 'invalid_code' | 'expired' | 'production_blocked' };
