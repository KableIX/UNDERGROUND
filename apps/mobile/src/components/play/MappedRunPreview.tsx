import { DrivePhoto } from './DrivePhoto';
import { useEffect, useState } from 'react';
import { AppState, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@underground/ui';
import type { CuratedRun } from '../../data/curated-runs';
import { cedarGroveRoadReport, cedarGroveWinterClosure, routeAdvisories, winterNavigationPaused } from '../../data/route-advisories';
import { shell } from '../../theme/shell';
import { RouteRecords } from './RouteRecords';
import { DriveRouteMap } from './DriveRouteMap';
import { useFloridaAccess } from '../../lib/use-florida-access';
import { RoutePhotoCredit } from './RoutePhotoCredit';

type Props = { run: CuratedRun; route: NonNullable<CuratedRun['mapped']> };

export function MappedRunPreview({ run, route }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const id = run.catalog?.id;
  const isFlorida = run.catalog?.state === 'FL';
  const { access, checking, check } = useFloridaAccess(isFlorida);
  const preview = isFlorida && access !== 'inside';
  const [mirrored, setMirrored] = useState(false);
  const sequence = mirrored ? [...run.sequence].reverse() : run.sequence;
  const coordinates = mirrored ? [...route.coordinates].reverse() : route.coordinates;
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const refresh = () => setNow(Date.now());
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') refresh(); });
    const wait = cedarGroveWinterClosure - now;
    const timer = id === 'KS01' && wait > 0 ? setTimeout(refresh, Math.min(wait, 2147483647)) : undefined;
    return () => { subscription.remove(); if (timer !== undefined) clearTimeout(timer); };
  }, [id, now]);
  const paused = winterNavigationPaused(id, now);
  const notices = run.slug === 'jenner-to-point-arena' ? [...routeAdvisories('N04', now), ...routeAdvisories('N06', now)] : routeAdvisories(id ?? '', now);
  const [startLng, startLat] = coordinates[0];
  const [endLng, endLat] = coordinates[coordinates.length - 1];
  const loop = Math.abs(startLng - endLng) < 0.0001 && Math.abs(startLat - endLat) < 0.0001;
  const status = run.category === 'TEST' ? 'POC · DEVELOPMENT ONLY' : run.catalog?.status === 'official' ? 'OFFICIAL ' + run.category : run.category === 'CRUISE' ? 'CRUISE · DRAFT' :
    route.suitabilityReview ? 'RUN · SUITABILITY REVIEW' : 'RUN · DRAFT';
  return <View style={[styles.root, { paddingTop: insets.top }]}>
    <Pressable accessibilityRole="button" style={styles.back} onPress={() => router.canGoBack() ? router.back() : router.replace('/runs')}>
      <Text gold>‹  Back</Text>
    </Pressable>
    <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
      <View>
      <DriveRouteMap key={mirrored ? 'reverse' : 'forward'} routeId={run.slug} resultKind={run.category === 'TEST' ? undefined : run.category} activity={run.category === 'CRUISE' ? 'Cruise' : 'Run'} previewOnly={paused || preview || mirrored} verifyStart={isFlorida && !mirrored && !paused ? () => check(true) : undefined} title={run.title} coordinates={coordinates} maneuvers={mirrored ? undefined : route.maneuvers} signalGap={mirrored ? undefined : route.signalGap} />
      {!loop && <Pressable accessibilityRole="button" accessibilityLabel="Mirror route" accessibilityState={{selected: mirrored}} onPress={() => setMirrored(v => !v)} style={[styles.mirror, mirrored && styles.mirrorActive]}>
        <MaterialCommunityIcons name="swap-horizontal" size={23} color={mirrored ? '#17150F' : '#E7C892'} />
        <Text style={[styles.mirrorText, mirrored && {color:'#17150F'}]}>MIRROR</Text>
      </Pressable>}
      </View>
      <View style={styles.body}>
        <View style={styles.cover}>
          {run.cover && <DrivePhoto source={run.cover} label={run.photo?.caption} />}
          <Text accessibilityRole="header" style={styles.title}>{run.title}</Text>
        </View>
        <Text style={styles.accent}>{run.catalog?.id ? run.catalog.id + ' · ' : ''}{status}{run.catalog?.tier ? ' · TIER ' + run.catalog.tier + '/5' : ''}</Text>
        <Text style={styles.distance}>{(route.distanceMeters / 1609.344).toFixed(1)} mi · {loop ? 'Loop' : 'One way'}</Text>
        {run.category !== 'TEST' && <RouteRecords route={run.slug} cruise={run.category === 'CRUISE'} />}
        <Text style={styles.copy}>{run.subtitle}</Text>
        <Text style={styles.note}>{Math.round(route.durationSeconds / 60)} min estimated driving ? {sequence.length} stops</Text>
        <Text gold>{sequence[0]} ? {sequence[sequence.length - 1]}</Text>
        {mirrored && <Text style={styles.note}>Reverse preview only. Navigation is unavailable until reverse road routing is validated.</Text>}
        {(id === 'N04' || id === 'N06') && <Pressable accessibilityRole="button" style={styles.locationButton} onPress={() => router.push('/runs/jenner-to-point-arena')}>
          <Text gold>Drive both Runs from Jenner to Point Arena</Text>
        </Pressable>}
        {id === 'KS01' && <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(cedarGroveRoadReport)}>
          <Text style={styles.copy}>{paused ? 'Seasonal preview · Navigation paused pending confirmation of the Cedar Grove reopening.' : 'Seasonal Cruise · NPS scheduled the Cedar Grove winter closure for November 13, 2026.'}</Text>
          <Text style={styles.credit}>National Park Service road report</Text>
        </Pressable>}
        {preview && <View style={styles.locationCard}>
          <Text style={styles.label}>Florida preview</Text>
          <Text style={styles.copy}>{access === 'away' ? 'Navigation unlocks in Florida. You can explore the whole route from here.' : access === 'denied' ? 'Allow foreground location in Settings to unlock navigation when you are in Florida.' : 'Confirm your location in Florida to unlock navigation.'}</Text>
          <Pressable accessibilityRole="button" style={styles.locationButton} disabled={checking}
            onPress={() => access === 'denied' ? void Linking.openSettings() : void check(true)}>
            <Text gold>{checking ? 'Checking location…' : access === 'denied' ? 'Open Settings' : 'Check my location'}</Text>
          </Pressable>
        </View>}
        <Text style={styles.note}>{paused||preview?'Preview only':'In-app navigation available'} · {run.category==='TEST'?'Development only':'Field validation pending'} · Capture disabled</Text>

        <Text style={styles.label}>Stops and waypoints</Text>
        {sequence.map((point,i) => <View key={i} style={styles.stopRow}><View style={styles.stopNumber}><Text gold>{String(i+1).padStart(2,'0')}</Text></View><View style={{flex:1}}>
          <Text style={styles.copy}>{i===0 ? 'Start · ' : i===run.sequence.length-1 ? 'Finish · ' : ''}{point}</Text>
          {(i===0 || i===run.sequence.length-1) && <Text style={styles.note}>{i===0 ? startLat.toFixed(5)+', '+startLng.toFixed(5) : endLat.toFixed(5)+', '+endLng.toFixed(5)}</Text>}
        </View></View>)}
        <Text style={styles.label}>Road conditions</Text>
        <Text style={styles.copy}>{run.accessNote}</Text>
        <Text style={styles.note}>{notices.length?'Saved bulletins below. Open the traffic report for current conditions.':'Live road conditions have not been checked for this drive.'}</Text>
        {!!run.clearanceNote && <Text style={styles.note}>{run.clearanceNote}</Text>}
        {notices.map(n => <Pressable key={n.text} accessibilityRole="link" onPress={() => void Linking.openURL(n.source)}>
          <Text style={styles.copy}>{n.text}</Text><Text style={styles.credit}>Caltrans bulletin · {n.date}</Text>
        </Pressable>)}
        {run.catalog?.informationUrl && run.catalog.informationUrl !== 'https://fl511.com/' && <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(run.catalog!.informationUrl!)}>
          <Text style={styles.credit}>Visitor information for this drive</Text>
        </Pressable>}
        <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(isFlorida ? 'https://fl511.com/' : 'https://quickmap.dot.ca.gov/')}>
          <Text style={styles.credit}>{isFlorida ? 'Current Florida traffic · FL511' : 'Current Caltrans conditions'}</Text>
        </Pressable>
        {run.slug === 'nvidia-campus-loop' && <Pressable style={styles.back} accessibilityRole="button" onPress={() => router.push('/runs/nvidia-map')}>
          <Text gold>Open GPS test</Text>
        </Pressable>}
        <Pressable accessibilityRole="link" onPress={() => void Linking.openURL('https://www.openstreetmap.org/copyright')}>
          <Text style={styles.credit}>Road geometry © OpenStreetMap contributors · OSRM guidance</Text>
        </Pressable>
        <RoutePhotoCredit photo={run.photo} />
      </View>
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  mirror: {position:'absolute',top:12,right:12,borderRadius:30,borderWidth:1,borderColor:'#C5A572',backgroundColor:'#181C1F',paddingHorizontal:15,paddingVertical:9,flexDirection:'row',alignItems:'center',gap:7,shadowColor:'#C5A572',shadowOpacity:0.35,shadowRadius:9,shadowOffset:{width:0,height:0},elevation:5},
  mirrorActive: {backgroundColor:'#E7C892',shadowOpacity:0.85},
  mirrorText: {color:'#E7C892',fontFamily:'Inter_600SemiBold',fontSize:12,letterSpacing:1.8},
  stopRow: {flexDirection:'row',alignItems:'center',gap:12,paddingVertical:8},
  stopNumber: {width:34,height:34,borderRadius:17,borderWidth:1,borderColor:'#927B54',alignItems:'center',justifyContent:'center'},

  locationCard: { padding: 12, borderWidth: 1, borderColor: '#625543', gap: 5, borderRadius: 5 },
  locationButton: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  cover: { backgroundColor: '#12191D', borderRadius: 8, overflow: 'hidden' },
  root: { flex: 1, backgroundColor: shell.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingRight: 16 },
  back: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 15 },
  title: { fontFamily: 'BarlowCondensed_700Bold', fontSize: 27, lineHeight: 35, paddingHorizontal: 12, paddingVertical: 10 },
  body: { padding: 18, gap: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 9, flexWrap: 'wrap' },
  accent: { color: shell.accent, fontFamily: 'Inter_600SemiBold', fontSize: 11, letterSpacing: 1 },
  distance: { fontFamily: 'BarlowCondensed_700Bold', fontSize: 27 },
  endpoints: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: shell.muted, marginTop: 6, paddingBottom: 6 },
  label: { color: shell.accent, fontFamily: 'Inter_600SemiBold', fontSize: 12, letterSpacing: 1, marginTop: 10 },
  copy: { fontSize: 15, lineHeight: 22 },
  note: { color: shell.muted, fontSize: 13, lineHeight: 20 },
  credit: { color: shell.muted, fontSize: 11, paddingVertical: 5 },
});