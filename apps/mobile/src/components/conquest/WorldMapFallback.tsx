import type {IntelWeather} from '../../lib/intel-weather';
import { CameraMarkerDetails } from './IntelMarker';
import {cameraImages} from '../../map-layers/camera-images';
import { cameraPins, regionBox, snapshot, cameraViewportMode, cameraDisplayPins, cameraViewportNote, cameraShieldSize, type CameraPin } from '../../map-layers/cameras';
import { useLayers } from '../../map-layers/controls';
import { type drawZones, zoneLabel } from '../../map-layers/history';
import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import type { MapLighting } from '../../lib/map-lighting';
import type { Region } from 'react-native-maps';
import { useStreetDetail } from './use-street-detail';
import { exploreRoutes } from '../../data/explore-routes';
import { Alert, Image, Platform, StyleSheet, View } from 'react-native';
import type { TerritoryDefinition } from '@underground/domain';
import { Text } from '@underground/ui';
import { probeReactNativeMapsModule } from '../../lib/native-module-probe';
import { shell } from '../../theme/shell';
import { startFinishForTerritory } from '../../lib/territory-geojson';
import { BeaconHighlights, type Highlight, type HighlightControls } from './BeaconHighlights';
import { MapBeacon, beaconAnchor, campusPoint, locationAnchor, locationCenterOffset } from './MapBeacon';
import { TacticalMapPlane } from '../TacticalMapPlane';

type Camera = { longitude: number; latitude: number; zoom: number };
type Props = {
  historyLines: ReturnType<typeof drawZones>;
  intelWeather?: IntelWeather[];
  onExploreRoute?: (slug: string) => void;
  territories: TerritoryDefinition[];
  selectedSlug: string | null;
  onSelect: (slug: string) => void;
  camera: Camera;
  lighting: MapLighting;
  onCenterChange: (center: { latitude: number; longitude: number }) => void;
  onPan?: () => void;
  badge: string;
  showTerritories: boolean;
  followUser: boolean;
  showUserLocation: boolean;
  userPosition: { longitude: number; latitude: number; accuracyM: number | null } | null;
  cameraRevision: number;
  approachLeg?: boolean;
  streetView?: boolean;
  fitCoordinates?: [number, number][];
};

type MapsModule = {
  default: ComponentType<Record<string, unknown>>;
  Polyline: ComponentType<Record<string, unknown>>;
  Marker: ComponentType<Record<string, unknown>>;
  PROVIDER_DEFAULT?: string;
};

/**
 * Apple MapKit basemap when Mapbox is not configured — real roads, world-wide pan/zoom.
 * Requires a custom dev client that linked react-native-maps.
 * Never render MapView from JS-only presence: that is Crash A (bubblingEventTypes of null).
 * Tactical plane is last-resort only for older IPAs missing the native module.
 */
