import type { SupercargoCatalogEntry } from './supercargo';

/**
 * SupercarGO seed catalog. Production numbers are public manufacturer
 * statements as commonly reported; each one must be re-checked against the
 * cited source before launch. Entries with no sourced number stay Open.
 * This list is ours: no data is taken from any other spotting app.
 */
export const supercargoSeedCatalog: SupercargoCatalogEntry[] = [
  { id: 'bugatti-chiron', make: 'Bugatti', model: 'Chiron', built: 500, builtSource: 'Bugatti press release on the final Chiron (500 units)', firstYear: 2016 },
  { id: 'bugatti-veyron', make: 'Bugatti', model: 'Veyron 16.4', built: 450, builtSource: 'Bugatti: 300 coupes and 150 Grand Sport roadsters', firstYear: 2005 },
  { id: 'ferrari-laferrari', make: 'Ferrari', model: 'LaFerrari', built: 499, builtSource: 'Ferrari: 499 coupes', firstYear: 2013 },
  { id: 'ferrari-enzo', make: 'Ferrari', model: 'Enzo', built: 400, builtSource: 'Ferrari: 399 plus one built for the Vatican', firstYear: 2002 },
  { id: 'ferrari-f40', make: 'Ferrari', model: 'F40', built: 1311, builtSource: 'Ferrari model history page', firstYear: 1987 },
  { id: 'ferrari-daytona-sp3', make: 'Ferrari', model: 'Daytona SP3', built: 599, builtSource: 'Ferrari launch release (599 units)', firstYear: 2022 },
  { id: 'porsche-918-spyder', make: 'Porsche', model: '918 Spyder', built: 918, builtSource: 'Porsche: limited to 918 units', firstYear: 2013 },
  { id: 'porsche-carrera-gt', make: 'Porsche', model: 'Carrera GT', built: 1270, builtSource: 'Porsche production total', firstYear: 2004 },
  { id: 'mclaren-p1', make: 'McLaren', model: 'P1', built: 375, builtSource: 'McLaren: 375 road cars', firstYear: 2013 },
  { id: 'mclaren-f1', make: 'McLaren', model: 'F1', built: 106, builtSource: 'McLaren: 106 cars across all versions', firstYear: 1992 },
  { id: 'mercedes-amg-one', make: 'Mercedes-AMG', model: 'One', built: 275, builtSource: 'Mercedes-AMG: 275 units', firstYear: 2022 },
  { id: 'koenigsegg-jesko', make: 'Koenigsegg', model: 'Jesko', built: 125, builtSource: 'Koenigsegg: 125 planned', firstYear: 2022 },
  { id: 'pagani-huayra', make: 'Pagani', model: 'Huayra', built: 100, builtSource: 'Pagani: 100 coupes', firstYear: 2011 },
  { id: 'lexus-lfa', make: 'Lexus', model: 'LFA', built: 500, builtSource: 'Lexus: 500 units', firstYear: 2010 },
  { id: 'lamborghini-sian', make: 'Lamborghini', model: 'Sián FKP 37', built: 63, builtSource: 'Lamborghini: 63 coupes', firstYear: 2020 },
  { id: 'lamborghini-countach-lpi-800-4', make: 'Lamborghini', model: 'Countach LPI 800-4', built: 112, builtSource: 'Lamborghini: 112 units', firstYear: 2022 },
  { id: 'lamborghini-aventador', make: 'Lamborghini', model: 'Aventador', built: 11465, builtSource: 'Lamborghini: final Aventador, 11,465 built', firstYear: 2011 },
  { id: 'ford-gt-2017', make: 'Ford', model: 'GT (2017)', built: 1350, builtSource: 'Ford: run extended to 1,350', firstYear: 2017 },
  { id: 'gma-t50', make: 'Gordon Murray', model: 'T.50', built: 100, builtSource: 'Gordon Murray Automotive: 100 road cars', firstYear: 2022 },
  { id: 'audi-r8', make: 'Audi', model: 'R8', built: null, builtSource: null, firstYear: 2006 },
  { id: 'lamborghini-huracan', make: 'Lamborghini', model: 'Huracán', built: null, builtSource: null, firstYear: 2014 },
  { id: 'porsche-911-gt3-rs', make: 'Porsche', model: '911 GT3 RS', built: null, builtSource: null, firstYear: 2007 },
];

/** Match a confirmed make and model to the catalog, loosely. */
export function findSupercargoEntry(make: string, model: string, catalog = supercargoSeedCatalog) {
  const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const m = norm(make);
  const n = norm(model);
  if (!m || !n) return null;
  return (
    catalog.find((e) => norm(e.make) === m && norm(e.model) === n) ??
    catalog.find((e) => norm(e.make) === m && (norm(e.model).startsWith(n) || n.startsWith(norm(e.model)))) ??
    null
  );
}
