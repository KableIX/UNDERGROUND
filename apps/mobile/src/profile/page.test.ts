import { describe, it, expect } from 'vitest';
import { copyLook, restoreSettings, defaults, move, profileLink, validatePage } from './page';

describe('member pages', () => {
  it('retains a featured photo for either car source and rejects a mismatched garage link', () => {
    const feature = { name: 'Carrera GT', story: 'My poster car', photo: 'data:image/jpeg;base64,/9j/AAAA' };
    const s = { ...defaults('Driver'), featuredCar: feature };
    expect(validatePage(s, [], []).featuredCar).toEqual(feature);
    const id = '33333333-3333-4333-8333-333333333302';
    const vehicles = [{ id, label: 'R8', visibility: 'private' }];
    expect(() => validatePage({ ...s, vehicleId: id }, [], vehicles)).toThrow();
    const linked = { ...feature, linkedVehicleId: id };
    expect(validatePage({ ...s, vehicleId: id, featuredCar: linked }, [], vehicles).featuredCar).toEqual(linked);
  });
  it('normalizes optional LinkedIn profile links and strips tracking', () => {
    expect(profileLink('linkedin.com/in/stark/?trk=abc', 'linkedin')).toBe(
      'https://www.linkedin.com/in/stark',
    );
    expect(profileLink('', 'linkedin')).toBe('');
    for (const link of [
      'javascript:alert(1)',
      'https://linkedin.com.example.org/in/stark',
      'https://linkedin.com/company/test',
      'http://linkedin.com/in/a',
      'https://foo@linkedin.com/in/a',
    ])
      expect(() => profileLink(link, 'linkedin')).toThrow();
  });
  it('supports opt-in music links and preserves an Apple Music song ID', () => {
    expect(profileLink('https://music.apple.com/us/album/test/1?i=23&at=tracker', 'music')).toBe(
      'https://music.apple.com/us/album/test/1?i=23',
    );
    expect(profileLink('https://open.spotify.com/track/abc?si=z', 'music')).toBe(
      'https://open.spotify.com/track/abc',
    );
    expect(() => profileLink('https://example.org', 'music')).toThrow();
  });
  it('plays direct audio while retaining signed query parameters', () => {
    const url = 'https://audio.example.com/club/intro.M4A?signature=abc';
    expect(profileLink(url + '#skip', 'music')).toBe(url);
    for (const value of [
      'http://audio.example.com/intro.mp3',
      'https://audio.example.com/player.html',
      'https://user@audio.example.com/intro.wav',
    ]) {
      expect(() => profileLink(value, 'music')).toThrow();
    }
  });
  it('upgrades the original layout and copies only design choices', () => {
    const old = defaults('Founder');
    const layout = old.layout.filter((s) => s !== 'guestbook' && s !== 'journal').reverse();
    const upgraded = restoreSettings('Founder', { layout });
    expect(upgraded.layout).toEqual([...layout, 'journal', 'guestbook']);
    const source = {
      ...upgraded,
      music: 'https://audio.example.com/private.mp3',
      bio: 'Private notes',
      cover: 'owned-photo',
      accent: 'Ice' as const,
    };
    source.look.wallpaper = 'My cover';
    source.look.large = ['drive'];
    const recipient = defaults('Driver');
    const copy = copyLook(source, recipient);
    expect(copy).toEqual({
      ...recipient,
      accent: 'Ice',
      layout: upgraded.layout,
      look: upgraded.look,
    });
    expect(copy.look.large).not.toBe(source.look.large);
  });
  it('only features cars the member owns and friends the member has accepted', () => {
    const s = defaults('STARK');
    const id = '33333333-3333-4333-8333-333333333302';
    expect(() => validatePage({ ...s, topEight: [id] }, [], [])).toThrow();
    expect(() => validatePage({ ...s, vehicleId: id }, [], [])).toThrow();
    expect(validatePage({ ...s, topEight: [id] }, [{ id, name: 'PACIFIC' }], []).topEight).toEqual([
      id,
    ]);
  });
  it('keeps all editable sections in order and rejects duplicates', () => {
    const s = defaults('STARK');
    const layout = move(s.layout, 4, -1);
    expect(layout[3]).toBe('music');
    expect(s.layout[3]).toBe('friends');
    expect(() =>
      validatePage({ ...s, layout: [...s.layout.slice(0, 5), 'about'] }, [], []),
    ).toThrow();
  });
});

import { visitorPage } from './audience';
import { type Page } from './page';
describe('published member profile', () => {
  const id = '44444444-4444-4444-8444-444444444401';
  const jpeg = 'data:image/jpeg;base64,/9j/AAAA';
  function published(): Page {
    const s = defaults('STARK');
    s.audience = 'members';
    s.avatar = jpeg;
    s.custom.avatarFrame = { mode: 'fill', x: 0.7, y: 0.2 };
    s.custom.owned = [{ id, photo: jpeg, frame: { mode: 'whole', x: 0.5, y: 0.5 } }];
    s.featuredCar = { name: 'Carrera GT', story: 'The car that got me into cars.', photo: jpeg };
    s.custom.labels.garage = 'Poster car';
    s.music = 'https://audio.example.com/intro.mp3';
    s.custom.access.music = 'friends';
    s.layout = ['garage', 'collection', ...s.layout.filter(k => k !== 'collection' && k !== 'garage')];
    const cars = [{ id, label: '2010 Audi R8', visibility: 'friends' }];
    const saved = validatePage(s, [], cars);
    return { settings: restoreSettings('STARK', JSON.parse(JSON.stringify(saved))),
      vehicles: cars, member: { id: 'owner', name: 'STARK', number: '000001', founder: true },
      revision: 1, friendCount: 1, clout: 25, featuredFriends: [] };
  }
  it('keeps frame, photo, order and music through serialization and a friend read', () => {
    const p = published(), f = visitorPage(p, 'friends')!;
    expect(f.settings.custom.avatarFrame).toEqual(p.settings.custom.avatarFrame);
    expect(f.settings.custom.owned).toEqual(p.settings.custom.owned);
    expect(f.settings.music).toBe(p.settings.music);
    expect(f.settings.layout.slice(0, 2)).toEqual(['garage', 'collection']);
    expect(f.settings.featuredCar?.name).toBe('Carrera GT');
  });
  it('strips the friends-only garage and soundtrack for a nonfriend and preserves the free feature', () => {
    const p = published(), m = visitorPage(p, 'members')!;
    expect(m.vehicles).toEqual([]);
    expect(m.settings.custom.owned).toEqual([]);
    expect(m.settings.music).toBe('');
    expect(m.settings.featuredCar?.photo).toBe(jpeg);
    expect(p.settings.custom.owned).toHaveLength(1);
    p.settings.audience = 'private';
    expect(visitorPage(p, 'friends')).toBeNull();
  });
});
