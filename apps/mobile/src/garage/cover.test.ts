import { afterEach, expect, it, vi } from 'vitest';
import { coverKey, liveCover, ownerCover } from './cover';

vi.mock('expo-sqlite/kv-store', () => ({ default: { getItem: async () => 'selected' } }));
vi.mock('../lib/env', () => ({ publicEnv: { API_PUBLIC_URL: 'https://example.invalid' } }));
vi.mock('../session/supabase-session', () => ({
  isLiveAuthConfigured: () => true,
  getMobileSupabaseClient: () => ({ auth: { getSession: async () => ({ data: { session: { access_token: 'test' } } }) } }),
}));
afterEach(() => vi.unstubAllGlobals());

it('uses existing member and vehicle cover keys', () => {
  expect(coverKey('member','car',false)).toBe('garage-cover.v1.local.member.car');
  expect(coverKey('member','car',true)).toBe('garage-cover.v1.live.member.car');
});

it('uses the selected readable cover or another readable image', () => {
  const rows = [{id:'a',readUrl:null},{id:'b',readUrl:'b.jpg'},{id:'c',readUrl:'c.jpg'}];
  expect(liveCover(rows,'c')).toBe('c.jpg');
  expect(liveCover(rows,'a')).toBe('b.jpg');
  expect(liveCover([],null)).toBeNull();
});

it('uses only images of the chosen car from the authenticated owner response', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ok:true,json:async () => ({profile:{
    member:{id:'owner'},media:[{id:'selected',vehicleId:'other',readUrl:'other.jpg'},
      {id:'cover',vehicleId:'r8',readUrl:'r8.jpg'}]}})})));
  expect(await ownerCover('owner','r8')).toBe('r8.jpg');
  expect(await ownerCover('owner','missing')).toBeNull();
  await expect(ownerCover('visitor','r8')).rejects.toThrow();
});
