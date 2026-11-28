import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Platform, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { CameraView } from 'expo-camera';
import type { SupercargoCatalogEntry, SupercargoTier } from '@underground/domain';
import { useSession } from '../../src/session/SessionContext';
import { saveSpot } from '../../src/spotted/collection';
import { suggestModel } from '../../src/spotted/photo';
import { CarArt } from '../../src/supercargo/CarArt';
import { captureNonce, countMySpots, photoUrl, readMySighting, submitSighting } from '../../src/supercargo/client';
import { sightingOutcome, supercargoCopy, tierLabel, tierNote } from '../../src/supercargo/copy';
import { currentFix } from '../../src/supercargo/location';
import { haptic, loadCamera, loadViewShot } from '../../src/supercargo/native';
import {
  areaLabel,
  catalogById,
  confidenceCue,
  finishFor,
  matchCatalog,
  needsChoice,
  productionLine,
  rankCandidates,
  shareMessage,
  similarInCatalog,
  type Candidate,
  type Cue,
} from '../../src/supercargo/scan';
import { Brackets, ScanOverlay } from '../../src/supercargo/ScanOverlay';
import { GoldButton, LineButton, RaritySeal, SpotCard } from '../../src/supercargo/SpotCard';
import { ui } from '../../src/supercargo/ui';
import { useFoilMotion } from '../../src/supercargo/useFoilMotion';
import { useReduceMotion } from '../../src/supercargo/useReduceMotion';
import { LiveFinder } from '../../src/supercargo/Viewfinder';

type Shot = { original: string; uri: string; width: number; height: number; base64: string; capturedAt: string; nonce: string; fix: Awaited<ReturnType<typeof currentFix>> };
type Phase = 'ready' | 'scanning' | 'reveal' | 'card';
type Card = {
  sightingId: string | null;
  make: string;
  model: string;
  tier: SupercargoTier;
  entry: SupercargoCatalogEntry | null;
  catalogId: string | null;
  photoUri: string | null;
  spottedAt: string;
  area: string | null;
  spotNumber: number | null;
};

const GOLD = '#E7C892';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

type Fix = Awaited<ReturnType<typeof currentFix>>;

/** Re-encode a fresh photo: smaller, and with every EXIF field, location included, dropped. */
async function packShot(asset: { uri: string; width: number; height: number }, nonce: string, fixBefore: Fix, capturedAt: string): Promise<Shot> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const tools = require('expo-image-manipulator') as typeof import('expo-image-manipulator');
  const fix = await currentFix().catch(() => fixBefore);
  const resize = asset.width >= asset.height ? { width: Math.min(1280, asset.width) } : { height: Math.min(1280, asset.height) };
  const out = await tools.manipulateAsync(asset.uri, [{ resize }], { format: tools.SaveFormat.JPEG, compress: 0.8, base64: true });
  if (!out.base64) throw new Error('Could not read the photo.');
  return { original: asset.uri, uri: out.uri, width: out.width, height: out.height, base64: out.base64, capturedAt, nonce, fix };
}

/** Fallback: the system camera. Camera only. A library photo can be kept in Spotted, but it is never logged here. */
async function freshCapture(): Promise<Shot | null> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const picker = require('expo-image-picker') as typeof import('expo-image-picker');
  if (!(await picker.requestCameraPermissionsAsync()).granted) throw new Error('Allow camera access in Settings.');
  const [{ nonce }, fixBefore] = await Promise.all([captureNonce(), currentFix()]);
  const result = await picker.launchCameraAsync({ mediaTypes: picker.MediaTypeOptions.Images, quality: 0.9, exif: false });
  if (result.canceled) return null;
  const capturedAt = new Date().toISOString();
  return packShot(result.assets[0]!, nonce, fixBefore, capturedAt);
}

/** The live viewfinder (expo-camera). The nonce and a fix are warmed up while the camera opens. */
type Warm = { nonce: string; fix: Fix; at: number };
async function warmUp(): Promise<Warm> {
  const [{ nonce }, fix] = await Promise.all([captureNonce(), currentFix()]);
  return { nonce, fix, at: Date.now() };
}
async function liveCapture(cam: CameraView, warm: Warm | null): Promise<Shot> {
  // A nonce is good for five minutes. Use the warm one for three, then ask again.
  const ready = warm && Date.now() - warm.at < 180_000 ? warm : await warmUp();
  const photo = await cam.takePictureAsync({ quality: 0.9, exif: false, skipProcessing: false });
  const capturedAt = new Date().toISOString();
  if (!photo) throw new Error('Could not take the photo. Try again.');
  return packShot(photo, ready.nonce, ready.fix, capturedAt);
}

