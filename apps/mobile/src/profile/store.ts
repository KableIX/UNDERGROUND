import { getMobileSupabaseClient, isLiveAuthConfigured } from '../session/supabase-session';
import { restoreSettings, validatePage, type Connections, type Page, type Settings } from './page';
import { previewDatabase, previewConnections, previewRequest, previewRespond, readPreview, savePreview } from './preview-store';

function client() {
  const c = getMobileSupabaseClient();
  if (!c) throw new Error('Sign in to open member pages.');
  return c;
}
function handle(error: { code?: string; message: string }) {
  if (error.code === '23505') return new Error('That handle is already in use.');
  if (error.code === '42501') return new Error('This member page is private.');
  if (error.code === '40001')
    return new Error('Your page changed on another device. Reload the page before saving.');
  if (error.code === 'PGRST202')
    return new Error('The member-page update is unavailable on this server.');
  return new Error(error.message || 'Could not reach your member page.');
}
export async function getPage(viewer: string, target: string): Promise<Page> {
  if (!isLiveAuthConfigured()) return readPreview(viewer, target);
  let { data, error } = await client().rpc('read_custom_member_page', { target });
  if (error?.code === 'PGRST202') ({ data, error } = await client().rpc('read_designed_member_page', { target }));
  if (error) throw handle(error);
  return { ...data, settings: restoreSettings(data.member.name, data.settings) };
}
export async function findMemberPage(viewer: string, number: string): Promise<string> {
  if (!/^\d{6}$/.test(number)) throw new Error('Enter a six-digit member number.');
  if (!isLiveAuthConfigured()) {
    const db = await previewDatabase();
    const person = await db.getFirstAsync<{ id: string }>('SELECT id FROM people WHERE number=?', Number(number));
    if (person && await readPreview(viewer, person.id).catch(() => null)) return person.id;
  } else {
    const { data, error } = await client().rpc('find_visible_member_page', { number_input: number });
    if (error) throw handle(error);
    if (data) return data;
  }
  throw new Error('This member page is unavailable to your account.');
}
export async function getConnections(viewer: string): Promise<Connections> {
  if (!isLiveAuthConfigured()) return previewConnections(viewer);
  const { data, error } = await client().rpc('member_page_connections');
  if (error) throw handle(error);
  return data;
}
export async function requestConnection(viewer: string, number: string): Promise<string> {
  if (!/^[0-9]{6}$/.test(number)) throw new Error('Enter a six-digit member number.');
  if (!isLiveAuthConfigured()) return previewRequest(viewer, number);
  const {data,error} = await client().rpc('request_member_friendship',{member_number_input:number});
  if (error) throw handle(error);
  return data;
}
export async function answerConnection(viewer: string, sender: string, accept: boolean) {
  if (!isLiveAuthConfigured()) return previewRespond(viewer, sender, accept);
  const { data, error } = await client()
    .from('friendships')
    .update({ status: accept ? 'accepted' : 'rejected' })
    .eq('requester_id', sender)
    .eq('addressee_id', viewer)
    .eq('status', 'pending')
    .select('id');
  if (error) throw handle(error);
  if (!data?.length) throw new Error('This request has already changed.');
}
export async function savePage(
  viewer: string,
  page: Page,
  input: Settings,
  connections: Connections,
) {
  if (viewer !== page.member.id) throw new Error('Only the owner can edit this profile.');
  const draft = validatePage(input, connections.accepted, page.vehicles);
  if (!isLiveAuthConfigured()) return savePreview(viewer, draft, page.revision);
  const { error } = await client().rpc('publish_custom_member_page', {
    draft, expected_revision: page.revision,
  });
  if (error) throw handle(error);
}

export async function pickPhoto(
  kind: 'cover' | 'avatar' | 'journal' | 'featured',
) {
  const picker = require('expo-image-picker') as typeof import('expo-image-picker');
  const result = await picker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
  if (result.canceled) return null;
  const asset = result.assets[0];
  return prepareProfilePhoto(asset, kind);
}

export async function prepareProfilePhoto(
  asset: { uri: string; width: number; height: number },
  kind: 'cover' | 'avatar' | 'journal' | 'featured',
) {
  const photo = require('expo-image-manipulator') as typeof import('expo-image-manipulator');
  const edge = kind === 'avatar' ? 720 : kind === 'journal' ? 960 : 1440;
  const width = Math.max(1, Math.round(asset.width * Math.min(1, edge / Math.max(asset.width, asset.height))));
  let resized = await photo.manipulateAsync(
    asset.uri, [{ resize: { width } }],
    { base64: true, compress: 0.72, format: photo.SaveFormat.JPEG },
  );
  const limit = kind === 'journal' ? 199970 : 479970;
  while (resized.base64 && resized.base64.length > limit && resized.width > 160) {
    resized = await photo.manipulateAsync(resized.uri, [{ resize: { width: Math.floor(resized.width * 0.78) } }],
      { base64: true, compress: 0.76, format: photo.SaveFormat.JPEG });
  }
  if (!resized.base64 || resized.base64.length > (kind === 'journal' ? 199970 : 479970))
    throw new Error('Choose a smaller image for this page.');
  return 'data:image/jpeg;base64,' + resized.base64;
}
