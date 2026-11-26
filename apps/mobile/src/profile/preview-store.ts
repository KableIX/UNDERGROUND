import { visitorPage } from './audience';
import { previewVehicles } from '../garage/preview-vehicles';
import type { SQLiteDatabase } from 'expo-sqlite';
import { founderGarageSeed } from '../data/founder-garage';
import { createDevBypassMember } from '../session/dev-bypass';
import type { SessionMember } from '../session/types';
import {
  restoreSettings,
  validatePage,
  type Connections,
  type Identity,
  type Page,
  type Settings,
  type Vehicle,
} from './page';

const founder = createDevBypassMember();
const pacific = '33333333-3333-4333-8333-333333333302';
let connection: Promise<SQLiteDatabase> | undefined;
async function open() {
  const sqlite = require('expo-sqlite') as typeof import('expo-sqlite');
  const db = await sqlite.openDatabaseAsync('underground-member-pages.db');
  await db.execAsync(`CREATE TABLE IF NOT EXISTS people (id TEXT PRIMARY KEY, number INTEGER UNIQUE NOT NULL, alias TEXT NOT NULL UNIQUE COLLATE NOCASE, name TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS pages (owner TEXT PRIMARY KEY, data TEXT NOT NULL, rev INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS friends (sender TEXT NOT NULL, recipient TEXT NOT NULL, status TEXT NOT NULL, PRIMARY KEY(sender,recipient));`);
  await db.runAsync(
    "INSERT OR IGNORE INTO people VALUES(?,1,'STARK','STARK'),(?,2,'PACIFIC','PACIFIC')",
    founder.memberId,
    pacific,
  );
  await db.runAsync(
    "INSERT OR IGNORE INTO friends VALUES(?,?,'pending')",
    pacific,
    founder.memberId,
  );
  return db;
}
export function previewDatabase() {
  return (connection ??= open().catch((e) => {
    connection = undefined;
    throw e;
  }));
}
type Person = { id: string; number: number; name: string };
function identity(p: Person): Identity {
  return {
    id: p.id,
    number: String(p.number).padStart(6, '0'),
    name: p.name,
    founder: p.id === founder.memberId,
  };
}

export async function previewSignIn(alias: string): Promise<SessionMember> {
  const db = await previewDatabase();
  await db.runAsync(
    `INSERT OR IGNORE INTO people(id,number,alias,name) SELECT
    lower(hex(randomblob(4))||'-'||hex(randomblob(2))||'-4'||substr(hex(randomblob(2)),2)||'-8'||substr(hex(randomblob(2)),2)||'-'||hex(randomblob(6))),
    max(number)+1,?,? FROM people`,
    alias,
    alias,
  );
  const p = await db.getFirstAsync<Person>(
    'SELECT * FROM people WHERE alias=? COLLATE NOCASE',
    alias,
  );
  if (!p) throw new Error('Could not open the beta account.');
  return {
    memberId: p.id,
    memberNumber: identity(p).number,
    displayName: p.name,
    isFounder: p.id === founder.memberId,
    role: 'member',
  };
}

export async function previewConnections(
  id: string,
  active?: SQLiteDatabase,
): Promise<Connections> {
  const db = active ?? (await previewDatabase());
  const rows = await db.getAllAsync<{ id: string; name: string; status: string }>(
    `SELECT p.id,p.name,f.status FROM friends f JOIN people p
    ON p.id=CASE WHEN f.sender=? THEN f.recipient ELSE f.sender END
    WHERE ((f.sender=? OR f.recipient=?) AND f.status='accepted') OR (f.recipient=? AND f.status='pending') ORDER BY p.name`,
    id,
    id,
    id,
    id,
  );
  return {
    accepted: rows.filter((r) => r.status === 'accepted'),
    incoming: rows.filter((r) => r.status === 'pending'),
  };
}
export async function previewRequest(viewer: string, number: string) {
  const db = await previewDatabase();
  let message = 'Request sent.';
  await db.withExclusiveTransactionAsync(async tx => {
    const member = await tx.getFirstAsync<Person>('SELECT * FROM people WHERE number=?', Number(number));
    if (!member) throw new Error('Member unavailable.');
    if (member.id === viewer) throw new Error('Enter another member number.');
    const existing = await tx.getFirstAsync<{sender:string;status:string}>(
      'SELECT sender,status FROM friends WHERE (sender=? AND recipient=?) OR (sender=? AND recipient=?)',
      viewer,member.id,member.id,viewer);
    if (existing) {
      message = existing.status === 'accepted' ? 'Already friends.' : existing.status !== 'pending' ? 'Request unavailable.'
        : existing.sender === viewer ? 'Request pending.' : 'You already have an incoming request from this member.';
    } else await tx.runAsync("INSERT INTO friends VALUES(?,?,'pending')",viewer,member.id);
  });
  return message;
}
export async function previewRespond(id: string, sender: string, accept: boolean) {
  const db = await previewDatabase();
  const result = await db.runAsync(
    "UPDATE friends SET status=? WHERE sender=? AND recipient=? AND status='pending'",
    accept ? 'accepted' : 'rejected',
    sender,
    id,
  );
  if (!result.changes) throw new Error('This request has already changed.');
}

