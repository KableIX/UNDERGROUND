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
  routeClass: 'CIRCUIT' | 'COASTAL' | 'RIDGE' | 'SCENIC';
  subtitle: string;
  sequence: readonly string[];
  geometryStatus: 'not_surveyed';
  accessNote: string;
  clearanceNote: string;
  cover: ImageSourcePropType;
  photo: {
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
export const curatedRuns: readonly CuratedRun[] = [
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
  {
    slug: 'skyline-ridge-cruise',
    number: '02',
    title: 'SKYLINE RIDGE RUN',
    category: 'RUN',
    environment: 'RIDGE',
    screening: UNVERIFIED_SCREENING,
    territory: 'Silicon Valley',
    region: 'San Mateo / Santa Cruz Mountains',
    routeClass: 'RIDGE',
    subtitle: 'A high-ridge scenic road above the Peninsula.',
    sequence: ['CA-35 / Skyline Boulevard', 'Proposed segment: Highway 92 to Highway 84'],
    geometryStatus: 'not_surveyed',
    accessNote: 'Mountain-road conditions and closures vary; no start/end geofence is approved.',
    clearanceNote: 'Tight turns, shade, cyclist traffic and pavement transitions require field inspection.',
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cover: require('../../assets/runs/skyline-ridge.jpg'),
    photo: {
      author: 'Stephen Lea',
      license: 'CC BY-SA 3.0',
      source: 'https://commons.wikimedia.org/wiki/File:SkylineBoulevardFromAir.jpg',
      caption: 'Skyline Boulevard from the air.',
    },
  },
  {
    slug: 'half-moon-bay-coast',
    number: '03',
    title: 'HALF MOON BAY COAST',
    category: 'RUN',
    environment: 'COASTAL_HIGHWAY',
    screening: UNVERIFIED_SCREENING,
    territory: 'Peninsula Coast',
    region: 'Pacifica / Half Moon Bay',
    routeClass: 'COASTAL',
    subtitle: 'Ocean highway and cliffside scenery.',
    sequence: ['Pacifica', 'California Highway 1', 'Half Moon Bay'],
    geometryStatus: 'not_surveyed',
    accessNote: 'Use the current highway through Tom Lantos Tunnels, not the closed old Devil’s Slide road.',
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
    screening: UNVERIFIED_SCREENING,
    territory: 'Napa Valley',
    region: 'Napa / Calistoga',
    routeClass: 'SCENIC',
    subtitle: 'The signature wine-country driving corridor.',
    sequence: ['South Silverado Trail, Napa', 'Silverado Trail', 'Calistoga area'],
    geometryStatus: 'not_surveyed',
    accessNote: 'No exact start/end or legal stopping area selected; respect residential access.',
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
    .sort((a, b) => priority[a.environment] - priority[b.environment] || Number(a.number) - Number(b.number));
}

export function getCuratedRun(slug: string): CuratedRun | undefined {
  return curatedRuns.find(run => run.slug === slug);
}
