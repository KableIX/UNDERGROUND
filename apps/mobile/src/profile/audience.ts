import { restoreSettings, sectionTitles, type Audience, type Page, type Section } from './page';

export type Visitor = 'friends' | 'members';
export function allowed(audience: Audience, viewer: Visitor) {
  return audience === 'members' || (viewer === 'friends' && audience === 'friends');
}

// Preview and the on-device beta share the same projection. The live RPC enforces this at the database.
export function visitorPage(page: Page, viewer: Visitor): Page | null {
  const s = restoreSettings(page.member.name, page.settings);
  if (!allowed(s.audience, viewer)) return null;
  const blocked = (Object.keys(sectionTitles) as Section[]).filter(k =>
    s.look.hidden.includes(k) || !allowed(s.custom.access[k] ?? 'members', viewer));
  s.look = { ...s.look, hidden: blocked };
  const c = { ...s.custom, labels: { ...s.custom.labels }, formats: { ...s.custom.formats } };
  for (const key of blocked) { delete c.labels[key]; delete c.formats[key]; }
  s.custom = c;
  if (blocked.includes('about')) { s.bio = ''; c.links = []; }
  if (blocked.includes('music')) { s.music = ''; s.trackTitle = ''; }
  if (blocked.includes('friends')) s.topEight = [];
  if (blocked.includes('drive')) s.driveSlug = '';
  if (blocked.includes('work')) { s.linkedin = ''; s.work = ''; }
  if (blocked.includes('journal')) s.entries = [];
  const visibleCars = page.vehicles.filter(v =>
    v.visibility === 'public' || (v.visibility === 'friends' && viewer === 'friends'));
  if (blocked.includes('collection')) c.owned = [];
  else c.owned = c.owned.filter(item => visibleCars.some(v => v.id === item.id));
  if (blocked.includes('garage') || (s.vehicleId && !visibleCars.some(v => v.id === s.vehicleId))) {
    s.vehicleId = null; s.featuredCar = null; c.gallery = [];
  }
  return { ...page, settings: s, vehicles: visibleCars.filter(v =>
    v.id === s.vehicleId || c.owned.some(item => item.id === v.id)),
    featuredFriends: blocked.includes('friends') ? [] : page.featuredFriends,
    clout: c.showClout ? page.clout : null, verifiedRuns: c.showRuns ? page.verifiedRuns : null,
    territories: c.showTerritories ? page.territories : null };
}
