// Plain JavaScript copy of the member page rules, for the browser and the dependency-free dev
// server. The source of truth is packages/domain/src/member-page.ts. A test in packages/domain
// holds this file to it: the token tables must be equal, and both must accept and reject the same
// documents and show visitors the same things. Change both together.

export const PAGE_SECTIONS = Object.freeze([
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
export const SECTION_TITLES = Object.freeze({
  about: 'About me',
  garage: 'Featured car',
  drive: 'Favorite drive',
  friends: 'Top 8',
  music: 'On rotation',
  work: 'Off the road',
  journal: 'Build journal',
  guestbook: 'Guestbook',
  collection: 'My garage',
});
export const WALLPAPER_PRESETS = Object.freeze(['Midnight', 'Saratoga', 'Pacific', 'My cover']);
export const HEADING_STYLES = Object.freeze(['Condensed', 'Classic', 'Modern']);
export const PANEL_STYLES = Object.freeze(['Lines', 'Glass', 'Solid']);
export const COVER_SIZES = Object.freeze(['Wide', 'Portrait', 'Compact']);
export const PAGE_ACCENTS = Object.freeze(['Gold', 'Ice', 'Rose', 'Silver']);
export const ACCENT_COLORS = Object.freeze({
  Gold: '#E1BC82',
  Ice: '#8BE3DF',
  Rose: '#F3A4B9',
  Silver: '#CCD5DD',
});
export const PAGE_AUDIENCES = Object.freeze(['members', 'friends', 'private']);
export const SECTION_FORMATS = Object.freeze(['compact', 'full', 'gallery']);
export const FRAME_MODES = Object.freeze(['whole', 'fill']);
export const CAR_CLASSES = Object.freeze(['daily', 'collector', 'preserved']);
export const CAR_CLASS_LABELS = Object.freeze({
  daily: 'Daily driver',
  collector: 'Garage / Collector',
  preserved: 'Preserved',
});
export const GARAGE_VERIFICATION_STATES = Object.freeze([
  'verified',
  'pending_review',
  'unverified',
  'rejected',
]);
export const PAGE_PHOTO_MAX_LENGTH = 480000;

// ---- Checks. Each mirrors one schema rule: reject, never clean up. ----
const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value, max, min = 0) =>
  typeof value === 'string' && value.trim().length >= min && value.trim().length <= max;
const plain = (value, max, min = 0) =>
  typeof value === 'string' && value.length >= min && value.length <= max;
const oneOf = (list) => (value) => list.includes(value);
const distinct = (list) => new Set(list).size === list.length;
const unit = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
const count = (value) => typeof value === 'number' && Number.isInteger(value) && value >= 0;

const PHOTO = /^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/=]+$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEX_COLOR = /^(?:#[0-9a-f]{6})?$/i;
const HANDLE = /^(?:[a-z0-9_]{3,24})?$/i;

function photo(value) {
  return typeof value === 'string' && value.length <= PAGE_PHOTO_MAX_LENGTH && PHOTO.test(value);
}
function frame(value) {
  return isObject(value) && FRAME_MODES.includes(value.mode) && unit(value.x) && unit(value.y);
}
const photoCard = (value) => isObject(value) && (value.photo === null || photo(value.photo)) && frame(value.frame);
const sectionList = (value) =>
  Array.isArray(value) && value.length <= PAGE_SECTIONS.length && value.every(oneOf(PAGE_SECTIONS)) && distinct(value);
const recordOf = (value, check) =>
  isObject(value) && Object.keys(value).every((key) => PAGE_SECTIONS.includes(key) && check(value[key]));

/** A plain HTTPS address: no spaces, quotes, angle brackets or backslashes. */
function link(value) {
  if (typeof value !== 'string' || value.trim().length > 350) return false;
  const trimmed = value.trim();
  try {
    new URL(trimmed);
  } catch {
    return false;
  }
  return /^https:\/\//i.test(trimmed) && /^[^\s"'<>\\`]*$/.test(trimmed);
}

function validLook(value) {
  return (
    isObject(value) &&
    WALLPAPER_PRESETS.includes(value.wallpaper) &&
    HEADING_STYLES.includes(value.heading) &&
    PANEL_STYLES.includes(value.panels) &&
    COVER_SIZES.includes(value.coverSize) &&
    sectionList(value.hidden) &&
    (value.large === undefined || sectionList(value.large))
  );
}

function validCustom(value) {
  return (
    isObject(value) &&
    typeof value.handle === 'string' &&
    HANDLE.test(value.handle.trim()) &&
    Array.isArray(value.links) &&
    value.links.length <= 6 &&
    value.links.every(link) &&
    typeof value.accentColor === 'string' &&
    HEX_COLOR.test(value.accentColor) &&
    typeof value.panelColor === 'string' &&
    HEX_COLOR.test(value.panelColor) &&
    (value.wallpaper === null || photoCard(value.wallpaper)) &&
    recordOf(value.labels, (label) => text(label, 48)) &&
    recordOf(value.access, oneOf(PAGE_AUDIENCES)) &&
    recordOf(value.formats, oneOf(SECTION_FORMATS)) &&
    frame(value.avatarFrame) &&
    frame(value.coverFrame) &&
    frame(value.featureFrame) &&
    Array.isArray(value.gallery) &&
    value.gallery.length <= 5 &&
    value.gallery.every(photoCard) &&
    Array.isArray(value.owned) &&
    value.owned.length <= 12 &&
    value.owned.every((item) => photoCard(item) && typeof item.id === 'string' && UUID.test(item.id)) &&
    distinct(value.owned.map((item) => item.id)) &&
    typeof value.showClout === 'boolean' &&
    typeof value.showRuns === 'boolean' &&
    typeof value.showTerritories === 'boolean'
  );
}

const validEntry = (value) =>
  isObject(value) &&
  text(value.title, 80, 1) &&
  text(value.note, 450) &&
  (value.frame === undefined || frame(value.frame)) &&
  (value.crew === undefined || typeof value.crew === 'boolean') &&
  (value.photo === null || (photo(value.photo) && value.photo.length <= 200000));

const validFeature = (value) =>
  value === null ||
  value === undefined ||
  (isObject(value) &&
    text(value.name, 100, 1) &&
    text(value.story, 500) &&
    (value.photo === undefined || value.photo === null || photo(value.photo)) &&
    (value.linkedVehicleId === undefined ||
      (typeof value.linkedVehicleId === 'string' && UUID.test(value.linkedVehicleId))));

/** True when every theme token and field of a page's settings is one a member may choose. */
export function validSettings(value) {
  return (
    isObject(value) &&
    text(value.displayName, 64, 1) &&
    text(value.status, 120) &&
    text(value.bio, 500) &&
    text(value.home, 64) &&
    text(value.work, 100) &&
    text(value.linkedin, 350) &&
    text(value.music, 350) &&
    PAGE_ACCENTS.includes(value.accent) &&
    validLook(value.look) &&
    Array.isArray(value.entries) &&
    value.entries.length <= 4 &&
    value.entries.every(validEntry) &&
    text(value.trackTitle, 80) &&
    PAGE_AUDIENCES.includes(value.audience) &&
    validCustom(value.custom) &&
    (value.avatar === null || photo(value.avatar)) &&
    (value.cover === null || photo(value.cover)) &&
    validFeature(value.featuredCar) &&
    (value.vehicleId === null || (typeof value.vehicleId === 'string' && UUID.test(value.vehicleId))) &&
    text(value.driveSlug, 100) &&
    Array.isArray(value.topEight) &&
    value.topEight.length <= 8 &&
    value.topEight.every((id) => typeof id === 'string' && UUID.test(id)) &&
    distinct(value.topEight) &&
    Array.isArray(value.layout) &&
    value.layout.length === PAGE_SECTIONS.length &&
    value.layout.every(oneOf(PAGE_SECTIONS)) &&
    distinct(value.layout)
  );
}

const optionalCount = (value) => value === undefined || value === null || count(value);
const identity = (value) =>
  isObject(value) &&
  plain(value.id, 64, 1) &&
  plain(value.name, 64, 1) &&
  plain(value.number, 12, 1) &&
  typeof value.founder === 'boolean';
const vehicle = (value) =>
  isObject(value) &&
  plain(value.id, 64, 1) &&
  plain(value.label, 200, 1) &&
  ['public', 'friends', 'private'].includes(value.visibility);
const friend = (value) => isObject(value) && plain(value.id, 64, 1) && plain(value.name, 64, 1);
const note = (value) =>
  isObject(value) &&
  plain(value.id, 64, 1) &&
  plain(value.author, 64, 1) &&
  plain(value.name, 64, 1) &&
  plain(value.body, 300, 1);

/** A whole page document, as the server returns it. False means the page must not be drawn. */
export function validPageDocument(value) {
  return (
    isObject(value) &&
    identity(value.member) &&
    validSettings(value.settings) &&
    count(value.revision) &&
    optionalCount(value.verifiedRuns) &&
    optionalCount(value.territories) &&
    count(value.friendCount) &&
    ((typeof value.clout === 'number' && !Number.isNaN(value.clout)) || value.clout === null) &&
    Array.isArray(value.vehicles) &&
    value.vehicles.every(vehicle) &&
    Array.isArray(value.featuredFriends) &&
    value.featuredFriends.every(friend) &&
    (value.guestbook === undefined ||
      (Array.isArray(value.guestbook) && value.guestbook.length <= 60 && value.guestbook.every(note)))
  );
}

const CAR_VISIBILITIES = ['public', 'friends', 'private'];

function validCar(value) {
  if (
    !isObject(value) ||
    !plain(value.id, 64, 1) ||
    !(typeof value.year === 'number' && Number.isInteger(value.year) && value.year >= 1900 && value.year <= 2100) ||
    !text(value.make, 60, 1) ||
    !text(value.model, 80, 1) ||
    !(value.trim === null || text(value.trim, 80)) ||
    !(value.color === null || text(value.color, 60)) ||
    !GARAGE_VERIFICATION_STATES.includes(value.verification) ||
    !CAR_VISIBILITIES.includes(value.visibility) ||
    !(value.carClass === null || CAR_CLASSES.includes(value.carClass)) ||
    !Array.isArray(value.specs) ||
    value.specs.length > 24 ||
    !value.specs.every(
      (spec) =>
        isObject(spec) && text(spec.key, 40, 1) && text(spec.label, 60, 1) && text(spec.value, 300),
    ) ||
    !distinct(value.specs.map((spec) => spec.key.trim())) ||
    !Array.isArray(value.mods) ||
    value.mods.length > 40 ||
    !value.mods.every(
      (mod) => isObject(mod) && text(mod.title, 120, 1) && ['installed', 'pending'].includes(mod.status),
    ) ||
    !Array.isArray(value.photos) ||
    value.photos.length > 12 ||
    !value.photos.every(
      (item) =>
        isObject(item) &&
        photo(item.src) &&
        (item.caption === null || text(item.caption, 280)) &&
        (item.frame === undefined || frame(item.frame)),
    )
  ) {
    return false;
  }
  return true;
}

/** A garage page document: a member and the cars they show. False means it must not be drawn. */
export function validGarageDocument(value) {
  return (
    isObject(value) &&
    identity(value.member) &&
    Array.isArray(value.cars) &&
    value.cars.length <= 12 &&
    value.cars.every(validCar)
  );
}

// ---- Defaults, links and what a visitor may see ----
const FILL = Object.freeze({ mode: 'fill', x: 0.5, y: 0.5 });
const WHOLE = Object.freeze({ mode: 'whole', x: 0.5, y: 0.5 });

export function defaultSettings(name) {
  return {
    displayName: name,
    status: '',
    home: '',
    bio: '',
    work: '',
    linkedin: '',
    music: '',
    accent: 'Gold',
    look: { wallpaper: 'Midnight', heading: 'Condensed', panels: 'Lines', coverSize: 'Wide', hidden: [], large: [] },
    entries: [],
    trackTitle: '',
    audience: 'friends',
    custom: {
      handle: '',
      links: [],
      accentColor: '',
      panelColor: '',
      wallpaper: null,
      labels: {},
      access: { collection: 'friends', guestbook: 'friends' },
      formats: {},
      avatarFrame: FILL,
      coverFrame: FILL,
      featureFrame: WHOLE,
      gallery: [],
      owned: [],
      showClout: true,
      showRuns: false,
      showTerritories: false,
    },
    avatar: null,
    cover: null,
    featuredCar: null,
    vehicleId: null,
    driveSlug: '',
    topEight: [],
    layout: [...PAGE_SECTIONS],
  };
}

/** A saved page may predate newer sections and tokens, so missing pieces take their defaults. */
export function restoreSettings(name, saved) {
  const base = defaultSettings(name);
  const has = isObject(saved);
  const order = (has && saved.layout) || base.layout;
  return {
    ...base,
    ...(has ? saved : undefined),
    custom: { ...base.custom, ...(has ? saved.custom : undefined) },
    look: { ...base.look, ...(has ? saved.look : undefined) },
    layout: [...order, ...PAGE_SECTIONS.filter((key) => !order.includes(key))],
  };
}

export function profileCoverRatio(size) {
  return size === 'Portrait' ? 1.2 : size === 'Compact' ? 3.8 : 2.25;
}

/** The three tokens a garage page borrows from the member's page so the two read as one. */
export function garageLook(settings) {
  return {
    accent: settings.custom.accentColor || ACCENT_COLORS[settings.accent],
    heading: settings.look.heading,
    panels: settings.look.panels,
  };
}

export function validGarageLook(look) {
  return (
    isObject(look) &&
    typeof look.accent === 'string' &&
    (Object.values(ACCENT_COLORS).includes(look.accent) || /^#[0-9a-f]{6}$/i.test(look.accent)) &&
    HEADING_STYLES.includes(look.heading) &&
    PANEL_STYLES.includes(look.panels)
  );
}

/** A music link may point straight at an audio file on its own HTTPS host. */
export function isDirectAudioFile(value) {
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
 * A LinkedIn profile link, a Spotify or Apple Music link, or a direct audio file. Anything else
 * throws. Returns the normalized link, or '' for no link.
 */
export function normalizeProfileLink(value, kind) {
  let raw = value.trim();
  if (!raw) return '';
  if (!/^[a-z][a-z0-9+.-]*:/i.test(raw)) raw = 'https://' + raw;
  let u;
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
    if (kind === 'music' && host === 'open.spotify.com' && /^[/](track|album|playlist)[/][a-zA-Z0-9]+[/]?$/.test(u.pathname)) {
      return u.origin + u.pathname;
    }
    if (kind === 'music' && host === 'music.apple.com' && /^[/][a-z]{2}[/](song|album|playlist)[/].+/.test(u.pathname)) {
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

/** The same, but a link that cannot be used yields '' so that it is never drawn. */
export function safeProfileLink(value, kind) {
  try {
    return normalizeProfileLink(value, kind);
  } catch {
    return '';
  }
}

export function pageIsVisibleTo(audience, viewer) {
  return audience === 'members' || (viewer === 'friends' && audience === 'friends');
}

/**
 * What a visitor receives: the page with every section they may not see removed. The live
 * database does the same before sending; this copy lets the dev server decide before it sends
 * anything, so private content never reaches the browser. Null when the visitor may not visit.
 */
export function projectPageForVisitor(page, viewer) {
  if (!isObject(page) || !isObject(page.member)) return null;
  const s = restoreSettings(page.member.name, page.settings);
  if (!pageIsVisibleTo(s.audience, viewer)) return null;
  const blocked = PAGE_SECTIONS.filter(
    (key) => s.look.hidden.includes(key) || !pageIsVisibleTo(s.custom.access[key] ?? 'members', viewer),
  );
  s.look = { ...s.look, hidden: [...blocked] };
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
  // Wall notes travel with the document; a blocked section must not carry them.
  const guestbook = blocked.includes('guestbook') ? [] : page.guestbook;
  const vehicles = Array.isArray(page.vehicles) ? page.vehicles : [];
  const visibleCars = vehicles.filter(
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
    ...(guestbook === undefined ? {} : { guestbook }),
  };
}

/** Which of a member's cars a viewer may see. A private car is for its owner only. */
export function garageCarIsVisible(car, viewer) {
  if (viewer === 'owner') return true;
  return car.visibility === 'public' || (car.visibility === 'friends' && viewer === 'friend');
}

/** A garage with every car the viewer may not see removed. */
export function projectGarageForViewer(garage, viewer) {
  const cars = Array.isArray(garage?.cars) ? garage.cars : [];
  return { ...garage, cars: cars.filter((car) => garageCarIsVisible(car, viewer)) };
}

