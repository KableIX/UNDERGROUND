import { ImageBackground, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Text } from '@underground/ui';
import { getCuratedRun } from '../../src/data/curated-runs';
import { shell } from '../../src/theme/shell';

export default function RunDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ slug: string }>();
  const run = getCuratedRun(params.slug ?? '');

  if (!run) {
    return (
      <View style={styles.missing}>
        <Text variant="title">Run not found</Text>
        <Pressable onPress={() => router.replace('/runs')}>
          <Text variant="caption" gold>BACK TO RUNS</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: run.title, headerShown: false }} />
      <ImageBackground source={run.cover} style={styles.hero} resizeMode="cover">
        <View style={styles.scrim} />
        <Pressable onPress={() => router.back()} style={styles.back} accessibilityRole="button">
          <Text variant="caption" style={styles.backLabel}>‹ ALL RUNS</Text>
        </Pressable>
        <View style={styles.heroCopy}>
          <Text style={styles.eyebrow}>RUN {run.number} · {run.routeClass}</Text>
          <Text style={styles.title}>{run.title}</Text>
          <Text style={styles.location}>{run.territory.toUpperCase()} / {run.region.toUpperCase()}</Text>
        </View>
      </ImageBackground>
      <View style={styles.body}>
        <Text style={styles.status}>DRAFT EVENT · ROUTE NOT GPS-VERIFIED</Text>
        <Text style={styles.intro}>{run.subtitle}</Text>
        <Text style={styles.section}>PROPOSED ROUTE</Text>
        {run.sequence.map((segment, index) => (
          <View key={index} style={styles.step}>
            <Text style={styles.stepCount}>{String(index + 1).padStart(2, '0')}</Text>
            <Text style={styles.stepText}>{segment}</Text>
          </View>
        ))}
        <Text style={styles.section}>ROAD ACCESS</Text>
        <Text style={styles.note}>{run.accessNote}</Text>
        <Text style={styles.section}>EXOTIC-CAR SUITABILITY</Text>
        <Text style={styles.note}>{run.clearanceNote}</Text>
        <View style={styles.locked}>
          <Text style={styles.lockedHeading}>CAPTURE NOT YET AVAILABLE</Text>
          <Text style={styles.note}>The road-snapped centerline, actual turn connections, checkpoint gates, and in-person suitability review must pass before claiming can be enabled. No simulated or production crown is awarded from this screen.</Text>
        </View>
        <Text style={styles.section}>PHOTO CREDIT</Text>
        <Text style={styles.note}>{run.photo.caption} Photograph by {run.photo.author}, {run.photo.license}. Cropped and resized for event-card display.</Text>
        <Pressable onPress={() => void Linking.openURL(run.photo.source)} accessibilityRole="link">
          <Text variant="caption" gold>VIEW SOURCE AND LICENSE ↗</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#08090A' },
  content: { paddingBottom: 46 },
  missing: { flex: 1, backgroundColor: '#08090A', justifyContent: 'center', alignItems: 'center', gap: 15 },
  hero: { height: 320, justifyContent: 'space-between' },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  back: { paddingHorizontal: 20, paddingTop: 28, alignSelf: 'flex-start' },
  backLabel: { color: '#FFFFFF', fontFamily: 'Inter_600SemiBold', letterSpacing: 2 },
  heroCopy: { padding: 22, gap: 7 },
  eyebrow: { color: '#D0B88F', fontFamily: 'Inter_600SemiBold', letterSpacing: 3, fontSize: 11 },
  title: { color: '#FFFFFF', fontFamily: 'BarlowCondensed_700Bold', fontSize: 50, letterSpacing: 2, lineHeight: 52 },
  location: { color: '#FFFFFF', letterSpacing: 2, fontFamily: 'Inter_500Medium', fontSize: 10 },
  body: { padding: 22, gap: 13 },
  status: { borderWidth: 1, borderColor: shell.accent, alignSelf: 'flex-start', padding: 9, color: '#D0B88F', fontFamily: 'Inter_600SemiBold', fontSize: 10, letterSpacing: 1.5 },
  intro: { color: '#F4F2ED', fontSize: 16, fontFamily: 'Inter_400Regular', lineHeight: 25 },
  section: { marginTop: 16, marginBottom: 2, color: '#D0B88F', fontFamily: 'BarlowCondensed_700Bold', fontSize: 22, letterSpacing: 2 },
  step: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#48423A', paddingVertical: 10, gap: 17 },
  stepCount: { color: '#D0B88F', fontFamily: 'BarlowCondensed_700Bold', fontSize: 20 },
  stepText: { color: '#F4F2ED', fontFamily: 'Inter_500Medium', flex: 1, lineHeight: 22 },
  note: { fontFamily: 'Inter_400Regular', color: shell.muted, fontSize: 12, lineHeight: 21 },
  locked: { marginTop: 20, gap: 10, padding: 18, backgroundColor: '#121314', borderWidth: 1, borderColor: '#48423A' },
  lockedHeading: { color: '#D0B88F', fontFamily: 'BarlowCondensed_700Bold', fontSize: 24, letterSpacing: 2 },
});
