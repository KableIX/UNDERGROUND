import { z } from 'zod';

/**
 * Member pages: the fixed set of theme tokens a member may choose from, the page document built
 * from them, and the rules that decide who sees what.
 *
 * This file is the single definition. The app validates with it before saving and again before
 * rendering; the database re-checks every value on save. The members website carries a plain
 * JavaScript copy of the token tables and rules (apps/members-web/public/schema.js), held to this
 * file by a parity test. Members never supply HTML, CSS or scripts: only these tokens and text.
 */

// ---- Tokens: fixed, versioned choices. A new value is added here and in the website copy. ----
export const PAGE_SECTIONS = [
  'about',
  'garage',
  'drive',
  'friends',
  'music',
  'work',
  'journal',
  'guestbook',
  'collection',
] as const;
export type PageSection = (typeof PAGE_SECTIONS)[number];
export const SECTION_TITLES: Record<PageSection, string> = {
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
export const WALLPAPER_PRESETS = ['Midnight', 'Saratoga', 'Pacific', 'My cover'] as const;
export const HEADING_STYLES = ['Condensed', 'Classic', 'Modern'] as const;
export const PANEL_STYLES = ['Lines', 'Glass', 'Solid'] as const;
export const COVER_SIZES = ['Wide', 'Portrait', 'Compact'] as const;
export const PAGE_ACCENTS = ['Gold', 'Ice', 'Rose', 'Silver'] as const;
export type PageAccent = (typeof PAGE_ACCENTS)[number];
export const ACCENT_COLORS: Record<PageAccent, string> = {
  Gold: '#E1BC82',
  Ice: '#8BE3DF',
  Rose: '#F3A4B9',
  Silver: '#CCD5DD',
};
export const PAGE_AUDIENCES = ['members', 'friends', 'private'] as const;
export const SECTION_FORMATS = ['compact', 'full', 'gallery'] as const;
export const FRAME_MODES = ['whole', 'fill'] as const;
/** How a member drives a car. Classes never compete against each other. */
export const CAR_CLASSES = ['daily', 'collector', 'preserved'] as const;
export type CarClass = (typeof CAR_CLASSES)[number];
export const CAR_CLASS_LABELS: Record<CarClass, string> = {
  daily: 'Daily driver',
  collector: 'Garage / Collector',
  preserved: 'Preserved',
};

// ---- Schema ----
const section = z.enum(PAGE_SECTIONS);
const distinct = (list: string[]) => new Set(list).size === list.length;

/** Photos are JPEG data URLs, as the app stores them. Nothing else is accepted. */
export const PAGE_PHOTO_MAX_LENGTH = 480000;
export const pagePhotoSchema = z
  .string()
  .max(PAGE_PHOTO_MAX_LENGTH)
  .regex(/^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/=]+$/);
const image = pagePhotoSchema.nullable();

