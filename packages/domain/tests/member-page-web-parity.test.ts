import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createDevData, type DevReply } from '../../../apps/members-web/lib/dev-data.mjs';
import * as web from '../../../apps/members-web/public/schema.js';
import {
  ACCENT_COLORS,
  CAR_CLASSES,
  CAR_CLASS_LABELS,
  COVER_SIZES,
  FRAME_MODES,
  GARAGE_VERIFICATION_STATES,
  HEADING_STYLES,
  PAGE_ACCENTS,
  PAGE_AUDIENCES,
  PAGE_PHOTO_MAX_LENGTH,
  PAGE_SECTIONS,
  PANEL_STYLES,
  SECTION_FORMATS,
  SECTION_TITLES,
  WALLPAPER_PRESETS,
  MemberGarageSchema,
  MemberPageDocumentSchema,
  PageSettingsSchema,
  defaultPageSettings,
  isDirectAudioFile,
  normalizeProfileLink,
  projectGarageForViewer,
  projectPageForVisitor,
  type MemberGarage,
  type MemberPageDocument,
} from '../src/member-page';

// The website carries a plain JavaScript copy of these rules because it has no build step and no
// dependencies. This file holds that copy to the schema: same tokens, same answers, every time.

const fixtures = fileURLToPath(new URL('../../../apps/members-web/fixtures/', import.meta.url));

async function load(folder: string): Promise<Record<string, unknown>[]> {
  const dir = join(fixtures, folder);
  const names = (await readdir(dir)).filter((name) => name.endsWith('.json'));
  return Promise.all(names.map(async (name) => JSON.parse(await readFile(join(dir, name), 'utf8'))));
}

/** Compares through JSON, so key order and dropped undefined values do not matter. */
const json = (value: unknown) => JSON.parse(JSON.stringify(value));

const car = '44444444-4444-4444-8444-444444444401';
const jpeg = 'data:image/jpeg;base64,/9j/AAAA';

