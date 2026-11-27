export const countyBulletin = 'https://roads.santaclaracounty.gov/roads-and-traffic-info/view-closures-and-outages-county-maintained-roads';

function plain(html: string) {
  return html.replace(/<[^>]+>/g, ' ').replace(/&(?:nbsp|amp|quot|#39);/g, entity =>
    ({ '&nbsp;': ' ', '&amp;': '&', '&quot;': '"', '&#39;': "'" })[entity] ?? entity).replace(/\s+/g, ' ').trim();
}
function normalize(value: string) {
  return value.toLowerCase().replace(/\b(road|avenue|street|drive|boulevard|lane|highway)\b/g, word =>
    ({road:'rd', avenue:'ave', street:'st', drive:'dr', boulevard:'blvd', lane:'ln', highway:'hwy'})[word]!)
    .replace(/[^a-z0-9]+/g, ' ').trim();
}
export function routeNotices(html: string, roads: string[]) {
  const tables = html.match(/<table\b[^>]*>[\s\S]*?<\/table>/gi) ?? [];
  const reports = new Set<string>();
  let parsed = 0;
  for (const table of tables) {
    if (!/Section closed<\/th>/i.test(table) || !/Road Name<\/th>/i.test(table)) continue;
    for (const row of table.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi) ?? []) {
      const cells: Record<string, string> = {};
      for (const m of row.matchAll(/<t[dh]\b[^>]*data-label="([^"]+)"[^>]*>([\s\S]*?)<\/t[dh]>/gi)) cells[m[1]] = plain(m[2]);
      if (!cells['Road Name']) continue;
      parsed++;
      const named = ' ' + normalize(cells['Road Name']) + ' ';
      if (roads.some(road => named.includes(' ' + normalize(road) + ' '))) {
        reports.add([cells['Road Name'], cells['Section closed'], cells.Status, cells['Last Updated'] && 'County update ' + cells['Last Updated']].filter(Boolean).join(' · '));
      }
    }
  }
  if (!parsed) throw new Error('County bulletin unavailable');
  return [...reports];
}
