import { useMemo, useState } from 'react';
import { ImageBackground, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@underground/ui';
import { curatedRuns, getCuratedEvents, type CuratedRun } from '../../data/curated-runs';
import { shell } from '../../theme/shell';

type AreaKey = 'peninsula-coast' | 'silicon-valley' | 'napa-valley' | 'monterey-peninsula';
const areas: ReadonlyArray<{ key: AreaKey; title: string; territory: string }> = [
  { key: 'peninsula-coast', title: 'PENINSULA', territory: 'Peninsula Coast' },
  { key: 'silicon-valley', title: 'SILICON VALLEY', territory: 'Silicon Valley' },
  { key: 'napa-valley', title: 'NAPA', territory: 'Napa Valley' },
  { key: 'monterey-peninsula', title: 'MONTEREY', territory: 'Monterey Peninsula' },
];
const categories = ['RUN', 'CRUISE', 'TEST'] as const;

export function PlaySelector() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [area, setArea] = useState<AreaKey>('peninsula-coast');
  const [category, setCategory] = useState<CuratedRun['category']>('RUN');
  const selected = areas.find(item => item.key === area) ?? areas[0];
  const events = useMemo(
    () => getCuratedEvents(category).filter(run => run.territory === selected.territory),
    [category, selected.territory],
  );
  const available = useMemo(
    () => new Set(curatedRuns.filter(run => run.territory === selected.territory).map(run => run.category)),
    [selected.territory],
  );

  function chooseArea(next: AreaKey) {
    setArea(next);
    const matching = areas.find(item => item.key === next)?.territory;
    const first = getCuratedEvents('RUN').find(run => run.territory === matching)
      ?? curatedRuns.find(run => run.territory === matching);
    setCategory(first?.category ?? 'RUN');
  }

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top, 12) + 12 }]} showsVerticalScrollIndicator={false}>
        <Text style={styles.kicker}>UNDERGROUND / CALIFORNIA</Text>
        <Text style={styles.heading}>PLAY</Text>
        <Text style={styles.subtitle}>Choose an area, then a drive.</Text>

        <Text style={styles.label}>AREA</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.areas}>
          {areas.map(item => (
            <Pressable key={item.key} onPress={() => chooseArea(item.key)}
              accessibilityRole="button" accessibilityState={{ selected: area === item.key }}
              style={[styles.areaChip, area === item.key && styles.selectedChip]}>
              <Text style={area === item.key ? styles.selectedText : styles.chipText}>{item.title}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.eventHeader}>
          <Text style={styles.label}>CONQUESTS / {selected.title}</Text>
          <Text style={styles.count}>{events.length} SHOWN</Text>
        </View>
        <View style={styles.filters}>
          {categories.map(value => (
            <Pressable key={value} onPress={() => setCategory(value)}
              accessibilityRole="button" accessibilityState={{ selected: category === value }}
              style={[styles.filter, category === value && styles.activeFilter]}>
              <Text style={category === value ? styles.activeLabel : styles.filterLabel}>
                {value === 'RUN' ? 'RUNS' : value === 'CRUISE' ? 'CRUISES' : 'POC'}
              </Text>
              {!available.has(value) ? <View style={styles.unavailableDot} /> : null}
            </Pressable>
          ))}
        </View>

        {events.length ? events.map(run => (
          <Pressable key={run.slug} style={styles.card}
            accessibilityRole="button" accessibilityLabel={`View ${run.title}`}
            onPress={() => router.push({ pathname: '/runs/[slug]', params: { slug: run.slug } })}>
            <ImageBackground source={run.cover} style={styles.photo} imageStyle={styles.photoImage}>
              <View style={styles.photoTop}>
                <Text style={styles.runNo}>{run.category} {run.number}</Text>
                <Text style={styles.draft}>DRAFT</Text>
              </View>
            </ImageBackground>
            <View style={styles.cardCaption}>
              <Text style={styles.runName} numberOfLines={2}>{run.title}</Text>
              <Text style={styles.routeLocation}>{run.region.toUpperCase()}</Text>
              <View style={styles.cardFooter}>
                <Text style={styles.view}>VIEW DETAILS</Text>
                <Text style={styles.arrow}>›</Text>
              </View>
            </View>
          </Pressable>
        )) : (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>NO {category === 'TEST' ? 'POC TESTS' : category + 'S'} HERE</Text>
            <Text style={styles.emptyText}>Select another category or area. Only curated, photographed candidates are shown.</Text>
          </View>
        )}

        {area === 'silicon-valley' ? (
          <Pressable style={styles.dev} accessibilityRole="button"
            onPress={() => router.push('/conquests/dev-map')}>
            <Text style={styles.devTitle}>NVIDIA DEVELOPMENT MAP</Text>
            <Text style={styles.devCaption}>GPS test circuits and simulated captures only ›</Text>
          </Pressable>
        ) : null}
        <Text style={styles.disclaimer}>PREVIEW ONLY · GPS ROUTES AND SUPERCAR SUITABILITY NOT YET VERIFIED</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#08090A' },
  content: { paddingTop: 14, paddingHorizontal: 16, paddingBottom: 36, gap: 11 },
  kicker: { fontFamily: 'Inter_600SemiBold', fontSize: 10, letterSpacing: 2.1, color: '#C6B08B' },
  heading: { fontFamily: 'BarlowCondensed_700Bold', fontSize: 42, lineHeight: 48, letterSpacing: 2, color: '#F4F2ED' },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 13, color: shell.muted, marginBottom: 8 },
  label: { fontFamily: 'Inter_600SemiBold', color: '#C6B08B', letterSpacing: 1.6, fontSize: 11 },
  areas: { flexDirection: 'row', gap: 8, paddingBottom: 5 },
  areaChip: { borderColor: '#48423A', borderWidth: 1, paddingVertical: 12, paddingHorizontal: 13 },
  selectedChip: { backgroundColor: '#D0B88F', borderColor: '#D0B88F' },
  chipText: { color: '#D6D3CE', fontFamily: 'Inter_600SemiBold', fontSize: 10 },
  selectedText: { color: '#08090A', fontFamily: 'Inter_600SemiBold', fontSize: 10 },
  eventHeader: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 9 },
  count: { color: shell.muted, fontFamily: 'Inter_400Regular', fontSize: 10 },
  filters: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  filter: { flex: 1, borderWidth: 1, borderColor: '#48423A', paddingVertical: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 4 },
  activeFilter: { borderColor: '#D0B88F', backgroundColor: 'rgba(208,184,143,0.18)' },
  filterLabel: { color: shell.muted, fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  activeLabel: { color: '#F4F2ED', fontFamily: 'Inter_600SemiBold', fontSize: 11 },
  unavailableDot: { backgroundColor: '#48423A', width: 4, height: 4, borderRadius: 2 },
  card: { borderWidth: 1, borderColor: '#48423A', backgroundColor: '#121314', marginBottom: 6 },
  photo: { height: 188, justifyContent: 'flex-start' },
  photoImage: { opacity: 1 },
  cardCaption: { backgroundColor: '#111214', paddingHorizontal: 14, paddingTop: 13, paddingBottom: 2, gap: 4 },
  photoTop: { padding: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  runNo: { fontFamily: 'Inter_600SemiBold', letterSpacing: 1.3, fontSize: 11, color: '#08090A', backgroundColor: '#D0B88F', paddingHorizontal: 10, paddingVertical: 6, overflow: 'hidden' },
  draft: { color: '#08090A', backgroundColor: '#D0B88F', paddingHorizontal: 9, paddingVertical: 5, fontFamily: 'Inter_600SemiBold', fontSize: 9 },

  runName: { color: '#FFFFFF', fontFamily: 'BarlowCondensed_700Bold', fontSize: 28, letterSpacing: 0.7, lineHeight: 34, flexShrink: 1 },
  routeLocation: { color: '#F4F2ED', fontFamily: 'Inter_500Medium', fontSize: 10, letterSpacing: 1.3 },
  cardFooter: { paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 3, borderTopWidth: 1, borderTopColor: '#363432' },
  view: { fontFamily: 'Inter_600SemiBold', color: '#D0B88F', letterSpacing: 1.8, fontSize: 10 },
  arrow: { color: '#D0B88F', fontSize: 24 },
  empty: { borderWidth: 1, borderColor: '#48423A', padding: 24, gap: 10 },
  emptyTitle: { color: '#F4F2ED', fontFamily: 'BarlowCondensed_700Bold', fontSize: 23 },
  emptyText: { color: shell.muted, fontSize: 12, lineHeight: 19 },
  dev: { borderWidth: 1, borderColor: '#C6B08B', padding: 15, gap: 6 },
  devTitle: { color: '#D0B88F', fontFamily: 'Inter_600SemiBold', letterSpacing: 1.5, fontSize: 11 },
  devCaption: { color: shell.muted, fontSize: 11 },
  disclaimer: { textAlign: 'center', color: shell.muted, fontSize: 9, letterSpacing: 0.6, marginTop: 8 },
});