function settingsCases(): [string, unknown][] {
  const base = defaultPageSettings('Driver');
  const frame = base.custom.avatarFrame;
  const custom = (change: Record<string, unknown>) => ({ ...base.custom, ...change });
  const look = (change: Record<string, unknown>) => ({ ...base.look, ...change });
  return [
    ['defaults', base],
    [
      'every token in use',
      {
        ...base,
        accent: 'Ice',
        audience: 'members',
        bio: 'x'.repeat(500),
        driveSlug: 'a-b',
        trackTitle: 'x',
        look: look({ wallpaper: 'Pacific', heading: 'Classic', panels: 'Solid', coverSize: 'Portrait', large: ['drive'] }),
        custom: custom({
          handle: 'driver_01',
          links: ['https://example.com/a?b=1'],
          accentColor: '#123456',
          panelColor: '#abcdef',
          wallpaper: { photo: jpeg, frame },
          labels: { about: 'Me' },
          access: { collection: 'private' },
          formats: { friends: 'compact' },
          gallery: [{ photo: null, frame }],
          owned: [{ id: car, photo: jpeg, frame }],
        }),
        entries: [{ title: 'T', note: '', photo: null, crew: true }],
        avatar: jpeg,
        cover: jpeg,
        featuredCar: { name: 'Car', story: '', photo: jpeg, linkedVehicleId: car },
        vehicleId: car,
        topEight: [car],
        layout: [...base.layout].reverse(),
      },
    ],
    ['unknown wallpaper', { ...base, look: look({ wallpaper: 'Neon' }) }],
    ['space inside a token', { ...base, look: look({ heading: 'Classic ' }) }],
    ['unknown accent', { ...base, accent: 'Bronze' }],
    ['unknown audience', { ...base, audience: 'everyone' }],
    ['unknown section in layout', { ...base, layout: [...base.layout.slice(0, 8), 'podcast'] }],
    ['short layout', { ...base, layout: base.layout.slice(1) }],
    ['repeated section in layout', { ...base, layout: [...base.layout.slice(0, 8), 'about'] }],
    ['repeated large section', { ...base, look: look({ large: ['drive', 'drive'] }) }],
    ['frame above one', { ...base, custom: custom({ avatarFrame: { mode: 'fill', x: 1.5, y: 0.5 } }) }],
    ['frame as text', { ...base, custom: custom({ avatarFrame: { mode: 'fill', x: '0.5', y: 0.5 } }) }],
    ['unknown frame mode', { ...base, custom: custom({ avatarFrame: { mode: 'stretch', x: 0.5, y: 0.5 } }) }],
    ['color carrying css', { ...base, custom: custom({ accentColor: '#fff;background:url(x)' }) }],
    ['short color', { ...base, custom: custom({ panelColor: '#12345' }) }],
    ['handle with a space', { ...base, custom: custom({ handle: 'a b' }) }],
    ['short handle', { ...base, custom: custom({ handle: 'ab' }) }],
    ['label on unknown section', { ...base, custom: custom({ labels: { podcast: 'x' } }) }],
    ['long label', { ...base, custom: custom({ labels: { about: 'x'.repeat(49) } }) }],
    ['unknown access value', { ...base, custom: custom({ access: { collection: 'public' } }) }],
    ['unknown format value', { ...base, custom: custom({ formats: { friends: 'wide' } }) }],
    ['script link', { ...base, custom: custom({ links: ['javascript:alert(1)'] }) }],
    ['link with a quote', { ...base, custom: custom({ links: ['https://example.com/" onmouseover="alert(1)'] }) }],
    ['insecure link', { ...base, custom: custom({ links: ['http://example.com'] }) }],
    ['not a link', { ...base, custom: custom({ links: ['not a url'] }) }],
    ['too many links', { ...base, custom: custom({ links: Array(7).fill('https://example.com') }) }],
    ['svg photo', { ...base, avatar: 'data:image/svg+xml,<svg onload=alert(1)>' }],
    ['remote photo', { ...base, cover: 'https://example.com/x.jpg' }],
    ['png photo', { ...base, avatar: 'data:image/png;base64,AAAA' }],
    ['photo too long', { ...base, avatar: 'data:image/jpeg;base64,/9j/' + 'A'.repeat(PAGE_PHOTO_MAX_LENGTH) }],
    [
      'journal photo too long',
      { ...base, entries: [{ title: 'T', note: '', photo: 'data:image/jpeg;base64,/9j/' + 'A'.repeat(200001) }] },
    ],
    ['blank journal title', { ...base, entries: [{ title: '   ', note: '', photo: null }] }],
    ['too many journal entries', { ...base, entries: Array(5).fill({ title: 'T', note: '', photo: null }) }],
    ['long bio', { ...base, bio: 'x'.repeat(501) }],
    ['blank name', { ...base, displayName: '   ' }],
    ['number where text belongs', { ...base, status: 7 }],
    ['null where text belongs', { ...base, home: null }],
    ['look missing', { ...base, look: undefined }],
    ['hidden list missing', { ...base, look: { ...base.look, hidden: undefined } }],
    ['garage car id not a uuid', { ...base, custom: custom({ owned: [{ id: 'car', photo: null, frame }] }) }],
    [
      'garage car listed twice',
      { ...base, custom: custom({ owned: [{ id: car, photo: null, frame }, { id: car, photo: null, frame }] }) },
    ],
    ['garage car without a frame', { ...base, custom: custom({ owned: [{ id: car, photo: null }] }) }],
    ['featured car id not a uuid', { ...base, vehicleId: 'r8' }],
    ['top 8 id not a uuid', { ...base, topEight: ['stark'] }],
    ['top 8 id twice', { ...base, topEight: [car, car] }],
    ['featured car without a name', { ...base, featuredCar: { name: '', story: '' } }],
    ['toggle as text', { ...base, custom: custom({ showClout: 'yes' }) }],
    ['customization missing', { ...base, custom: undefined }],
    ['not an object', 'nope'],
    ['null', null],
  ];
}

