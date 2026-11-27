import { getMobileSupabaseClient, isLiveAuthConfigured } from '../session/supabase-session';
import { previewDatabase, readPreview } from './preview-store';

export type Note = { id: string; author: string; name: string; body: string };
async function rpc<T>(name: string, args: Record<string, string>) {
  const client = getMobileSupabaseClient();
  if (!client) throw new Error('Sign in to open this page.');
  const { data, error } = await client.rpc(name, args);
  if (error) throw new Error(error.code === '42501' ? 'This guestbook is private.' : error.message);
  return data as T;
}
async function book(viewer: string, target: string) {
  const page = await readPreview(viewer, target);
  if (page.settings.look.hidden.includes('guestbook')) throw new Error('This guestbook is closed.');
  const db = await previewDatabase();
  await db.execAsync(
    'CREATE TABLE IF NOT EXISTS guest_notes(id INTEGER PRIMARY KEY, owner TEXT NOT NULL, author TEXT NOT NULL, body TEXT NOT NULL)',
  );
  return db;
}
export async function notes(viewer: string, target: string): Promise<Note[]> {
  if (isLiveAuthConfigured()) return rpc('member_guest_notes', { target });
  const db = await book(viewer, target);
  return db.getAllAsync<Note>(
    'SELECT CAST(n.id AS TEXT) AS id,n.author,p.name,n.body FROM guest_notes n JOIN people p ON p.id=n.author WHERE n.owner=? ORDER BY n.id DESC LIMIT 60',
    target,
  );
}
export async function signBook(viewer: string, target: string, message: string) {
  const body = message.trim();
  if (!body || body.length > 300) throw new Error('Write a note of 1 to 300 characters.');
  if (isLiveAuthConfigured()) return rpc('sign_member_guestbook', { target, message: body });
  if (viewer === target) throw new Error('Only visiting friends can sign.');
  const db = await book(viewer, target);
  await db.runAsync(
    'INSERT INTO guest_notes(owner,author,body) VALUES(?,?,?)',
    target,
    viewer,
    body,
  );
}
export async function removeNote(viewer: string, target: string, id: string) {
  if (isLiveAuthConfigured()) return rpc('remove_member_guest_note', { target, note_id: id });
  const db = await book(viewer, target);
  const result = await db.runAsync(
    'DELETE FROM guest_notes WHERE id=? AND owner=? AND (author=? OR owner=?)',
    id,
    target,
    viewer,
    viewer,
  );
  if (!result.changes) throw new Error('This note is unavailable.');
}
