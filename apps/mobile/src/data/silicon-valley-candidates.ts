import { saratogaPhoto } from './saratoga-photo';
import type { CuratedRun } from './curated-runs';
import { UNVERIFIED_SCREENING } from './run-screening';
import roads from './silicon-valley-road-routes.json';

type RoadSlug = keyof typeof roads;
type Candidate = Pick<CuratedRun, 'number' | 'title' | 'region' | 'environment' | 'routeClass' |
  'subtitle' | 'sequence' | 'accessNote' | 'clearanceNote' | 'cover' | 'photo'> & {
  slug: RoadSlug;
  proposedValue: number | null;
  suitabilityReview?: boolean;
  planningTime?: string;
};

function credit(file: string, author: string, license: string, caption: string) {
  return { author, license, caption, source: 'https://commons.wikimedia.org/wiki/File:' +
    encodeURIComponent(file.replace(/ /g, '_')) };
}

const candidates: Candidate[] = [
  {
    slug: 'santa-clara-cupertino', number: '07', title: 'Santa Clara / Cupertino',
    region: 'Santa Clara to Cupertino', proposedValue: null, environment: 'URBAN', routeClass: 'CORRIDOR',
    subtitle: 'Follow Stevens Creek Boulevard west through the valley grid. Its signals and parallel carriageways give the GPS tracker a repeatable local test.',
    sequence: ['Stevens Creek Boulevard at San Tomas Expressway', 'Westbound Stevens Creek Boulevard', 'Stevens Creek Boulevard at De Anza Boulevard'],
    accessNote: 'The endpoints mark the westbound carriageway. Choose an off-street meeting spot before departure.',
    clearanceNote: 'An urban GPS test with traffic signals and driveways. There is no territory award.',
    cover: require('../../assets/runs/santa-clara-cupertino.jpg'),
    photo: {"source": "https://commons.wikimedia.org/wiki/File:Cupertino,_CA,_USA_-_panoramio.jpg", "author": "peter boy12qq12", "license": "CC BY 3.0", "caption": "Cupertino, at the west end of the test corridor."},
  },
  {
    slug: 'saratoga-highway-9', number: '08', title: 'Saratoga → Highway 9',
    region: 'Saratoga Village to Saratoga Gap', proposedValue: 3, environment: 'RIDGE', routeClass: 'SCENIC',
    subtitle: 'The village gives way to a wooded ascent. Follow Highway 9 up Saratoga Creek until the road meets the Skyline ridge.',
    sequence: ['Big Basin Way at Saratoga Avenue', 'CA-9 via Big Basin Way and Congress Springs Road', 'Saratoga Gap at Skyline Boulevard'],
    accessNote: 'The solo ascent finishes at the CA-9 / CA-35 junction. The longer Saratoga loop is under Club Drives.',
    clearanceNote: 'Village traffic, wooded bends and turnout entrances need a field check.',
    ...saratogaPhoto,
  },
  {
    slug: 'skyline-ridge-cruise', number: '02', title: 'Skyline Ridge Run',
    region: 'Highway 92 to Sky Londa', proposedValue: 5, environment: 'RIDGE', routeClass: 'RIDGE',
    subtitle: 'Leave Highway 92 on the southbound ridge road and hold the high ground. Skyline carries you through the trees to Sky Londa, where drivers coming up from Woodside and La Honda meet at the same crossroads.',
    sequence: ['CA-92 at southbound Skyline Boulevard', 'Skyline Boulevard / CA-35 south', 'Sky Londa at CA-84'],
    accessNote: 'Start at the southern CA-35 branch from Highway 92. Reserve entrances along Skyline are separate from the route.',
    clearanceNote: 'Check ridge visibility, pavement and turnout traffic before departure.',
    cover: require('../../assets/runs/skyline-ridge.jpg'),
    photo: credit('SkylineBoulevardFromAir.jpg', 'Stephen Lea', 'CC BY-SA 3.0', 'Skyline Boulevard from the air.'),
  },
  {
    slug: 'la-honda-highway-84', number: '09', title: 'Highway 84 / La Honda',
    region: 'Sky Londa to San Gregorio', proposedValue: 4, environment: 'COUNTRYSIDE', routeClass: 'SCENIC',
    subtitle: 'From Sky Londa, Highway 84 winds down through the trees to La Honda. Stay with the valley as the hills part and the sky opens toward the ocean. Stage Road in San Gregorio is the last turn on the map.',
    sequence: ['Sky Londa at Skyline Boulevard', 'La Honda Road / CA-84 west through La Honda', 'Stage Road in San Gregorio'],
    accessNote: 'The finish is in San Gregorio village, before Highway 1.',
    clearanceNote: 'Check sightlines through the bends and expect local traffic at the village junctions.',
    cover: require('../../assets/runs/la-honda-highway-84.jpg'),
    photo: {"author": "Suiren2022", "source": "https://commons.wikimedia.org/wiki/File:Old_La_Honda_Rd_-_La_Honda_Rd_intersection.jpg", "license": "CC BY-SA 4.0", "caption": "The junction of Old La Honda Road and Highway 84."},
  },
  {
    slug: 'page-mill-road', number: '10', title: 'Page Mill Road',
    region: 'Palo Alto foothills to Skyline', proposedValue: 3, environment: 'RIDGE', routeClass: 'SCENIC',
    suitabilityReview: true,
    subtitle: 'Climb from the Foothill Expressway junction to the ridge above Palo Alto. Page Mill stays on the same named road all the way to Skyline.',
    sequence: ['Page Mill Road at Foothill Expressway', 'Uphill on Page Mill Road', 'Skyline Boulevard at Alpine Road'],
    accessNote: 'The trace begins on the uphill carriageway and finishes at the highway junction outside Russian Ridge.',
    clearanceNote: 'Suitability review pending. Inspect usable width, blind bends and pavement transitions in a low-clearance car.',
    cover: require('../../assets/runs/page-mill-road.jpg'),
    photo: credit('Russian Ridge Open Space.jpg', 'Inklein', 'CC BY-SA 4.0', 'A trail at Russian Ridge near the finish. The drive stays on paved Page Mill Road.'),
  },
  {
    slug: 'sierra-road', number: '11', title: 'Sierra Road',
    region: 'San José to Sierra Vista', proposedValue: 2, environment: 'RIDGE', routeClass: 'SCENIC',
    subtitle: 'A short east-foothills ascent with the valley opening out below. The finish is the Sierra Vista preserve entrance on Sierra Road.',
    sequence: ['Sierra Road at Piedmont Road', 'Sierra Road uphill', 'Sierra Vista Open Space Preserve entrance'],
    accessNote: 'The preserve lot can close when full. Roadside parking on Sierra Road is prohibited.',
    clearanceNote: 'Review the grade, bends and entrance transition before organizing a club stop.',
    cover: require('../../assets/runs/sierra-road.jpg'),
    photo: credit('Sierra Vista Open Space Preserve, San Jose.png', 'Srishti Sethi', 'CC BY-SA 4.0', 'The East Foothills from Sierra Vista Open Space Preserve.'),
  },
  {
    slug: 'mount-hamilton-road', number: '12', title: 'Mount Hamilton Road',
    region: 'East San José to Lick Observatory', proposedValue: 5, environment: 'RIDGE', routeClass: 'SCENIC',
    planningTime: 'Allow at least 1 hr from San José (Lick Observatory visitor guidance).',
    subtitle: 'Follow CA-130 into the Diablo Range. Its long succession of bends leads to the summit access road for Lick Observatory.',
    sequence: ['Mount Hamilton Road at Alum Rock Avenue', 'Mount Hamilton Road / CA-130', 'Observatory Peak Road junction at Lick Observatory'],
    accessNote: 'The mapped finish is on CA-130 at the visitor access road. Observatory access and opening hours are separate.',
    clearanceNote: 'Allow time for the winding approach. Check road restrictions, weather and summit access before departure.',
    cover: require('../../assets/runs/mount-hamilton-road.jpg'),
    photo: credit('Mt hamilton road cyclist.jpg', 'Sweetnsourbkr', 'Public domain', 'A cyclist ascending Mount Hamilton Road.'),
  },
];

export const siliconValleyCandidates: CuratedRun[] = candidates.map(({ proposedValue, suitabilityReview, planningTime, ...candidate }) => ({
  ...candidate,
  territory: 'Silicon Valley',
  category: proposedValue === null ? 'TEST' : 'RUN',
  geometryStatus: 'road_mapped',
  screening: { ...UNVERIFIED_SCREENING, roadSnappedGeometry: 'pass' },
  mapped: { ...roads[candidate.slug], proposedValue, suitabilityReview, planningTime },
}));
