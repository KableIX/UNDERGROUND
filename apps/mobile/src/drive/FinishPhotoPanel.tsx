import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@underground/ui';
import { FINISH_PHOTO_WINDOW_MS, FINISH_POINTS_BOTH, FINISH_POINTS_CAR, FINISH_POINTS_DASH, type FinishCredit, type FinishPhotoKind } from '@underground/domain';
import { captureFinishPhoto } from './finish-photo';
import { addFinishPhoto, onResultChange, readFinishCredit, readFinishNonce, syncResults } from './result-store';
import { cameraState, type FinishNonce, type LocalFinishCredit } from './result-sql';
import { isLiveAuthConfigured } from '../session/supabase-session';

type Props = { member: string; attempt: string; finishedAtMs: number };

const TIER_LINE: Record<FinishCredit['tier'], string> = {
  none: 'GPS finish recorded. Add a photo for credit.',
  verified: `Dash photo. Run verified. ${FINISH_POINTS_DASH} points.`,
  car: `Car at the finish. ${FINISH_POINTS_CAR} points.`,
  top: `Car and dash. ${FINISH_POINTS_BOTH} points.`,
};

/**
 * Finish photos after a GPS-completed Run. Open for 30 minutes after the finish,
 * so it still works after you park and unlock the phone. The photo is saved on this
 * phone only (My Run Photos) and never uploaded. The capture GPS fix and time are sent
 * once to verify the finish, then deleted on the server and the phone.
 * Anti-cheat: only in-app camera photos taken after the server's finish nonce arrives earn
 * points. Library photos are kept for the member but flagged and earn nothing.
 */
export function FinishPhotoPanel({ member, attempt, finishedAtMs }: Props) {
  const [credit, setCredit] = useState<LocalFinishCredit | null>(null);
  const [busy, setBusy] = useState<FinishPhotoKind | null>(null);
  const [now, setNow] = useState(Date.now);
  const [nonce, setNonce] = useState<FinishNonce | null>(null);
  useEffect(() => {
    const load = () => {
      void readFinishCredit(member, attempt).then(setCredit).catch(() => undefined);
      void readFinishNonce(member, attempt).then(setNonce).catch(() => undefined);
    };
    load();
    const unsubscribe = onResultChange(load);
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => { clearInterval(timer); unsubscribe(); };
  }, [member, attempt]);
  const camera = cameraState(nonce, isLiveAuthConfigured(), now);
  // Still waiting for the finish nonce: nudge the sync that fetches it.
  useEffect(() => {
    if (camera === 'waiting') void syncResults(member).catch(() => undefined);
  }, [camera, member, now]);
  const closesAt = finishedAtMs + FINISH_PHOTO_WINDOW_MS;
  const open = now < closesAt;
  const minutes = Math.max(0, Math.ceil((closesAt - now) / 60_000));
  // When the window closes the photo set is final: send the proof and settle the credit.
  const settled = useRef(false);
  useEffect(() => {
    if (open || settled.current) return;
    settled.current = true;
    void syncResults(member).then(() => readFinishCredit(member, attempt)).then(setCredit).catch(() => undefined);
  }, [open, member, attempt]);

  function take(kind: FinishPhotoKind) {
    Alert.alert(kind === 'car' ? 'Car at the finish' : 'Dash', camera === 'ready' ? undefined : 'Camera opens once the club confirms your finish.', [
      ...(camera === 'ready' ? [{ text: 'Camera', onPress: () => void capture(kind, 'camera') }] : []),
      { text: 'Library (no points)', onPress: () => void capture(kind, 'library') },
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  }
  async function capture(kind: FinishPhotoKind, source: 'camera' | 'library') {
    setBusy(kind);
    try {
      const photo = await captureFinishPhoto(kind, source);
      if (!photo) return;
      setCredit(await addFinishPhoto(member, attempt, photo.claim, photo.uri, photo.imageSha256));
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
    if (value === 'library') return 'Library photo · no points';
    return value === 'accepted' ? 'Saved' : 'Held for review';
  };

  return (
    <View style={s.panel}>
      <Text style={s.kicker}>FINISH PHOTO</Text>
      <Text style={s.line}>{TIER_LINE[credit?.tier ?? 'none']}</Text>
      {credit?.final ? <Text style={s.note}>Credit confirmed. Photos saved on this phone in My Run Photos.</Text> : open ? <>
        <View style={s.row}>
          {(['car', 'dash'] as const).map(kind => (
            <Pressable key={kind} disabled={!!busy} accessibilityRole="button" style={[s.slot, credit?.[kind] === 'accepted' && s.done]} onPress={() => take(kind)}>
              <Text style={s.slotText}>{kind === 'car' ? 'Car at finish' : 'Dash'}</Text>
              <Text style={s.slotNote}>{busy === kind ? 'Saving…' : status(kind) ?? (kind === 'car' ? `${FINISH_POINTS_CAR} points` : `Verifies · ${FINISH_POINTS_DASH}`)}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={s.note}>{camera === 'waiting' ? 'Confirming your finish… camera unlocks when it is confirmed. ' : camera === 'expired' ? 'Finish confirmation expired. ' : ''}Both: {FINISH_POINTS_BOTH} points. Window closes in {minutes} min. In-app camera only. Photos stay on this phone.</Text>
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
