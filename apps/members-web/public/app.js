// Sign-in and the member directory. Nothing on this site can be seen without a member session,
// which the server checks on every request; this script only decides what to show.
import { clear, getJson, h, postJson } from './dom.js';

const main = document.querySelector('main');

async function directory(me) {
  const reply = await getJson('/api/dev/members');
  if (reply.status === 401) return location.replace('./');
  const list = h('ul', { class: 'members' });
  const signOut = h('button', { class: 'button', type: 'button', text: 'Sign out' });
  signOut.addEventListener('click', async () => {
    await postJson('/api/dev/sign-out');
    location.reload();
  });
  clear(main).append(
    h('h1', { class: 'wordmark', text: 'UNDERGROUND' }),
    h('p', { class: 'lede', text: `Signed in as ${me.name} · #${me.number}` }),
    h(
      'p',
      {},
      h('a', { class: 'link', href: `member.html?id=${encodeURIComponent(me.id)}`, text: 'Your profile' }),
      ' · ',
      h('a', { class: 'link', href: `garage.html?id=${encodeURIComponent(me.id)}`, text: 'Your garage' }),
    ),
    h('div', { class: 'directory' }, h('h2', { class: 'section-title', text: 'Members' }), list),
    signOut,
  );
  if (!reply.ok || reply.body?.ok !== true) {
    list.append(h('li', { class: 'meta', text: 'The member list could not be loaded. Try again.' }));
    return;
  }
  for (const member of reply.body.members) {
    list.append(
      h(
        'li',
        { class: 'member' },
        h('a', { href: `member.html?id=${encodeURIComponent(member.id)}`, text: member.name }),
        h('a', { class: 'link', href: `garage.html?id=${encodeURIComponent(member.id)}`, text: 'Garage' }),
        h('span', {
          class: 'meta',
          text: `#${member.number}${member.founder ? ' · Founder' : ''}${member.id === me.id ? ' · you' : ''}`,
        }),
      ),
    );
  }
}

async function signIn() {
  const input = h('input', {
    id: 'member-number',
    class: 'input',
    type: 'text',
    inputmode: 'numeric',
    autocomplete: 'off',
    maxlength: '6',
    pattern: '[0-9]{6}',
    placeholder: 'Six-digit member number',
    'aria-label': 'Member number',
    required: true,
  });
  const error = h('p', { class: 'error', role: 'alert' });
  const button = h('button', { class: 'button primary', type: 'submit', text: 'Sign in' });
  const form = h(
    'form',
    { class: 'card sign-in' },
    h('label', { for: 'member-number', text: 'Member number' }),
    input,
    button,
    error,
  );
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    button.disabled = true;
    error.textContent = '';
    try {
      const reply = await postJson('/api/dev/sign-in', { memberNumber: input.value.trim() });
      if (reply.ok && reply.body?.ok === true) location.reload();
      else error.textContent = reply.status === 401 ? 'No member has that number.' : 'Could not sign in. Try again.';
    } catch {
      error.textContent = 'Could not reach the members site. Try again.';
    } finally {
      button.disabled = false;
    }
  });
  clear(main).append(
    h('h1', { class: 'wordmark', text: 'UNDERGROUND' }),
    h('p', { class: 'lede', text: 'Members only. Sign in to see member pages and garages.' }),
    form,
    h('p', { class: 'hint', text: 'Dev build with fake data. Try 000001, 000002 or 000003.' }),
  );
  input.focus();
}

async function start() {
  try {
    const session = await getJson('/api/dev/session');
    if (session.ok && session.body?.signedIn === true) await directory(session.body.member);
    else await signIn();
  } catch {
    clear(main).append(h('p', { class: 'body', text: 'Could not reach the members site. Try again.' }));
  }
}

start();
