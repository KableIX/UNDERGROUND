// Turns validated theme tokens into CSS variables and data attributes, so the same choices look
// the same here as in the app. Only tokens reach CSS: colors come from the allow-list or the
// six-digit hex rule, styles from the fixed lists. Member text never becomes CSS.
import { ACCENT_COLORS, profileCoverRatio } from './schema.js';

export const FILL_FRAME = Object.freeze({ mode: 'fill', x: 0.5, y: 0.5 });
const PRESET_WALLPAPERS = { Saratoga: '/wallpapers/saratoga.jpg', Pacific: '/wallpapers/pacific.jpg' };

/** Sets the theme on the page element. Call only with settings that passed the checks. */
export function applyTheme(root, page) {
  const s = page.settings;
  root.style.setProperty('--accent', s.custom.accentColor || ACCENT_COLORS[s.accent]);
  root.style.setProperty('--panel', s.custom.panelColor || 'transparent');
  root.style.setProperty('--cover-ratio', String(profileCoverRatio(s.look.coverSize)));
  root.dataset.heading = s.look.heading;
  root.dataset.panels = s.look.panels;
  root.classList.toggle('has-panel', !!s.custom.panelColor);
  return wallpaper(root, s);
}

/** How a photo sits in its frame: fill the box or show it whole, and where it is focused. */
export function applyFraming(img, frame) {
  img.style.setProperty('object-fit', frame.mode === 'whole' ? 'contain' : 'cover');
  img.style.setProperty('object-position', `${Math.round(frame.x * 100)}% ${Math.round(frame.y * 100)}%`);
  return img;
}

/** The wallpaper behind the page, as the app shows it: a photo, then a dark veil over it. */
function wallpaper(root, s) {
  const chosen = s.custom.wallpaper?.photo;
  const image = chosen ?? (s.look.wallpaper === 'My cover' ? s.cover : null) ?? PRESET_WALLPAPERS[s.look.wallpaper] ?? null;
  const box = document.createElement('div');
  box.className = 'wallpaper';
  box.setAttribute('aria-hidden', 'true');
  if (!image) return box;
  root.classList.add('has-wallpaper');
  if (image.startsWith('data:')) {
    const img = document.createElement('img');
    img.src = image;
    img.alt = '';
    box.append(applyFraming(img, chosen ? s.custom.wallpaper.frame : s.custom.coverFrame));
  } else {
    box.style.setProperty('background-image', `url("${image}")`);
  }
  return box;
}
