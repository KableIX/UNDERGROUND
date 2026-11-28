import type {Snapshot} from '../map-layers/cameras';
import {cameraMarkerKind} from '../map-layers/camera-registry';

export type CameraBrief={state:'partial'|'unknown';snapshot:string|null;speed:number;redlight:number;plate:number};
const UNKNOWN:CameraBrief={state:'unknown',snapshot:null,speed:0,redlight:0,plate:0};
const NEAR_M=75;
const M_PER_DEG=111320;
// Offline route-context summary only. No point distances, encounter order,
// operation estimates, or enforcement-derived route ratings.
export function routeCameraBrief(db:Snapshot|null,points:readonly (readonly number[])[]|undefined,state:'CA'|'FL'|undefined):CameraBrief{
 if(!db||state!=='CA'||!points||points.length<2||!/^\d{4}-\d{2}-\d{2}$/.test(db.retrieved))return UNKNOWN;
 if(points.some(p=>p.length!==2||!p.every(Number.isFinite)||p[0]!<-125||p[0]!>-114||p[1]!<32||p[1]!>43))return UNKNOWN;
 const found=new Set<string>();
 const counts={speed:0,redlight:0,plate:0};
 for(let i=1;i<points.length;i++){
  const a=points[i-1]!,b=points[i]!;
  const cos=Math.cos((a[1]!+b[1]!)/2*Math.PI/180);
  const xscale=M_PER_DEG*cos;
  const dx=(b[0]!-a[0]!)*xscale,dy=(b[1]!-a[1]!)*M_PER_DEG;
  const den=dx*dx+dy*dy;
  // Do not invent road proximity across missing or implausibly large geometry gaps.
  if(den===0||den>5000*5000)continue;
  const west=Math.min(a[0]!,b[0]!)-NEAR_M/xscale,east=Math.max(a[0]!,b[0]!)+NEAR_M/xscale;
  const south=Math.min(a[1]!,b[1]!)-NEAR_M/M_PER_DEG,north=Math.max(a[1]!,b[1]!)+NEAR_M/M_PER_DEG;
  for(let x=Math.floor(west*10);x<=Math.floor(east*10);x++)for(let y=Math.floor(south*10);y<=Math.floor(north*10);y++){
   for(const [lon,lat,kind,source,key,label] of db.cells[x+','+y]??[]){
    const id=source+'/'+key;
    if(found.has(id)||lon<west||lon>east||lat<south||lat>north)continue;
    const px=(lon-a[0]!)*xscale,py=(lat-a[1]!)*M_PER_DEG;
    const t=Math.max(0,Math.min(1,(px*dx+py*dy)/den));
    if((px-t*dx)**2+(py-t*dy)**2>NEAR_M**2)continue;
    found.add(id);
    const category=kind==='plate'?'plate':cameraMarkerKind(kind,label);
    if(category==='plate'||category==='speed'||category==='redlight')counts[category]++;
   }
  }
 }
 return {state:'partial',snapshot:db.retrieved,...counts};
}
