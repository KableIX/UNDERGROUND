import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';
import { publicEnv } from '../lib/env';
import type { SessionMember } from './types';
import { createChunkedSecureStorage, type SecureStringStore } from './chunked-secure-storage';

function loadSecureStore(): SecureStringStore | null {
  try {
    // Deliberately guarded: old development clients lack the native module.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo-secure-store') as SecureStringStore;
    return mod && typeof mod.getItemAsync === 'function' ? mod : null;
  } catch {
    return null;
  }
}

let client: SupabaseClient | null | undefined;

export function isLiveAuthConfigured(): boolean {
  return Boolean(publicEnv.EXPO_PUBLIC_SUPABASE_URL &&
    publicEnv.EXPO_PUBLIC_SUPABASE_ANON_KEY && publicEnv.API_PUBLIC_URL);
}

/** No insecure AsyncStorage fallback for authentication tokens. */
export function getMobileSupabaseClient(): SupabaseClient | null {
  if (client !== undefined) return client;
  client = null;
  if (!isLiveAuthConfigured()) return client;
  const store = loadSecureStore();
  if (!store) return client;
  client = createClient(
    publicEnv.EXPO_PUBLIC_SUPABASE_URL!,
    publicEnv.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        storage: createChunkedSecureStorage(store),
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    },
  );
  return client;
}

type MemberResponse = {
  ok: boolean;
  profile?: {
    member?: {
      id: string;
      member_number: string;
      display_name: string;
      is_founder: boolean;
      role: 'member' | 'admin';
    };
  };
  error?: string;
};

async function loadVerifiedMember(jwt: string): Promise<SessionMember> {
  const response = await fetch(`${publicEnv.API_PUBLIC_URL!.replace(/\/$/, '')}/v1/me`, {
    headers: { Authorization: `Bearer ${jwt}` },
  });
  if (!response.ok) {
    throw new Error(response.status === 403 ? 'membership_not_active' : 'member_backend_unavailable');
  }
  const body = await response.json() as MemberResponse;
  const member = body.profile?.member;
  if (!body.ok || !member || !member.id || !/^\d{6}$/.test(member.member_number.trim())) {
    throw new Error('invalid_member_profile');
  }
  return {
    memberId: member.id,
    memberNumber: member.member_number.trim(),
    displayName: member.display_name,
    isFounder: member.is_founder,
    role: member.role,
  };
}

export async function restoreVerifiedSession(): Promise<SessionMember | null> {
  const supabase = getMobileSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) return null;
  try {
    return await loadVerifiedMember(data.session.access_token);
  } catch {
    await supabase.auth.signOut();
    return null;
  }
}

export async function signInVerifiedMember(email: string, password: string):
  Promise<{ ok: true; member: SessionMember } | { ok: false; error: string }> {
  const supabase = getMobileSupabaseClient();
  if (!supabase) return { ok: false, error: 'authentication_not_configured' };
  if (!email.trim() || !password) return { ok: false, error: 'email_and_password_required' };

  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error || !data.session) return { ok: false, error: 'invalid_credentials' };
  try {
    return { ok: true, member: await loadVerifiedMember(data.session.access_token) };
  } catch (e) {
    await supabase.auth.signOut();
    return { ok: false, error: e instanceof Error ? e.message : 'member_lookup_failed' };
  }
}

export async function signOutVerifiedMember(): Promise<void> {
  await getMobileSupabaseClient()?.auth.signOut();
}
