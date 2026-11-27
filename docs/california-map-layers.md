# California map layers

California is the supported geography, including rural counties, islands and border areas. Keep ingestion, attribution and verification statewide when adding a feed. The Saratoga club route is a regression fixture. Both map renderers read the same offline index. A missing point means coverage is unknown.

## Beta

In Explore, open map options then Map layers. Route previews offer Layers directly. Navigation keeps the control in the expandable drive panel. Settings carry through navigation for the current app session. Both camera layers and member history start off.

The iOS development client opens through [Aphrodite](https://aphrodite.tail32f2e6.ts.net:18443/_expo/link?choice=expo-dev-client&platform=ios) on the tailnet. Use the installed UNDERGROUND development build. To test the Saratoga loop, open its preview, choose Layers, enable a category, then zoom to a street. Toggle both off, enter navigation and check that route, start and finish stay visible. Test on an iPhone while parked or as a passenger.

## Camera index

Run `python scripts/refresh-california-cameras.py` from the checkout before a data refresh. It downloads the sources into the generator, filters against the Census California polygon, and replaces the bundled JSON only after every source validates. The application reads the last published snapshot offline. The date in the layer picker is the retrieval date. No client GPS coordinates are sent to these vendors. OSM points can have unknown manufacturers. A city listing or prior citation does not establish operating status. Some SFMTA sites have separate directional points.

- [FlockHopper open camera pipeline](https://github.com/flockhopper3/deflock-data) supplies the compressed US plate-reader GeoJSON. OpenStreetMap's statewide speed-camera nodes supplement city sources. Camera records from these feeds are © OpenStreetMap contributors, available under [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/). The machine-readable OSM records are included in the offline index with sources `reader` and `osm`.
- [San José DOT](https://geo.sanjoseca.gov/server/rest/services/DOT/DOT_TrafficSignalsParkingOpsLayers/MapServer/26), [SFMTA](https://data.sf.gov/Transportation/Automated-Speed-Enforcement-Citations/d5uh-bk84), [OakDOT](https://www.arcgis.com/home/item.html?id=b1661b60e154451fb63b155c95c157df), [LADOT](https://ladot.lacity.gov/speed-safety-system). Source codes are `sj`, `sf`, `oak`, and `la` respectively. The public programs in other jurisdictions may include sites missing from this snapshot.
- [US Census TIGERweb](https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer) supplies the state boundary.

## Member history

A member with an accurate, recent GPS match can record a speed check or patrol observation. On the disconnected development beta, personal observations are retained in SQLite on that phone. They stay separate from shared history and are never automatically published. On a membership-connected deployment, apply the existing route conditions migration and `supabase/migrations/20261116000001_california_speed_history.sql` to the linked beta database. Authenticated submissions then go through the existing route-conditions RPC.

Only speed checks count toward historical zones. A 500 m route segment qualifies after three different members report on three different Pacific dates within 90 days. The route preview summarizes qualifying segments, and tapping an amber segment shows observation days and the latest month. An unavailable membership backend leaves navigation and the camera layers usable. A patrol sighting cannot establish radar, lidar, or exhaust enforcement.
