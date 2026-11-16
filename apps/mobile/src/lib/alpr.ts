export type ReportedAlpr = { id: string; latitude: number; longitude: number; manufacturer: string | null; lastEdited: string | null };

/** Round the query center to ~5 km so map requests do not reveal an exact GPS fix. */
export function alprBounds(latitude: number, longitude: number) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 85 || Math.abs(longitude) > 179.8) throw new Error('Map area is unsupported');
  const lat = Math.round(latitude * 20) / 20;
  const lon = Math.round(longitude * 20) / 20;
  return [lat - 0.1, lon - 0.1, lat + 0.1, lon + 0.1] as const;
}
export function parseAlprData(data: unknown): ReportedAlpr[] {
  if (!data || typeof data !== 'object' || !Array.isArray((data as {elements?: unknown}).elements)) throw new Error('Invalid camera data');
  const result: ReportedAlpr[] = [];
  for (const row of (data as {elements: Array<{type?: string; id?: number; lat?: number; lon?: number; center?: {lat?: number; lon?: number}; tags?: Record<string, string>; timestamp?: string}>}).elements) {
    const lat = row?.lat ?? row?.center?.lat, lon = row?.lon ?? row?.center?.lon;
    if (!['node','way','relation'].includes(row?.type) || !Number.isSafeInteger(row?.id) || !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180 || row?.tags?.['surveillance:type'] !== 'ALPR') continue;
    const raw = row.tags?.brand ?? row.tags?.manufacturer;
    result.push({id:`${row.type}/${row.id}`,latitude:lat,longitude:lon,manufacturer:typeof raw === 'string' ? raw.slice(0,120) : null,lastEdited:typeof row.timestamp === 'string' ? row.timestamp : null});
  }
  return result;
}
export async function fetchAlpr(latitude: number, longitude: number, signal?: AbortSignal): Promise<ReportedAlpr[]> {
  const bounds = alprBounds(latitude, longitude).join(',');
  const query = `[out:json][timeout:20];nwr["surveillance:type"="ALPR"](${bounds});out center meta;`;
  const response = await fetch('https://overpass-api.de/api/interpreter', {method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'},body:`data=${encodeURIComponent(query)}`,signal});
  if (!response.ok) throw new Error(`Camera data unavailable (${response.status})`);
  return parseAlprData(await response.json());
}
