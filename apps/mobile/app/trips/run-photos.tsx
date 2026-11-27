import { useCallback, useState } from 'react';
import { Image, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Text } from '@underground/ui';
import { getCuratedRun } from '../../src/data/curated-runs';
import { useSession } from '../../src/session/SessionContext';
import { onResultChange, readRunPhotos, type RunPhoto } from '../../src/drive/result-store';
import { shell } from '../../src/theme/shell';

/** Finish photos live on this phone only. They are never uploaded to the club servers. */
export default function RunPhotosScreen() {
  const {state} = useSession();
  const member = state.status === 'authenticated' ? state.member.memberId : undefined;
  const [photos, setPhotos] = useState<RunPhoto[] | null>(null);
  useFocusEffect(useCallback(() => {
    let live = true;
    const load = () => { if (member) void readRunPhotos(member).then(rows => { if (live) setPhotos(rows); }).catch(() => { if (live) setPhotos([]); }); };
    load();
    const unsubscribe = onResultChange(load);
    return () => { live = false; unsubscribe(); };
  }, [member]));
  return <ScrollView contentContainerStyle={s.page}>
    <Text style={s.muted}>Saved on this phone. Not uploaded to UNDERGROUND servers.</Text>
    {photos?.length === 0 && <Text style={s.muted}>No finish photos yet.</Text>}
    {photos?.map(photo => <View key={photo.attempt + ':' + photo.kind} style={s.card}>
      <Image source={{uri: photo.uri}} style={s.image} resizeMode="cover" accessibilityLabel={`${photo.kind === 'car' ? 'Car' : 'Dash'} finish photo`} />
      <Text gold variant="caption">{(photo.route && getCuratedRun(photo.route)?.title) ?? photo.route ?? 'Run'} · {photo.kind === 'car' ? 'CAR' : 'DASH'}</Text>
      <Text style={s.muted}>{new Date(photo.takenAtMs).toLocaleString()}</Text>
    </View>)}
  </ScrollView>;
}
const s = StyleSheet.create({
  page:{padding:18, gap:16}, muted:{color:shell.muted},
  card:{gap:6}, image:{width:'100%', aspectRatio:4/3, borderRadius:6, backgroundColor:'#111'},
});
