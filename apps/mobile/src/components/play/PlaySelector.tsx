import { useState } from 'react';
import { ImageBackground, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Text } from '@underground/ui';
import { curatedRuns, type CuratedRun } from '../../data/curated-runs';
import { shell } from '../../theme/shell';

type Stage = 'region' | 'area' | 'conquests';
type AreaKey = 'silicon-valley' | 'peninsula-coast' | 'napa-valley' | 'monterey-peninsula';
const areas: { key: AreaKey; name: string; description: string; photo: CuratedRun['cover'] }[] = [
  { key: 'silicon-valley', name: 'SILICON VALLEY', description: 'Ridges, Santa Clara and our NVIDIA test circuit', photo: curatedRuns[0].cover },
  { key: 'peninsula-coast', name: 'PENINSULA COAST', description: 'Pacific Coast Highway and ocean-side stretches', photo: curatedRuns[2].cover },
  { key: 'napa-valley', name: 'NAPA VALLEY', description: 'Silverado Trail and wine-country drives', photo: curatedRuns[4].cover },
  { key: 'monterey-peninsula', name: 'MONTEREY PENINSULA', description: '17-Mile Drive and scenic coastal cruises', photo: curatedRuns[5].cover },
];
const areaNames: Record<AreaKey, string> = {
  'silicon-valley': 'Silicon Valley',
  'peninsula-coast': 'Peninsula Coast',
  'napa-valley': 'Napa Valley',
  'monterey-peninsula': 'Monterey Peninsula',
};

