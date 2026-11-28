// A member page, drawn from the same tokens and data as the app's profile screen.
import { SECTION_TITLES, safeProfileLink, validPageDocument } from './schema.js';
import { FILL_FRAME, applyFraming, applyTheme } from './theme.js';
import { clear, externalLink, getJson, h } from './dom.js';

const DEFAULT_COVER = '/wallpapers/pacific.jpg';
const main = document.querySelector('main');
const memberId = new URLSearchParams(location.search).get('id') ?? '';

function framed(photo, frame, alt, className) {
  return applyFraming(h('img', { class: className, src: photo, alt }), frame ?? FILL_FRAME);
}

function notice(text) {
  clear(main).append(
    h('p', { class: 'body', text }),
    h('p', {}, h('a', { class: 'link', href: './', text: 'Back to members' })),
  );
}

function musicLink(url) {
  const host = new URL(url).hostname;
  if (host === 'open.spotify.com') return { label: 'Open in Spotify', url };
  if (host === 'music.apple.com') return { label: 'Open in Apple Music', url };
  return null;
}

function renderProfile(page) {
  const d = page.settings;
  const me = page.member;
  const vehicle = page.vehicles.find((v) => v.id === d.vehicleId) ?? null;
  const garageHref = `garage.html?id=${encodeURIComponent(me.id)}`;
  const collectionOpen = !d.look.hidden.includes('collection');
  // Whether each section has anything to show, decided exactly as the app decides it.
  const has = {
    journal: d.entries.length > 0,
    guestbook: true,
    collection: d.custom.owned.length > 0,
    about: !!(d.bio || d.custom.links.length),
    garage: !!(d.featuredCar || vehicle),
    drive: false, // the website has no run catalog yet, so a favorite drive is left out
    friends: page.featuredFriends.length > 0,
    music: !!d.music,
    work: !!(d.work || d.linkedin),
  };

  function sectionBody(key) {
    if (key === 'about') {
      return [d.bio ? h('p', { class: 'body', text: d.bio }) : null, ...d.custom.links.map((url) => externalLink(url, url))];
    }
    if (key === 'collection') {
      return [
        h(
          'ul',
          { class: d.custom.formats.collection === 'gallery' ? 'grid' : 'stack' },
          d.custom.owned.map((item) => {
            const car = page.vehicles.find((v) => v.id === item.id);
            return car
              ? h('li', { class: 'car' }, item.photo ? framed(item.photo, item.frame, car.label, 'photo') : null, h('p', { class: 'feature', text: car.label }))
              : null;
          }),
        ),
      ];
    }
    if (key === 'garage') {
      const feature = d.featuredCar;
      return [
        feature?.photo && (!feature.linkedVehicleId || vehicle)
          ? framed(feature.photo, d.custom.featureFrame, vehicle?.label ?? feature.name, 'photo')
          : null,
        d.custom.gallery.length
          ? h(
              'ul',
              { class: d.custom.formats.garage === 'gallery' ? 'grid' : 'stack' },
              d.custom.gallery.map((item, i) =>
                item.photo ? h('li', {}, framed(item.photo, item.frame, `Featured car photo ${i + 2}`, 'photo')) : null,
              ),
            )
          : null,
        vehicle && feature?.story ? h('p', { class: 'body', text: feature.story }) : null,
        feature && !feature.linkedVehicleId
          ? [h('p', { class: 'feature', text: feature.name }), feature.story ? h('p', { class: 'body', text: feature.story }) : null]
          : null,
        vehicle
          ? [h('p', { class: 'feature', text: vehicle.label }), collectionOpen ? h('p', {}, h('a', { class: 'link', href: garageHref, text: 'View garage' })) : null]
          : null,
      ];
    }
    if (key === 'friends') {
      return [
        h(
          'ol',
          { class: 'top-eight' },
          page.featuredFriends.map((friend, i) =>
            h(
              'li',
              { class: 'friend' },
              h(
                'a',
                { class: 'friend-link', href: `member.html?id=${encodeURIComponent(friend.id)}` },
                h('span', { class: 'rank', text: String(i + 1).padStart(2, '0') }),
                h('span', { text: friend.name }),
              ),
            ),
          ),
        ),
      ];
    }
    if (key === 'journal') {
      return d.entries.map((entry) =>
        h(
          'article',
          { class: 'entry' },
          entry.photo ? framed(entry.photo, entry.frame, entry.title, 'photo') : null,
          h('h3', { class: 'feature', text: entry.title }),
          entry.note ? h('p', { class: 'body', text: entry.note }) : null,
        ),
      );
    }
    if (key === 'guestbook') {
      const notes = page.guestbook ?? [];
      return notes.length
        ? [
            h(
              'ul',
              { class: 'notes' },
              notes.map((note) =>
                h('li', { class: 'note' }, h('p', { class: 'note-author', text: note.name }), h('p', { class: 'body', text: note.body })),
              ),
            ),
          ]
        : [h('p', { class: 'muted', text: 'No notes yet.' })];
    }
    if (key === 'music') {
      const track = musicLink(d.music);
      return [
        h('p', { class: 'feature', text: d.trackTitle || 'On rotation' }),
        track ? h('p', {}, externalLink(track.label, track.url)) : null,
        h('p', { class: 'muted', text: 'Plays in the UNDERGROUND app.' }),
      ];
    }
    if (key === 'work') {
      // The stored link is only drawn if it still passes the allow-list; otherwise it is left out.
      const linkedin = safeProfileLink(d.linkedin, 'linkedin');
      return [d.work ? h('p', { class: 'body', text: d.work }) : null, linkedin ? h('p', {}, externalLink('View LinkedIn profile', linkedin)) : null];
    }
    return [];
  }

  const stats = h(
    'p',
    { class: 'stats' },
    h('span', { class: 'stat', text: `${page.friendCount} ${page.friendCount === 1 ? 'friend' : 'friends'}` }),
    d.custom.showRuns && page.verifiedRuns != null ? h('span', { class: 'stat', text: `${page.verifiedRuns} verified Runs` }) : null,
    d.custom.showTerritories && page.territories != null ? h('span', { class: 'stat', text: `${page.territories} solo territories` }) : null,
    d.custom.showClout && page.clout !== null ? h('span', { class: 'stat', text: `${page.clout} CLOUT` }) : null,
  );
  const cover = h(
    'div',
    { class: 'cover' },
    d.cover ? framed(d.cover, d.custom.coverFrame, 'Cover photo', 'cover-photo') : h('img', { class: 'cover-photo', src: DEFAULT_COVER, alt: '' }),
  );
  const identity = h(
    'header',
    { class: 'identity' },
    h(
      'div',
      { class: 'avatar' },
      d.avatar
        ? framed(d.avatar, d.custom.avatarFrame, 'Profile photo', 'avatar-photo')
        : h('span', { class: 'monogram', text: d.displayName.slice(0, 2).toUpperCase() }),
    ),
    h('p', { class: 'member-number', text: `${me.founder ? 'FOUNDER' : 'MEMBER'} #${me.number}` }),
    h('h1', { class: 'member-name', text: d.displayName }),
    d.custom.handle ? h('p', { class: 'handle', text: `@${d.custom.handle}` }) : null,
    d.home ? h('p', { class: 'home', text: d.home }) : null,
    d.status ? h('p', { class: 'status', text: d.status }) : null,
    stats,
    collectionOpen ? h('p', {}, h('a', { class: 'link', href: garageHref, text: 'View garage' })) : null,
  );
  const sections = h('div', { class: 'sections' });
  for (const key of d.layout) {
    if (d.look.hidden.includes(key) || !has[key]) continue;
    const format = d.custom.formats[key];
    const classes = ['section', format ? `format-${format}` : '', d.look.large.includes(key) ? 'large' : ''];
    sections.append(
      h(
        'section',
        { class: classes.filter(Boolean).join(' '), 'data-section': key },
        h('h2', { class: 'section-title', text: d.custom.labels[key] || SECTION_TITLES[key] }),
        sectionBody(key),
      ),
    );
  }

  main.className = 'page';
  clear(main).append(
    applyTheme(main, page),
    h('div', { class: 'sheet' }, cover, identity, sections, h('footer', { class: 'footer' }, h('a', { class: 'link', href: './', text: 'Back to members' }))),
  );
}

async function start() {
  try {
    const session = await getJson('/api/dev/session');
    if (!session.ok || session.body?.signedIn !== true) return location.replace('./');
    if (!memberId) return notice('No member was chosen.');
    const reply = await getJson(`/api/dev/members/${encodeURIComponent(memberId)}/page`);
    if (reply.status === 401) return location.replace('./');
    if (reply.status === 403) return notice('This member page is private.');
    if (!reply.ok || reply.body?.ok !== true) return notice('This page could not be shown.');
    // The server decides what to send. The browser decides what to draw, so it checks once more.
    const page = reply.body.page;
    if (!validPageDocument(page)) return notice('This page could not be shown.');
    document.title = `${page.settings.displayName} · UNDERGROUND members`;
    renderProfile(page);
  } catch {
    notice('Could not reach the members site. Try again.');
  }
}

start();
