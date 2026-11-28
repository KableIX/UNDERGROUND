import { useEffect, useRef, useState, type RefObject } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { CameraView as CameraViewType } from 'expo-camera';
import { loadCamera } from './native';
import { Brackets, GOLD } from './ScanOverlay';

/*
 * The live viewfinder, in the gold-and-black of the rest of SupercarGO. It opens
 * straight into the camera like a QR scanner: no gallery, no picker, camera only.
 * The preview is cropped to the same 3:4 frame the photo is taken in, so what is
 * inside the brackets is what gets scanned. Needs expo-camera (a newer development
 * build); the capture screen checks that and otherwise opens the system camera.
 */

export type FinderRef = RefObject<CameraViewType>;

export function LiveFinder({
  cameraRef,
  busy,
  message,
  reduceMotion,
  onShutter,
  onBack,
  onFailed,
}: {
  cameraRef: FinderRef;
  busy: boolean;
  message: string;
  reduceMotion: boolean;
  onShutter: () => void;
  onBack: () => void;
  /** The preview could not start. The screen falls back to the system camera. */
  onFailed: () => void;
}) {
  const Camera = loadCamera();
  const inset = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [ready, setReady] = useState(false);
  const breathe = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion) return;
    const run = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 1, duration: 1700, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        Animated.timing(breathe, { toValue: 0, duration: 1700, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
      ]),
    );
    run.start();
    return () => run.stop();
  }, [breathe, reduceMotion]);

  if (!Camera) return null;
  const { CameraView } = Camera;
  // Room for the header above and the shutter below; the frame is 3:4 portrait.
  const room = height - inset.top - inset.bottom - 64 - 190;
  const frameW = Math.min(width, Math.round((room * 3) / 4));
  const frameH = Math.round((frameW * 4) / 3);
  const bracketInset = reduceMotion ? 18 : breathe.interpolate({ inputRange: [0, 1], outputRange: [14, 22] });

  return (
    <View style={s.root}>
      <View style={{ paddingTop: inset.top + 12, paddingHorizontal: 20, height: inset.top + 64 }}>
        <Pressable accessibilityRole="button" onPress={onBack} disabled={busy} hitSlop={12}>
          <Text style={s.back}>‹ SUPERCARGO</Text>
        </Pressable>
      </View>

      <View style={{ width: frameW, height: frameH, alignSelf: 'center', backgroundColor: '#000', overflow: 'hidden' }}>
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing="back"
          mode="picture"
          animateShutter={false}
          onCameraReady={() => setReady(true)}
          onMountError={onFailed}
        />
        <LinearGradient pointerEvents="none" colors={['rgba(0,0,0,0.5)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.55)']} locations={[0, 0.22, 0.75, 1]} style={StyleSheet.absoluteFill} />
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          {[1, 2].map((i) => (
            <View key={'v' + i} style={{ position: 'absolute', top: 0, bottom: 0, left: `${(i * 100) / 3}%`, width: StyleSheet.hairlineWidth, backgroundColor: GOLD, opacity: 0.16 }} />
          ))}
          {[1, 2].map((i) => (
            <View key={'h' + i} style={{ position: 'absolute', left: 0, right: 0, top: `${(i * 100) / 3}%`, height: StyleSheet.hairlineWidth, backgroundColor: GOLD, opacity: 0.16 }} />
          ))}
        </View>
        <Brackets inset={bracketInset} />
        <View pointerEvents="none" style={s.captionWrap}>
          <Text style={s.caption}>{busy ? 'HOLD STEADY' : 'FRAME THE CAR'}</Text>
        </View>
      </View>

      <View style={s.controls}>
        {message ? (
          <Text accessibilityLiveRegion="polite" style={s.message}>
            {message}
          </Text>
        ) : (
          <Text style={s.hint}>One tap scans. Plates and faces are blurred before anything is shared.</Text>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Scan the car"
          disabled={busy || !ready}
          onPress={onShutter}
          style={({ pressed }) => [s.shutter, pressed && s.shutterPressed, (busy || !ready) && { opacity: 0.45 }]}
        >
          <LinearGradient colors={['#F4E2B6', '#D2B27C', '#A9864C']} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={s.shutterCore} />
        </Pressable>
        <Text style={s.label}>{busy ? 'SCANNING' : ready ? 'SCAN' : 'STARTING CAMERA'}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#050506' },
  back: { fontFamily: 'DMSans_600SemiBold', fontSize: 14, letterSpacing: 1, color: '#C6B08B' },
  captionWrap: { position: 'absolute', left: 0, right: 0, bottom: 20, alignItems: 'center' },
  caption: { fontFamily: 'Cinzel_600SemiBold', fontSize: 13, letterSpacing: 6, color: GOLD, textShadowColor: 'rgba(0,0,0,0.7)', textShadowRadius: 6, textShadowOffset: { width: 0, height: 1 } },
  controls: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 28 },
  hint: { fontFamily: 'DMSans_400Regular', fontSize: 12, color: '#8F8F92', textAlign: 'center' },
  message: { fontFamily: 'DMSans_500Medium', fontSize: 13, color: '#E7C892', textAlign: 'center' },
  shutter: { width: 82, height: 82, borderRadius: 41, borderWidth: 2, borderColor: '#8F7A52', alignItems: 'center', justifyContent: 'center', shadowColor: '#E6B755', shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 0 } },
  shutterPressed: { transform: [{ scale: 0.94 }], shadowOpacity: 0.85 },
  shutterCore: { width: 64, height: 64, borderRadius: 32 },
  label: { fontFamily: 'DMSans_600SemiBold', fontSize: 11, letterSpacing: 4, color: '#8F7A52' },
});
