// Metadata for the existing offline snapshot. A listing is not evidence of operation.
export const cameraSources = {
 reader: {name:'OpenStreetMap via FlockHopper',url:'https://github.com/flockhopper3/deflock-data',license:'ODbL 1.0 (OSM; see source)',authority:'community'},
 osm: {name:'OpenStreetMap',url:'https://www.openstreetmap.org/copyright',license:'ODbL 1.0',authority:'community'},
 sj: {name:'San Jose DOT',url:'https://geo.sanjoseca.gov/server/rest/services/DOT/DOT_TrafficSignalsParkingOpsLayers/MapServer/26',license:'Reuse terms require review',authority:'municipal'},
 sf: {name:'SFMTA',url:'https://data.sf.gov/Transportation/Automated-Speed-Enforcement-Citations/d5uh-bk84',license:'Reuse terms require review',authority:'municipal'},
 oak: {name:'OakDOT',url:'https://www.arcgis.com/home/item.html?id=b1661b60e154451fb63b155c95c157df',license:'Reuse terms require review',authority:'municipal'},
 la: {name:'LADOT',url:'https://ladot.lacity.gov/speed-safety-system',license:'Reuse terms require review',authority:'municipal'},
} as const;
export type CameraSource=keyof typeof cameraSources;
export type CameraMarkerKind='flock'|'alpr'|'speed'|'redlight';
export function cameraMarkerKind(kind:'plate'|'speed', label:string):CameraMarkerKind {
 if(kind==='plate')return /^(flock safety|flock)$/i.test(label.trim())?'flock':'alpr';
 return /red[ -]?light/i.test(label)?'redlight':'speed';
}
export function cameraStatus(raw:string):string {
 return raw.trim()||'Operating status unknown';
}
