import { ImageBackground, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Text } from '@underground/ui';
import { curatedRuns, type CuratedRun } from '../../src/data/curated-runs';
import { shell } from '../../src/theme/shell';

export default function RunCatalogScreen() {
  const router = useRouter();
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back to Play">
          <Text variant="caption" gold>‹ PLAY</Text>
        </Pressable>
        <Text variant="caption" style={styles.counter}>UNDERGROUND / EVENTS</Text>
      </View>
      <Text style={styles.kicker}>THE DRIVING COLLECTION</Text>
      <Text style={styles.heading}>ICONIC RUNS</Text>
      <Text style={styles.description}>
        Curated roads. Real landscapes. Six initial event concepts for the 1.0 catalog.
        Geometry and supercar-clearance reviews are pending; no live captures are enabled.
      </Text>
      <View style={styles.cards}>
        {curatedRuns.map(run => (
          <RunEventCard
            key={run.slug}
            run={run}
            onPress={() => router.push({ pathname: '/runs/[slug]', params: { slug: run.slug } })}
          />
        ))}
      </View>
      <Text variant="caption" style={styles.footer}>
        PHOTOS ARE REAL LOCAL LANDMARK/ROAD IMAGES · EVENT CENTERLINES NOT YET VERIFIED
      </Text>
    </ScrollView>
  );
}

export function RunEventCard({ run, onPress }: { run: CuratedRun; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Preview ${run.title} in ${run.territory}`}
      style={styles.card}
    >
      <ImageBackground source={run.cover} resizeMode="cover" style={styles.cover} imageStyle={styles.coverImage}>
        <View style={styles.scrim} />
        <View style={styles.top}>
          <Text style={styles.runNumber}>RUN / {run.number}</Text>
          <Text style={styles.draft}>DRAFT · PREVIEW</Text>
        </View>
        <View style={styles.heroText}>
          <Text style={styles.territory}>{run.territory.toUpperCase()} / {run.routeClass}</Text>
          <Text style={styles.cardTitle}>{run.title}</Text>
          <Text style={styles.city}>{run.region.toUpperCase()}</Text>
        </View>
        <View style={styles.bottom}>
          <Text variant="caption" style={styles.view}>VIEW EVENT DETAILS</Text>
          <Text style={styles.arrow}>↗</Text>
        </View>
      </ImageBackground>
      <View style={styles.accentBar} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#08090A' },
  content: { paddingHorizontal: 16, paddingTop: 25, paddingBottom: 42, gap: 13 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  counter: { color: shell.muted, letterSpacing: 2 },
  kicker: { fontFamily: 'Inter_600SemiBold', fontSize: 10, letterSpacing: 4, color: shell.accent },
  heading: { fontFamily: 'BarlowCondensed_700Bold', fontSize: 48, color: '#F4F2ED', letterSpacing: 3 },
  description: { fontFamily: 'Inter_400Regular', color: shell.muted, fontSize: 12, lineHeight: 20, marginBottom: 12 },
  cards: { gap: 16 },
  card: { borderWidth: 1, borderColor: 'rgba(198,176,139,0.45)', backgroundColor: '#121314', overflow: 'hidden' },
  cover: { height: 235, justifyContent: 'space-between' },
  coverImage: { opacity: 0.92 },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.40)' },
  top: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 14, paddingTop: 14 },
  runNumber: { color: '#FFFFFF', fontFamily: 'BarlowCondensed_700Bold', letterSpacing: 2, fontSize: 17 },
  draft: { color: '#0A0B0D', backgroundColor: '#D0B88F', overflow: 'hidden', paddingHorizontal: 10, paddingVertical: 5, fontFamily: 'Inter_600SemiBold', fontSize: 9, letterSpacing: 1.2 },
  heroText: { paddingHorizontal: 17, gap: 5, marginTop: 'auto' },
  territory: { fontSize: 10, color: '#D0B88F', fontFamily: 'Inter_600SemiBold', letterSpacing: 2 },
  cardTitle: { color: '#FFFFFF', fontFamily: 'BarlowCondensed_700Bold', fontSize: 34, letterSpacing: 1.7, textShadowColor: '#000', textShadowRadius: 7 },
  city: { fontSize: 9, color: '#FFFFFF', letterSpacing: 2, fontFamily: 'Inter_500Medium' },
  bottom: { marginTop: 20, backgroundColor: 'rgba(6,7,9,0.82)', paddingVertical: 13, paddingHorizontal: 17, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  view: { color: '#F4F2ED', letterSpacing: 2 },
  arrow: { color: '#D0B88F', fontSize: 23 },
  accentBar: { height: 3, backgroundColor: '#D0B88F' },
  footer: { color: shell.muted, fontSize: 9, textAlign: 'center', lineHeight: 18, marginTop: 12 },
});
