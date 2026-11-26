import type { Fix, RoutePoint } from './route-navigation';

export function conditionPosition(points:RoutePoint[], distances:number[], fix:Fix|null, hint:number) {
  if(!fix || fix.accuracyM===null || fix.accuracyM>25)return null;
  const k=111320*Math.cos(fix.latitude*Math.PI/180);
  let closest=Infinity, along=0;
  for(let i=1;i<points.length;i++){
    const a=points[i-1]!, b=points[i]!;
    const dx=(b[0]-a[0])*k, dy=(b[1]-a[1])*111320;
    const x=(fix.longitude-a[0])*k, y=(fix.latitude-a[1])*111320;
    const t=Math.max(0,Math.min(1,(x*dx+y*dy)/(dx*dx+dy*dy || 1)));
    const gap=Math.hypot(x-t*dx,y-t*dy);
    const m=distances[i-1]!+t*(distances[i]!-distances[i-1]!);
    if(gap<closest-0.1 || (Math.abs(gap-closest)<=0.1 && Math.abs(m-hint)<Math.abs(along-hint))){
      closest=gap;along=m;
    }
  }
  return closest<=15 ? along : null;
}
