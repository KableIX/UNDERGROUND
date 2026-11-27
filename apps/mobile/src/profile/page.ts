import { z } from 'zod';

export const accents = {
  Gold: '#E1BC82',
  Ice: '#8BE3DF',
  Rose: '#F3A4B9',
  Silver: '#CCD5DD',
} as const;
export const sectionTitles = {
  about: 'About me',
  garage: 'Featured car',
  drive: 'Favorite drive',
  friends: 'Top 8',
  music: 'On rotation',
  work: 'Off the road',
  journal: 'Build journal',
  guestbook: 'Guestbook',
  collection: 'My garage',
};
export type Section = keyof typeof sectionTitles;
export const editorSections = ['Identity', 'Page style', 'Featured car', 'Favorite drive', 'Top 8',
  'My garage', 'Build journal', 'Soundtrack', 'Off the road', 'Section order', 'Who can visit?'] as const;
export type EditorSection = (typeof editorSections)[number] | 'Customize page';
export const sectionEditor: Record<Section, EditorSection> = {
  collection: 'My garage', about: 'Identity', garage: 'Featured car', drive: 'Favorite drive', friends: 'Top 8',
  music: 'Soundtrack', work: 'Off the road', journal: 'Build journal', guestbook: 'Section order',
};
const sections = Object.keys(sectionTitles) as Section[];
const image = z
  .string()
  .max(480000)
  .regex(/^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/=]+$/)
  .nullable();
const optionalLink = z.string().trim().max(350);