/** Links are plain HTTPS addresses: no spaces, quotes, angle brackets or backslashes. */
export const pageLinkSchema = z
  .string()
  .trim()
  .max(350)
  .url()
  .regex(/^https:\/\//i, 'Use an HTTPS link.')
  .regex(/^[^\s"'<>\\`]*$/, 'Use a plain HTTPS link.');

export const PageLookSchema = z.object({
  wallpaper: z.enum(WALLPAPER_PRESETS),
  heading: z.enum(HEADING_STYLES),
  panels: z.enum(PANEL_STYLES),
  coverSize: z.enum(COVER_SIZES),
  large: z.array(section).max(PAGE_SECTIONS.length).refine(distinct).default([]),
  hidden: z.array(section).max(PAGE_SECTIONS.length).refine(distinct),
});
export type PageLook = z.infer<typeof PageLookSchema>;
export function defaultPageLook(): PageLook {
  return { wallpaper: 'Midnight', heading: 'Condensed', panels: 'Lines', coverSize: 'Wide', hidden: [], large: [] };
}

export const PhotoFrameSchema = z.object({
  mode: z.enum(FRAME_MODES),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
});
export type PhotoFrame = z.infer<typeof PhotoFrameSchema>;
export const wholeFrame: PhotoFrame = { mode: 'whole', x: 0.5, y: 0.5 };
export const fillFrame: PhotoFrame = { ...wholeFrame, mode: 'fill' };

export const PageAudienceSchema = z.enum(PAGE_AUDIENCES);
export type PageAudience = z.infer<typeof PageAudienceSchema>;

const photoCard = z.object({ photo: image, frame: PhotoFrameSchema });
const color = z.string().regex(/^(?:#[0-9a-f]{6})?$/i, 'Enter a six-digit hex color.');

export const PageCustomizationSchema = z.object({
  handle: z
    .string()
    .trim()
    .regex(/^(?:[a-z0-9_]{3,24})?$/i, 'Use 3–24 letters, numbers or underscores for your handle.'),
  links: z.array(pageLinkSchema).max(6),
  accentColor: color,
  panelColor: color,
  wallpaper: photoCard.nullable(),
  labels: z.record(section, z.string().trim().max(48)),
  access: z.record(section, PageAudienceSchema),
  formats: z.record(section, z.enum(SECTION_FORMATS)),
  avatarFrame: PhotoFrameSchema,
  coverFrame: PhotoFrameSchema,
  featureFrame: PhotoFrameSchema,
  gallery: z.array(photoCard).max(5),
  owned: z
    .array(photoCard.extend({ id: z.string().uuid() }))
    .max(12)
    .refine((items) => distinct(items.map((item) => item.id)), 'A garage car can only appear once.'),
  showClout: z.boolean(),
  showRuns: z.boolean(),
  showTerritories: z.boolean(),
});
export type PageCustomization = z.infer<typeof PageCustomizationSchema>;
export function defaultPageCustomization(): PageCustomization {
  return {
    handle: '',
    links: [],
    accentColor: '',
    panelColor: '',
    wallpaper: null,
    labels: {},
    access: { collection: 'friends', guestbook: 'friends' },
    formats: {},
    avatarFrame: fillFrame,
    coverFrame: fillFrame,
    featureFrame: wholeFrame,
    gallery: [],
    owned: [],
    showClout: true,
    showRuns: false,
    showTerritories: false,
  };
}

const journalEntry = z.object({
  title: z.string().trim().min(1).max(80),
  note: z.string().trim().max(450),
  frame: PhotoFrameSchema.optional(),
  crew: z.boolean().default(false),
  photo: image.refine((value) => value === null || value.length <= 200000),
});

export const PageSettingsSchema = z.object({
  displayName: z.string().trim().min(1, 'Choose a display name.').max(64),
  status: z.string().trim().max(120),
  bio: z.string().trim().max(500),
  home: z.string().trim().max(64),
  work: z.string().trim().max(100),
  linkedin: z.string().trim().max(350),
  music: z.string().trim().max(350),
  accent: z.enum(PAGE_ACCENTS),
  look: PageLookSchema,
  entries: z.array(journalEntry).max(4),
  trackTitle: z.string().trim().max(80),
  audience: PageAudienceSchema,
  custom: PageCustomizationSchema,
  avatar: image,
  cover: image,
  featuredCar: z
    .object({
      name: z.string().trim().min(1, 'Enter the featured car name.').max(100),
      story: z.string().trim().max(500),
      photo: image.optional(),
      linkedVehicleId: z.string().uuid().optional(),
    })
    .nullable()
    .default(null),
  vehicleId: z.string().uuid().nullable(),
  driveSlug: z.string().trim().max(100),
  topEight: z
    .array(z.string().uuid())
    .max(8)
    .refine((ids) => distinct(ids)),
  layout: z.array(section).length(PAGE_SECTIONS.length).refine(distinct),
});
export type PageSettings = z.infer<typeof PageSettingsSchema>;

// ---- Documents: what the server returns for a page or a garage ----
// Ids are plain strings here because preview and fixture data use ids that are not UUIDs.
export const PageIdentitySchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(64),
  number: z.string().min(1).max(12),
  founder: z.boolean(),
});
export const PageFriendSchema = z.object({ id: z.string().min(1).max(64), name: z.string().min(1).max(64) });
export const PageVehicleSchema = z.object({
  id: z.string().min(1).max(64),
  label: z.string().min(1).max(200),
  visibility: z.enum(['public', 'friends', 'private']),
});
export const MemberPageDocumentSchema = z.object({
  member: PageIdentitySchema,
  settings: PageSettingsSchema,
  revision: z.number().int().nonnegative(),
  verifiedRuns: z.number().int().nonnegative().nullable().optional(),
  territories: z.number().int().nonnegative().nullable().optional(),
  friendCount: z.number().int().nonnegative(),
  clout: z.number().nullable(),
  vehicles: z.array(PageVehicleSchema),
  featuredFriends: z.array(PageFriendSchema),
});
export type PageIdentity = z.infer<typeof PageIdentitySchema>;
export type PageFriend = z.infer<typeof PageFriendSchema>;
/** Loose on purpose so callers can pass what they store; documents are checked strictly at runtime. */
export type PageVehicle = { id: string; label: string; visibility: string };
/** `vehicles` uses the loose car type so the app can hand over what it stores; it is checked on read. */
export type MemberPageDocument = Omit<z.infer<typeof MemberPageDocumentSchema>, 'vehicles'> & {
  vehicles: PageVehicle[];
};
export type PageConnections = { accepted: PageFriend[]; incoming: PageFriend[] };

/** A garage page lists the cars a member chooses to show, each with its details. */
export const GARAGE_VERIFICATION_STATES = ['verified', 'pending_review', 'unverified', 'rejected'] as const;
export const GarageCarPhotoSchema = z.object({
  src: pagePhotoSchema,
  caption: z.string().trim().max(280).nullable(),
  frame: PhotoFrameSchema.optional(),
});
export const GarageCarSchema = z.object({
  id: z.string().min(1).max(64),
  year: z.number().int().min(1900).max(2100),
  make: z.string().trim().min(1).max(60),
  model: z.string().trim().min(1).max(80),
  trim: z.string().trim().max(80).nullable(),
  color: z.string().trim().max(60).nullable(),
  verification: z.enum(GARAGE_VERIFICATION_STATES),
  visibility: z.enum(['public', 'friends', 'private']),
  carClass: z.enum(CAR_CLASSES).nullable(),
  specs: z
    .array(
      z.object({
        key: z.string().trim().min(1).max(40),
        label: z.string().trim().min(1).max(60),
        value: z.string().trim().max(300),
      }),
    )
    .max(24)
    .refine((specs) => distinct(specs.map((spec) => spec.key)), 'A specification can only appear once.'),
  mods: z
    .array(z.object({ title: z.string().trim().min(1).max(120), status: z.enum(['installed', 'pending']) }))
    .max(40),
  photos: z.array(GarageCarPhotoSchema).max(12),
});
export const MemberGarageSchema = z.object({
  member: PageIdentitySchema,
  cars: z.array(GarageCarSchema).max(12),
});
export type GarageCar = z.infer<typeof GarageCarSchema>;
export type MemberGarage = z.infer<typeof MemberGarageSchema>;
export type GarageViewer = 'owner' | 'friend' | 'member';

// ---- Rules ----
const allSections = [...PAGE_SECTIONS];

export function profileCoverRatio(size: PageLook['coverSize']): number {
  return size === 'Portrait' ? 1.2 : size === 'Compact' ? 3.8 : 2.25;
}

export function defaultPageSettings(name: string): PageSettings {
  return {
    displayName: name,
    status: '',
    home: '',
    bio: '',
    work: '',
    linkedin: '',
    music: '',
    accent: 'Gold',
    look: defaultPageLook(),
    entries: [],
    trackTitle: '',
    audience: 'friends',
    custom: defaultPageCustomization(),
    avatar: null,
    cover: null,
    featuredCar: null,
    vehicleId: null,
    driveSlug: '',
    topEight: [],
    layout: [...allSections],
  };
}

/** A saved page may predate newer sections and tokens, so missing pieces take their defaults. */
export function restorePageSettings(name: string, saved: Partial<PageSettings> | null): PageSettings {
  const base = defaultPageSettings(name);
  const order = saved?.layout || base.layout;
  return {
    ...base,
    ...saved,
    custom: { ...base.custom, ...saved?.custom },
    look: { ...base.look, ...saved?.look },
    layout: [...order, ...allSections.filter((key) => !order.includes(key))],
  };
}

/** A shared design contains no URLs, photos, identity or friend selections. */
export function copyPageLook(source: PageSettings, recipient: PageSettings): PageSettings {
  return {
    ...recipient,
    accent: source.accent,
    custom: {
      ...recipient.custom,
      accentColor: source.custom.accentColor,
      panelColor: source.custom.panelColor,
      formats: { ...source.custom.formats },
    },
    layout: [...source.layout],
    look: { ...source.look, large: [...source.look.large], hidden: [...source.look.hidden] },
  };
}

/** A music link may point straight at an audio file on its own HTTPS host. */
export function isDirectAudioFile(value: string): boolean {
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

/**
 * Accepts a LinkedIn profile link, or a Spotify or Apple Music link, or a direct audio file.
 * Anything else throws. Returns the normalized link, or an empty string for no link.
 */
export function normalizeProfileLink(value: string, kind: 'linkedin' | 'music'): string {
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
    if (kind === 'music' && isDirectAudioFile(u.href)) {
      u.hash = '';
      return u.href;
    }
    if (
      kind === 'linkedin' &&
      /^(?:[a-z]{2,3}[.])?linkedin[.]com$/.test(host) &&
      /^[/]in[/][A-Za-z0-9%_-]+[/]?$/.test(u.pathname)
    ) {
      return 'https://www.linkedin.com' + u.pathname.replace(/[/]$/, '');
    }
    if (
      kind === 'music' &&
      host === 'open.spotify.com' &&
      /^[/](track|album|playlist)[/][a-zA-Z0-9]+[/]?$/.test(u.pathname)
    ) {
      return u.origin + u.pathname;
    }
    if (
      kind === 'music' &&
      host === 'music.apple.com' &&
      /^[/][a-z]{2}[/](song|album|playlist)[/].+/.test(u.pathname)
    ) {
      const track = u.searchParams.get('i');
      return u.origin + u.pathname + (track && /^[0-9]+$/.test(track) ? '?i=' + track : '');
    }
  }
  throw new Error(
    kind === 'linkedin'
      ? 'Use your personal linkedin.com/in/ profile link.'
      : 'Use a direct HTTPS MP3, M4A, AAC or WAV file, or a Spotify or Apple Music link.',
  );
}

/**
 * Checks a page before it is saved and returns it with links normalized. Throws on the first
 * problem. Friends and vehicles are what the member actually has, so a page can only name those.
 */
export function validatePageSettings(
  input: PageSettings,
  friends: readonly PageFriend[],
  vehicles: readonly PageVehicle[],
): PageSettings {
  const parsed = PageSettingsSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message || 'Review your profile fields.');
  const s = parsed.data;
  if (s.custom.owned.some((item) => !vehicles.some((v) => v.id === item.id))) {
    throw new Error('Remove unavailable cars from My garage before saving.');
  }
  if (s.topEight.some((id) => !friends.some((f) => f.id === id))) {
    throw new Error('Choose your Top 8 from accepted friends.');
  }
  if (s.featuredCar && (s.featuredCar.linkedVehicleId ?? null) !== s.vehicleId) {
    throw new Error('Choose one featured car.');
  }
  if (s.vehicleId && !vehicles.some((v) => v.id === s.vehicleId)) {
    throw new Error('Choose a car from your garage.');
  }
  return {
    ...s,
    linkedin: normalizeProfileLink(s.linkedin, 'linkedin'),
    music: normalizeProfileLink(s.music, 'music'),
  };
}

/** Swaps an item with the one `amount` places away. An out-of-range move returns the list unchanged. */
export function moveItem<T>(items: T[], index: number, amount: number): T[] {
  const to = index + amount;
  if (to < 0 || to >= items.length || index < 0 || index >= items.length) return items;
  const first = items[index];
  const second = items[to];
  if (first === undefined || second === undefined) return items;
  const copy = [...items];
  copy[to] = first;
  copy[index] = second;
  return copy;
}

/**
 * A page as the server returned it, with defaults filled in and checked once more before anything
 * is drawn from it. Throws when the document does not hold to the schema, so nothing is drawn.
 */
export function pageFromServer(raw: unknown): MemberPageDocument {
  const source = (typeof raw === 'object' && raw ? raw : null) as Record<string, unknown> | null;
  if (!source) throw new Error('This page could not be shown.');
  const identity = PageIdentitySchema.safeParse(source.member);
  if (!identity.success) throw new Error('This page could not be shown.');
  const doc = {
    ...source,
    member: identity.data,
    settings: restorePageSettings(identity.data.name, (source.settings ?? null) as Partial<PageSettings> | null),
  };
  const parsed = MemberPageDocumentSchema.safeParse(doc);
  if (!parsed.success) throw new Error('This page could not be shown.');
  return parsed.data;
}

export type PageViewer = 'friends' | 'members';

/** Who may visit a page at all. The owner is never subject to this check. */
export function pageIsVisibleTo(audience: PageAudience, viewer: PageViewer): boolean {
  return audience === 'members' || (viewer === 'friends' && audience === 'friends');
}

/**
 * What a visitor receives: the page with every section they may not see removed. The live
 * database does the same before sending; preview, fixtures and tests use this so all agree.
 * Returns null when the visitor may not visit the page at all.
 */
export function projectPageForVisitor(
  page: MemberPageDocument,
  viewer: PageViewer,
): MemberPageDocument | null {
  const s = restorePageSettings(page.member.name, page.settings);
  if (!pageIsVisibleTo(s.audience, viewer)) return null;
  const blocked = PAGE_SECTIONS.filter(
    (key) => s.look.hidden.includes(key) || !pageIsVisibleTo(s.custom.access[key] ?? 'members', viewer),
  );
  s.look = { ...s.look, hidden: blocked };
  const c = { ...s.custom, labels: { ...s.custom.labels }, formats: { ...s.custom.formats } };
  for (const key of blocked) {
    delete c.labels[key];
    delete c.formats[key];
  }
  s.custom = c;
  if (blocked.includes('about')) {
    s.bio = '';
    c.links = [];
  }
  if (blocked.includes('music')) {
    s.music = '';
    s.trackTitle = '';
  }
  if (blocked.includes('friends')) s.topEight = [];
  if (blocked.includes('drive')) s.driveSlug = '';
  if (blocked.includes('work')) {
    s.linkedin = '';
    s.work = '';
  }
  if (blocked.includes('journal')) s.entries = [];
  const visibleCars = page.vehicles.filter(
    (v) => v.visibility === 'public' || (v.visibility === 'friends' && viewer === 'friends'),
  );
  if (blocked.includes('collection')) c.owned = [];
  else c.owned = c.owned.filter((item) => visibleCars.some((v) => v.id === item.id));
  if (blocked.includes('garage') || (s.vehicleId && !visibleCars.some((v) => v.id === s.vehicleId))) {
    s.vehicleId = null;
    s.featuredCar = null;
    c.gallery = [];
  }
  return {
    ...page,
    settings: s,
    vehicles: visibleCars.filter((v) => v.id === s.vehicleId || c.owned.some((item) => item.id === v.id)),
    featuredFriends: blocked.includes('friends') ? [] : page.featuredFriends,
    clout: c.showClout ? page.clout : null,
    verifiedRuns: c.showRuns ? page.verifiedRuns : null,
    territories: c.showTerritories ? page.territories : null,
  };
}

/** Which of a member's cars a viewer may see. A private car is for its owner only. */
export function garageCarIsVisible(car: Pick<GarageCar, 'visibility'>, viewer: GarageViewer): boolean {
  if (viewer === 'owner') return true;
  return car.visibility === 'public' || (car.visibility === 'friends' && viewer === 'friend');
}

/** A garage with every car the viewer may not see removed. */
export function projectGarageForViewer(garage: MemberGarage, viewer: GarageViewer): MemberGarage {
  return { ...garage, cars: garage.cars.filter((car) => garageCarIsVisible(car, viewer)) };
}