/** Neighborhood or town of the fuzzed cell center. Never the capture point. */
async function areaOf(lat: number, lng: number) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Location = require('expo-location') as typeof import('expo-location');
    const [place] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    return areaLabel(place);
  } catch {
    return null;
  }
}

function CuePill({ cue }: { cue: Cue }) {
  const color = cue.level === 'strong' ? GOLD : cue.level === 'likely' ? '#B89C66' : '#8F8F92';
  return (
    <View style={s.cue} accessibilityLabel={`${cue.label}. ${cue.detail}`}>
      <View style={s.cueBars}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={{ width: 3, height: 6 + i * 3, backgroundColor: i < (cue.level === 'strong' ? 3 : cue.level === 'likely' ? 2 : 1) ? color : '#2C2D31' }} />
        ))}
      </View>
      <Text style={[s.cueLabel, { color }]}>{cue.label.toUpperCase()}</Text>
      <Text style={s.cueDetail}>{cue.detail}</Text>
    </View>
  );
}

function useEntrance(key: string, reduce: boolean) {
  const v = useRef(new Animated.Value(reduce ? 1 : 0)).current;
  useEffect(() => {
    if (reduce) {
      v.setValue(1);
      return;
    }
    v.setValue(0);
    Animated.timing(v, { toValue: 1, duration: 620, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [key, reduce, v]);
  return {
    opacity: v,
    transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }, { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) }],
  };
}