const section = z.enum([
  'about',
  'garage',
  'drive',
  'friends',
  'music',
  'work',
  'journal',
  'guestbook',
  'collection',
]);
const distinct = (list: string[]) => new Set(list).size === list.length;
export const lookSchema = z.object({
  wallpaper: z.enum(['Midnight', 'Saratoga', 'Pacific', 'My cover']),
  heading: z.enum(['Condensed', 'Classic', 'Modern']),
  panels: z.enum(['Lines', 'Glass', 'Solid']),
  coverSize: z.enum(['Wide', 'Portrait', 'Compact']),
  large: z.array(section).max(9).refine(distinct).default([]),
  hidden: z.array(section).max(9).refine(distinct),
});
export type Look = z.infer<typeof lookSchema>;
export const defaultLook = (): Look => ({
  wallpaper: 'Midnight',
  heading: 'Condensed',
  panels: 'Lines',
  coverSize: 'Wide',
  hidden: [],
  large: [],
});
export const frameSchema = z.object({
  mode: z.enum(['whole', 'fill']),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
});
export type Frame = z.infer<typeof frameSchema>;
export const whole: Frame = { mode: 'whole', x: 0.5, y: 0.5 };
export const fill: Frame = { ...whole, mode: 'fill' };
const audience = z.enum(['members', 'friends', 'private']);
export type Audience = z.infer<typeof audience>;
const photoCard = z.object({ photo: image, frame: frameSchema });
const color = z.string().regex(/^(?:#[0-9a-f]{6})?$/i, 'Enter a six-digit hex color.');
const customSchema = z.object({
  handle: z.string().trim().regex(/^(?:[a-z0-9_]{3,24})?$/i, 'Use 3–24 letters, numbers or underscores for your handle.'),
  links: z.array(z.string().max(350).url().regex(/^https:\/\//i, 'Use an HTTPS link.')).max(6),
  accentColor: color, panelColor: color,
  wallpaper: photoCard.nullable(),
  labels: z.record(section, z.string().trim().max(48)),
  access: z.record(section, audience),
  formats: z.record(section, z.enum(['compact', 'full', 'gallery'])),
  avatarFrame: frameSchema, coverFrame: frameSchema, featureFrame: frameSchema,
  gallery: z.array(photoCard).max(5),
  owned: z.array(photoCard.extend({ id: z.string().uuid() })).max(12)
    .refine(items => distinct(items.map(item => item.id)), 'A garage car can only appear once.'),
  showClout: z.boolean(), showRuns: z.boolean(), showTerritories: z.boolean(),
});
export function defaultCustom(): z.infer<typeof customSchema> {
  return {
    handle: '', links: [], accentColor: '', panelColor: '', wallpaper: null,
    labels: {}, access: { collection: 'friends', guestbook: 'friends' }, formats: {},
    avatarFrame: fill, coverFrame: fill, featureFrame: whole, gallery: [], owned: [],
    showClout: true, showRuns: false, showTerritories: false,
  };
}
const journalEntry = z.object({
  title: z.string().trim().min(1).max(80),
  note: z.string().trim().max(450),
  frame: frameSchema.optional(),
  crew: z.boolean().default(false),
  photo: image.refine((v) => v === null || v.length <= 200000),
});
export const settingsSchema = z.object({
  displayName: z.string().trim().min(1, 'Choose a display name.').max(64),
  status: z.string().trim().max(120),
  bio: z.string().trim().max(500),
  home: z.string().trim().max(64),
  work: z.string().trim().max(100),
  linkedin: optionalLink,
  music: optionalLink,
  accent: z.enum(['Gold', 'Ice', 'Rose', 'Silver']),
  look: lookSchema,
  entries: z.array(journalEntry).max(4),
  trackTitle: z.string().trim().max(80),
  audience,
  custom: customSchema,
  avatar: image,
  cover: image,
  featuredCar: z.object({ name: z.string().trim().min(1, 'Enter the featured car name.').max(100),
    story: z.string().trim().max(500), photo: image.optional(),
    linkedVehicleId: z.string().uuid().optional() }).nullable().default(null),
  vehicleId: z.string().uuid().nullable(),
  driveSlug: z.string().max(100),
  topEight: z
    .array(z.string().uuid())
    .max(8)
    .refine((a) => a.length === new Set(a).size),
  layout: z.array(section).length(sections.length).refine(distinct),
});
export type Settings = z.infer<typeof settingsSchema>;
export function profileCoverRatio(size: Settings['look']['coverSize']) {
  return size === 'Portrait' ? 1.2 : size === 'Compact' ? 3.8 : 2.25;
}
export type Identity = { id: string; name: string; number: string; founder: boolean };
export type Friend = { id: string; name: string };
export type Vehicle = { id: string; label: string; visibility: string };
export type Page = {
  member: Identity;
  settings: Settings;
  revision: number;
  verifiedRuns?: number | null;
  territories?: number | null;
  friendCount: number;
  clout: number | null;
  vehicles: Vehicle[];
  featuredFriends: Friend[];
};
export type Connections = { accepted: Friend[]; incoming: Friend[] };

export function defaults(name: string): Settings {
  return {
    displayName: name,
    status: '',
    home: '',
    bio: '',
    work: '',
    linkedin: '',
    music: '',
    accent: 'Gold',
    look: defaultLook(),
    entries: [],
    trackTitle: '',
    audience: 'friends',
    custom: defaultCustom(),
    avatar: null,
    cover: null,
    featuredCar: null,
    vehicleId: null,
    driveSlug: '',
    topEight: [],
    layout: [...sections],
  };
}

export function restoreSettings(name: string, saved: Partial<Settings> | null): Settings {
  const base = defaults(name);
  const order = saved?.layout || base.layout;
  return {
    ...base,
    ...saved,
    custom: { ...base.custom, ...saved?.custom },
    look: { ...base.look, ...saved?.look },
    layout: [...order, ...sections.filter((k) => !order.includes(k))],
  };
}

// A shared design contains no URLs, photos, identity or friend selections.
export function copyLook(source: Settings, recipient: Settings): Settings {
  return {
    ...recipient,
    accent: source.accent,
    custom: { ...recipient.custom, accentColor: source.custom.accentColor,
      panelColor: source.custom.panelColor, formats: { ...source.custom.formats } },
    layout: [...source.layout],
    look: { ...source.look, large: [...source.look.large], hidden: [...source.look.hidden] },
  };
}
export function audioFile(value: string): boolean {
  try {
    const u = new URL(value);
    return (
      u.protocol === 'https:' &&
      !u.port &&
      !u.username &&
      !u.password &&
      /^[a-z0-9-]+(?:[.][a-z0-9-]+)+$/i.test(u.hostname) &&
      !['open.spotify.com', 'music.apple.com'].includes(u.hostname) &&
      /[.](mp3|m4a|aac|wav)$/i.test(u.pathname)
    );
  } catch {
    return false;
  }
}

export function profileLink(value: string, kind: 'linkedin' | 'music') {
  let raw = value.trim();
  if (!raw) return '';
  if (!/^[a-z][a-z0-9+.-]*:/i.test(raw)) raw = 'https://' + raw;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error('Enter a valid ' + (kind === 'music' ? 'music' : 'LinkedIn') + ' link.');
  }
  const host = u.hostname.toLowerCase();
  if (u.protocol === 'https:' && !u.username && !u.password && !u.port) {
    if (kind === 'music' && audioFile(u.href)) {
      u.hash = '';
      return u.href;
    }
    if (
      kind === 'linkedin' &&
      /^(?:[a-z]{2,3}\.)?linkedin\.com$/.test(host) &&
      /^\/in\/[A-Za-z0-9%_-]+\/?$/.test(u.pathname)
    ) {
      return 'https://www.linkedin.com' + u.pathname.replace(/\/$/, '');
    }
    if (
      kind === 'music' &&
      host === 'open.spotify.com' &&
      /^\/(track|album|playlist)\/[a-zA-Z0-9]+\/?$/.test(u.pathname)
    )
      return u.origin + u.pathname;
    if (
      kind === 'music' &&
      host === 'music.apple.com' &&
      /^\/[a-z]{2}\/(song|album|playlist)\/.+/.test(u.pathname)
    ) {
      const track = u.searchParams.get('i');
      return u.origin + u.pathname + (track && /^\d+$/.test(track) ? '?i=' + track : '');
    }
  }
  throw new Error(
    kind === 'linkedin'
      ? 'Use your personal linkedin.com/in/ profile link.'
      : 'Use a direct HTTPS MP3, M4A, AAC or WAV file, or a Spotify or Apple Music link.',
  );
}

export function validatePage(input: Settings, friends: Friend[], vehicles: Vehicle[]) {
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success)
    throw new Error(parsed.error.issues[0]?.message || 'Review your profile fields.');
  const s = parsed.data;
  if (s.custom.owned.some(item => !vehicles.some(v => v.id === item.id)))
    throw new Error('Remove unavailable cars from My garage before saving.');
  if (s.topEight.some((id) => !friends.some((f) => f.id === id)))
    throw new Error('Choose your Top 8 from accepted friends.');
  if (s.featuredCar && (s.featuredCar.linkedVehicleId ?? null) !== s.vehicleId) throw new Error('Choose one featured car.');
  if (s.vehicleId && !vehicles.some((v) => v.id === s.vehicleId))
    throw new Error('Choose a car from your garage.');
  return {
    ...s,
    linkedin: profileLink(s.linkedin, 'linkedin'),
    music: profileLink(s.music, 'music'),
  };
}

export function move<T>(items: T[], index: number, amount: number): T[] {
  const to = index + amount;
  if (to < 0 || to >= items.length || index < 0 || index >= items.length) return items;
  const copy = [...items];
  [copy[to], copy[index]] = [copy[index], copy[to]];
  return copy;
}
