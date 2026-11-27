import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@underground/ui';
import { FINISH_PHOTO_WINDOW_MS, FINISH_POINTS_BOTH, FINISH_POINTS_CAR, FINISH_POINTS_DASH, type FinishCredit, type FinishPhotoKind } from '@underground/domain';
import { captureFinishPhoto } from './finish-photo';
import { addFinishPhoto, readFinishCredit } from './result-store';

type Props = { member: string; attempt: string; finishedAtMs: number };

const TIER_LINE: Record<FinishCredit['tier'], string> = {
  none: 'GPS finish recorded. Add a photo for credit.',
  verified: `Dash photo. Run verified. ${FINISH_POINTS_DASH} points.`,
  car: `Car at the finish. ${FINISH_POINTS_CAR} points.`,
  top: `Car and dash. ${FINISH_POINTS_BOTH} points.`,
};

/**
 * Finish photos after a GPS-completed Run. Open for 30 minutes after the finish,
 * so it still works after you park and unlock the phone. Location is checked privately
 * and stripped from the image; nobody else sees where it was taken.
 */
export function FinishPhotoPanel({ member, attempt, finishedAtMs }: Props) {
  const [credit, setCredit] = useState<FinishCredit | null>(null);
  const [busy, setBusy] = useState<FinishPhotoKind | null>(null);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    void readFinishCredit(member, attempt).then(setCredit).catch(() => undefined);
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, [member, attempt]);
  const closesAt = finishedAtMs + FINISH_PHOTO_WINDOW_MS;
  const open = now < closesAt;
  const minutes = Math.max(0, Math.ceil((closesAt - now) / 60_000));

  function take(kind: FinishPhotoKind) {
    Alert.alert(kind === 'car' ? 'Car at the finish' : 'Dash', undefined, [
      { text: 'Camera', onPress: () => void capture(kind, 'camera') },
      { text: 'Library', onPress: () => void capture(kind, 'library') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }
  async function capture(kind: FinishPhotoKind, source: 'camera' | 'library') {
    setBusy(kind);
    try {
      const photo = await captureFinishPhoto(kind, source);
      if (!photo) return;
      setCredit(await addFinishPhoto(member, attempt, photo.claim, photo.uri));
    } catch (error) {
      Alert.alert('Photo not saved', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setBusy(null);
    }
  }

  const status = (kind: FinishPhotoKind) => {
    const value = credit?.[kind];
    if (!value) return null;
    // Failures stay quiet: the photo is held, not announced.
    return value === 'accepted' ? 'Saved' : 'Held for review';
  };

  return (
    <View style={s.panel}>
      <Text style={s.kicker}>FINISH PHOTO</Text>
      <Text style={s.line}>{TIER_LINE[credit?.tier ?? 'none']}</Text>
      {open ? <>
        <View style={s.row}>
          {(['car', 'dash'] as const).map(kind => (
            <Pressable key={kind} disabled={!!busy} accessibilityRole="button" style={[s.slot, credit?.[kind] === 'accepted' && s.done]} onPress={() => take(kind)}>
              <Text style={s.slotText}>{kind === 'car' ? 'Car at finish' : 'Dash'}</Text>
              <Text style={s.slotNote}>{busy === kind ? 'Saving…' : status(kind) ?? (kind === 'car' ? `${FINISH_POINTS_CAR} points` : `Verifies · ${FINISH_POINTS_DASH}`)}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={s.note}>Both: {FINISH_POINTS_BOTH} points. Window closes in {minutes} min.</Text>
      </> : <Text style={s.note}>Photo window closed.</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  panel: { gap: 8, paddingVertical: 6 },
  kicker: { color: '#D0B88F', fontSize: 11, letterSpacing: 1 },
  line: { color: '#FFFFFF', fontSize: 18, fontFamily: 'BarlowCondensed_700Bold' },
  row: { flexDirection: 'row', gap: 10 },
  slot: { flex: 1, minHeight: 60, borderWidth: 1, borderColor: '#D0B88F', borderRadius: 5, alignItems: 'center', justifyContent: 'center', padding: 8 },
  done: { backgroundColor: '#D0B88F22' },
  slotText: { color: '#D0B88F', fontSize: 15, fontWeight: '700' },
  slotNote: { color: '#AAB5B0', fontSize: 11, marginTop: 3 },
  note: { color: '#ACCAD0', fontSize: 12 },
});