export function PlaySelector() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>('region');
  const [areaKey, setAreaKey] = useState<AreaKey>('silicon-valley');
  const [category, setCategory] = useState<CuratedRun['category']>('RUN');

  const selectedArea = areaNames[areaKey];
  const relevant = curatedRuns.filter(r => r.territory === selectedArea);
  const visible = relevant.filter(r => r.category === category);
  const categories = (['RUN', 'CRUISE', 'TEST'] as const).filter(c => relevant.some(r => r.category === c));

  function selectArea(key: AreaKey) {
    setAreaKey(key);
    const first = curatedRuns.find(r => r.territory === areaNames[key]);
    setCategory(first?.category === 'TEST' ? 'RUN' : first?.category ?? 'RUN');
    setStage('conquests');
  }
  function goBack() {
    if (stage === 'conquests') setStage('area');
    else if (stage === 'area') setStage('region');
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.top}>
        <Text style={styles.kicker}>UNDERGROUND / PLAY</Text>
        {stage !== 'region' ? (
          <Pressable onPress={goBack} accessibilityRole="button" style={styles.back}>
            <Text variant="caption" gold>‹ BACK</Text>
          </Pressable>
        ) : null}
      </View>
      <Text style={styles.title}>
        {stage === 'region' ? 'SELECT REGION' : stage === 'area' ? 'SELECT AREA' : 'SELECT CONQUEST'}
      </Text>
      <View style={styles.breadcrumb}>
        <Text style={styles.crumb}>REGION</Text>
        <Text style={styles.crumb}>{stage === 'region' ? '—' : 'CALIFORNIA'}</Text>
        <Text style={styles.crumb}>/</Text>
        <Text style={styles.crumb}>{stage === 'conquests' ? selectedArea.toUpperCase() : 'AREA'}</Text>
        <Text style={styles.crumb}>/</Text>
        <Text style={styles.crumb}>{stage === 'conquests' ? 'CONQUESTS' : '—'}</Text>
      </View>
      {stage === 'region' ? (
        <>
          <Text style={styles.description}>Choose a geographic region before viewing its territories and driving events.</Text>
          <Pressable onPress={() => setStage('area')} style={styles.regionCard} accessibilityRole="button" accessibilityLabel="Select California region">
            <ImageBackground source={curatedRuns[2].cover} style={styles.regionHero} resizeMode="cover">
              <View style={styles.shade} />
              <View style={styles.cardText}>
                <Text style={styles.small}>WESTERN UNITED STATES</Text>
                <Text style={styles.cardHeading}>CALIFORNIA</Text>
                <Text style={styles.small}>4 AREAS · DEVELOPMENT CATALOG</Text>
              </View>
            </ImageBackground>
          </Pressable>
        </>
      ) : null}

      {stage === 'area' ? (
        <>
          <Text style={styles.description}>Select the territory area you want to explore. Only curated events are listed; roads are not automatically claimable.</Text>
          {areas.map(area => (
            <Pressable key={area.key} onPress={() => selectArea(area.key)} style={styles.areaCard} accessibilityRole="button" accessibilityLabel={`Select ${area.name}`}>
              <ImageBackground source={area.photo} style={styles.areaHero}>
                <View style={styles.shade} />
                <View style={styles.cardText}>
                  <Text style={styles.cardHeadingSmall}>{area.name}</Text>
                  <Text style={styles.small}>{area.description}</Text>
                </View>
              </ImageBackground>
            </Pressable>
          ))}
        </>
      ) : null}

      {stage === 'conquests' ? (
        <>
          <Text style={styles.description}>{selectedArea} · Choose a curated event. Capture is currently disabled pending GPS route and safety verification.</Text>
          <View style={styles.filters}>
            {categories.map(value => (
              <Pressable key={value} style={[styles.filter, category === value && styles.filterActive]} onPress={() => setCategory(value)} accessibilityRole="button">
                <Text variant="caption" style={category === value ? styles.filterTextActive : styles.filterText}>{value === 'TEST' ? 'POC TESTS' : value === 'CRUISE' ? 'CRUISES' : 'RUNS'}</Text>
              </Pressable>
            ))}
          </View>
          {visible.length === 0 ? (
            <Text style={styles.empty}>No approved event candidates in this category. Choose another event type.</Text>
          ) : visible.map(run => (
            <Pressable
              key={run.slug}
              onPress={() => router.push({ pathname: '/runs/[slug]', params: { slug: run.slug } })}
              style={styles.event}
              accessibilityRole="button"
              accessibilityLabel={`Open ${run.title} event details`}
            >
              <ImageBackground source={run.cover} style={styles.eventHero}>
                <View style={styles.shade} />
                <View style={styles.eventText}>
                  <Text style={styles.small}>{run.category} {run.number} · DRAFT</Text>
                  <Text style={styles.eventTitle}>{run.title}</Text>
                  <Text style={styles.small}>VIEW EVENT DETAILS ›</Text>
                </View>
              </ImageBackground>
            </Pressable>
          ))}
          {areaKey === 'silicon-valley' ? (
            <Pressable onPress={() => router.push('/conquests/dev-map')} style={styles.devMap} accessibilityRole="button">
              <Text variant="caption" gold>OPEN DEVELOPMENT CONQUEST MAP</Text>
              <Text style={styles.devHint}>Draft route overlays and simulated test captures only</Text>
            </Pressable>
          ) : null}
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#08090A' },
  content: { padding: 17, paddingBottom: 44, gap: 13 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12 },
  kicker: { color: shell.accent, fontFamily: 'Inter_600SemiBold', fontSize: 10, letterSpacing: 2.8 },
  back: { padding: 9 },
  title: { color: '#F4F2ED', fontFamily: 'BarlowCondensed_700Bold', fontSize: 47, letterSpacing: 2.2 },
  breadcrumb: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  crumb: { color: shell.muted, fontFamily: 'Inter_500Medium', fontSize: 10, letterSpacing: 0.8 },
  description: { color: '#B7B7B8', fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 19, marginBottom: 9 },
  regionCard: { borderWidth: 1, borderColor: shell.accent },
  regionHero: { height: 310, justifyContent: 'flex-end' },
  shade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.48)' },
  cardText: { padding: 19, gap: 7 },
  small: { color: '#F4F2ED', fontSize: 10, letterSpacing: 1.6, fontFamily: 'Inter_500Medium' },
  cardHeading: { color: '#FFFFFF', fontSize: 47, letterSpacing: 2, fontFamily: 'BarlowCondensed_700Bold' },
  cardHeadingSmall: { color: '#FFFFFF', fontSize: 30, letterSpacing: 1.5, fontFamily: 'BarlowCondensed_700Bold' },
  areaCard: { borderWidth: 1, borderColor: 'rgba(198,176,139,0.45)' },
  areaHero: { height: 168, justifyContent: 'flex-end' },
  filters: { flexDirection: 'row', gap: 6, marginBottom: 7 },
  filter: { flex: 1, padding: 12, borderWidth: 1, borderColor: '#48423A', alignItems: 'center' },
  filterActive: { backgroundColor: '#D0B88F', borderColor: '#D0B88F' },
  filterText: { color: '#B7B7B8' },
  filterTextActive: { color: '#08090A' },
  empty: { color: '#B7B7B8', lineHeight: 22, padding: 12 },
  event: { borderWidth: 1, borderColor: '#48423A', marginBottom: 4 },
  eventHero: { height: 190, justifyContent: 'flex-end' },
  eventText: { padding: 17, gap: 6 },
  eventTitle: { color: '#FFFFFF', fontSize: 31, fontFamily: 'BarlowCondensed_700Bold', letterSpacing: 1.3 },
  devMap: { borderWidth: 1, borderColor: shell.accent, padding: 16, marginTop: 10, gap: 7, alignItems: 'center' },
  devHint: { color: shell.muted, fontSize: 11, textAlign: 'center' },
});