async function vehicles(id: string): Promise<Vehicle[]> {
  return (await previewVehicles(id)).map(car => ({
    id: car.id,
    label: [car.year, car.make, car.model, car.trim].filter(Boolean).join(' '),
    visibility: 'friends',
  }));
}

export async function readPreview(viewer: string, target: string): Promise<Page> {
  const db = await previewDatabase();
  const p = await db.getFirstAsync<Person>('SELECT * FROM people WHERE id=?', target);
  const row = await db.getFirstAsync<{ data: string; rev: number }>(
    'SELECT * FROM pages WHERE owner=?',
    target,
  );
  if (!p) throw new Error('Member page unavailable.');
  const mine = viewer === target;
  const connections = await previewConnections(target, db);
  const s: Settings = restoreSettings(p.name, row ? JSON.parse(row.data) : null);
  if (!mine && !await db.getFirstAsync('SELECT id FROM people WHERE id=?', viewer)) throw new Error('Sign in to visit member pages.');
  if (!row && target === founder.memberId) {
    s.bio = founderGarageSeed.profile.bio;
  }
  s.topEight = s.topEight.filter((id) => connections.accepted.some((f) => f.id === id));
  const visible = await vehicles(target);
  s.custom.owned = s.custom.owned.filter(item => visible.some(v => v.id === item.id));
  if (s.vehicleId && !visible.some(v => v.id === s.vehicleId)) {
    s.vehicleId = null;
    if (s.featuredCar?.linkedVehicleId) { s.featuredCar = null; s.custom.gallery = []; }
  }
  const full: Page = {
    member: identity(p),
    settings: s,
    revision: row?.rev ?? 0,
    friendCount: connections.accepted.length,
    clout: null,
    vehicles: visible,
    featuredFriends: s.topEight.map((id) => connections.accepted.find((f) => f.id === id)!),
  };
  if (mine) return full;
  const projected = visitorPage(full, connections.accepted.some(f => f.id === viewer) ? 'friends' : 'members');
  if (!projected) throw new Error('This member page is private.');
  return projected;
}

export async function savePreview(owner: string, draft: Settings, version: number) {
  const db = await previewDatabase();
  await db.withExclusiveTransactionAsync(async (tx) => {
    const row = await tx.getFirstAsync<{ rev: number }>(
      'SELECT rev FROM pages WHERE owner=?',
      owner,
    );
    if ((row?.rev ?? 0) !== version)
      throw new Error('Your page changed. Reload before saving again.');
    const s = validatePage(draft, (await previewConnections(owner, tx)).accepted, await vehicles(owner));
    if (s.custom.handle && await tx.getFirstAsync(
      "SELECT owner FROM pages WHERE owner<>? AND lower(json_extract(data,'$.custom.handle'))=lower(?)", owner, s.custom.handle))
      throw new Error('That handle is already in use.');
    await tx.runAsync(
      'INSERT OR REPLACE INTO pages VALUES(?,?,?)',
      owner,
      JSON.stringify(s),
      version + 1,
    );
    await tx.runAsync('UPDATE people SET name=? WHERE id=?', s.displayName, owner);
  });
}
