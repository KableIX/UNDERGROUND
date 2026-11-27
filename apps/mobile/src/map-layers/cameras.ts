import {cameraSources,cameraMarkerKind,cameraStatus,type CameraSource,type CameraMarkerKind} from './camera-registry';
export type Layer = 'plate' | 'speed' | 'history';
export type Layers = Readonly<Record<Layer, boolean>>;
export const initialLayers: Layers = { plate: true, speed: true, history: true };
export type Box = { west: number; south: number; east: number; north: number };
type Source = CameraSource;
type Row = [number, number, 'plate' | 'speed', Source, string, string, string];
export type Snapshot = { retrieved: string; cells: Record<string, Row[]>; counts: Record<Source, number> };
export type CameraPin = { id: string; lon: number; lat: number; kind: Row[2]; marker: CameraMarkerKind; title: string; detail: string; source: Source; sourceUrl:string; license:string; status:string; lastChecked:string };


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
// Use a city-scale window instead of hiding all cameras above street zoom.
export function cameraViewportMode(b:Box|null):'waiting'|'outside'|'zoom'|'city'|'street'{
 if(!b)return 'waiting';
 const {west,east,north,south}=b;
 if(![west,east,north,south].every(Number.isFinite)||west>=east||south>=north)return 'waiting';
 if(east<-125||west>-114||north<32||south>43)return 'outside';
 if(east-west>.35||north-south>.65)return 'zoom';
 return east-west<=.055&&north-south<=.13?'street':'city';
}
// At city scale cap native view count, keeping the real coordinates of one
// representative per grid cell and category. Never fabricate camera locations.
export function cameraDisplayPins(pins:CameraPin[],b:Box|null):CameraPin[]{
 if(!b||pins.length<=288)return pins;
 const byCell=new Map<string,CameraPin>();
 for(const p of pins){
  const x=Math.max(0,Math.min(11,Math.floor(12*(p.lon-b.west)/(b.east-b.west))));
  const y=Math.max(0,Math.min(11,Math.floor(12*(p.lat-b.south)/(b.north-b.south))));
  const key=x+','+y+','+p.kind;
  const old=byCell.get(key);
  // Prefer municipal sources for duplicate/nearby speed-camera listings.
  const rank=(v:CameraPin)=>cameraSources[v.source].authority==='municipal'?0:1;
  if(!old||rank(p)<rank(old)||(rank(p)===rank(old)&&p.id<old.id))byCell.set(key,p);
 }
 return [...byCell.values()];
}
// Scale strictly with zoom, not with camera count or pitched vertical bounds.
// Quantized sizes avoid recreating Apple annotation views on every gesture frame.
export function cameraShieldSize(b:Box|null):number {
 if(!b)return 36;
 const width=b.east-b.west;
 if(!Number.isFinite(width)||width<=0)return 36;
 return width<=.0025?144:width<=.005?132:width<=.009?120:width<=.018?104:width<=.036?88:width<=.075?72:width<=.15?48:36;
}
// MapKit's pitched geographic bounds can grow when the camera moves closer.
// Use the actual altitude (meters) instead. Lower altitude always means larger
// screen-space shields, independently of bearing, pitch, and camera density.
export function cameraShieldSizeForAltitude(altitude:unknown):number|null {
 if(typeof altitude!=='number'||!Number.isFinite(altitude)||altitude<=0)return null;
 return Math.max(32,Math.min(192,Math.round((96+32*Math.log2(1000/altitude))/8)*8));
}
// Mapbox uses its native zoom expression so size follows the camera continuously.
export const cameraSymbolScale=['interpolate',['linear'],['zoom'],
 10,32/112,11,48/112,12,64/112,13,80/112,14,96/112,15,120/112,16,144/112,17,176/112,18,192/112];
export function cameraViewportNote(mode:ReturnType<typeof cameraViewportMode>,total:number,shown:number,available:boolean){
 if(!available)return 'Camera data unavailable';
 if(mode==='waiting')return 'Loading camera locations...';
 if(mode==='outside')return 'Camera coverage: California only';
 if(mode==='zoom')return 'Zoom in for camera locations';
 if(!total)return 'No camera records in this view';
 return shown<total?shown+' of '+total+' camera records / zoom for more':shown+' camera records in view';
}
export function cameraPins(db: Snapshot | null, b: Box | null, layers: Layers): CameraPin[] {
  if (!db || !b || (!layers.plate && !layers.speed)) return [];
  const {west,east,north,south} = b;
  const mode=cameraViewportMode(b);
  if(mode!=='city'&&mode!=='street')return [];
  const pins: CameraPin[] = [];
  for (let x=Math.floor(west*10); x<=Math.floor(east*10); x++) {
    for (let y=Math.floor(south*10); y<=Math.floor(north*10); y++) {
      for (const [lon,lat,kind,source,key,label,status] of db.cells[x+','+y] ?? []) {
        if (!layers[kind] || lon<west || lon>east || lat<south || lat>north) continue;
        const marker=cameraMarkerKind(kind,label);
        const title = marker==='flock'?'Reported Flock Safety ALPR':marker==='alpr'?(label?label+' plate reader':'Reported plate reader'):
          marker==='redlight'?'Reported red-light camera':source==='osm'?'Reported speed camera':'City-listed speed camera';
        const meta=cameraSources[source];
        const operating=cameraStatus(status);
        const detail = [kind==='speed' && label, meta.name, operating, 'Snapshot '+db.retrieved].filter(Boolean).join(' \u00b7 ');
        pins.push({id:source+'/'+key,lon,lat,kind,marker,title,detail,source,sourceUrl:meta.url,license:meta.license,status:operating,lastChecked:db.retrieved});
      }
    }
  }
  return pins;
}
