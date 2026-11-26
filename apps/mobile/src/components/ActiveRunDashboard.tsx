import { Image, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@underground/ui';
import type { PersistentDriveControls } from '../drive/use-persistent-drive';
import { formatDurationMs } from '../drive/format';

type Props = { visible: boolean; drive: PersistentDriveControls; temporary: boolean; busy: boolean; onClose: () => void; onPause: () => void; onResume: () => void; onEnd: () => void };
export function ActiveRunDashboard({ visible, drive, temporary, busy, onClose, onPause, onResume, onEnd }: Props) {
  const inset = useSafeAreaInsets();
  const active = drive.state.session.status === 'recording';
  const ended = drive.state.session.status === 'ended';
  const sample = drive.state.samples[drive.state.samples.length - 1];
  const fresh = sample != null && Date.now() - sample.timestampMs < 15000 && !sample.flags.poorAccuracy && !sample.flags.discontinuity;
  const speed = active && fresh && drive.privateSpeedMps != null ? Math.round(drive.privateSpeedMps * 2.236936) : null;
  const distance = drive.summary?.distanceM ?? 0;
  const duration = drive.summary?.durationMs ?? 0;
  const average = duration > 0 ? (distance / (duration / 1000) * 2.236936).toFixed(1) : '—';
  return <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
    <ScrollView style={s.root} contentContainerStyle={{ padding: 24, paddingTop: inset.top + 18, paddingBottom: inset.bottom + 24 }}>
      <Image
        accessibilityRole="image"
        accessibilityLabel="UNDERGROUND"
        accessible
        resizeMode="contain"
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        source={require('../../assets/brand/underground-lockup-silver.png')}
        style={s.brandHeader}
      />
      <View style={s.row}><Text style={s.kicker}>NVIDIA CAMPUS LOOP</Text><Pressable onPress={onClose}><Text style={s.link}>VIEW MAP</Text></Pressable></View>
      {!!drive.summary?.vehicleLabel && <Text style={s.kicker}>{drive.summary.vehicleLabel}</Text>}
      <Text style={s.title}>{ended ? 'RUN ENDED' : active ? 'RUN IN PROGRESS' : 'RUN PAUSED'}</Text>
      <Text style={[s.status, { color: active && fresh ? '#76FF03' : '#D0B88F' }]}>{ended ? 'Recording stopped' : active ? fresh ? '● GPS RECORDING ACTIVE' : 'WAITING FOR RELIABLE GPS' : 'GPS RECORDING PAUSED'}</Text>
      <Text style={s.speed}>{speed ?? '—'}</Text><Text style={s.unit}>MPH</Text>
      <View style={s.grid}>
        <Metric label="DISTANCE" value={(distance / 1609.344).toFixed(2) + ' mi'} />
        <Metric label="ACTIVE TIME" value={formatDurationMs(duration)} />
        <Metric label="AVERAGE SPEED" value={average + ' mph'} />
        <Metric label="GPS ACCURACY" value={sample?.accuracyM != null ? '±' + Math.round(sample.accuracyM) + ' m' : 'Waiting'} />
        <Metric label="GPS SAMPLES" value={String(drive.state.samples.length)} />
        <Metric label="G-FORCE" value="Unavailable" />
      </View>
      <Text style={s.note}>G-force requires a motion-sensor-enabled build and a securely mounted phone. These metrics confirm recording; they do not verify territory completion.</Text>
      {!ended ? <View style={s.row}>
        <Pressable disabled={busy} style={s.primary} onPress={active ? onPause : onResume}><Text style={s.primaryText}>{active ? 'PAUSE RUN' : 'RESUME RUN'}</Text></Pressable>
        <Pressable disabled={busy} style={s.end} onPress={onEnd}><Text style={s.link}>{temporary ? 'END RUN' : 'END & SAVE'}</Text></Pressable>
      </View> : null}
      <Text style={s.note}>Keep the app open. Locking the phone or switching apps pauses recording.{temporary ? ' Storage is temporary until the updated iPhone build is installed.' : ''}</Text>
    </ScrollView>
  </Modal>;
}
function Metric({ label, value }: { label: string; value: string }) { return <View style={s.metric}><Text style={s.label}>{label}</Text><Text style={s.value}>{value}</Text></View>; }
const s = StyleSheet.create({
 brandHeader: { width: '100%', maxWidth: 310, height: 58, alignSelf: 'center', marginBottom: 14 },
 root: { flex: 1, backgroundColor: '#080B0C' }, row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
 kicker: { color: '#D0B88F', fontSize: 11 }, link: { color: '#D0B88F', fontSize: 12, fontWeight: '700' },
 title: { color: '#FFFFFF', fontSize: 34, lineHeight: 44, fontFamily: 'BarlowCondensed_700Bold', marginTop: 24 }, status: { fontSize: 12, marginTop: 10 },
 speed: { color: '#FFFFFF', textAlign: 'center', fontSize: 110, lineHeight: 132, fontFamily: 'BarlowCondensed_700Bold', marginTop: 18 }, unit: { color: '#76FF03', textAlign: 'center', fontSize: 16, marginBottom: 25 },
 grid: { flexDirection: 'row', flexWrap: 'wrap' }, metric: { width: '50%', paddingVertical: 18, borderTopWidth: 1, borderColor: '#283331' },
 label: { color: '#AAB5B0', fontSize: 10 }, value: { color: '#FFFFFF', fontSize: 23, lineHeight: 32, marginTop: 7 },
 note: { color: '#AAB5B0', fontSize: 11, lineHeight: 17, marginVertical: 16 }, primary: { flex: 1, backgroundColor: '#76FF03', padding: 18, borderRadius: 5, alignItems: 'center' },
 primaryText: { color: '#080B0C', fontWeight: '700', fontSize: 13 }, end: { padding: 16, borderColor: '#D0B88F', borderWidth: 1, borderRadius: 5 },
});