describe('website copy of the member page rules', () => {
  it('lists exactly the same tokens', () => {
    const lists: [string, readonly string[], readonly string[]][] = [
      ['sections', PAGE_SECTIONS, web.PAGE_SECTIONS],
      ['wallpapers', WALLPAPER_PRESETS, web.WALLPAPER_PRESETS],
      ['headings', HEADING_STYLES, web.HEADING_STYLES],
      ['panels', PANEL_STYLES, web.PANEL_STYLES],
      ['cover sizes', COVER_SIZES, web.COVER_SIZES],
      ['accents', PAGE_ACCENTS, web.PAGE_ACCENTS],
      ['audiences', PAGE_AUDIENCES, web.PAGE_AUDIENCES],
      ['formats', SECTION_FORMATS, web.SECTION_FORMATS],
      ['frame modes', FRAME_MODES, web.FRAME_MODES],
      ['car classes', CAR_CLASSES, web.CAR_CLASSES],
      ['verification states', GARAGE_VERIFICATION_STATES, web.GARAGE_VERIFICATION_STATES],
    ];
    for (const [name, shared, copy] of lists) expect([...copy], name).toEqual([...shared]);
    expect(web.SECTION_TITLES).toEqual(SECTION_TITLES);
    expect(web.ACCENT_COLORS).toEqual(ACCENT_COLORS);
    expect(web.CAR_CLASS_LABELS).toEqual(CAR_CLASS_LABELS);
    expect(web.PAGE_PHOTO_MAX_LENGTH).toBe(PAGE_PHOTO_MAX_LENGTH);
  });

  it('accepts and rejects the same settings', () => {
    const cases = settingsCases();
    const accepted = cases.filter(([, value]) => PageSettingsSchema.safeParse(value).success).map(([label]) => label);
    expect(accepted).toEqual(['defaults', 'every token in use']);
    for (const [label, value] of cases) {
      expect(PageSettingsSchema.safeParse(value).success, label).toBe(web.validSettings(value));
    }
  });

  it('turns the same links into the same addresses, or none', () => {
    const links: [string, 'linkedin' | 'music'][] = [
      ['', 'linkedin'],
      ['linkedin.com/in/stark/?trk=abc', 'linkedin'],
      ['javascript:alert(1)', 'linkedin'],
      ['https://linkedin.com.example.org/in/stark', 'linkedin'],
      ['https://evil.example/in/a', 'linkedin'],
      ['https://music.apple.com/us/album/test/1?i=23&at=tracker', 'music'],
      ['https://open.spotify.com/track/abc?si=z', 'music'],
      ['https://audio.example.com/club/intro.M4A?signature=abc#skip', 'music'],
      ['http://audio.example.com/intro.mp3', 'music'],
      ['https://user@audio.example.com/intro.wav', 'music'],
      ['https://example.com', 'music'],
      ['  https://open.spotify.com/track/abc  ', 'music'],
    ];
    for (const [value, kind] of links) {
      let expected = '';
      try {
        expected = normalizeProfileLink(value, kind);
      } catch {
        expected = '';
      }
      expect(web.safeProfileLink(value, kind), `${kind}: ${value}`).toBe(expected);
    }
  });

  it('agrees on which addresses are direct audio files', () => {
    for (const url of [
      'https://audio.example.com/a/intro.MP3?sig=1',
      'http://audio.example.com/a.mp3',
      'https://audio.example.com:8443/a.mp3',
      'https://u:p@audio.example.com/a.mp3',
      'https://open.spotify.com/track/x.mp3',
      'https://audio.example.com/a.html',
      'https://localhost/a.mp3',
      'not a url',
    ]) {
      expect(web.isDirectAudioFile(url), url).toBe(isDirectAudioFile(url));
    }
  });

  it('accepts and rejects the same page documents', async () => {
    const pages = await load('pages');
    expect(pages.length).toBeGreaterThan(1);
    const [first] = pages;
    const settings = (first?.settings ?? {}) as Record<string, unknown>;
    const variants: [string, unknown][] = [
      ...pages.map((page) => ['fixture', page] as [string, unknown]),
      [
        'unknown wallpaper',
        { ...first, settings: { ...settings, look: { ...(settings.look as object), wallpaper: 'Neon' } } },
      ],
      ['member without a number', { ...first, member: { ...((first?.member ?? {}) as object), number: '' } }],
      ['vehicle with unknown visibility', { ...first, vehicles: [{ id: car, label: 'R8', visibility: 'hidden' }] }],
      ['blank wall note', { ...first, guestbook: [{ id: 'n', author: car, name: 'X', body: '' }] }],
      ['negative revision', { ...first, revision: -1 }],
      ['clout missing', { ...first, clout: undefined }],
      ['not an object', []],
    ];
    for (const [label, value] of variants) {
      expect(MemberPageDocumentSchema.safeParse(value).success, label).toBe(web.validPageDocument(value));
    }
  });

  it('shows every visitor exactly what the shared rules show them', async () => {
    for (const page of await load('pages')) {
      for (const viewer of ['friends', 'members'] as const) {
        const shared = json(projectPageForVisitor(page as MemberPageDocument, viewer));
        expect(json(web.projectPageForVisitor(page, viewer)), `${String(page.member)} as ${viewer}`).toEqual(shared);
      }
    }
  });

  it('accepts, rejects and filters garages the same way', async () => {
    const garages = await load('garages');
    const [first] = garages;
    const cars = (first?.cars ?? []) as Record<string, unknown>[];
    const member = first?.member;
    const variants: [string, unknown][] = [
      ...garages.map((garage) => ['fixture', garage] as [string, unknown]),
      ['unknown class', { member, cars: [{ ...cars[0], carClass: 'track' }] }],
      [
        'too many photos',
        { member, cars: [{ ...cars[0], photos: Array(13).fill({ src: jpeg, caption: null }) }] },
      ],
      [
        'remote photo',
        { member, cars: [{ ...cars[0], photos: [{ src: 'https://example.com/x.jpg', caption: null }] }] },
      ],
      [
        'repeated specification',
        {
          member,
          cars: [{ ...cars[0], specs: [{ key: 'a', label: 'A', value: '1' }, { key: ' a', label: 'B', value: '2' }] }],
        },
      ],
      ['year out of range', { member, cars: [{ ...cars[0], year: 1850 }] }],
      ['one car alone', { member, cars: [cars[0]] }],
      ['no cars', { member, cars: [] }],
    ];
    for (const [label, value] of variants) {
      expect(MemberGarageSchema.safeParse(value).success, label).toBe(web.validGarageDocument(value));
    }
    for (const garage of garages) {
      for (const viewer of ['owner', 'friend', 'member'] as const) {
        expect(json(web.projectGarageForViewer(garage, viewer))).toEqual(
          json(projectGarageForViewer(garage as MemberGarage, viewer)),
        );
      }
    }
  });
});

