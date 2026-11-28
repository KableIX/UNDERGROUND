// Builds elements with textContent only. Member data is never written as HTML, and an attribute
// only ever receives a value the page code chose (a token, a checked link), never raw member text.
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) {
    if (value === undefined || value === null || value === false) continue;
    if (name === 'class') el.className = value;
    else if (name === 'text') el.textContent = value;
    else if (name === 'css') {
      for (const [property, v] of Object.entries(value)) {
        if (v !== undefined && v !== null && v !== false) el.style.setProperty(property, v);
      }
    } else el.setAttribute(name, value === true ? '' : String(value));
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const child of children.flat(6)) {
    if (child === undefined || child === null || child === false || child === '') continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

export function clear(el) {
  el.replaceChildren();
  return el;
}

async function readBody(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function getJson(url) {
  const response = await fetch(url, { credentials: 'same-origin', headers: { Accept: 'application/json' } });
  return { status: response.status, ok: response.ok, body: await readBody(response) };
}

export async function postJson(url, value) {
  const response = await fetch(url, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(value ?? {}),
  });
  return { status: response.status, ok: response.ok, body: await readBody(response) };
}

/** A link out to an address the page rules already accepted. */
export function externalLink(label, url, className = 'link') {
  return h('a', { class: className, href: url, target: '_blank', rel: 'noopener noreferrer nofollow', referrerpolicy: 'no-referrer' }, label);
}
