import { describe, expect, it } from 'vitest';
import {
  CAR_CLASSES,
  COVER_SIZES,
  HEADING_STYLES,
  PAGE_AUDIENCES,
  PAGE_PHOTO_MAX_LENGTH,
  PAGE_SECTIONS,
  PANEL_STYLES,
  SECTION_FORMATS,
  WALLPAPER_PRESETS,
  PageSettingsSchema,
  defaultPageSettings,
  isDirectAudioFile,
  moveItem,
  normalizeProfileLink,
  profileCoverRatio,
  validatePageSettings,
  GarageCarSchema,
  MemberGarageSchema,
  pageFromServer,
  projectGarageForViewer,
  projectPageForVisitor,
  restorePageSettings,
  type MemberPageDocument,
  type PageSettings,
} from '../src/member-page';

const jpeg = 'data:image/jpeg;base64,/9j/AAAA';
const id = '44444444-4444-4444-8444-444444444401';
const friend = { id, name: 'PACIFIC' };

function page(overrides: Record<string, unknown> = {}): PageSettings {
  return { ...defaultPageSettings('Driver'), ...overrides } as PageSettings;
}
function accepted(settings: unknown) {
  expect(PageSettingsSchema.safeParse(settings).success).toBe(true);
}
function rejected(settings: unknown) {
  expect(PageSettingsSchema.safeParse(settings).success).toBe(false);
}

describe('theme tokens', () => {
  it('accepts every value a member may choose', () => {
    const base = defaultPageSettings('Driver');
    for (const value of WALLPAPER_PRESETS) accepted({ ...base, look: { ...base.look, wallpaper: value } });
    for (const value of HEADING_STYLES) accepted({ ...base, look: { ...base.look, heading: value } });
    for (const value of PANEL_STYLES) accepted({ ...base, look: { ...base.look, panels: value } });
    for (const value of COVER_SIZES) accepted({ ...base, look: { ...base.look, coverSize: value } });
    for (const value of PAGE_AUDIENCES) accepted({ ...base, audience: value });
    for (const value of ['Gold', 'Ice', 'Rose', 'Silver'] as const) accepted({ ...base, accent: value });
    for (const section of PAGE_SECTIONS) {
      for (const value of SECTION_FORMATS) {
        accepted({ ...base, custom: { ...base.custom, formats: { [section]: value } } });
      }
    }
    expect(CAR_CLASSES).toEqual(['daily', 'collector', 'preserved']);
  });

  it('rejects an unknown token instead of cleaning it up', () => {
    const base = defaultPageSettings('Driver');
    rejected({ ...base, look: { ...base.look, wallpaper: 'Neon' } });
    rejected({ ...base, look: { ...base.look, wallpaper: 'Midnight ' } });
    rejected({ ...base, look: { ...base.look, heading: 'Gothic' } });
    rejected({ ...base, look: { ...base.look, panels: 'Gradient' } });
    rejected({ ...base, look: { ...base.look, coverSize: 'Banner' } });
    rejected({ ...base, accent: 'Bronze' });
    rejected({ ...base, audience: 'everyone' });
    rejected({ ...base, custom: { ...base.custom, access: { collection: 'public' } } });
    rejected({ ...base, custom: { ...base.custom, formats: { friends: 'wide' } } });
    rejected({
      ...base,
      custom: { ...base.custom, avatarFrame: { mode: 'stretch', x: 0.5, y: 0.5 } },
    });
  });

  it('rejects values outside their range', () => {
    const base = defaultPageSettings('Driver');
    for (const x of [-0.01, 1.01, 0.5, Number.NaN]) {
      const ok = PageSettingsSchema.safeParse({
        ...base,
        custom: { ...base.custom, avatarFrame: { mode: 'fill', x, y: 0.5 } },
      }).success;
      expect(ok).toBe(x === 0.5);
    }
    rejected({ ...base, custom: { ...base.custom, avatarFrame: { mode: 'fill', x: '0.5', y: 0.5 } } });
    rejected({ ...base, bio: 'x'.repeat(501) });
    rejected({ ...base, status: 'x'.repeat(121) });
    rejected({ ...base, home: 'x'.repeat(65) });
    rejected({ ...base, work: 'x'.repeat(101) });
    rejected({ ...base, displayName: 'x'.repeat(65) });
    rejected({ ...base, trackTitle: 'x'.repeat(81) });
    rejected({ ...base, custom: { ...base.custom, handle: 'x'.repeat(25) } });
    rejected({ ...base, custom: { ...base.custom, handle: 'ab' } });
    rejected({ ...base, custom: { ...base.custom, labels: { about: 'x'.repeat(49) } } });
    rejected({ ...base, custom: { ...base.custom, links: ['https://e.co/' + 'x'.repeat(345)] } });
    rejected({ ...base, custom: { ...base.custom, links: Array(7).fill('https://e.co') } });
    rejected({ ...base, custom: { ...base.custom, gallery: Array(6).fill({ photo: null, frame: base.custom.avatarFrame }) } });
    rejected({ ...base, custom: { ...base.custom, owned: Array(13).fill({ id, photo: null, frame: base.custom.avatarFrame }) } });
    rejected({ ...base, custom: { ...base.custom, owned: [
      { id, photo: null, frame: base.custom.avatarFrame },
      { id, photo: null, frame: base.custom.avatarFrame },
    ] } });
    rejected({ ...base, custom: { ...base.custom, owned: [{ id: 'not-a-uuid', photo: null, frame: base.custom.avatarFrame }] } });
    rejected({ ...base, entries: Array(5).fill({ title: 'T', note: '', photo: null }) });
    rejected({ ...base, topEight: [id, id] });
    rejected({ ...base, look: { ...base.look, large: ['drive', 'drive'] } });
    rejected({ ...base, avatar: 'data:image/jpeg;base64,/9j/' + 'A'.repeat(PAGE_PHOTO_MAX_LENGTH) });
    accepted({ ...base, bio: 'x'.repeat(500), status: 'x'.repeat(120) });
  });
});