// The dev server decides who sees what before anything is sent. These are its decisions.
describe('dev members site: who may see what', () => {
  const root = fileURLToPath(new URL('../../../apps/members-web/', import.meta.url));
  const stark = '11111111-1111-4111-8111-111111111111';
  const pacific = '22222222-2222-4222-8222-222222222222';
  const vega = '33333333-3333-4333-8333-333333333333';
  const as = (memberId: string) => `ug_dev_session=${encodeURIComponent(memberId)}`;
  type Page = {
    viewer?: string;
    page?: { settings: { custom: { owned: unknown[] } }; vehicles: unknown[]; guestbook?: unknown[] };
  };
  type Garage = { garage?: { cars: { model: string }[] } };
  const page = (reply: DevReply) => reply.body as Page;
  const models = (reply: DevReply) => (reply.body as Garage).garage?.cars.map((c) => c.model);

  it('lets nobody in without a session, and does not reveal unknown members', async () => {
    const data = await createDevData(root);
    expect((await data.page(stark, undefined)).status).toBe(401);
    expect((await data.garage(stark, 'ug_dev_session=nobody')).status).toBe(401);
    expect((await data.page('not-a-member', as(stark))).status).toBe(404);
    expect(data.directory().map((m) => m.number)).toEqual(['000001', '000002', '000003', '000004']);
    expect(data.memberByNumber('000001')?.id).toBe(stark);
    expect(data.memberByNumber('999999')).toBeNull();
  });

  it('answers "am I signed in" and the member list from the cookie exactly as sent', async () => {
    const data = await createDevData(root);
    // Both take the raw header. Parsing it a second time once made every member look signed out.
    expect(data.session(as(stark))).toEqual({
      signedIn: true,
      member: { id: stark, number: '000001', name: 'STARK', founder: true },
    });
    expect(data.session(undefined)).toEqual({ signedIn: false, member: null });
    expect(data.session('ug_dev_session=nobody').signedIn).toBe(false);
    const listed = await data.directoryFor(as(pacific));
    expect(listed.status).toBe(200);
    expect((listed.body as { members: { name: string }[] }).members.map((m) => m.name)).toEqual([
      'STARK',
      'PACIFIC',
      'VEGA',
      'MONTEREY',
    ]);
    expect((await data.directoryFor(undefined)).status).toBe(401);
  });

  it('shows the owner everything, a friend most of it, and a stranger only what is public', async () => {
    const data = await createDevData(root);
    const own = page(await data.page(stark, as(stark)));
    expect(own.viewer).toBe('owner');
    expect(own.page?.vehicles).toHaveLength(2);
    expect(own.page?.guestbook).toHaveLength(2);

    const friend = page(await data.page(stark, as(pacific)));
    expect(friend.viewer).toBe('friend');
    expect(friend.page?.vehicles).toHaveLength(2);
    expect(friend.page?.settings.custom.owned).toHaveLength(2);

    const stranger = page(await data.page(stark, as(vega)));
    expect(stranger.viewer).toBe('member');
    expect(stranger.page?.vehicles).toHaveLength(1); // the R8 is for friends
    expect(stranger.page?.settings.custom.owned).toHaveLength(1);
    expect(stranger.page?.guestbook).toHaveLength(2); // the wall on this page is open to all members
  });

  it('keeps a friends-only page and garage from anyone who is not a friend', async () => {
    const data = await createDevData(root);
    expect((await data.page(pacific, as(pacific))).status).toBe(200);
    expect((await data.page(pacific, as(stark))).status).toBe(200);
    expect((await data.page(pacific, as(vega))).status).toBe(403);
    expect(models(await data.garage(pacific, as(stark)))).toEqual(['Huracán STO']);
    expect((await data.garage(pacific, as(vega))).status).toBe(403);
    // A member with no page yet has a friends-only page, and VEGA has no friends.
    expect((await data.page(vega, as(vega))).status).toBe(200);
    expect((await data.page(vega, as(stark))).status).toBe(403);
  });

  it('filters a garage car by car: public to all, friends-only to friends, private to the owner', async () => {
    const data = await createDevData(root);
    expect(models(await data.garage(stark, as(stark)))).toEqual(['Carrera GT', 'R8 V10', 'Supra']);
    expect(models(await data.garage(stark, as(pacific)))).toEqual(['Carrera GT', 'R8 V10']);
    expect(models(await data.garage(stark, as(vega)))).toEqual(['Carrera GT']);
    // A member with no garage file gets an empty one, not an error.
    expect((await data.garage(vega, as(vega))).status).toBe(200);
    expect(models(await data.garage(vega, as(vega)))).toEqual([]);
  });

  it('only sends pages and garages that pass the checks', async () => {
    const data = await createDevData(root);
    for (const memberId of [stark, pacific, vega]) {
      const reply = await data.page(memberId, as(stark));
      if (reply.status === 200) expect(web.validPageDocument(page(reply).page)).toBe(true);
      const g = await data.garage(memberId, as(stark));
      if (g.status === 200) expect(web.validGarageDocument((g.body as Garage).garage)).toBe(true);
    }
  });
});


