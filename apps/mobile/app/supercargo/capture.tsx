import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FittedPhoto } from '../../src/components/FittedPhoto';
import { useSession } from '../../src/session/SessionContext';
import { saveSpot } from '../../src/spotted/collection';
import { suggestModel } from '../../src/spotted/photo';
import { captureNonce, submitSighting } from '../../src/supercargo/client';
import { sightingOutcome, supercargoCopy } from '../../src/supercargo/copy';
import { currentFix } from '../../src/supercargo/location';
import { Action, Caption, ui } from '../../src/supercargo/ui';

type Shot = { original: string; uri: string; width: number; height: number; base64: string; capturedAt: string; nonce: string; fix: Awaited<ReturnType<typeof currentFix>> };

/** Camera only. A library photo can be kept in Spotted, but it is never logged here. */
async function freshCapture(): Promise<Shot | null> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const picker = require('expo-image-picker') as typeof import('expo-image-picker');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const tools = require('expo-image-manipulator') as typeof import('expo-image-manipulator');
  if (!(await picker.requestCameraPermissionsAsync()).granted) throw new Error('Allow camera access in Settings.');
  const [{ nonce }, fixBefore] = await Promise.all([captureNonce(), currentFix()]);
  const result = await picker.launchCameraAsync({ mediaTypes: picker.MediaTypeOptions.Images, quality: 0.9, exif: false });
  if (result.canceled) return null;
  const capturedAt = new Date().toISOString();
  const fix = await currentFix().catch(() => fixBefore);
  const asset = result.assets[0]!;
  const resize = asset.width >= asset.height ? { width: Math.min(1280, asset.width) } : { height: Math.min(1280, asset.height) };
  // Re-encoding drops every EXIF field, location included.
  const out = await tools.manipulateAsync(asset.uri, [{ resize }], { format: tools.SaveFormat.JPEG, compress: 0.8, base64: true });
  if (!out.base64) throw new Error('Could not read the photo.');
  return { original: asset.uri, uri: out.uri, width: out.width, height: out.height, base64: out.base64, capturedAt, nonce, fix };
}

export default function Capture() {
  const router = useRouter();
  const inset = useSafeAreaInsets();
  const { state } = useSession();
  const memberId = state.status === 'authenticated' ? state.member.memberId : null;
  const [shot, setShot] = useState<Shot | null>(null);
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [message, setMessage] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);

  async function act(work: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setMessage('');
    try {
      await work();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Try again.');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return (
    <ScrollView style={ui.screen} keyboardShouldPersistTaps="handled" contentContainerStyle={[ui.content, { paddingTop: inset.top + 12, paddingBottom: inset.bottom + 32 }]}>
      <Pressable accessibilityRole="button" onPress={() => router.back()} disabled={busy}>
        <Text style={ui.back}>‹ SUPERCARGO</Text>
      </Pressable>
      <Text style={ui.heading}>{shot ? 'Confirm' : 'Log a sighting'}</Text>
      <Text style={ui.body}>{supercargoCopy.captureNote}</Text>
      {message ? <Text accessibilityLiveRegion="polite" style={ui.notice}>{message}</Text> : null}
      {busy ? <ActivityIndicator color="#C6B08B" /> : null}
      {!shot ? (
        <Action primary title="Open camera" disabled={busy} onPress={() => void act(async () => {
          const next = await freshCapture();
          if (next) {
            setShot(next);
            setMake('');
            setModel('');
            setDone(false);
          }
        })} />
      ) : (
        <>
          <FittedPhoto source={{ uri: shot.uri }} />
          {!done ? (
            <>
              <Action title="Identify" disabled={busy} onPress={() => void act(async () => {
                const s = await suggestModel(shot);
                setMake(s.make);
                setModel(s.model);
                setMessage('Suggested. Confirm or correct it.');
              })} />
              <View style={{ gap: 6 }}>
                <Caption>MAKE</Caption>
                <TextInput value={make} onChangeText={setMake} maxLength={80} autoCorrect={false} style={field} accessibilityLabel="Make" />
                <Caption>MODEL</Caption>
                <TextInput value={model} onChangeText={setModel} maxLength={100} autoCorrect={false} style={field} accessibilityLabel="Model" />
              </View>
              <Action primary title="Log it" disabled={busy || !make.trim() || !model.trim()} onPress={() => void act(async () => {
                const r = await submitSighting({ nonce: shot.nonce, jpeg: shot.base64, capturedAt: shot.capturedAt, fix: shot.fix, make, model });
                // The full-resolution original lives on this phone, in the private Spotted album.
                if (memberId) await saveSpot(memberId, shot.original, make, model, '').catch(() => undefined);
                setMessage(sightingOutcome(r) + ' ' + supercargoCopy.originalKept);
                setDone(true);
              })} />
            </>
          ) : (
            <>
              <Action title="Log another" onPress={() => setShot(null)} />
              <Action title="The Ledger" onPress={() => router.replace({ pathname: '/(tabs)/supercargo', params: { section: 'ledger' } })} />
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}

const field = { padding: 12, borderColor: '#2C2D31', borderWidth: 1, backgroundColor: '#111215', color: '#F4F2ED', fontSize: 17 } as const;
