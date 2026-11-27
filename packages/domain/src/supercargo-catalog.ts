import type { SupercargoCatalogEntry } from './supercargo';

/**
 * SupercarGO seed catalog. Every production number cites a public source,
 * preferring the manufacturer (press release, newsroom or model page), and was
 * checked on 2026-11-27. Where a run is announced but not finished, the figure
 * is the announced cap and the source says "planned". Cars with no published
 * production number stay Open with built = null; nothing is estimated.
 * This list is ours: no data is taken from any other spotting app.
 * supabase/seed/supercargo_catalog.sql is generated
 * from this file by scripts/supercargo/catalog-seed-sql.ts; keep them in step.
 */
export const supercargoSeedCatalog: SupercargoCatalogEntry[] = [
  // Bugatti
  { id: 'bugatti-tourbillon', make: 'Bugatti', model: 'Tourbillon', built: 250, builtSource: 'Bugatti newsroom, 2024: 250 to be built (planned). https://newsroom.bugatti.com/en/press-releases/the-bugatti-tourbillon-an-automotive-icon-pour-leternite', firstYear: 2026 },
  { id: 'bugatti-chiron', make: 'Bugatti', model: 'Chiron', built: 500, builtSource: 'Bugatti newsroom: L\'Ultime is the 500th and final Chiron. https://newsroom.bugatti.com/en/press-releases/celebrating-the-end-of-the-incomparable-chiron-era', firstYear: 2016 },
  { id: 'bugatti-veyron', make: 'Bugatti', model: 'Veyron 16.4', built: 450, builtSource: 'Bugatti newsroom: 300 coupes and 150 Grand Sport roadsters. https://newsroom.bugatti.com/en/press-releases/bugatti-sells-the-last-veyron', firstYear: 2005 },
  { id: 'bugatti-bolide', make: 'Bugatti', model: 'Bolide', built: 40, builtSource: 'Bugatti newsroom: limited to 40 units. https://newsroom.bugatti.com/en/press-releases/bugatti-developing-production-version-of-the-bolide-experimental-hyper-sports-car', firstYear: 2024 },
  { id: 'bugatti-w16-mistral', make: 'Bugatti', model: 'W16 Mistral', built: 99, builtSource: 'Bugatti: limited to 99 units. https://www.bugatti.com/bolide/models/w16-mistral', firstYear: 2024 },
  // Ferrari
  { id: 'ferrari-f80', make: 'Ferrari', model: 'F80', built: 799, builtSource: 'Ferrari, 17 Oct 2024: limited run of 799 (planned). https://www.ferrari.com/en-EN/articles/f80-ferraris-new-supercar', firstYear: 2025 },
  { id: 'ferrari-laferrari', make: 'Ferrari', model: 'LaFerrari', built: 500, builtSource: 'Ferrari: 499 cars plus a 500th built for earthquake relief. https://www.ferrari.com/en-EN/corporate/articles/the-500th-laferrari-to-be-built-to-benefit-the-people-affected-by-the-earthquake', firstYear: 2013 },
  { id: 'ferrari-laferrari-aperta', make: 'Ferrari', model: 'LaFerrari Aperta', built: 210, builtSource: 'Ferrari: 209 cars plus a 210th charity car. https://www.ferrari.com/en-EN/corporate/articles/laferrari-aperta-sells-for-record-83-million-euro', firstYear: 2016 },
  { id: 'ferrari-enzo', make: 'Ferrari', model: 'Enzo', built: 400, builtSource: 'Ferrari: 399 road cars plus one for Pope John Paul II. https://www.ferrari.com/en-EN/auto/enzo-ferrari', firstYear: 2002 },
  { id: 'ferrari-f50', make: 'Ferrari', model: 'F50', built: 349, builtSource: 'Ferrari model page: 349 built. https://www.ferrari.com/en-EN/auto/f50', firstYear: 1995 },
  { id: 'ferrari-f40', make: 'Ferrari', model: 'F40', built: 1311, builtSource: 'Ferrari model page: 1,311 built. https://www.ferrari.com/en-EN/auto/f40', firstYear: 1987 },
  { id: 'ferrari-288-gto', make: 'Ferrari', model: '288 GTO', built: 272, builtSource: 'Ferrari: 272 built. https://www.ferrari.com/en-EN/magazine/articles/legacy-tour-2024-celebrating-the-gto', firstYear: 1984 },
  { id: 'ferrari-daytona-sp3', make: 'Ferrari', model: 'Daytona SP3', built: 599, builtSource: 'Ferrari launch release: 599 units. https://www.ferrari.com/en-EN/corporate/articles/ferrari-daytona-sp3-the-new-icona-inspired-by-the-legendary-victories-of-maranellos-sports-prototypes', firstYear: 2022 },
  { id: 'ferrari-sf90-xx-stradale', make: 'Ferrari', model: 'SF90 XX Stradale', built: 799, builtSource: 'Ferrari, 29 Jun 2023: 799 SF90 XX Stradale. https://www.ferrari.com/en-EN/corporate/articles/sf90-xx-stradale-and-sf90-xx-spider-the-first-road-going-cars-in-the-xx-programme', firstYear: 2024 },
  { id: 'ferrari-sf90-xx-spider', make: 'Ferrari', model: 'SF90 XX Spider', built: 599, builtSource: 'Ferrari, 29 Jun 2023: 599 SF90 XX Spider. https://www.ferrari.com/en-EN/corporate/articles/sf90-xx-stradale-and-sf90-xx-spider-the-first-road-going-cars-in-the-xx-programme', firstYear: 2024 },
  { id: 'ferrari-812-competizione', make: 'Ferrari', model: '812 Competizione', built: 999, builtSource: 'Ferrari launch, May 2021: 999 coupes (as reported by Top Gear). https://www.topgear.com/car-news/supercars/ferrari-812-competizione-and-aperta-have-sold-out', firstYear: 2021 },
  { id: 'ferrari-812-competizione-a', make: 'Ferrari', model: '812 Competizione A', built: 599, builtSource: 'Ferrari launch, May 2021: 599 Competizione A (as reported by Top Gear). https://www.topgear.com/car-news/supercars/ferrari-812-competizione-and-aperta-have-sold-out', firstYear: 2021 },
  { id: 'ferrari-f12tdf', make: 'Ferrari', model: 'F12tdf', built: 799, builtSource: 'Ferrari: limited to 799. https://www.ferrari.com/en-EN/corporate/articles/f12tdf-track-level-performance-on-the-road', firstYear: 2016 },
  { id: 'ferrari-599-gto', make: 'Ferrari', model: '599 GTO', built: 599, builtSource: 'Ferrari model page: 599 units. https://www.ferrari.com/en-EN/auto/599-gto', firstYear: 2010 },
  { id: 'ferrari-sf90-stradale', make: 'Ferrari', model: 'SF90 Stradale', built: null, builtSource: null, firstYear: 2020 },
  { id: 'ferrari-sf90-spider', make: 'Ferrari', model: 'SF90 Spider', built: null, builtSource: null, firstYear: 2021 },
  { id: 'ferrari-296-gtb', make: 'Ferrari', model: '296 GTB', built: null, builtSource: null, firstYear: 2022 },
  { id: 'ferrari-296-gts', make: 'Ferrari', model: '296 GTS', built: null, builtSource: null, firstYear: 2022 },
  { id: 'ferrari-f8-tributo', make: 'Ferrari', model: 'F8 Tributo', built: null, builtSource: null, firstYear: 2020 },
  { id: 'ferrari-488-pista', make: 'Ferrari', model: '488 Pista', built: null, builtSource: null, firstYear: 2019 },
  { id: 'ferrari-812-superfast', make: 'Ferrari', model: '812 Superfast', built: null, builtSource: null, firstYear: 2017 },
  { id: 'ferrari-12cilindri', make: 'Ferrari', model: '12Cilindri', built: null, builtSource: null, firstYear: 2024 },
  { id: 'ferrari-purosangue', make: 'Ferrari', model: 'Purosangue', built: null, builtSource: null, firstYear: 2023 },
  { id: 'ferrari-roma', make: 'Ferrari', model: 'Roma', built: null, builtSource: null, firstYear: 2020 },
  // Lamborghini
  { id: 'lamborghini-sian', make: 'Lamborghini', model: 'Sián FKP 37', built: 63, builtSource: 'Lamborghini: limited series of 63. https://www.lamborghini.com/de-en/nachrichten/have-a-look-at-the-first-sian-models-delivered-worldwide', firstYear: 2020 },
  { id: 'lamborghini-centenario', make: 'Lamborghini', model: 'Centenario', built: 40, builtSource: 'Lamborghini: 20 coupes and 20 roadsters. https://www.lamborghini.com/fr-en/histoire/few-off/centenario', firstYear: 2016 },
  { id: 'lamborghini-countach-lpi-800-4', make: 'Lamborghini', model: 'Countach LPI 800-4', built: 112, builtSource: 'Lamborghini: 112 units. https://www.lamborghini.com/en-en/models/few-off/countach-lpi-800-4', firstYear: 2022 },
  { id: 'lamborghini-aventador-svj', make: 'Lamborghini', model: 'Aventador SVJ', built: 900, builtSource: 'Lamborghini, Aug 2018: produced in 900 units. https://www.lamborghini.com/fr-en/nouvelles/aventador-svj-unveiled-monterey-car-week', firstYear: 2019 },
  { id: 'lamborghini-aventador-svj-roadster', make: 'Lamborghini', model: 'Aventador SVJ Roadster', built: 800, builtSource: 'Lamborghini, Mar 2019: 800 units. https://www.lamborghini.com/fr-en/nouvelles/meet-aventador-svj-roadster', firstYear: 2019 },
  { id: 'lamborghini-aventador-ultimae', make: 'Lamborghini', model: 'Aventador LP 780-4 Ultimae', built: 600, builtSource: 'Lamborghini: 350 coupes and 250 roadsters. https://www.lamborghini.com/fr-en/nouvelles/aventador-ultimae-lamborghinis-latest-pure-v12-on-the-road', firstYear: 2021 },
  { id: 'lamborghini-aventador', make: 'Lamborghini', model: 'Aventador', built: 11465, builtSource: 'Lamborghini: last Aventador built, 11,465 in total. https://www.mynewsdesk.com/se/lamborghini-sverige/pressreleases/en-era-aer-oever-lamborghini-har-byggt-sin-sista-aventador-3219159', firstYear: 2011 },
  { id: 'lamborghini-huracan-sterrato', make: 'Lamborghini', model: 'Huracán Sterrato', built: 1499, builtSource: 'Lamborghini, 30 Nov 2022: 1,499 units. https://www.lamborghini.com/de-en/nachrichten/lamborghini-presents-the-new-huracan-sterrato', firstYear: 2023 },
  { id: 'lamborghini-huracan-sto', make: 'Lamborghini', model: 'Huracán STO', built: null, builtSource: null, firstYear: 2021 },
  { id: 'lamborghini-huracan-tecnica', make: 'Lamborghini', model: 'Huracán Tecnica', built: null, builtSource: null, firstYear: 2022 },
  { id: 'lamborghini-huracan', make: 'Lamborghini', model: 'Huracán', built: null, builtSource: null, firstYear: 2014 },
  { id: 'lamborghini-revuelto', make: 'Lamborghini', model: 'Revuelto', built: null, builtSource: null, firstYear: 2024 },
  { id: 'lamborghini-temerario', make: 'Lamborghini', model: 'Temerario', built: null, builtSource: null, firstYear: 2025 },
  { id: 'lamborghini-urus', make: 'Lamborghini', model: 'Urus', built: null, builtSource: null, firstYear: 2018 },
  // McLaren
  { id: 'mclaren-f1', make: 'McLaren', model: 'F1', built: 106, builtSource: 'McLaren: 106 cars across all versions. https://www.mclaren.com/cars/es_es/post/mclaren-f1-the-birth-of-the-real-supercar', firstYear: 1992 },
  { id: 'mclaren-p1', make: 'McLaren', model: 'P1', built: 375, builtSource: 'McLaren press: 375 customer cars. https://cars.mclaren.press/api/releases/1068', firstYear: 2013 },
  { id: 'mclaren-w1', make: 'McLaren', model: 'W1', built: 399, builtSource: 'McLaren: production limited to 399 (planned). https://www.mclaren.com/cars/us_en/w1', firstYear: 2026 },
  { id: 'mclaren-speedtail', make: 'McLaren', model: 'Speedtail', built: 106, builtSource: 'McLaren press: 106 cars, all reserved. https://cars.mclaren.press/api/releases/770', firstYear: 2020 },
  { id: 'mclaren-senna', make: 'McLaren', model: 'Senna', built: 500, builtSource: 'McLaren media information: limited to 500. https://cars.mclaren.press/assets/documents/original/9588-McLarenSennamediainformationupdatedforGTDUSversion731.pdf', firstYear: 2018 },
  { id: 'mclaren-elva', make: 'McLaren', model: 'Elva', built: 149, builtSource: 'McLaren, May 2021: no more than 149 built (as reported by Carscoops). https://www.carscoops.com/2021/05/mclaren-slashes-elva-production-to-149-units-debuts-windscreen-version-of-the-roofless-supercar/', firstYear: 2021 },
  { id: 'mclaren-765lt', make: 'McLaren', model: '765LT', built: 765, builtSource: 'McLaren press: 765 coupes. https://cars.mclaren.press/assets/documents/original/12453-PerformancefiguresfornewMcLaren765LTconfirmedascustomercarproductioncommencesFINALUS.pdf', firstYear: 2021 },
  { id: 'mclaren-765lt-spider', make: 'McLaren', model: '765LT Spider', built: 765, builtSource: 'McLaren release: 765 Spiders. https://www.prnewswire.com/news-releases/the-mclaren-765lt-spider-extreme-performance-and-new-heights-of-driver-engagement-from-mclarens-most-powerful-ever-convertible-supercar-301341943.html', firstYear: 2022 },
  { id: 'mclaren-750s', make: 'McLaren', model: '750S', built: null, builtSource: null, firstYear: 2024 },
  { id: 'mclaren-720s', make: 'McLaren', model: '720S', built: null, builtSource: null, firstYear: 2018 },
  { id: 'mclaren-600lt', make: 'McLaren', model: '600LT', built: null, builtSource: null, firstYear: 2019 },
  { id: 'mclaren-artura', make: 'McLaren', model: 'Artura', built: null, builtSource: null, firstYear: 2023 },
  // Porsche
  { id: 'porsche-918-spyder', make: 'Porsche', model: '918 Spyder', built: 918, builtSource: 'Porsche AG release, 19 Jun 2015: 918 units. https://newsroom.porsche.com/dam/jcr:d701ad55-e514-4712-93b3-4e217fa9d37f/Porsche%20finishes%20production%20of%20the%20918%20Spyder%20technology%20pioneer,%20press%20release,%2006-19-2015,%20Porsche%20AG.pdf', firstYear: 2013 },
  { id: 'porsche-carrera-gt', make: 'Porsche', model: 'Carrera GT', built: 1270, builtSource: 'Porsche newsroom: 1,270 produced. https://newsroom.porsche.com/en/press-kits/Exhibition-Kit-2025/25Y-Carrera-GT.html', firstYear: 2004 },
  { id: 'porsche-911-r', make: 'Porsche', model: '911 R', built: 991, builtSource: 'Porsche newsroom, 2016: limited to 991 units. https://newsroom.porsche.com/en/products/porsche-911-r-geneva-international-motor-show-12266.html', firstYear: 2016 },
  { id: 'porsche-911-sport-classic', make: 'Porsche', model: '911 Sport Classic', built: 1250, builtSource: 'Porsche newsroom, 2022: 1,250 units. https://newsroom.porsche.com/en/2022/products/porsche-911-sport-classic-world-premiere-28164.html', firstYear: 2023 },
  { id: 'porsche-911-st', make: 'Porsche', model: '911 S/T', built: 1963, builtSource: 'Porsche newsroom, 2023: 1,963 units. https://newsroom.porsche.com/en_US/2023/products/new-porsche-911-ST-lightest-911-of-generation-33365.html', firstYear: 2024 },
  { id: 'porsche-911-dakar', make: 'Porsche', model: '911 Dakar', built: 2500, builtSource: 'Porsche newsroom, 2022: 2,500 units. https://newsroom.porsche.com/en/2022/products/porsche-911-dakar-world-premiere-auto-show-los-angeles-30421.html', firstYear: 2023 },
  { id: 'porsche-911-gt3-rs', make: 'Porsche', model: '911 GT3 RS', built: null, builtSource: null, firstYear: 2003 },
  { id: 'porsche-911-gt3', make: 'Porsche', model: '911 GT3', built: null, builtSource: null, firstYear: 1999 },
  { id: 'porsche-911-gt2-rs', make: 'Porsche', model: '911 GT2 RS', built: null, builtSource: null, firstYear: 2010 },
  { id: 'porsche-911-turbo-s', make: 'Porsche', model: '911 Turbo S', built: null, builtSource: null, firstYear: null },
  { id: 'porsche-taycan-turbo-gt', make: 'Porsche', model: 'Taycan Turbo GT', built: null, builtSource: null, firstYear: 2025 },
  { id: 'porsche-718-cayman-gt4-rs', make: 'Porsche', model: '718 Cayman GT4 RS', built: null, builtSource: null, firstYear: 2022 },
  // Koenigsegg, Pagani, Rimac and other hypercars
  { id: 'koenigsegg-jesko', make: 'Koenigsegg', model: 'Jesko', built: 125, builtSource: 'Koenigsegg: Jesko Attack and Absolut, 125 cars combined. https://www.koenigsegg.com/model/jesko-attack', firstYear: 2022 },
  { id: 'koenigsegg-regera', make: 'Koenigsegg', model: 'Regera', built: 80, builtSource: 'Koenigsegg: limited to 80. https://www.koenigsegg.com/model/regera', firstYear: 2016 },
  { id: 'koenigsegg-gemera', make: 'Koenigsegg', model: 'Gemera', built: 300, builtSource: 'Koenigsegg: limited to 300 (planned). https://www.koenigsegg.com/model/gemera', firstYear: 2025 },
  { id: 'pagani-huayra', make: 'Pagani', model: 'Huayra', built: 100, builtSource: 'Pagani: 100 Huayra coupes. https://www.pagani.com/huayra/', firstYear: 2011 },
  { id: 'pagani-huayra-bc', make: 'Pagani', model: 'Huayra BC', built: 20, builtSource: 'Pagani: 20 cars, sold out (as reported by Carscoops). https://www.carscoops.com/2016/03/pagani-huayra-bc-is-finally-on/', firstYear: 2016 },
  { id: 'pagani-utopia', make: 'Pagani', model: 'Utopia', built: 99, builtSource: 'Pagani: Utopia coupe limited to 99. https://www.pagani.com/press/pagani-automobili-celebrates-its-25th-anniversary-with-the-utopia-at-monterey-car-week-2023/', firstYear: 2023 },
  { id: 'rimac-nevera', make: 'Rimac', model: 'Nevera', built: 71, builtSource: 'Road & Track, 2026: production ended at 71 (51 Nevera, 20 Nevera R); announced cap was 150. https://www.roadandtrack.com/news/a74413636/rimac-is-reportedly-ending-nevera-production-after-selling-just-71-cars/', firstYear: 2021 },
  { id: 'mercedes-amg-one', make: 'Mercedes-AMG', model: 'One', built: 275, builtSource: 'Mercedes-Benz Media: 275 customer vehicles. https://media.mercedes-benz.com/en/article/5c13627c-7ecb-473b-95cf-f014aff14dfa', firstYear: 2022 },
  { id: 'mercedes-slr-stirling-moss', make: 'Mercedes-Benz', model: 'SLR Stirling Moss', built: 75, builtSource: 'Mercedes-Benz press information, 19 Dec 2008: limited to 75. https://mercedes-benz-publicarchive.com/marsClassic/en/instance/print/Press-Information-December-19-2008.xhtml?oid=184882425', firstYear: 2009 },
  { id: 'aston-martin-valkyrie', make: 'Aston Martin', model: 'Valkyrie', built: 150, builtSource: 'Aston Martin: 150 coupes. https://www.astonmartin.com/en/our-world/news/2021/11/4/first-aston-martin-valkyrie-customer-car-complete', firstYear: 2021 },
  { id: 'aston-martin-valhalla', make: 'Aston Martin', model: 'Valhalla', built: 999, builtSource: 'Aston Martin: limited to 999 (planned). https://www.astonmartin.com/en/our-world/news/2024/12/11/valhalla-the-ultimate-drivers-supercar', firstYear: 2025 },
  { id: 'aston-martin-one-77', make: 'Aston Martin', model: 'One-77', built: 77, builtSource: 'Aston Martin: 77 examples. https://www.astonmartin.com/en/models/past-models/one-77', firstYear: 2009 },
  { id: 'gma-t50', make: 'Gordon Murray', model: 'T.50', built: 100, builtSource: 'Gordon Murray Automotive: 100 road cars. https://www.gordonmurray.com/automotive/t50', firstYear: 2022 },
  { id: 'czinger-21c', make: 'Czinger', model: '21C', built: 80, builtSource: 'Czinger: production limited to 80. https://www.czinger.com/news/6', firstYear: 2023 },
  { id: 'lotus-evija', make: 'Lotus', model: 'Evija', built: 130, builtSource: 'Lotus: limited to 130 (planned). https://www.lotuscars.com/en/evija', firstYear: 2023 },
  { id: 'ssc-tuatara', make: 'SSC', model: 'Tuatara', built: 100, builtSource: 'SSC North America: 100 road cars planned. https://sscnorthamerica.com/news/2020-tuatara-debut', firstYear: 2020 },
  { id: 'hennessey-venom-f5', make: 'Hennessey', model: 'Venom F5', built: 24, builtSource: 'Hennessey: Venom F5 Coupe limited to 24, sold out. https://www.hennesseyperformance.com/news/article/hennessey-announces-venom-f5-hypercar-is-sold-out/', firstYear: 2021 },
  { id: 'maserati-mc12', make: 'Maserati', model: 'MC12', built: 50, builtSource: 'Maserati: 50 MC12 Stradale road cars. https://www.maserati.com/global/en/brand/maserati-classic-cars/post-war-racing-cars/mc12', firstYear: 2004 },
  { id: 'jaguar-xj220', make: 'Jaguar', model: 'XJ220', built: 275, builtSource: 'Jaguar media, 2012: 275 built. https://media.jlr.com/archive-jaguar/en-gb/news/2012/01/marking-20-years-launch-jaguar-xj220', firstYear: 1992 },
  { id: 'lexus-lfa', make: 'Lexus', model: 'LFA', built: 500, builtSource: 'Toyota: LFA 500-unit run completed. https://global.toyota/en/detail/95770', firstYear: 2010 },
  { id: 'bmw-3-0-csl-2023', make: 'BMW', model: '3.0 CSL (2023)', built: 50, builtSource: 'BMW M: 50 numbered cars. https://www.bmw-m.com/en/topics/magazine-article-pool/the-bmw-3-0-csl-from-2023.html', firstYear: 2023 },
  // American
  { id: 'ford-gt-2017', make: 'Ford', model: 'GT (2017)', built: 1350, builtSource: 'Ford media, Oct 2018: production extended to 1,350. https://media.ford.com/content/fordmedia/feu/en/news/2018/10/18/ford-gt-production-extended-to-satisfy-exceptional-demand.html', firstYear: 2017 },
  { id: 'ford-gt-2005', make: 'Ford', model: 'GT (2005)', built: 4038, builtSource: 'Autoweek: Wixom built 4,038 GTs (2005-2006). https://www.autoweek.com/news/a2070806/end-line-ford-builds-last-gt/', firstYear: 2005 },
  { id: 'dodge-challenger-srt-demon', make: 'Dodge', model: 'Challenger SRT Demon', built: 3300, builtSource: 'Stellantis Media: 3,000 for the U.S. and 300 for Canada. https://media.stellantisnorthamerica.com/newsrelease.do?id=18679&mid=', firstYear: 2018 },
  { id: 'acura-nsx-type-s', make: 'Acura', model: 'NSX Type S', built: 350, builtSource: 'Acura newsroom, Aug 2021: limited to 350 units. https://acuranews.com/en-US/releases/release-f8bfb43dd94cc82c09a8314c0b0a9a34-2022-acura-nsx-revealed-at-monterey-car-week', firstYear: 2022 },
  { id: 'chevrolet-corvette-zr1', make: 'Chevrolet', model: 'Corvette ZR1', built: null, builtSource: null, firstYear: 2025 },
  { id: 'chevrolet-corvette-z06', make: 'Chevrolet', model: 'Corvette Z06', built: null, builtSource: null, firstYear: 2023 },
  { id: 'chevrolet-corvette-e-ray', make: 'Chevrolet', model: 'Corvette E-Ray', built: null, builtSource: null, firstYear: 2024 },
  { id: 'ford-mustang-shelby-gt500', make: 'Ford', model: 'Mustang Shelby GT500', built: null, builtSource: null, firstYear: 2020 },
  // Other series supercars
  { id: 'audi-r8', make: 'Audi', model: 'R8', built: null, builtSource: null, firstYear: 2006 },
  { id: 'mercedes-amg-gt-black-series', make: 'Mercedes-AMG', model: 'GT Black Series', built: null, builtSource: null, firstYear: 2021 },
  { id: 'mercedes-sls-amg', make: 'Mercedes-Benz', model: 'SLS AMG', built: null, builtSource: null, firstYear: 2011 },
  { id: 'nissan-gt-r-nismo', make: 'Nissan', model: 'GT-R NISMO', built: null, builtSource: null, firstYear: 2015 },
  { id: 'maserati-mc20', make: 'Maserati', model: 'MC20', built: null, builtSource: null, firstYear: 2022 },
  { id: 'acura-nsx', make: 'Acura', model: 'NSX', built: null, builtSource: null, firstYear: 2017 },
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