export function WorldMapFallback({
  territories, selectedSlug, onSelect, onExploreRoute, camera, badge, showTerritories, followUser,
  showUserLocation, userPosition, cameraRevision, fitCoordinates, onPan, streetView, lighting, onCenterChange, approachLeg, historyLines, intelWeather,
}: Props) {
  const routePreview = !!fitCoordinates?.length;
  const [viewport, setViewport] = useState<Region | null>(null);
  const detail = useStreetDetail(viewport);
  const [maps, setMaps] = useState<MapsModule | null>(null);
  const [nativeMissing, setNativeMissing] = useState(false);
  const [ready, setReady] = useState(false);
  const lastFocus = useRef<{ revision: number; points: typeof fitCoordinates; streetView?: boolean } | null>(null);
  const highlightRef = useRef<HighlightControls>(null);
  const mapRef = useRef<{ pointForCoordinate: (coordinate: { latitude: number; longitude: number }) => Promise<{ x: number; y: number }>; setCamera: (camera: Record<string, unknown>) => void; animateToRegion: (region: Region, duration: number) => void; fitToCoordinates: (points: { longitude: number; latitude: number }[], options: Record<string, unknown>) => void } | null>(null);
  const routePoints = useMemo(() => fitCoordinates?.map(([longitude, latitude]) => ({ longitude, latitude })), [fitCoordinates]);
  const selected = territories.find(t => t.slug === selectedSlug);
  const endpoints = fitCoordinates?.length ? { start: fitCoordinates[0], finish: fitCoordinates[fitCoordinates.length - 1] } : selected ? startFinishForTerritory(selected) : null;
  const closed = endpoints?.start.every((v, i) => v === endpoints.finish[i]);
  const lat = userPosition?.latitude, lon = userPosition?.longitude;
  const highlights = useMemo(() => {
    const pins: Highlight[] = [];
    if (!showTerritories) pins.push({ id: 'campus', ...campusPoint });
    if (showUserLocation && lat != null && lon != null) pins.push({ id: 'you', latitude: lat, longitude: lon, location: true });
    if (showTerritories && fitCoordinates?.length) {
      const [startLon, startLat] = fitCoordinates[0];
      const [endLon, endLat] = fitCoordinates[fitCoordinates.length - 1];
      if (!approachLeg) pins.push({ id: 'start', latitude: startLat, longitude: startLon });
      if (approachLeg || startLat !== endLat || startLon !== endLon) pins.push({ id: 'finish', latitude: endLat, longitude: endLon });
    }
    return pins;
  }, [showTerritories, showUserLocation, lat, lon, fitCoordinates, approachLeg]);
  useEffect(() => {
    const probe = probeReactNativeMapsModule();
    if (!probe.usable) {
      setMaps(null);
      setNativeMissing(true);
      return;
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require('react-native-maps');
      if (mod?.default && mod?.Polyline) {
        setMaps(mod as MapsModule);
        setNativeMissing(false);
      } else {
        setMaps(null);
        setNativeMissing(true);
      }
    } catch {
      setMaps(null);
      setNativeMissing(true);
    }
  }, []);

  const region = useMemo(() => {
    if (!streetView && routePoints?.length) {
      const first = routePoints[0];
      let north = first.latitude, south = north, east = first.longitude, west = east;
      for (const point of routePoints) {
        north = Math.max(north, point.latitude);
        south = Math.min(south, point.latitude);
        east = Math.max(east, point.longitude);
        west = Math.min(west, point.longitude);
      }
      return { latitude: (north + south) / 2, longitude: (east + west) / 2,
        latitudeDelta: Math.max(0.006, (north - south) * 1.4), longitudeDelta: Math.max(0.006, (east - west) * 1.4) };
    }
    const delta = Math.max(0.005, Math.min(100, 30 / (2 ** (camera.zoom - 3))));
    return {
      latitude: camera.latitude,
      longitude: camera.longitude,
      latitudeDelta: delta,
      longitudeDelta: delta,
    };
  }, [camera.latitude, camera.longitude, camera.zoom, streetView, routePoints]);
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const previous = lastFocus.current;
    if (previous && previous.revision === cameraRevision && previous.points === fitCoordinates && previous.streetView === streetView) return;
    lastFocus.current = { revision: cameraRevision, points: fitCoordinates, streetView };
    if (!streetView && routePoints?.length) {
      mapRef.current.fitToCoordinates(routePoints, {
        edgePadding: { top: 75, right: 55, bottom: 75, left: 55 }, animated: false,
      });
    } else {
      mapRef.current.animateToRegion(region, 0);
    }
    mapRef.current.setCamera({ pitch: 42 });
  }, [ready, cameraRevision, fitCoordinates, streetView, routePoints, region]);

  const visibleRegion = viewport ?? region;
  const settings=useLayers();
  const box=useMemo(()=>regionBox(visibleRegion),[visibleRegion]);
  const cameraData=useMemo(()=>settings.plate||settings.speed?snapshot():null,[settings]);
  const allCameraPins=useMemo(()=>cameraPins(cameraData,box,settings),[cameraData,settings,box]);
  const pins=useMemo(()=>cameraDisplayPins(allCameraPins,box),[allCameraPins,box]);
  const cameraNote=cameraViewportNote(cameraViewportMode(box),allCameraPins.length,pins.length,!!cameraData);
  const shieldSize=cameraShieldSize(box,pins.length);
  const shieldHeight=Math.round(shieldSize*122/112);
  const [cameraDetail,setCameraDetail]=useState<CameraPin|null>(null);
  const visibleDrives = useMemo(() => {
    if (!onExploreRoute) return [];
    const { latitude, longitude, latitudeDelta, longitudeDelta } = visibleRegion;
    return exploreRoutes.features.filter(({ bbox: [west, south, east, north] }) =>
      east >= longitude - longitudeDelta / 2 && west <= longitude + longitudeDelta / 2 &&
      north >= latitude - latitudeDelta / 2 && south <= latitude + latitudeDelta / 2
    ).map(({ properties, geometry }) => ({
      ...properties,
      points: geometry.coordinates.map(([longitude, latitude]) => ({ longitude, latitude })),
    }));
  }, [!!onExploreRoute, visibleRegion]);
  if (!maps) {
    return (
      <TacticalMapPlane
        territories={showTerritories ? territories : []}
        selectedSlug={selectedSlug}
        onSelect={onSelect}
        camera={camera}
        illuminated
        lighting={lighting}
        badge={badge}
        disclaimer={
          nativeMissing
            ? 'APPLE MAPKIT NOT LINKED IN THIS DEV CLIENT · INSTALL NEW IOS BUILD FOR REAL ROADS'
            : 'MAP SDK NOT INSTALLED IN THIS DEV CLIENT · NEW IOS BUILD REQUIRED'
        }
      />
    );
  }

  const MapView = maps.default;
  const Polyline = maps.Polyline;
  const Marker = maps.Marker;
  // Explicit Apple/default provider — never PROVIDER_GOOGLE on iOS (New Arch AIRGoogleMap crash).
  const provider = maps.PROVIDER_DEFAULT;

  return (
    <View style={styles.root}>
      <MapView
        ref={mapRef}
        onMapReady={() => setReady(true)}
        onRegionChange={() => highlightRef.current?.refresh()}
        onRegionChangeComplete={(next: Region) => {
          highlightRef.current?.refresh();
          setViewport(next);
          onCenterChange(next);
        }}
        style={StyleSheet.absoluteFill}
        provider={provider}
        initialRegion={region}
        showsUserLocation={showUserLocation}
        followsUserLocation={followUser}
        onPanDrag={onPan}
        showsMyLocationButton={false}
        showsCompass
        mapType={Platform.OS === 'ios' ? 'hybridFlyover' : 'hybrid'}
        userInterfaceStyle="dark"
        showsPointsOfInterest={false}
        showsBuildings
        rotateEnabled
        pitchEnabled
        scrollEnabled
        zoomEnabled
        accessibilityLabel="UNDERGROUND full geographic road map"
      >
        {detail.map(line => <Polyline key={line.id} coordinates={line.points}
          strokeColor={line.road ? '#DC9049' : '#546B80'} strokeWidth={line.road ? 2.4 : 1.1} />)}
        {historyLines.map(z=><Polyline key={'checks-'+z.start_m} coordinates={z.coords.map(([longitude,latitude])=>({longitude,latitude}))}
          strokeColor="#B89356C2" strokeWidth={13} tappable onPress={()=>Alert.alert('Recurring speed checks',zoneLabel(z))}/>)}
        {pins.map(p=><Marker key={p.id} identifier={p.id} coordinate={{latitude:p.lat,longitude:p.lon}}
          anchor={{x:.5,y:.96}} title={p.title} description={p.detail} onPress={()=>setCameraDetail(p)}>
          <View style={{width:shieldSize,height:shieldHeight,alignItems:'center',justifyContent:'center'}}>
            <View style={{position:'absolute',bottom:3,width:9,height:9,borderRadius:5,borderWidth:1,borderColor:'#101820',backgroundColor:p.kind==='speed'?'#FFBF56':'#8DDBFF'}}/>
            <Image source={cameraImages[p.marker]} resizeMode="contain" style={{width:shieldSize,height:shieldHeight}}/>
          </View>
        </Marker>)}
        {visibleDrives.map(drive => <Polyline key={'drive-' + drive.slug}
          coordinates={drive.points} strokeColor="#76FF03" strokeWidth={5}
          lineCap="round" lineJoin="round" tappable onPress={() => onExploreRoute?.(drive.slug)} />)}
        {visibleRegion.latitudeDelta < 0.22 && visibleDrives.map(drive =>
          <Marker key={'label-' + drive.slug} coordinate={drive.points[Math.floor(drive.points.length / 2)]}
            onPress={() => onExploreRoute?.(drive.slug)} accessibilityLabel={drive.name}>
            <View style={{ backgroundColor: '#10200B', borderRadius: 5, paddingHorizontal: 6, paddingVertical: 3 }}>
              <Text style={{ color: '#E9FFDC', fontSize: 12 }}>{drive.name}</Text>
            </View>
          </Marker>)}
        {!showTerritories ? <Marker identifier="nvidia-campus" coordinate={campusPoint} anchor={beaconAnchor} centerOffset={{ x: 18, y: -18 }}>
          <MapBeacon label="NVIDIA Campus" />
        </Marker> : null}
        {showUserLocation && userPosition ? (
          <Marker
            identifier="underground-live-position"
            coordinate={{ latitude: userPosition.latitude, longitude: userPosition.longitude }}
            title="Your current location"
            description={userPosition.accuracyM == null ? 'GPS fix' : `GPS accuracy approximately ${Math.round(userPosition.accuracyM)} meters`}
            centerOffset={locationCenterOffset}
            anchor={locationAnchor}
          >
            <MapBeacon location label="You" />
          </Marker>
        ) : null}
        {showTerritories && fitCoordinates ? [18, 11, 5, 2].map((width, i) => (
          <Polyline key={width} coordinates={routePoints}
            strokeWidth={width} strokeColor={['rgba(118,255,3,0.12)', 'rgba(118,255,3,0.30)', '#76FF03', '#DCFFB8'][i]}
            lineCap="round" lineJoin="round" />
        )) : null}
        {showTerritories ? territories.map(t => (
          <Polyline
            key={t.slug}
            coordinates={t.geometry.coordinates.map(([lng, lat]) => ({
              latitude: lat,
              longitude: lng,
            }))}
            strokeColor={fitCoordinates ? '#E9FFD5' : t.slug === selectedSlug ? shell.accent : 'rgba(197,165,114,0.60)'}
            strokeWidth={fitCoordinates ? 3 : t.slug === selectedSlug ? 5 : 2}
            tappable
            onPress={() => onSelect(t.slug)}
          />
        )) : null}
        {fitCoordinates && !approachLeg && intelWeather?.flatMap(a=>a.segments.map((coords,i)=><Polyline
          key={'intel-weather-'+a.id+':'+i} coordinates={coords.map(([longitude,latitude])=>({longitude,latitude}))}
          strokeColor="#BEA2FF" strokeWidth={4} lineDashPattern={[8,8]} lineCap="round"/>))}
        {showTerritories && endpoints ? [
          ...(!approachLeg ? [{ role: closed ? 'START / FINISH' : 'START', point: endpoints.start, color: '#7CFFB2' }] : []),
          ...(!closed ? [{ role: approachLeg ? 'MEETUP' : 'FINISH', point: endpoints.finish, color: '#D0B88F' }] : []),
        ].map(endpoint => (
          <Marker key={endpoint.role} identifier={endpoint.role}
            coordinate={{ longitude: endpoint.point[0], latitude: endpoint.point[1] }}
            title={fitCoordinates ? undefined : endpoint.role} description={fitCoordinates ? undefined : selected?.name}
            centerOffset={routePreview ? { x: 18, y: -18 } : undefined}
            anchor={routePreview ? beaconAnchor : { x: 0.5, y: 1 }} tracksViewChanges={routePreview}>
            {routePreview ? <MapBeacon label={endpoint.role} /> : (
            <View style={{ alignItems: 'center' }}>
              <View style={{ backgroundColor: '#08090A', borderColor: endpoint.color, borderWidth: 2, padding: 8, borderRadius: 5 }}>
                <Text style={{ color: endpoint.color, fontSize: 12, fontWeight: '700' }}>{endpoint.role}</Text>
              </View>
              <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: endpoint.color, borderWidth: 2, borderColor: '#08090A' }} />
            </View>
            )}
          </Marker>
        )) : null}
        {showTerritories ? territories.filter(t => t.slug !== selectedSlug).map(t => {
          const first = t.geometry.coordinates[0];
          if (!first) return null;
          return (
            <Marker
              key={`marker-${t.slug}`}
              coordinate={{ longitude: first[0], latitude: first[1] }}
              title={t.name}
              description="Unverified draft route"
              onPress={() => onSelect(t.slug)}
              pinColor={shell.accent}
            />
          );
        }) : null}
      </MapView>
      {cameraDetail && <CameraMarkerDetails pin={cameraDetail} onClose={()=>setCameraDetail(null)}/>}
      {/* A screen-space tint covers the pitched map during loading, panning and recentering. */}
      <View testID="map-solar-tint" pointerEvents="none" accessible={false} style={[StyleSheet.absoluteFill, { backgroundColor: lighting.tint }]} />
      {ready && lighting.daylight < 1 && <View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: 1 - lighting.daylight }]}>
        <BeaconHighlights map={mapRef} ref={highlightRef} pins={highlights} />
      </View>}
      {(settings.plate || settings.speed) && <View pointerEvents="none" style={{position:'absolute',left:8,bottom:26}}><Text style={{fontSize:11,color:'#D3F4FF',backgroundColor:'#131a22',padding:3}}>{cameraNote}</Text><Text style={{fontSize:9,color:'#ddd',backgroundColor:'#131a22'}}>© OpenStreetMap contributors · CA city data</Text></View>}
      {badge && !fitCoordinates ? <View pointerEvents="none" style={styles.badge}>
        <Text variant="caption" gold>{badge} · APPLE MAPS</Text>
      </View> : null}
      {detail.length > 0 ? <View pointerEvents="none" style={{ position: 'absolute', right: 4, bottom: 4, backgroundColor: '#0B121D' }}>
        <Text style={{ fontSize: 9, color: '#BBC7D3' }}>OpenFreeMap {'\u00b7'} OpenMapTiles {'\u00b7'} {'\u00a9'} OpenStreetMap</Text>
      </View> : null}
      {showTerritories && !fitCoordinates ? (
        <View pointerEvents="none" style={styles.draft}>
          <Text variant="caption" style={styles.draftText}>
            {fitCoordinates ? 'ROAD PREVIEW · GPS GATES UNVERIFIED' : 'DRAFT ROUTES · NOT ROAD-SNAPPED · NO PRODUCTION CAPTURES'}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  locationRing: { width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, borderColor: '#73E8DB', backgroundColor: 'rgba(32,154,153,0.32)', alignItems: 'center', justifyContent: 'center' },
  locationDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: '#C2FFF7' },
  root: { flex: 1, backgroundColor: shell.mapVoid },
  badge: {
    position: 'absolute', top: 12, left: 12, paddingHorizontal: 10, paddingVertical: 6,
    backgroundColor: 'rgba(5,7,12,0.80)',
  },
  draft: {
    position: 'absolute', bottom: 12, left: 12, right: 12, padding: 8,
    backgroundColor: 'rgba(5,7,12,0.82)',
  },
  draftText: { color: shell.muted, textAlign: 'center' },
});
