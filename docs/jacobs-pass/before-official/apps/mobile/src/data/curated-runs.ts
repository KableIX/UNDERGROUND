import jacobsPass from './jacobs-pass-route.json';
import california from './california-catalog.json';
import florida from './florida-catalog.json';
import floridaRoads from './florida-road-routes.json';
import { floridaPhotos } from './florida-photos';
import mappedRoads from './california-road-routes.json';
import { catalogPhotos } from './california-photos';
import { siliconValleyCandidates } from './silicon-valley-candidates';
import type { ImageSourcePropType } from 'react-native';
import { UNVERIFIED_SCREENING, type RunScreening } from './run-screening';

export type CuratedRun = {
  slug: string;
  number: string;
  title: string;
  territory: string;
  region: string;
  category: 'RUN' | 'CRUISE' | 'TEST';
  /** Coastal RUNs take precedence; these are editorial candidates, not clearance claims. */
  environment: 'COASTAL_HIGHWAY' | 'RIDGE' | 'COUNTRYSIDE' | 'URBAN' | 'DESTINATION';
  /** Every criterion must pass before a RUN can be approved. */
  screening: RunScreening;
  routeClass: 'CIRCUIT' | 'COASTAL' | 'RIDGE' | 'SCENIC' | 'CORRIDOR';
  subtitle: string;
  sequence: readonly string[];
  geometryStatus: 'not_surveyed' | 'road_mapped';
  mapped?: {
    coordinates: number[][];
    signalGap?: { entryIndex: number; exitIndex: number };
    maneuvers: { index: number; instruction: string }[];
    distanceMeters: number;
    durationSeconds: number;
    proposedValue: number | null;
    suitabilityReview?: boolean;
    planningTime?: string;
  };
  accessNote: string;
  clearanceNote: string;
  catalog?: { id: string; state?: 'CA' | 'FL'; informationUrl?: string; region: string; district: string; tier: number | null; shortlisted: boolean; status: 'draft' };
  cover?: ImageSourcePropType;
  photo?: {
    author: string;
    license: string;
    source: string;
    caption: string;
  };
};

/** Curated event candidates, not accepted GPS territory geometries.
 * We must not synthesize road polylines from landmark/corner labels.
 * Every published card has its own site-specific, credited photograph.
 * For any future event art prominently featuring a car: only verified exotic
 * supercars/hypercars (R8, Lamborghini, Ferrari, Carrera GT/911 GT, McLaren,
 * etc.). Never feature ordinary vehicles as the hero. Landscapes are preferred
 * to inaccurate vehicle imagery. See docs/CURATED_RUNS.md.
 */
