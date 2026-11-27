import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useEffect,
  type ReactNode,
} from 'react';
import { previewSignIn } from '../profile/preview-store';
import { publicEnv } from '../lib/env';
import { createDevBypassMember, isDevAuthBypassAllowed } from './dev-bypass';
import { redeemInvitationCode } from './invite-redeem';
import {
  isLiveAuthConfigured,
  restoreVerifiedSession,
  signInVerifiedMember,
  signOutVerifiedMember,
} from './supabase-session';
import type { SessionMember, SessionState } from './types';

type SessionApi = {
  state: SessionState;
  canDevBypass: boolean;
  liveAuthConfigured: boolean;
  signInWithEmail: (email: string, password: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  signInExistingMember: (displayName: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  updateDisplayName: (memberId: string, displayName: string) => void;
  redeemInvite: (code: string) => { ok: true } | { ok: false; error: string };
  enterDevBypass: () => { ok: true } | { ok: false; error: 'production_blocked' };
  signOut: () => void;
};

const SessionContext = createContext<SessionApi | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const liveAuthConfigured = isLiveAuthConfigured();
  const [state, setState] = useState<SessionState>(
    liveAuthConfigured ? { status: 'loading' } : { status: 'anonymous' },
  );
  // Production/release binaries may never enter the fixture authentication flow.
  const canDevBypass = !liveAuthConfigured && isDevAuthBypassAllowed(publicEnv.APP_ENV) && __DEV__;

  useEffect(() => {
    if (!liveAuthConfigured) return;
    let active = true;
    void restoreVerifiedSession().then(member => {
      if (active) setState(member
        ? { status: 'authenticated', member, via: 'login' }
        : { status: 'anonymous' });
    }).catch(() => { if (active) setState({ status: 'anonymous' }); });
    return () => { active = false; };
  }, [liveAuthConfigured]);

  const authenticate = useCallback((member: SessionMember, via: 'login' | 'invite' | 'dev_bypass') => {
    setState({ status: 'authenticated', member, via });
  }, []);

  // The preview invite and shortcut both sign in as the same local founder.
  const previewFounder = state.status === 'authenticated' && state.member.isFounder &&
    state.via !== 'login' && !liveAuthConfigured;
  useEffect(() => {
    if (!previewFounder) return;
    let active = true;
    void previewSignIn('STARK').then(saved => {
      if (active) setState(previous => previous.status === 'authenticated' &&
        previous.member.memberId === saved.memberId && previous.member.displayName === 'STARK'
        ? { ...previous, member: saved } : previous);
    }).catch(() => undefined);
    return () => { active = false; };
  }, [previewFounder]);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    const result = await signInVerifiedMember(email, password);
    if (!result.ok) return { ok: false as const, error: result.error };
    authenticate(result.member, 'login');
    return { ok: true as const };
  }, [authenticate]);

  const signInExistingMember = useCallback(async (displayName: string) => {
    if (!canDevBypass || liveAuthConfigured) return { ok: false as const, error: 'production_blocked' };
    const alias = displayName.trim().slice(0,64);
    if (!alias) return { ok: false as const, error: 'display_name_required' };
    try {
      authenticate(await previewSignIn(alias), 'login');
      return { ok: true as const };
    } catch { return { ok: false as const, error: 'Could not open this beta account.' }; }
  }, [authenticate, canDevBypass, liveAuthConfigured]);

  const updateDisplayName = useCallback((memberId: string, displayName: string) => {
    setState(previous => previous.status === 'authenticated' && previous.member.memberId === memberId
      ? { ...previous, member: { ...previous.member, displayName } } : previous);
  }, []);

  const redeemInvite = useCallback(
    (code: string) => {
      if (!canDevBypass) return { ok: false as const, error: 'production_blocked' };
      const result = redeemInvitationCode({ code, appEnv: publicEnv.APP_ENV });
      if (!result.ok) return { ok: false as const, error: result.error };
      authenticate(result.member, 'invite');
      return { ok: true as const };
    },
    [authenticate, canDevBypass],
  );

  const enterDevBypass = useCallback(() => {
    if (!canDevBypass) return { ok: false as const, error: 'production_blocked' as const };
    authenticate(createDevBypassMember(), 'dev_bypass');
    return { ok: true as const };
  }, [authenticate, canDevBypass]);

  const signOut = useCallback(() => {
    void signOutVerifiedMember().catch(() => undefined);
    setState({ status: 'anonymous' });
  }, []);

  const value = useMemo(
    () => ({
      state,
      canDevBypass,
      liveAuthConfigured,
      signInWithEmail,
      signInExistingMember, updateDisplayName,
      redeemInvite,
      enterDevBypass,
      signOut,
    }),
    [state, canDevBypass, liveAuthConfigured, signInWithEmail, signInExistingMember, updateDisplayName, redeemInvite, enterDevBypass, signOut],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionApi {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession requires SessionProvider');
  return ctx;
}