describe('injection attempts', () => {
  const base = defaultPageSettings('Driver');

  it('rejects anything but a plain HTTPS address as a link', () => {
    for (const link of [
      'javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'vbscript:msgbox(1)',
      'http://example.com',
      'https://example.com/" onmouseover="alert(1)',
      'https://example.com/<script>',
      'https://example.com/a b',
      'https://example.com/\\x',
    ]) {
      rejected({ ...base, custom: { ...base.custom, links: [link] } });
    }
    accepted({ ...base, custom: { ...base.custom, links: ['https://example.com/a?b=c%20d'] } });
  });

  it('accepts only a six-digit hex color, or none', () => {
    for (const color of ['#C6B08B', '#c6b08b', '']) {
      accepted({ ...base, custom: { ...base.custom, accentColor: color, panelColor: color } });
    }
    for (const color of ['#fff;background:url(x)', 'red', '#GGGGGG', '#12345', '#0000000', ' #111111']) {
      rejected({ ...base, custom: { ...base.custom, accentColor: color } });
    }
  });

  it('accepts only letters, numbers and underscores in a handle', () => {
    for (const handle of ['<script>', 'a b', 'ab', 'name;drop', 'x'.repeat(25)]) {
      rejected({ ...base, custom: { ...base.custom, handle } });
    }
    accepted({ ...base, custom: { ...base.custom, handle: 'Driver_01' } });
  });

  it('accepts only JPEG data as a photo, never a script or a remote file', () => {
    for (const photo of [
      'data:image/svg+xml,<svg onload=alert(1)>',
      'https://evil.example/photo.jpg',
      'data:image/png;base64,AAAA',
      'data:image/jpeg;base64,/9j/AAAA"<script>',
    ]) {
      rejected({ ...base, avatar: photo, cover: null });
      rejected({ ...base, custom: { ...base.custom, wallpaper: { photo, frame: base.custom.avatarFrame } } });
    }
    accepted({ ...base, avatar: jpeg, cover: jpeg });
  });

  it('keeps markup in plain-text fields as text, never treating it as code', () => {
    const markup = '<b>Hi</b> <script>alert(1)</script> "quotes" & more';
    const parsed = PageSettingsSchema.parse({
      ...base,
      bio: markup,
      custom: { ...base.custom, labels: { about: '<i>Me</i>' } },
    });
    expect(parsed.bio).toBe(markup);
    expect(parsed.custom.labels.about).toBe('<i>Me</i>');
  });

  it('refuses music and LinkedIn links that are not from the allowed services', () => {
    for (const music of [
      'javascript:alert(1)',
      'https://evil.example/track.mp3.exe',
      'https://open.spotify.com.evil.example/track/x',
      'data:audio/mp3;base64,AAAA',
    ]) {
      expect(() => validatePageSettings(page({ music }), [], [])).toThrow();
    }
    for (const linkedin of [
      'javascript:alert(1)',
      'https://linkedin.com.evil.example/in/a',
      'https://evil.example/in/a',
    ]) {
      expect(() => validatePageSettings(page({ linkedin }), [], [])).toThrow();
    }
    expect(validatePageSettings(page({ music: 'https://open.spotify.com/track/abc?si=z' }), [], []).music).toBe(
      'https://open.spotify.com/track/abc',
    );
  });

  it('plays a direct audio file only over HTTPS, with no port and no sign-in', () => {
    expect(isDirectAudioFile('https://audio.example.com/a/intro.MP3?sig=1')).toBe(true);
    for (const url of [
      'http://audio.example.com/a.mp3',
      'https://audio.example.com:8443/a.mp3',
      'https://u:p@audio.example.com/a.mp3',
      'https://open.spotify.com/track/x.mp3',
      'https://audio.example.com/a.html',
      'https://localhost/a.mp3',
      'not a url',
    ]) {
      expect(isDirectAudioFile(url)).toBe(false);
    }
    expect(normalizeProfileLink('https://audio.example.com/a/intro.M4A?sig=1#t=2', 'music')).toBe(
      'https://audio.example.com/a/intro.M4A?sig=1',
    );
  });
});