export default function Capture() {
  const router = useRouter();
  const inset = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const reduce = useReduceMotion();
  const { state } = useSession();
  const memberId = state.status === 'authenticated' ? state.member.memberId : null;
  const [phase, setPhase] = useState<Phase>('ready');
  const [shot, setShot] = useState<Shot | null>(null);
  const [locked, setLocked] = useState(false);
  const [slow, setSlow] = useState(false);
  const [cands, setCands] = useState<Candidate[]>([]);
  const [scanNote, setScanNote] = useState('');
  const [editing, setEditing] = useState(false);
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [card, setCard] = useState<Card | null>(null);
  // 'pending' while we check for the live camera; 'live' with expo-camera and permission; 'system' otherwise.
  const [mode, setMode] = useState<'pending' | 'live' | 'system'>('pending');
  const camRef = useRef<CameraView>(null);
  const warm = useRef<Warm | null>(null);
  const shareRef = useRef<View>(null);
  const lock = useRef(false);
  const scanSeq = useRef(0);
  const cardW = Math.min(width - 40, 420);

  const current = matchCatalog(make, model);
  const picked = cands.find((c) => same(c.make, make) && same(c.model, model));
  const cue: Cue = picked
    ? confidenceCue(picked)
    : make.trim() && model.trim()
      ? current
        ? { level: 'likely', label: 'Your pick', detail: 'Matched to the catalog. Not an AI result.' }
        : { level: 'unsure', label: 'Your pick', detail: 'Not in the catalog. It logs as Open.' }
      : confidenceCue(undefined);
  const revealStyle = useEntrance(phase === 'reveal' ? (current?.entry.id ?? 'none') : 'off', reduce);
  const cardStyle = useEntrance(phase === 'card' ? (card?.sightingId ?? 'card') : 'off', reduce);
  // Foil follows the tilt of the phone where this build has motion sensors.
  const motion = useFoilMotion(card ? finishFor(card.tier) : 'matte', phase === 'card' && !reduce);
  const canShareImage = loadViewShot() !== null;

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

  function showReveal(found: Candidate[], note: string, byHand = false) {
    const first = found[0] ? matchCatalog(found[0].make, found[0].model) : null;
    haptic('reveal', first?.tier ?? 'open');
    setCands(found);
    setScanNote(note);
    setMake(found[0]?.make ?? '');
    setModel(found[0]?.model ?? '');
    setEditing(byHand || found.length === 0);
    setPhase('reveal');
  }

  /** The ID starts the moment the photo exists. The sweep only frames the wait. */
  async function scan(next: Shot) {
    const id = ++scanSeq.current;
    setShot(next);
    setCard(null);
    setLocked(false);
    setSlow(false);
    setPhase('scanning');
    const started = Date.now();
    const slowTimer = setTimeout(() => setSlow(true), 7000);
    let found: Candidate[] = [];
    let note = '';
    try {
      found = rankCandidates(await suggestModel(next));
    } catch (e) {
      note = e instanceof Error ? e.message : 'No clear match. Enter the make and model.';
    } finally {
      clearTimeout(slowTimer);
    }
    if (scanSeq.current !== id) return;
    await sleep(Math.max(0, (reduce ? 250 : 1800) - (Date.now() - started)));
    if (scanSeq.current !== id) return;
    setLocked(true);
    haptic('lock');
    await sleep(reduce ? 0 : 640);
    if (scanSeq.current !== id) return;
    showReveal(found, note);
  }

  function takePhoto() {
    void act(async () => {
      const next = await freshCapture();
      if (next) void scan(next);
    });
  }

  function shutter() {
    const cam = camRef.current;
    if (!cam) return;
    void act(async () => {
      haptic('shutter');
      const next = await liveCapture(cam, warm.current);
      warm.current = null;
      void scan(next);
    });
  }

  // Like a QR scanner: Log a sighting opens straight into the camera. With expo-camera
  // (a newer development build) that is a live viewfinder in the app. Without it, or
  // without permission, it opens the system camera at once; the gold frame and
  // shutter further down are only the fallback after a cancel or an error.
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    void (async () => {
      const cam = loadCamera();
      if (cam) {
        try {
          if ((await cam.Camera.requestCameraPermissionsAsync()).granted) {
            setMode('live');
            void warmUp().then((w) => (warm.current = w)).catch(() => undefined);
            return;
          }
        } catch {
          // Fall through to the system camera.
        }
      }
      setMode('system');
      takePhoto();
    })();
  }, []);

  function enterByHand() {
    scanSeq.current++;
    showReveal([], '', true);
  }

  function logIt() {
    if (!shot) return;
    void act(async () => {
      const m = matchCatalog(make, model);
      const finalMake = m?.entry.make ?? make.trim();
      const finalModel = m?.entry.model ?? model.trim();
      const r = await submitSighting({ nonce: shot.nonce, jpeg: shot.base64, capturedAt: shot.capturedAt, fix: shot.fix, make: finalMake, model: finalModel });
      if (!r.ok) throw new Error(r.message ?? 'Not logged. Try again.');
      // The full-resolution original lives on this phone, in the private Spotted album.
      if (memberId) await saveSpot(memberId, shot.original, finalMake, finalModel, '').catch(() => undefined);
      setMessage(sightingOutcome(r) + ' ' + supercargoCopy.originalKept);
      const base: Card = {
        sightingId: r.id ?? null,
        make: finalMake,
        model: finalModel,
        tier: r.tier,
        entry: m?.entry ?? null,
        catalogId: m?.entry.id ?? null,
        photoUri: null,
        spottedAt: shot.capturedAt,
        area: null,
        spotNumber: null,
      };
      setCard(base);
      setPhase('card');
      haptic('card', r.tier);
      if (!r.id) return;
      // Fill in the rest from the member's own row: the blurred copy, the cell, the count.
      const row = await readMySighting(r.id).catch(() => null);
      if (!row) return;
      const [photo, area, spots] = await Promise.all([
        photoUrl(row.photo_path).catch(() => null),
        areaOf(row.cell_lat, row.cell_lng),
        row.catalog_id && row.credited ? countMySpots(row.catalog_id).catch(() => null) : Promise.resolve(null),
      ]);
      const entry = catalogById(row.catalog_id) ?? base.entry;
      setCard((c) => (c && c.sightingId === r.id ? { ...c, tier: row.tier ?? c.tier, entry, catalogId: row.catalog_id ?? c.catalogId, photoUri: photo, area, spotNumber: spots } : c));
    });
  }

  async function share() {
    if (!card) return;
    const text = shareMessage(card);
    // First choice: the card itself as an image. The hidden copy has no place on it.
    let image: string | null = null;
    const shot = loadViewShot();
    if (shot && shareRef.current) {
      try {
        // The off-screen copy loads its photo on its own: make sure it is in the cache and drawn first.
        if (card.photoUri) await Image.prefetch(card.photoUri).catch(() => false);
        await sleep(120);
        image = await shot.captureRef(shareRef, { format: 'png', quality: 1, result: 'tmpfile' });
      } catch {
        image = null;
      }
    }
    try {
      if (image) {
        await Share.share(Platform.OS === 'ios' ? { url: image, message: text } : { message: text });
      } else if (card.photoUri && Platform.OS === 'ios') {
        // Older build: only the blurred copy from the API is ever shared, never the original, and no place.
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const FileSystem = require('expo-file-system') as typeof import('expo-file-system');
        const local = `${FileSystem.cacheDirectory}underground-spot-${card.sightingId ?? 'card'}.jpg`;
        const { uri } = await FileSystem.downloadAsync(card.photoUri, local);
        await Share.share({ url: uri, message: text });
      } else {
        await Share.share({ message: text });
      }
    } catch {
      setMessage('Could not share. Try again.');
    }
  }

  function spotAnother() {
    setShot(null);
    setCard(null);
    setPhase('ready');
    setMessage('');
    if (mode === 'live') {
      void warmUp().then((w) => (warm.current = w)).catch(() => undefined);
      return;
    }
    takePhoto();
  }

  const photoH = shot ? Math.min(Math.round(((width - 40) * shot.height) / shot.width), 460) : 0;
  const shownTier: SupercargoTier = current?.tier ?? 'open';
  const showChoices = cands.length > 1 && (needsChoice(cands) || !picked || picked !== cands[0]);
  const hints = editing && make.trim() && !current ? similarInCatalog(make, model) : [];

  if (phase === 'ready' && mode === 'pending') return <View style={{ flex: 1, backgroundColor: '#050506' }} />;
  if (phase === 'ready' && mode === 'live')
    return (
      <LiveFinder
        cameraRef={camRef}
        busy={busy}
        message={message}
        reduceMotion={reduce}
        onShutter={shutter}
        onBack={() => router.back()}
        onFailed={() => {
          setMode('system');
          takePhoto();
        }}
      />
    );

  const shareW = 360;
  return (
    <View style={{ flex: 1 }}>
    <ScrollView style={ui.screen} keyboardShouldPersistTaps="handled" contentContainerStyle={[ui.content, { paddingTop: inset.top + 12, paddingBottom: inset.bottom + 40 }]}>
      <Pressable accessibilityRole="button" onPress={() => router.back()} disabled={busy && phase !== 'card'}>
        <Text style={ui.back}>‹ SUPERCARGO</Text>
      </Pressable>

      {phase === 'ready' ? (
        <>
          <Text style={s.kicker}>SUPERCARGO · CAPTURE</Text>
          <Text style={ui.heading}>Log a sighting</Text>
          <View style={[s.finder, { height: Math.round(((width - 40) * 3) / 4) }]}>
            <LinearGradient colors={['#14120E', '#08090A']} style={StyleSheet.absoluteFill} />
            <Brackets inset={18} />
            <Text style={s.finderText}>FRAME THE CAR</Text>
            <Text style={s.finderSub}>Fresh captures only. Plates and faces are blurred before anything is shared.</Text>
          </View>
          {message ? <Text accessibilityLiveRegion="polite" style={ui.notice}>{message}</Text> : null}
          <View style={{ alignItems: 'center', gap: 10, marginTop: 4 }}>
            <Pressable accessibilityRole="button" accessibilityLabel="Take the photo" disabled={busy} onPress={takePhoto} style={({ pressed }) => [s.shutter, pressed && s.shutterPressed, busy && { opacity: 0.5 }]}>
              <LinearGradient colors={['#F4E2B6', '#D2B27C', '#A9864C']} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={s.shutterCore} />
            </Pressable>
            <Text style={s.caption}>{busy ? 'OPENING CAMERA' : 'OPEN THE CAMERA AGAIN'}</Text>
          </View>
        </>
      ) : null}

      {shot && (phase === 'scanning' || phase === 'reveal') ? (
        <View style={[s.photo, { height: photoH }]}>
          <Image source={{ uri: shot.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityIgnoresInvertColors />
          {phase === 'scanning' ? <ScanOverlay locked={locked} reduceMotion={reduce} /> : <Brackets inset={34} locked />}
        </View>
      ) : null}

      {phase === 'scanning' ? (
        <View style={{ alignItems: 'center', gap: 6 }} accessibilityLiveRegion="polite">
          <Text style={s.scanTitle}>{locked ? 'LOCKED' : 'IDENTIFYING'}</Text>
          <Text style={s.scanSub}>{slow && !locked ? 'Still working. The first scan after a quiet spell can take up to a minute.' : 'Reading the car from your photo.'}</Text>
          {slow && !locked ? (
            <Pressable accessibilityRole="button" onPress={enterByHand}>
              <Text style={s.link}>Enter it myself</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {phase === 'reveal' ? (
        <Animated.View style={[{ gap: 16 }, revealStyle]}>
          {scanNote ? <Text style={ui.notice}>{scanNote}</Text> : null}
          {make.trim() && model.trim() ? (
            <View style={s.reveal}>
              {current ? (
                <View style={{ alignItems: 'center' }}>
                  <CarArt catalogId={current.entry.id} width={Math.min(cardW - 32, 320)} />
                </View>
              ) : null}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={s.revealMake}>{(current?.entry.make ?? make).toUpperCase()}</Text>
                  <Text style={s.revealModel} numberOfLines={2} adjustsFontSizeToFit>
                    {current?.entry.model ?? model}
                  </Text>
                  <Text style={ui.body}>{current ? productionLine(current.entry) : 'Not in the catalog'}</Text>
                </View>
                <RaritySeal tier={shownTier} size={58} />
              </View>
              <Text style={s.tierNote}>
                {tierLabel(shownTier)} · {tierNote(shownTier)}
              </Text>
              <CuePill cue={cue} />
            </View>
          ) : null}

          {showChoices ? (
            <View style={{ gap: 8 }}>
              <Text style={s.caption}>WHICH ONE IS IT?</Text>
              {cands.map((c) => {
                const on = same(c.make, make) && same(c.model, model);
                return (
                  <Pressable key={c.make + c.model} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => { haptic('select'); setMake(c.make); setModel(c.model); setEditing(false); }} style={[s.choice, on && s.choiceOn]}>
                    {c.match ? <CarArt catalogId={c.match.entry.id} width={72} /> : <View style={{ width: 72, height: 54, backgroundColor: '#000' }} />}
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={s.choiceName}>
                        {c.make} {c.model}
                      </Text>
                      <Text style={ui.body}>
                        {c.match ? tierLabel(c.match.tier) : 'Not in the catalog'}
                        {c.confidence !== null ? ` · AI ${Math.round(c.confidence * 100)}%` : ''}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {!editing ? (
            <Pressable accessibilityRole="button" onPress={() => setEditing(true)}>
              <Text style={s.link}>Not right? Edit</Text>
            </Pressable>
          ) : (
            <View style={{ gap: 8 }}>
              <Text style={s.caption}>MAKE</Text>
              <TextInput value={make} onChangeText={setMake} maxLength={80} autoCorrect={false} style={s.field} accessibilityLabel="Make" placeholder="Ferrari" placeholderTextColor="#5A5B60" />
              <Text style={s.caption}>MODEL</Text>
              <TextInput value={model} onChangeText={setModel} maxLength={100} autoCorrect={false} style={s.field} accessibilityLabel="Model" placeholder="F40" placeholderTextColor="#5A5B60" />
              <Text style={ui.body}>{current ? `In the catalog as ${current.entry.make} ${current.entry.model} · ${tierLabel(current.tier)}` : make.trim() && model.trim() ? 'Not in the catalog. It logs as Open.' : 'Type the make and model.'}</Text>
              {hints.length ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {hints.map((h) => (
                    <Pressable key={h.id} accessibilityRole="button" onPress={() => { setMake(h.make); setModel(h.model); }} style={s.chip}>
                      <Text style={s.chipText}>{h.model}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>
          )}

          {message ? <Text accessibilityLiveRegion="polite" style={ui.notice}>{message}</Text> : null}
          <GoldButton title={busy ? 'LOGGING…' : 'LOG IT'} disabled={busy || !make.trim() || !model.trim()} onPress={logIt} />
          <LineButton title="RETAKE" disabled={busy} onPress={spotAnother} />
        </Animated.View>
      ) : null}

      {phase === 'card' && card ? (
        <Animated.View style={[{ gap: 16 }, cardStyle]}>
          <Text style={s.kicker}>ADDED TO YOUR SPOTS</Text>
          <SpotCard {...card} reduceMotion={reduce} width={cardW} motion={motion} />
          {message ? <Text accessibilityLiveRegion="polite" style={[ui.body, { textAlign: 'center' }]}>{message}</Text> : null}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <LineButton title="SPOT ANOTHER" disabled={busy} onPress={spotAnother} />
            </View>
            <View style={{ flex: 1 }}>
              <LineButton title="SHARE" disabled={busy} onPress={() => void share()} />
            </View>
          </View>
          <Pressable accessibilityRole="button" onPress={() => router.replace({ pathname: '/(tabs)/supercargo', params: { section: 'ledger' } })}>
            <Text style={[s.link, { textAlign: 'center' }]}>Open the Ledger</Text>
          </Pressable>
        </Animated.View>
      ) : null}
    </ScrollView>
    {/* Rendered off screen so SHARE can send the card as an image. Still foil, and no place on it. */}
    {canShareImage && phase === 'card' && card ? (
      <View ref={shareRef} collapsable={false} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ position: 'absolute', left: -5000, top: 0, width: shareW, backgroundColor: '#050506', padding: 12 }}>
        <SpotCard {...card} area={null} reduceMotion width={shareW - 24} />
      </View>
    ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  kicker: { fontFamily: 'DMSans_600SemiBold', fontSize: 11, letterSpacing: 3, color: GOLD },
  caption: { fontFamily: 'DMSans_500Medium', fontSize: 11, letterSpacing: 2.2, color: '#8F8F92' },
  finder: { borderWidth: StyleSheet.hairlineWidth, borderColor: '#3A3B40', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 40, overflow: 'hidden' },
  finderText: { fontFamily: 'Cinzel_600SemiBold', fontSize: 16, letterSpacing: 5, color: GOLD },
  finderSub: { fontFamily: 'DMSans_400Regular', fontSize: 13, lineHeight: 19, color: '#8F8F92', textAlign: 'center' },
  shutter: { width: 82, height: 82, borderRadius: 41, borderWidth: 1.5, borderColor: GOLD, alignItems: 'center', justifyContent: 'center', shadowColor: '#E6B755', shadowOpacity: 0.45, shadowRadius: 12, shadowOffset: { width: 0, height: 0 } },
  shutterPressed: { transform: [{ scale: 0.94 }], shadowOpacity: 0.85 },
  shutterCore: { width: 64, height: 64, borderRadius: 32 },
  photo: { width: '100%', overflow: 'hidden', backgroundColor: '#000' },
  scanTitle: { fontFamily: 'Cinzel_600SemiBold', fontSize: 15, letterSpacing: 6, color: GOLD },
  scanSub: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: '#8F8F92', textAlign: 'center' },
  link: { fontFamily: 'DMSans_600SemiBold', fontSize: 14, color: GOLD, paddingVertical: 6 },
  reveal: { gap: 12, padding: 16, backgroundColor: '#0D0D0F', borderWidth: StyleSheet.hairlineWidth, borderColor: '#5E4C30' },
  revealMake: { fontFamily: 'DMSans_600SemiBold', fontSize: 12, letterSpacing: 3.5, color: '#C6B08B' },
  revealModel: { fontFamily: 'BarlowCondensed_700Bold', fontSize: 52, lineHeight: 56, color: '#F4F2ED' },
  tierNote: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: '#B7B7B8' },
  cue: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderColor: '#2A2B30' },
  cueBars: { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  cueLabel: { fontFamily: 'DMSans_600SemiBold', fontSize: 11, letterSpacing: 2 },
  cueDetail: { fontFamily: 'DMSans_400Regular', fontSize: 12, color: '#8F8F92', flexShrink: 1 },
  choice: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 8, borderWidth: 1, borderColor: '#24252A', backgroundColor: '#0D0D0F' },
  choiceOn: { borderColor: GOLD },
  choiceName: { fontFamily: 'BarlowCondensed_700Bold', fontSize: 22, color: '#F4F2ED' },
  field: { padding: 12, borderColor: '#2C2D31', borderWidth: 1, backgroundColor: '#111215', color: '#F4F2ED', fontSize: 17 },
  chip: { paddingVertical: 6, paddingHorizontal: 10, borderWidth: 1, borderColor: '#5E4C30' },
  chipText: { fontFamily: 'DMSans_500Medium', fontSize: 13, color: '#E8E2D6' },
});