const originalRuns: readonly CuratedRun[] = [
  {
    slug: 'nvidia-campus-loop',
    number: '01',
    title: 'NVIDIA CAMPUS LOOP',
    category: 'TEST',
    environment: 'URBAN',
    screening: UNVERIFIED_SCREENING,
    territory: 'Silicon Valley',
    region: 'Santa Clara, CA',
    routeClass: 'CIRCUIT',
    subtitle: 'The original UNDERGROUND validation circuit.',
    sequence: ['Scott Boulevard', 'San Tomas Expressway', 'Walsh Avenue', 'Bowers Avenue', 'Return to Scott Boulevard'],
    geometryStatus: 'not_surveyed',
    accessNote: 'Only public, lawful road approaches. Verify turn legality and intersection checkpoints.',
    clearanceNote: 'Urban surface roads; pavement, turns, traffic and vehicle clearance must be checked in person.',
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cover: require('../../assets/runs/nvidia-campus.jpg'),
    photo: {
      author: 'Coolcaesar',
      license: 'CC BY-SA 4.0',
      source: 'https://commons.wikimedia.org/wiki/File:NVIDIA_Headquarters.jpg',
      caption: 'NVIDIA headquarters in Santa Clara (context image; not a route trace).',
    },
  },
  ...siliconValleyCandidates,
  {
    slug: 'half-moon-bay-coast',
    number: '03',
    title: 'HALF MOON BAY COAST',
    category: 'RUN',
    environment: 'COASTAL_HIGHWAY',
    screening: { ...UNVERIFIED_SCREENING, roadSnappedGeometry: 'pass' },
    territory: 'Peninsula Coast',
    region: 'Pacifica / Half Moon Bay',
    routeClass: 'COASTAL',
    subtitle: 'The Tom Lantos Tunnels carry you through the headland above Pacifica. Daylight returns on the Montara side, and you get to stay with the ocean all the way south to Half Moon Bay.',
    sequence: ['Highway 1 at Linda Mar Boulevard in Pacifica', 'Tom Lantos Tunnels', 'Montara', 'Highway 1 at Highway 92 in Half Moon Bay'],
    geometryStatus: 'road_mapped',
    mapped: { ...mappedRoads.HMB, proposedValue: null },
    accessNote: 'Use Highway 1 through the Tom Lantos Tunnels. Confirm coastal visibility and staging before departure.',
    clearanceNote: 'Highway segment appears promising; closures and road surface still require validation.',
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cover: require('../../assets/runs/coast-halfmoon.jpg'),
    photo: {
      author: 'Firstcultural',
      license: 'CC0 1.0',
      source: 'https://commons.wikimedia.org/wiki/File:Aerial_view_of_Devil%27s_Slide_on_the_California_Coast.jpg',
      caption: 'Devil’s Slide area on the coast; pictured historical road is not the route.',
    },
  },
  {
    slug: 'pescadero-coastal-run',
    number: '04',
    title: 'PESCADERO COASTAL RUN',
    category: 'RUN',
    environment: 'COASTAL_HIGHWAY',
    screening: UNVERIFIED_SCREENING,
    territory: 'Peninsula Coast',
    region: 'Half Moon Bay / Pescadero',
    routeClass: 'COASTAL',
    subtitle: 'Scenic coastal stretch along CA-1.',
    sequence: ['Half Moon Bay', 'California Highway 1', 'Pescadero State Beach'],
    geometryStatus: 'not_surveyed',
    accessNote: 'Current highway only; coastal restrictions, fog and congestion must be checked.',
    clearanceNote: 'Do not assume uninterrupted safe clearance without drive-through inspection.',
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cover: require('../../assets/runs/pescadero-coast.jpg'),
    photo: {
      author: 'Fietsbel',
      license: 'CC BY-SA 3.0',
      source: 'https://commons.wikimedia.org/wiki/File:Ca-1_somewhere_near_Pescadero,_Pomponio_and_San_Gregorio_State_Beaches.JPG',
      caption: 'CA-1 near Pescadero/Pomponio/San Gregorio state beaches.',
    },
  },
  {
    slug: 'silverado-trail',
    number: '05',
    title: 'SILVERADO TRAIL',
    category: 'RUN',
    environment: 'COUNTRYSIDE',
    screening: { ...UNVERIFIED_SCREENING, roadSnappedGeometry: 'pass' },
    territory: 'Napa Valley',
    region: 'Napa / Calistoga',
    routeClass: 'SCENIC',
    subtitle: 'The signature wine-country driving corridor.',
    sequence: ['Silverado Trail at Trancas Street, Napa', 'Silverado Trail north', 'Silverado Trail at Lincoln Avenue in Calistoga'],
    geometryStatus: 'road_mapped',
    mapped: { ...mappedRoads.NAPA, proposedValue: null },
    accessNote: 'Survey public staging at both ends and check traffic at vineyard entrances.',
    clearanceNote: 'Vineyard-road surface, shoulders, weather and traffic require validation.',
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cover: require('../../assets/runs/silverado-trail.jpg'),
    photo: {
      author: 'Stan Shebs',
      license: 'CC BY-SA 3.0',
      source: 'https://commons.wikimedia.org/wiki/File:Napa_Valley_Silverado_Trail.jpg',
      caption: 'Napa Valley with Silverado Trail visible.',
    },
  },
  {
    slug: 'seventeen-mile-drive',
    number: '06',
    title: '17-MILE DRIVE',
    category: 'CRUISE',
    environment: 'DESTINATION',
    screening: UNVERIFIED_SCREENING,
    territory: 'Monterey Peninsula',
    region: 'Pebble Beach / Pacific Grove',
    routeClass: 'SCENIC',
    subtitle: 'An iconic Monterey Peninsula coastal destination.',
    sequence: ['Pacific Grove gate', '17-Mile Drive scenic road', 'Pebble Beach area'],
    geometryStatus: 'not_surveyed',
    accessNote: 'Private toll scenic road; admission and daylight gate hours apply. Not part of the nine-county Bay Area.',
    clearanceNote: 'Slow scenic touring only; verify current gate policies and road suitability.',
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cover: require('../../assets/runs/17-mile-drive.jpg'),
    photo: {
      author: 'Amadscientist',
      license: 'CC BY-SA 3.0',
      source: 'https://commons.wikimedia.org/wiki/File:17_Mile_Drive_at_Pebble_Beach.jpg',
      caption: '17-Mile Drive, Pebble Beach.',
    },
  },
];

const oldBySlug = new Map(originalRuns.map(run => [run.slug, run]));
const reusePhoto: Record<string, string> = {
  H01: 'half-moon-bay-coast', H03: 'pescadero-coastal-run', S01: 'saratoga-highway-9',
  S04: 'skyline-ridge-cruise', S06: 'la-honda-highway-84', S07: 'page-mill-road',
  S08: 'sierra-road', CR01: 'seventeen-mile-drive', P01: 'nvidia-campus-loop',
};
const roads: Partial<Record<string, Omit<NonNullable<CuratedRun['mapped']>, 'proposedValue'>>> = { ...mappedRoads, ...floridaRoads, EB01: jacobsPass };
const catalog = [...california.map(row => ({ ...row, state: 'CA' as const, informationUrl: row.informationUrl })),
  ...florida.map(row => ({ ...row, state: 'FL' as const }))];

