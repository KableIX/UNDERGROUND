export type Layer = 'plate' | 'speed' | 'history';
export type Layers = Readonly<Record<Layer, boolean>>;
export const initialLayers: Layers = { plate: true, speed: true, history: true };
export type Box = { west: number; south: number; east: number; north: number };
type Source = 'reader' | 'osm' | 'sf' | 'sj' | 'oak' | 'la';
type Row = [number, number, 'plate' | 'speed', Source, string, string, string];
export type Snapshot = { retrieved: string; cells: Record<string, Row[]>; counts: Record<Source, number> };
export type CameraPin = { id: string; lon: number; lat: number; kind: Row[2]; title: string; detail: string };
const sources = { reader: 'OpenStreetMap via FlockHopper', osm: 'OpenStreetMap', sf: 'SFMTA',
  sj: 'San José DOT', la: 'LADOT', oak: 'OakDOT' };

export function snapshot(): Snapshot | null {
  // Defer evaluating the statewide index until a member opens the layers or enables pins.
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('../data/california-cameras.json') as Snapshot;
  } catch { return null; }
}

export function regionBox(r: {latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number}): Box {
  return { west:r.longitude-r.longitudeDelta/2, east:r.longitude+r.longitudeDelta/2,
    south:r.latitude-r.latitudeDelta/2, north:r.latitude+r.latitudeDelta/2 };
}
export function cameraPins(db: Snapshot | null, b: Box | null, layers: Layers): CameraPin[] {
  if (!db || !b || (!layers.plate && !layers.speed)) return [];
  const {west,east,north,south} = b;
  // Use geographic width on both renderers so an overview never fills with markers.
  if (![west,east,north,south].every(Number.isFinite) || west >= east || south >= north ||
      east-west > 0.055 || north-south > 0.13 || east < -125 || west > -114 || north < 32 || south > 43) return [];
  const pins: CameraPin[] = [];
  for (let x=Math.floor(west*10); x<=Math.floor(east*10); x++) {
    for (let y=Math.floor(south*10); y<=Math.floor(north*10); y++) {
      for (const [lon,lat,kind,source,key,label,status] of db.cells[x+','+y] ?? []) {
        if (!layers[kind] || lon<west || lon>east || lat<south || lat>north) continue;
        const title = kind==='plate' ? (label ? label+' plate reader' : 'Reported plate reader') :
          source==='osm' ? 'Reported speed camera' : 'City-listed speed camera';
        const detail = [kind==='speed' && label, sources[source], status || 'Operating status unknown', 'Snapshot '+db.retrieved].filter(Boolean).join(' · ');
        pins.push({id:source+'/'+key,lon,lat,kind,title,detail});
      }
    }
  }
  return pins;
}
