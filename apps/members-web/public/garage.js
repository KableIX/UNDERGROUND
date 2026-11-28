// A member's garage page: every car they show, with photos, specifications, modifications and class.
import { CAR_CLASS_LABELS, validGarageDocument, validGarageLook } from './schema.js';
import { FILL_FRAME, applyFraming } from './theme.js';
import { clear, getJson, h } from './dom.js';

const main = document.querySelector('main');
const memberId = new URLSearchParams(location.search).get('id') ?? '';

function notice(text) {
  clear(main).append(
    h('p', { class: 'body', text }),
    h('p', {}, h('a', { class: 'link', href: './', text: 'Back to members' })),
  );
}

function carCard(car) {
  const title = [car.year, car.make, car.model, car.trim].filter(Boolean).join(' ');
  const hero = car.photos[0];
  const mods = (status) => car.mods.filter((mod) => mod.status === status).map((mod) => h('li', { text: mod.title }));
  const modGroup = (status, label) =>
    car.mods.some((mod) => mod.status === status)
      ? h('div', { class: 'mods' }, h('h3', { class: 'mods-title', text: label }), h('ul', { class: 'mods-list' }, mods(status)))
      : null;
  return h(
    'article',
    { class: 'garage-car' },
    hero
      ? applyFraming(h('img', { class: 'garage-hero', src: hero.src, alt: hero.caption ?? title }), hero.frame ?? FILL_FRAME)
      : null,
    h('h2', { class: 'car-title', text: title }),
    h(
      'p',
      { class: 'badges' },
      // Only a car the network has verified is called verified here.
      car.verification === 'verified'
        ? h('span', { class: 'badge verified', text: 'Verified' })
        : car.verification === 'pending_review'
          ? h('span', { class: 'badge', text: 'Verification in review' })
          : null,
      car.carClass ? h('span', { class: 'badge', text: CAR_CLASS_LABELS[car.carClass] }) : null,
      car.color ? h('span', { class: 'badge', text: car.color }) : null,
    ),
    car.specs.length
      ? h('dl', { class: 'specs' }, car.specs.flatMap((spec) => [h('dt', { text: spec.label }), h('dd', { text: spec.value })]))
      : null,
    modGroup('installed', 'Installed'),
    modGroup('pending', 'Planned'),
    car.photos.length > 1
      ? h(
          'ul',
          { class: 'gallery' },
          car.photos.slice(1).map((photo) =>
            h(
              'li',
              {},
              applyFraming(h('img', { class: 'gallery-photo', src: photo.src, alt: photo.caption ?? 'Garage photograph' }), photo.frame ?? FILL_FRAME),
              photo.caption ? h('p', { class: 'caption', text: photo.caption }) : null,
            ),
          ),
        )
      : null,
  );
}

function renderGarage(garage, look) {
  const me = garage.member;
  main.className = 'page garage';
  main.style.setProperty('--accent', look.accent);
  main.dataset.heading = look.heading;
  main.dataset.panels = look.panels;
  clear(main).append(
    h(
      'div',
      { class: 'sheet' },
      h(
        'header',
        { class: 'garage-head' },
        h('p', { class: 'member-number', text: `${me.founder ? 'FOUNDER' : 'MEMBER'} #${me.number}` }),
        h('h1', { class: 'member-name', text: `${me.name}'s garage` }),
        h(
          'p',
          {},
          h('a', { class: 'link', href: `member.html?id=${encodeURIComponent(me.id)}`, text: 'View profile' }),
          ' · ',
          h('a', { class: 'link', href: './', text: 'Back to members' }),
        ),
      ),
      garage.cars.length ? garage.cars.map(carCard) : h('p', { class: 'body', text: 'No cars to show yet.' }),
    ),
  );
}

async function start() {
  try {
    const session = await getJson('/api/dev/session');
    if (!session.ok || session.body?.signedIn !== true) return location.replace('./');
    if (!memberId) return notice('No member was chosen.');
    const reply = await getJson(`/api/dev/members/${encodeURIComponent(memberId)}/garage`);
    if (reply.status === 401) return location.replace('./');
    if (reply.status === 403) return notice('This garage is private.');
    if (!reply.ok || reply.body?.ok !== true) return notice('This garage could not be shown.');
    // Checked once more here, before anything is drawn.
    const { garage, look } = reply.body;
    if (!validGarageDocument(garage) || !validGarageLook(look)) return notice('This garage could not be shown.');
    document.title = `${garage.member.name}'s garage · UNDERGROUND members`;
    renderGarage(garage, look);
  } catch {
    notice('Could not reach the members site. Try again.');
  }
}

start();