export const masterCatalog: readonly (CuratedRun & { catalog: NonNullable<CuratedRun['catalog']> })[] = catalog.map(row => {
  const original = oldBySlug.get(row.slug);
  const road = roads[row.id] ?? original?.mapped;
  const media = floridaPhotos[row.id] ?? catalogPhotos[row.id] ?? oldBySlug.get(reusePhoto[row.id]) ?? original;
  const category = row.category as CuratedRun['category'];
  const environment = row.environment as CuratedRun['environment'];
  return {
    slug: row.slug, number: row.id, title: row.title, territory: row.territory, category, environment,
    region: row.sequence[0] + ' → ' + row.sequence[row.sequence.length - 1],
    routeClass: category === 'TEST' ? (row.id === 'P01' || row.id === 'P03' ? 'CIRCUIT' : 'CORRIDOR') :
      environment === 'COASTAL_HIGHWAY' ? 'COASTAL' : environment === 'RIDGE' ? 'RIDGE' : 'SCENIC',
    subtitle: row.description, sequence: row.sequence,
    screening: road ? { ...UNVERIFIED_SCREENING, roadSnappedGeometry: 'pass' } : UNVERIFIED_SCREENING,
    geometryStatus: road ? 'road_mapped' : 'not_surveyed',
    ...(road && { mapped: { ...road, proposedValue: row.tier, suitabilityReview: ['S07', 'S08', 'LA17'].includes(row.id), planningTime: original?.mapped?.planningTime } }),
    accessNote: row.survey, clearanceNote: row.state === 'FL' ? 'Beta route. Start and finish parking and low-car clearance still need an on-site check.' : category === 'TEST' ? 'Development use only.' :
      category === 'CRUISE' ? 'Attendance and parked photography are the proposed participation measures.' :
      'Staging polygons, clearance and completion evidence await a field survey.',
    cover: media?.cover, photo: media?.photo,
    catalog: { id: row.id, state: row.state,
      informationUrl: row.informationUrl, tier: row.tier, region: row.region, district: row.district,
      shortlisted: row.shortlist, status: 'draft' },
  };
});

const masterSlugs = new Set(masterCatalog.map(row => row.slug));
export const curatedRuns: readonly CuratedRun[] = [
  ...masterCatalog, ...originalRuns.filter(row => !masterSlugs.has(row.slug)),
];

/** Editorial ordering: ocean-side highways first; test circuits never mingle with RUNs. */
export function getCuratedEvents(category: CuratedRun['category']): CuratedRun[] {
  const priority: Record<CuratedRun['environment'], number> = {
    COASTAL_HIGHWAY: 0,
    COUNTRYSIDE: 1,
    RIDGE: 2,
    DESTINATION: 3,
    URBAN: 4,
  };
  return curatedRuns
    .filter(run => run.category === category)
    .sort((a, b) => priority[a.environment] - priority[b.environment] || a.number.localeCompare(b.number, 'en', { numeric: true }));
}

export function getCuratedRun(slug: string): CuratedRun | undefined {
  if (slug === 'jenner-to-point-arena') {
    const first = curatedRuns.find(run => run.number === 'N04');
    const last = curatedRuns.find(run => run.number === 'N06');
    if (!first?.mapped || !last?.mapped) return undefined;
    const offset = first.mapped.coordinates.length - 1;
    return {
      ...last, slug, title: 'Jenner to Point Arena', number: '', catalog: undefined,
      region: 'Jenner to Lighthouse Road',
      subtitle: 'Follow Sonoma Coastal Crown north from Jenner. At Sea Walk Drive, stay on Highway 1 for Point Arena Passage and the final turn toward the lighthouse.',
      sequence: [...first.sequence, ...last.sequence.slice(1)],
      accessNote: first.accessNote + ' ' + last.accessNote,
      mapped: {
        coordinates: [...first.mapped.coordinates, ...last.mapped.coordinates.slice(1)],
        maneuvers: [...first.mapped.maneuvers.slice(0, -1), ...last.mapped.maneuvers.map(cue => ({ ...cue, index: offset + cue.index }))],
        distanceMeters: first.mapped.distanceMeters + last.mapped.distanceMeters,
        durationSeconds: first.mapped.durationSeconds + last.mapped.durationSeconds,
        proposedValue: null,
      },
    };
  }
  return curatedRuns.find(run => run.slug === slug);
}