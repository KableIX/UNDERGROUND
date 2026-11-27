import sources from './local-event-sources.json';
import snapshot from './local-event-snapshot.json';
import discoveries from './local-event-discoveries.json';

export type LocalEvent = {
  id: string;
  title: string;
  starts: number;
  ends: number;
  place: string;
  url: string;
  kind: string;
  cancelled: boolean;
};
export type SourceFeed = { id: string; checked: number; events: LocalEvent[] };
export { sources };
export const initialFeeds: SourceFeed[] = snapshot;
type Listing = {
  id?: string;
  title?: string;
  startDate?: number;
  endDate?: number;
  categories?: string[];
  tags?: string[];
  fullUrl?: string;
  location?: { addressTitle?: string; addressLine1?: string; addressLine2?: string };
};

function clean(value: string) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&apos;|&#x27;/gi, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .trim();
}
export function organizerFeed(id: string, data: { upcoming?: Listing[] }, now: number): SourceFeed {
  const source = sources.find((s) => s.id === id);
  if (!source || !Array.isArray(data.upcoming)) throw new Error('Organizer calendar unavailable.');
  const events: LocalEvent[] = [];
  for (const listing of data.upcoming) {
    if (!listing.id || !listing.title || !listing.startDate || !listing.fullUrl) continue;
    const title = clean(listing.title),
      tags = [title, ...(listing.tags ?? []), ...(listing.categories ?? [])].join(' ');
    const kind = /coffee|kaffee|bagels/i.test(tags)
      ? 'Cars & Coffee'
      : /driv(?:e|ing).*tour|club drive|rally|fun run|group drive/i.test(tags)
        ? 'Organized drive'
        : null;
    let url: URL;
    try {
      url = new URL(listing.fullUrl, source.calendar);
    } catch {
      continue;
    }
    if (!kind || url.origin !== new URL(source.calendar).origin) continue;
    const ends = listing.endDate || listing.startDate;
    if (ends < now || listing.startDate > now + 90 * 86400000) continue;
    const loc = listing.location;
    events.push({
      id: source.id + '/' + listing.id,
      title,
      starts: listing.startDate,
      ends,
      place: [loc?.addressTitle, loc?.addressLine1, loc?.addressLine2]
        .filter(Boolean)
        .map((s) => clean(s!))
        .join(' · '),
      url: url.href,
      kind,
      cancelled: /cancel(?:led|ed)|postponed/i.test(tags),
    });
  }
  return { id, checked: now, events };
}
export async function refreshOrganizer(source: (typeof sources)[number]) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  try {
    const response = await fetch(source.calendar + '?format=json', {
      signal: ctrl.signal,
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new Error('Organizer unavailable.');
    return organizerFeed(source.id, await response.json(), Date.now());
  } finally {
    clearTimeout(timer);
  }
}

type Discovery = LocalEvent & { organizer: string; checked: number };
export function discoveryRows(now: number, strict = false) {
  const events: (LocalEvent & { source: { name: string }; checked: number })[] = [];
  for (const row of discoveries as Discovery[]) {
    const valid =
      row.id &&
      row.organizer &&
      row.title &&
      row.place &&
      /^https:\/\//i.test(row.url) &&
      Number.isFinite(row.starts) &&
      Number.isFinite(row.ends) &&
      row.ends >= row.starts &&
      Number.isFinite(row.checked) &&
      row.checked <= now + 300000 &&
      ['Cars & Coffee', 'Organized drive'].includes(row.kind) &&
      typeof row.cancelled === 'boolean';
    if (!valid) {
      if (strict) throw new Error('Invalid verified organizer discovery: ' + row.id);
      continue;
    }
    if (row.checked >= now - 7 * 86400000 && row.ends >= now && row.starts <= now + 90 * 86400000) {
      events.push({ ...row, source: { name: row.organizer } });
    }
  }
  return events;
}
