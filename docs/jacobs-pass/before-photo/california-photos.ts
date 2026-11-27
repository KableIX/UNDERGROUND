import type { CuratedRun } from './curated-runs';

export const catalogPhotos: Partial<Record<string, Pick<CuratedRun, 'cover' | 'photo'>>> = {
  M01: {
    cover: require('../../assets/runs/catalog-m01.jpg'),
    photo: {"author": "", "source": "", "license": "", "caption": "Bixby Creek Bridge on the Big Sur coast."} ,
  },
  M02: {
    cover: require('../../assets/runs/catalog-m02.jpg'),
    photo: {"author": "", "source": "", "license": "", "caption": "McWay Falls and the cove at Julia Pfeiffer Burns State Park."} ,
  },
  M03: {
    cover: require('../../assets/runs/catalog-m03.jpg'),
    photo: {"author": "Eric Polk", "source": "https://commons.wikimedia.org/wiki/File:Ragged_Point.jpg", "license": "CC BY-SA 4.0", "caption": "The coast at Ragged Point."} ,
  },
  M04: {
    cover: require('../../assets/runs/catalog-m04.jpg'),
    photo: {"author": "David Balmer", "source": "https://commons.wikimedia.org/wiki/File:Carmel_Valley_-_panoramio.jpg", "license": "CC BY 3.0", "caption": "Carmel Valley, Monterey County."} ,
  },
  M05: {
    cover: require('../../assets/runs/catalog-m05.jpg'),
    photo: {"author": "Ken Lund", "source": "https://commons.wikimedia.org/wiki/File:Carmel_Valley,_California.jpg", "license": "CC BY-SA 2.0", "caption": "Carmel Valley at the southern end of the Grade corridor."} ,
  },
  M06: {
    cover: require('../../assets/runs/catalog-m06.jpg'),
    photo: {"author": "Gateman1997 (talk)", "source": "https://commons.wikimedia.org/wiki/File:LagunaSecaMay08.jpg", "license": "CC BY-SA 3.0", "caption": "Laguna Seca, the nearby landmark. The drive uses public approach roads."} ,
  },
  H02: {
    cover: require('../../assets/runs/catalog-h02.jpg'),
    photo: {"author": "AWBridges", "source": "https://commons.wikimedia.org/wiki/File:Point_Montara_Panorama.jpg", "license": "CC BY-SA 3.0", "caption": "Point Montara and the San Mateo coast."} ,
  },
  H04: {
    cover: require('../../assets/runs/catalog-h04.jpg'),
    photo: {"author": "", "source": "", "license": "", "caption": "Pigeon Point Light Station."} ,
  },
  H05: {
    cover: require('../../assets/runs/catalog-h05.jpg'),
    photo: {"author": "Elaine with Grey Cats from California, USA", "source": "https://commons.wikimedia.org/wiki/File:Shark_Tooth_Rock_%26_Davenport_Beach.jpg", "license": "CC BY-SA 2.0", "caption": "Davenport Beach and Shark Tooth Rock."} ,
  },
  S02: {
    cover: require('../../assets/runs/catalog-s02.jpg'),
    photo: {"author": "Famartin", "source": "https://commons.wikimedia.org/wiki/File:2025-08-09_07_46_35_Coast_Redwood_grove_along_Bear_Creek_Road_in_Boulder_Creek,_Santa_Cruz_County,_California.jpg", "license": "CC BY-SA 4.0", "caption": "Coast redwoods at the Boulder Creek end of the Highway 9 descent."} ,
  },
  S03: {
    cover: require('../../assets/runs/catalog-s03.jpg'),
    photo: {"author": "Jawed Karim (talk · contribs)", "source": "https://commons.wikimedia.org/wiki/File:San_Francisco_Bay_Area_Skyline_Blvd.jpg", "license": "CC BY-SA 3.0", "caption": "Skyline Boulevard on the Peninsula."} ,
  },
  S09: {
    cover: require('../../assets/runs/catalog-s09.jpg'),
    photo: {"author": "Drew Stephens from Arlington, VA", "source": "https://commons.wikimedia.org/wiki/File:Huckleberry_Flat_picnic_area_(3172631077).jpg", "license": "CC BY-SA 2.0", "caption": "Huckleberry Flat in the Pescadero Creek corridor."} ,
  },
  C01: {
    cover: require('../../assets/runs/catalog-c01.jpg'),
    photo: {"author": "Eugene Zelenko", "source": "https://commons.wikimedia.org/wiki/File:USA-CA-Beach_near_State_Route_1-Bonny_Doon_Road_Intersection-3.jpg", "license": "CC BY-SA 4.0", "caption": "Coast at the Highway 1 and Bonny Doon Road junction."} ,
  },
  C02: {
    cover: require('../../assets/runs/catalog-c02.jpg'),
    photo: {"author": "Famartin", "source": "https://commons.wikimedia.org/wiki/File:2025-08-10_15_39_15_Coast_Redwoods_five_years_after_the_CZU_Lightning_Complex_fires_along_the_Redwood_Loop_Trail_within_Big_Basin_Redwoods_State_Park_in_Santa_Cruz_County,_California.jpg", "license": "CC BY-SA 4.0", "caption": "Coast redwoods in Big Basin."} ,
  },
  C03: {
    cover: require('../../assets/runs/catalog-c03.jpg'),
    photo: {"author": "Brocken Inaglory", "source": "https://commons.wikimedia.org/wiki/File:Rock_formations_at_Pinnacles_National_Park.jpg", "license": "CC BY-SA 3.0", "caption": "Rock formations at Pinnacles National Park."} ,
  },
  C04: {
    cover: require('../../assets/runs/catalog-c04.jpg'),
    photo: {"author": "The original uploader was Pillsbur at English Wikipedia.", "source": "https://commons.wikimedia.org/wiki/File:CA25_SanBenito.JPG", "license": "CC BY-SA 3.0", "caption": "Highway 25 in San Benito County."} ,
  },
  N01: {
    cover: require('../../assets/runs/catalog-n01.jpg'),
    photo: {"author": "MARELBU", "source": "https://commons.wikimedia.org/wiki/File:Stinson_Beach,_CA_-_panoramio_(2).jpg", "license": "CC BY 3.0", "caption": "Stinson Beach on the Marin coast."} ,
  },
  N02: {
    cover: require('../../assets/runs/catalog-n02.jpg'),
    photo: {"author": "Oleg Alexandrov", "source": "https://commons.wikimedia.org/wiki/File:Tomales_Bay_as_viewed_from_Tomales_Point_Trail_4.JPG", "license": "CC BY-SA 3.0", "caption": "Tomales Bay from the Point Reyes side."} ,
  },
  N03: {
    cover: require('../../assets/runs/catalog-n03.jpg'),
    photo: {"author": "Frank Schulenburg", "source": "https://commons.wikimedia.org/wiki/File:Fog_rolling_over_Arched_Rock.jpg", "license": "CC BY-SA 3.0", "caption": "Fog drifts over Arched Rock on the Sonoma Coast."} ,
  },
  N04: {
    cover: require('../../assets/runs/catalog-n04.jpg'),
    photo: {"author": "Babbage", "source": "https://commons.wikimedia.org/wiki/File:Coast_around_Fort_Ross.JPG", "license": "CC BY-SA 3.0", "caption": "The coastline around Fort Ross."} ,
  },
  N05: {
    cover: require('../../assets/runs/catalog-n05.jpg'),
    photo: {"author": "Lanthanum57", "source": "https://commons.wikimedia.org/wiki/File:The_estuary_of_the_Russian_River.jpg", "license": "CC BY-SA 3.0", "caption": "The Russian River estuary at Jenner."} ,
  },
  CR02: {
    cover: require('../../assets/runs/catalog-cr02.jpg'),
    photo: {"author": "Tony Hisgett from Birmingham, UK", "source": "https://commons.wikimedia.org/wiki/File:Cannery_Row_2_(15398349067).jpg", "license": "CC BY 2.0", "caption": "Cannery Row, Monterey."} ,
  },
  CR03: {
    cover: require('../../assets/runs/catalog-cr03.jpg'),
    photo: {"author": "btwashburn", "source": "https://commons.wikimedia.org/wiki/File:Harrison_Memorial_Library,_Carmel.jpg", "license": "CC BY 2.0", "caption": "Harrison Memorial Library on Ocean Avenue in Carmel."} ,
  },
  CR04: {
    cover: require('../../assets/runs/catalog-cr04.jpg'),
    photo: {"author": "Guy Kawasaki", "source": "https://commons.wikimedia.org/wiki/File:Pebble_Beach_Concours_2016-13.jpg", "license": "CC BY-SA 4.0", "caption": "A car on display at the 2016 Pebble Beach Concours."} ,
  },
  CR05: {
    cover: require('../../assets/runs/catalog-cr05.jpg'),
    photo: {"author": "Intothewoods29 (talk)", "source": "https://commons.wikimedia.org/wiki/File:Under_the_Santa_Cruz_Wharf.JPG", "license": "CC BY-SA 3.0", "caption": "Below the Santa Cruz Wharf."} ,
  },
  CR06: {
    cover: require('../../assets/runs/catalog-cr06.jpg'),
    photo: {"author": "Mertbiol", "source": "https://commons.wikimedia.org/wiki/File:El_Granada_and_Pilar_Pont_Harbor.jpg", "license": "CC0", "caption": "Pillar Point Harbor at Half Moon Bay."} ,
  },
  CR07: {
    cover: require('../../assets/runs/catalog-cr07.jpg'),
    photo: {"author": "Allie Caulfield", "source": "https://commons.wikimedia.org/wiki/File:Valencia_Hotel,_Santana_Row,_SJ_03.jpg", "license": "CC BY 2.0", "caption": "Hotel Valencia on Santana Row."} ,
  },
  P02: {
    cover: require('../../assets/runs/catalog-p02.jpg'),
    photo: {"author": "Dicklyon", "source": "https://commons.wikimedia.org/wiki/File:Central_Expressway_approaching_Lawrence.jpg", "license": "CC BY-SA 4.0", "caption": "Central Expressway approaching Lawrence in the Santa Clara Valley."} ,
  },
  P03: {
    cover: require('../../assets/runs/catalog-p03.jpg'),
    photo: {"source": "https://commons.wikimedia.org/wiki/File:Lawrence_and_Central_at_Sunnyvale-Santa_Clara_border.jpg", "author": "Dicklyon", "license": "CC BY-SA 4.0", "caption": "The Central and Lawrence expressway junction on the Sunnyvale–Santa Clara border."} ,
  },
  P04: {
    cover: require('../../assets/runs/catalog-p04.jpg'),
    photo: {"author": "BrokenSphere", "source": "https://commons.wikimedia.org/wiki/File:Bell_on_El_Camino_Real,_Santa_Clara.JPG", "license": "CC BY 3.0", "caption": "An El Camino Real bell in Santa Clara."} ,
  },
  S05: {
    cover: require('../../assets/runs/catalog-s05.jpg'),
    photo: {"author": "Thomson200", "source": "https://commons.wikimedia.org/wiki/File:CA_35_in_Sky_Londa,_August_2019.jpg", "license": "CC0", "caption": "Skyline Boulevard at Sky Londa, the crossing on this drive."} ,
  },
  M07: {
    cover: require('../../assets/runs/catalog-m07.jpg'),
    photo: {"author": "Adbar", "source": "https://commons.wikimedia.org/wiki/File:CA_SR-198_Coalinga.jpg", "license": "CC BY-SA 3.0", "caption": "Highway 198 near Coalinga."},
  },
  CC16: {
    cover: require('../../assets/runs/catalog-cc16.jpg'),
    photo: {"author": "Antandrus at English Wikipedia", "source": "https://commons.wikimedia.org/wiki/File:Hwy58TemblorRange.jpg", "license": "CC BY-SA 3.0", "caption": "Highway 58 in the Temblor Range."},
  },
  SD15: {
    cover: require('../../assets/runs/catalog-sd15.jpg'),
    photo: {"author": "Z3lvs", "source": "https://commons.wikimedia.org/wiki/File:Rocky_overlook_toward_an_arid_basin_and_layered_mountains,_San_Diego_County,_California.jpg", "license": "CC0", "caption": "Desert views from the Laguna Mountains."},
  },
  NC12: {
    cover: require('../../assets/runs/catalog-nc12.jpg'),
    photo: {"author": "David Eppstein", "source": "https://commons.wikimedia.org/wiki/File:Navarro_River_Redwoods.jpg", "license": "CC BY-SA 3.0", "caption": "Navarro River Redwoods State Park."},
  },
  WC13: {
    cover: require('../../assets/runs/catalog-wc13.jpg'),
    photo: {"author": "Jeremybrooks (talk · contribs)", "source": "https://commons.wikimedia.org/wiki/File:Glory_Hole,_Lake_Berryessa.jpg", "license": "Public domain", "caption": "The spillway at Lake Berryessa near Monticello Dam."},
  },
  LA17: {
    cover: require('../../assets/runs/catalog-la17.jpg'),
    photo: {"author": "Adbar", "source": "https://commons.wikimedia.org/wiki/File:First_Mile_CA_23.JPG", "license": "CC BY-SA 3.0", "caption": "The coastal end of State Route 23."},
  },
  SH11: {
    cover: require('../../assets/runs/catalog-sh11.jpg'),
    photo: {"author": "Ken Lund", "source": "https://commons.wikimedia.org/wiki/File:Trinity_River_Highway_299.jpg", "license": "CC BY-SA 2.0", "caption": "The Trinity River along Highway 299."},
  },
  KS01: {
    cover: require('../../assets/runs/catalog-ks01.jpg'),
    photo: {"author": "Dsdugan", "source": "https://commons.wikimedia.org/wiki/File:17_23_231_byway.jpg", "license": "CC0", "caption": "Kings Canyon Scenic Byway."},
  },
  H06: {
    cover: require('../../assets/runs/catalog-h06.jpg'),
    photo: {"author": "Janna Layton", "source": "https://commons.wikimedia.org/wiki/File:Greyhound_Rock_Beach_looking_south.jpg", "license": "CC BY-SA 4.0", "caption": "Looking south from Greyhound Rock on the Davenport coast."},
  },
  LA13: {
    cover: require('../../assets/runs/catalog-la13.jpg'),
    photo: {"author": "Antandrus at English Wikipedia", "source": "https://commons.wikimedia.org/wiki/File:SR33-Pinos.JPG", "license": "CC BY-SA 3.0", "caption": "The mountain country along Highway 33."},
  },
  CR08: { cover: require('../../assets/runs/catalog-cr08.jpg'), photo: {"author": "Grendelkhan", "source": "https://commons.wikimedia.org/wiki/File:Campbell_water_tower,_aerial_view.jpg", "license": "CC BY-SA 4.0", "caption": "The water tower above downtown Campbell."} },
  CR09: { cover: require('../../assets/runs/catalog-cr09.jpg'), photo: {"author": "Ramkumar Menon", "source": "https://commons.wikimedia.org/wiki/File:Los_Gatos_theater.jpg", "license": "CC BY-SA 4.0", "caption": "The theatre on North Santa Cruz Avenue in Los Gatos."} },
  CR10: { cover: require('../../assets/runs/catalog-cr10.jpg'), photo: {"author": "Dicklyon", "source": "https://commons.wikimedia.org/wiki/File:Adobe_Creek_in_Los_Altos_Redwood_Grove.jpg", "license": "CC BY-SA 4.0", "caption": "Adobe Creek at Redwood Grove, near downtown Los Altos."} },
  CR11: { cover: require('../../assets/runs/catalog-cr11.jpg'), photo: {"author": "David Monniaux", "source": "https://commons.wikimedia.org/wiki/File:Iris_%26_B._Gerald_Cantor_Center_for_Visual_Arts,_Stanford,_California_-_20060728.jpg", "license": "CC BY-SA 3.0", "caption": "The Cantor Arts Center at Stanford."} },
  NC13: {
    cover: require('../../assets/runs/catalog-nc13.jpg'),
    photo: {
      author: 'Frank Schulenburg',
      license: 'CC BY-SA 4.0',
      source: 'https://commons.wikimedia.org/wiki/File:Point_Arena_Lighthouse,_Mendocino_County.jpg',
      caption: 'Point Arena Lighthouse beyond the route finish. Resized from the original.',
    },
  },
  N06: {
    cover: require('../../assets/runs/catalog-n06.jpg'),
    photo: { author: 'Sarah and Jason', license: 'CC BY-SA 2.0', source: 'https://commons.wikimedia.org/wiki/File:Gualala_Point_Regional_Park_-_S_and_J_01.jpg', caption: 'Gualala Point Regional Park. Resized from the original.' },
  },
};