describe('layout and save checks', () => {
  const base = defaultPageSettings('Driver');

  it('requires every section exactly once, in any order', () => {
    accepted({ ...base, layout: [...base.layout].reverse() });
    rejected({ ...base, layout: base.layout.slice(1) });
    rejected({ ...base, layout: [...base.layout.slice(0, 5), 'about'] });
    rejected({ ...base, layout: [...base.layout.slice(0, 8), 'podcast'] });
  });

  it('only saves friends and cars the member actually has', () => {
    expect(() => validatePageSettings(page({ topEight: [id] }), [], [])).toThrow('Choose your Top 8');
    expect(validatePageSettings(page({ topEight: [id] }), [friend], []).topEight).toEqual([id]);
    expect(() => validatePageSettings(page({ vehicleId: id }), [], [])).toThrow('Choose a car from your garage');
    const vehicles = [{ id, label: 'R8', visibility: 'private' as const }];
    const feature = { name: 'Carrera GT', story: '', photo: jpeg };
    expect(validatePageSettings(page({ featuredCar: feature }), [], []).featuredCar).toEqual(feature);
    const otherCar = '33333333-3333-4333-8333-333333333302';
    expect(() =>
      validatePageSettings(
        page({ vehicleId: id, featuredCar: { ...feature, linkedVehicleId: otherCar } }),
        [],
        vehicles,
      ),
    ).toThrow('Choose one featured car');
  });

  it('moves a section by swapping it with a neighbour', () => {
    expect(moveItem(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c']);
    expect(moveItem(['a', 'b', 'c'], 2, 1)).toEqual(['a', 'b', 'c']);
    expect(profileCoverRatio('Wide')).toBe(2.25);
    expect(profileCoverRatio('Compact')).toBe(3.8);
  });
});

describe('reading a page', () => {
  function document(settings: unknown = defaultPageSettings('STARK')): Record<string, unknown> {
    return {
      member: { id: 'owner', name: 'STARK', number: '000001', founder: true },
      settings,
      revision: 3,
      friendCount: 1,
      clout: 25,
      vehicles: [],
      featuredFriends: [],
    };
  }

  it('fills in defaults for an older page and passes a valid one through', () => {
    const parsed = pageFromServer(document({ bio: 'Hello', layout: ['music', 'about'] }));
    expect(parsed.settings.bio).toBe('Hello');
    expect(parsed.settings.displayName).toBe('STARK');
    expect(parsed.settings.audience).toBe('friends');
    expect(parsed.settings.layout.slice(0, 2)).toEqual(['music', 'about']);
    expect(parsed.settings.layout).toHaveLength(PAGE_SECTIONS.length);
  });

  it('refuses a document that breaks the schema, so nothing is drawn from it', () => {
    const settings = defaultPageSettings('STARK');
    const broken = { ...settings, look: { ...settings.look, wallpaper: 'Neon' } };
    expect(() => pageFromServer(document(broken))).toThrow('This page could not be shown.');
    const injected = { ...settings, custom: { ...settings.custom, accentColor: '#fff;background:url(x)' } };
    expect(() => pageFromServer(document(injected))).toThrow('This page could not be shown.');
    expect(() =>
      pageFromServer({ ...document(), member: { id: '', name: 'STARK', number: '1', founder: false } }),
    ).toThrow('This page could not be shown.');
    expect(() =>
      pageFromServer({ ...document(), vehicles: [{ id, label: 'R8', visibility: 'hidden' }] }),
    ).toThrow('This page could not be shown.');
    expect(() => pageFromServer(null)).toThrow('This page could not be shown.');
  });
});

describe('what a visitor may see', () => {
  function published(): MemberPageDocument {
    const s = defaultPageSettings('STARK');
    s.audience = 'members';
    s.avatar = jpeg;
    s.custom.owned = [{ id, photo: jpeg, frame: s.custom.avatarFrame }];
    s.featuredCar = { name: 'Carrera GT', story: 'The car that got me into cars.', photo: jpeg };
    s.music = 'https://audio.example.com/intro.mp3';
    s.custom.access.music = 'friends';
    s.custom.access.collection = 'friends';
    const vehicles = [{ id, label: '2010 Audi R8', visibility: 'friends' as const }];
    const saved = JSON.parse(JSON.stringify(validatePageSettings(s, [], vehicles)));
    return {
      member: { id: 'owner', name: 'STARK', number: '000001', founder: true },
      settings: restorePageSettings('STARK', saved),
      vehicles,
      revision: 1,
      friendCount: 1,
      clout: 25,
      featuredFriends: [],
    };
  }

  it('shows a friend everything that is not hidden', () => {
    const p = published();
    const f = projectPageForVisitor(p, 'friends')!;
    expect(f.settings.music).toBe(p.settings.music);
    expect(f.settings.custom.owned).toEqual(p.settings.custom.owned);
    expect(f.vehicles).toEqual(p.vehicles);
  });

  it('removes friends-only sections and cars for another member', () => {
    const m = projectPageForVisitor(published(), 'members')!;
    expect(m.vehicles).toEqual([]);
    expect(m.settings.custom.owned).toEqual([]);
    expect(m.settings.music).toBe('');
    expect(m.settings.featuredCar?.photo).toBe(jpeg);
  });

  it('keeps a private page from everyone but the owner', () => {
    const p = published();
    p.settings.audience = 'private';
    expect(projectPageForVisitor(p, 'friends')).toBeNull();
    expect(projectPageForVisitor(p, 'members')).toBeNull();
  });

  it('hides the numbers a member chose not to show', () => {
    const p = published();
    p.settings.custom.showClout = false;
    expect(projectPageForVisitor(p, 'friends')!.clout).toBeNull();
  });
});

describe('garage page', () => {
  const garageMember = { id: 'owner', name: 'STARK', number: '000001', founder: false };
  function car(overrides: Record<string, unknown> = {}) {
    return {
      id,
      year: 2021,
      make: 'Lamborghini',
      model: 'Huracán STO',
      trim: null,
      color: 'Verde Mantis',
      verification: 'verified',
      visibility: 'friends',
      carClass: 'collector',
      specs: [{ key: 'exhaust', label: 'Exhaust', value: 'Titanium race exhaust' }],
      mods: [{ title: 'Titanium race exhaust', status: 'installed' }],
      photos: [{ src: jpeg, caption: null }],
      ...overrides,
    };
  }

  it('accepts every car class, or none, and rejects an unknown class', () => {
    for (const carClass of [null, ...CAR_CLASSES]) {
      expect(GarageCarSchema.safeParse(car({ carClass })).success).toBe(true);
    }
    expect(GarageCarSchema.safeParse(car({ carClass: 'track' })).success).toBe(false);
  });

  it('rejects a car with too much in it, a repeated specification or an unknown state', () => {
    expect(GarageCarSchema.safeParse(car({ photos: Array(13).fill({ src: jpeg, caption: null }) })).success).toBe(
      false,
    );
    expect(GarageCarSchema.safeParse(car({ photos: [{ src: jpeg, caption: 'x'.repeat(281) }] })).success).toBe(
      false,
    );
    const repeated = car({ specs: [{ key: 'a', label: 'A', value: '1' }, { key: 'a', label: 'A2', value: '2' }] });
    expect(GarageCarSchema.safeParse(repeated).success).toBe(false);
    expect(GarageCarSchema.safeParse(car({ verification: 'approved' })).success).toBe(false);
    const remote = car({ photos: [{ src: 'https://evil.example/x.jpg', caption: null }] });
    expect(GarageCarSchema.safeParse(remote).success).toBe(false);
  });

  it('shows a private car to its owner only, and friends-only cars to friends', () => {
    const garage = MemberGarageSchema.parse({
      member: garageMember,
      cars: [
        car({ id: 'a', visibility: 'private' }),
        car({ id: 'b', visibility: 'friends' }),
        car({ id: 'c', visibility: 'public' }),
      ],
    });
    const shown = (viewer: 'owner' | 'friend' | 'member') =>
      projectGarageForViewer(garage, viewer).cars.map((c) => c.id);
    expect(shown('owner')).toEqual(['a', 'b', 'c']);
    expect(shown('friend')).toEqual(['b', 'c']);
    expect(shown('member')).toEqual(['c']);
    expect(garage.cars).toHaveLength(3);
  });
});

