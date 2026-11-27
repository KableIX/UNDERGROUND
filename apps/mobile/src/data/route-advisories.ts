type Bulletin = { routes: string[]; through: string; text: string; source: string; date: string };
const fourCorners = 'https://dot.ca.gov/caltrans-near-me/district-4/d4-news/2026-10-02-four-corners-all-way-stop';
const highwayOne = 'https://roads.dot.ca.gov/?roadnumber=1';
const notices: Bulletin[] = [
  { routes: ['H06'], through: '2026-11-13T16:00:00-08:00', date: 'Nov 10, 2026', source: highwayOne,
    text: 'Caltrans scheduled one-way traffic between Waddell Creek Bridge and the county line, 7 am to 4 pm Tuesday through Friday, through November 13.' },
  { routes: ['M01'], through: '2026-11-30T06:00:00-08:00', date: 'Nov 10, 2026', source: highwayOne,
    text: 'Caltrans reported alternating traffic at Rocky Creek Bridge, scheduled through November 30.' },
  { routes: ['M01'], through: '2026-12-31T07:00:00-08:00', date: 'Nov 10, 2026', source: highwayOne,
    text: 'One-way controls were scheduled near Point Sur Lighthouse through December 31.' },
  { routes: ['M03'], through: '2026-11-13T12:00:00-08:00', date: 'Nov 10, 2026', source: highwayOne,
    text: 'Mud Creek work was scheduled weekday mornings through November 13. Caltrans estimated delays of up to 15 minutes.' },
  { routes: ['S03', 'S04', 'S05'], through: '2027-06-21T00:00:00-07:00', date: 'Oct 2, 2026', source: fourCorners,
    text: 'Four Corners has an all-way stop. Caltrans scheduled further work into spring 2027 and advised of possible traffic control and reduced parking.' },
  { routes: ['S05'], through: '2027-03-20T00:00:00-07:00', date: 'Sep 14, 2026',
    source: 'https://dot.ca.gov/caltrans-near-me/district-4/d4-news/2026-09-14-sr84-resurfacing-project',
    text: 'The Woodside to La Honda resurfacing project was scheduled through winter 2026. Check the current report before leaving.' },
];
export function routeAdvisories(id: string, now = Date.now()) {
  return notices.filter(item => item.routes.includes(id) && now < Date.parse(item.through));
}

export const cedarGroveRoadReport = 'https://www.nps.gov/seki/planyourvisit/road-conditions.htm';
export const cedarGroveWinterClosure = Date.parse('2026-11-13T00:00:00-08:00');

export function winterNavigationPaused(id: string | undefined, now = Date.now()) {
  return id === 'KS01' && now >= cedarGroveWinterClosure;
}

export function runAdvisories(slug:string,id:string|undefined,now=Date.now()){
 return slug==='jenner-to-point-arena'?[...routeAdvisories('N04',now),...routeAdvisories('N06',now)]:routeAdvisories(id??'',now);
}
