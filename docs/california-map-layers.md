# California map layers

California is the supported camera geography, including rural counties, islands and border areas. Keep ingestion, attribution and verification statewide when adding a feed. The Saratoga club route is a regression fixture. Both map renderers read the same offline index. A missing point means coverage is unknown.

## Beta

In Explore, open map options then Map layers. Route previews offer Layers directly. Navigation keeps the control visible. Existing camera layers and historical observations remain enabled.

The iOS development client opens through [Aphrodite](https://aphrodite.tail32f2e6.ts.net:18443/_expo/link?choice=expo-dev-client&platform=ios) on the tailnet. Use the installed UNDERGROUND development build. To test the Saratoga loop, open its preview, choose Layers and zoom to a street. Enter navigation and check that route, start and finish stay visible. Test on an iPhone while parked or as a passenger.

## Camera index

Run `python scripts/refresh-california-cameras.py` from the checkout before a data refresh. It downloads the sources into the generator, filters against the Census California polygon, and replaces the bundled JSON only after every source validates. The application reads the last published snapshot offline. The date in the layer picker is the retrieval date. No client GPS coordinates are sent to these vendors. OSM points can have unknown manufacturers. A city listing or prior citation does not establish operating status. Some SFMTA sites have separate directional points.

- [FlockHopper open camera pipeline](https://github.com/flockhopper3/deflock-data) supplies the compressed US plate-reader GeoJSON. OpenStreetMap's statewide speed-camera nodes supplement city sources. Camera records from these feeds are © OpenStreetMap contributors, available under [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/). The machine-readable OSM records are included in the offline index with sources `reader` and `osm`.
- [San José DOT](https://geo.sanjoseca.gov/server/rest/services/DOT/DOT_TrafficSignalsParkingOpsLayers/MapServer/26), [SFMTA](https://data.sf.gov/Transportation/Automated-Speed-Enforcement-Citations/d5uh-bk84), [OakDOT](https://www.arcgis.com/home/item.html?id=b1661b60e154451fb63b155c95c157df), [LADOT](https://ladot.lacity.gov/speed-safety-system). Source codes are `sj`, `sf`, `oak`, and `la` respectively. The public programs in other jurisdictions may include sites missing from this snapshot.
- [US Census TIGERweb](https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer) supplies the state boundary.

## Member history

A member with an accurate, recent GPS match can record a speed check or patrol observation. On the disconnected development beta, personal observations are retained in SQLite on that phone. They stay separate from shared history and are never automatically published. On a membership-connected deployment, apply the existing route conditions migration and `supabase/migrations/20261116000001_california_speed_history.sql` to the linked beta database. Authenticated submissions then go through the existing route-conditions RPC.

Only speed checks count toward historical zones. A 500 m route segment qualifies after three different members report on three different Pacific dates within 90 days. The route preview summarizes qualifying segments, and tapping an amber segment shows observation days and the latest month. An unavailable membership backend leaves navigation and the camera layers usable. A patrol sighting cannot establish radar, lidar, or exhaust enforcement.


## Marker visual registry
Every existing snapshot pin now exposes the source URL, license information (or explicitly pending reuse review), source-reported operating status and snapshot date. OSM brand labels identify reported Flock records, not independently verified installations. The active optical scan and gold triple-wave animation run in the selected marker detail only, with reduce-motion support. Native static shields and dots appear at city and street scale. Dense views show at most 288 real representative records, with the visible/total count; zoom closer to see additional records. A camera's presence does not establish current enforcement. No new locations, live individual patrol feeds or patrol predictions were added. The radar and regional advisory badge components are presentation-only until a permitted, verified source is approved.

## Official weather preview
The limited INTEL API returns fresh NWS alert geometry clipped to saved routes (not approach navigation). Weather segments are violet dashes over the existing green route; a severe/extreme road-relevant alert gets a route-wide banner. Low-priority voice can play using an available device TTS voice only when driving the saved route away from an imminent turn and at least 20 seconds after another cue; ordinary guidance takes priority. No distance-to-hazard claims, push notification or live road incident publication are enabled. Actual device audio and animation need validation.

The map uses reference-style transparent artwork and a 72-100 point street-scale shield (density capped). City views scale down to preserve map legibility. The approved Explore wordmark omits the Drivers Club subtitle.

**Public-release hold:** San Jose DOT, SFMTA, OakDOT and LADOT reuse terms have not been cleared. Do not ship their records in a public application bundle or expose them through a public registry/API until rights are verified; a UI-only filter is insufficient for bundled data. The existing offline snapshot remains an internal beta dataset. No new data sources or publication permissions are introduced by this visual change.
