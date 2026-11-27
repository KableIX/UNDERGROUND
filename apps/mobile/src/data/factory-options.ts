type Identity={year:string;make:string;model:string;trim:string};
export type Selection=Record<string,string>;
type Group={name:string;choices:string[]};
type Guide={title:string;links:Record<string,string>;standard?:string;groups:(s:Selection)=>Group[];included?:(s:Selection)=>string[]};
const group=(name:string,...choices:string[]):Group=>({name,choices});
const exclusive=['Palace Blue','Saddle Brown','Oak Green','Velvet Purple','Classic Red','Sand Beige','Morning Dew Green'];
const paint=['Ibis White · T9T9','Brilliant Red · C8C8','Ice Silver metallic · P5P5','Jet Blue metallic · 1Y1Y','Daytona Gray pearl · 6Y6Y','Lava Gray pearl · 1R1R','Sepang Blue pearl · E9E9','Phantom Black pearl · L8L8'];
const interior=['Black · JN','Limestone Gray · TH','Luxor Beige · TB','Tuscan Brown · JZ','Red · BF'];
const blocked:Record<string,string[]>={C8C8:['JZ','BF'],P5P5:['TB'],'1Y1Y':['BF'],E9E9:['BF']};
const r8:Guide={
  title:'2010 R8 V10 Coupé · US order guide',
  links:{'Audi order guide':'https://audienthusiasts.com/Downloads/Audi%2BOrder%2BGuide%2B2010%2BUSA%2BRetail.pdf','Audi exclusive guide':'https://www.ecodetuning.com/gallery/B8TSIAPR/reduced/OG2010AudiExclusive.pdf'},
  standard:'Fine Nappa seats, magnetic ride, LED headlights, carbon engine-bay inlays, Bang & Olufsen audio and navigation.',
  groups:s=>[
    group('Factory paint',...paint,...exclusive.map(v=>v+' · Audi exclusive 9996'),'Paint to sample · 9996','Audi special-order paint · SPSP'),
    group('Seat color',...interior.filter(v=>!(blocked[s['Factory paint']?.split(' · ')[1]]??[]).includes(v.split(' · ')[1]))),
    group('Sideblades','Paint-paired factory finish','Oxygen Silver · 6H2','Sigma carbon · 6H3','Body color · SPB',...exclusive.map(v=>v+' · Audi exclusive YUY')),
    group('Factory wheels','19-inch Y-spoke · standard','19-inch polished double-spoke · PQ7','19-inch titanium double-spoke · PQK','19-inch double-spoke · PRJ'),
    group('Leather package','Enhanced Leather · 7HD'),group('Headliner','Black Alcantara · 6NN'),
    group('Cabin inlays','Sigma carbon · 5MN','Piano Black · 5TL'),group('Mirror housings','Sigma carbon · 6FQ'),
    group('Door sills','Sigma carbon · 7M7','Illuminated · 7M9'),
    group('Infotainment','Navigation plus with music interface · PNC'),
    group('Front plate treatment','Plate holder · 6W3','Grille filler · 6W9')],
  included:s=>s['Leather package']?['Enhanced Leather adds black leather to the dashboard and upper door trim.']:[],
};
const sto:Guide={title:'Huracán STO · manufacturer specification',links:{'Lamborghini wheel guide':'https://www.lamborghini.com/en-en/news/huracan-sto-magnesium-rims'},groups:()=>[group('Factory wheels','20-inch HEK magnesium')]};
const lfa:Guide={title:'2012 LFA · Lexus USA',links:{'Lexus package guide':'https://pressroom.lexus.com/lexus-introduces-2012-lfa-nurburgring-package/'},
  groups:s=>[group('Factory package','Nürburgring Package'),...(s['Factory package']?[group('Package paint','Whitest White','Orange','Black','Matte Black'),group('Package interior','Black','Red','Violet')]:[])],
  included:s=>s['Factory package']?['Fixed rear wing, larger front spoiler, black mesh wheels, sport suspension and carbon console and door trim.']:[]};
const rs:Guide={title:'2023 911 GT3 RS · Porsche USA',links:{'Porsche package guide':'https://newsroom.porsche.com/dam/jcr%3A784f979e-f06d-4ce7-94d4-4351fcc7d61c/PCNA23_0021_us.pdf'},
  groups:()=>[group('Factory package','Weissach Package','Tribute to Carrera RS Package')],
  included:s=>s['Factory package']?['Weissach equipment includes carbon anti-roll bars, coupling rods and shear panel.',...(s['Factory package']==='Tribute to Carrera RS Package'?['Tribute includes Weissach equipment, Python Green magnesium wheels, mirror caps and side graphics.']:[])]:[]};
const ferrari:Guide={title:'Ferrari · manufacturer specification',links:{'Ferrari model coverage':'https://cdn.ferrari.com/cms/network/media/pdf/Ferrari%20NV%20Annual%20Report%20FY%202022%20-%20Form%2020F.pdf'},groups:()=>[group('Factory package','Assetto Fiorano')]};
const gtb:Guide={...ferrari,links:{'296 GTB package guide':'https://www.ferrari.com/content/dam/ferrari-fcom/old/pdf/CS_296_GTB_final_gbr.pdf'},
  groups:s=>[...ferrari.groups(s),...(s['Factory package']?[group('Factory livery','250 Le Mans–inspired livery')]:[])],
  included:s=>s['Factory package']?['Multimatic dampers, carbon front aero and Lexan rear window.']:[]};
export function guideFor(c:Identity):Guide|undefined{
  if(c.make==='Audi'&&c.year==='2010'&&c.model==='R8'&&/5\.2|V10/i.test(c.trim))return r8;
  if(c.make==='Lamborghini'&&c.model==='Huracan'&&c.trim==='STO')return sto;
  if(c.make==='Lexus'&&c.model==='LFA'&&c.year==='2012')return lfa;
  if(c.make==='Porsche'&&c.year==='2023'&&c.model==='911'&&/^911 GT3 RS\b/.test(c.trim))return rs;
  if(c.make==='Ferrari'&&!/speciale|\bXX\b/i.test(c.model+' '+c.trim)){
    if(c.model==='296 GTB'&&!/spider/i.test(c.trim))return gtb;
    if(['296 GTS','SF90 Stradale','SF90 Stradale Coupe','SF90 Spider'].includes(c.model))return ferrari;
  }
}
export function selectOption(guide:Guide,s:Selection,name:string,value:string):Selection{
  const next={...s,[name]:value};
  return Object.fromEntries(guide.groups(next).filter(g=>g.choices.includes(next[g.name])).map(g=>[g.name,next[g.name]]));
}
