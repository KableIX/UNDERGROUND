import { useCallback, useRef, useState } from 'react';
import { AppState, Linking, Pressable, StyleSheet, Switch, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { requireOptionalNativeModule } from 'expo-modules-core';
import type { Audio, AVPlaybackStatus } from 'expo-av';
import { Text } from '@underground/ui';
import { audioFile } from './page';
import { guidanceActive, onGuidanceStart } from './soundtrack-session';

type PlayerState = 'ready' | 'loading' | 'playing' | 'paused' | 'failed';
export function Soundtrack({
  url,
  title,
  viewer,
  preview = false,
}: {
  url: string;
  title: string;
  viewer: string;
  preview?: boolean;
}) {
  const direct = audioFile(url);
  const [phase, setPhase] = useState<PlayerState>('ready'),
    [error, setError] = useState('');
  const [automatic, setAutomatic] = useState(false);
  const sound = useRef<Audio.Sound | null>(null),
    epoch = useRef(0),
    focused = useRef(false);
  const preference = 'profile.audio.' + viewer;
  const stop = useCallback(() => {
    epoch.current++;
    const current = sound.current;
    sound.current = null;
    if (current) {
      current.setOnPlaybackStatusUpdate(null);
      void current.unloadAsync().catch(() => {});
    }
    setPhase('ready');
  }, []);
  const play = useCallback(async () => {
    if (!focused.current || AppState.currentState === 'background' || guidanceActive()) {
      setError('Page audio is paused during navigation.');
      return;
    }
    if (!requireOptionalNativeModule('ExponentAV')) {
      setError('In-page audio needs the audio-enabled iOS build.');
      return;
    }
    const tag = ++epoch.current;
    setPhase('loading');
    setError('');
    try {
      const { Audio } = require('expo-av') as typeof import('expo-av');
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      });
      if (tag !== epoch.current) return;
      let player = sound.current;
      if (!player) {
        const created = await Audio.Sound.createAsync(
          { uri: url },
          { shouldPlay: false },
          undefined,
          false,
        );
        player = created.sound;
        if (tag !== epoch.current) {
          await player.unloadAsync();
          return;
        }
        sound.current = player;
      }
      player.setOnPlaybackStatusUpdate((status: AVPlaybackStatus) => {
        if (tag !== epoch.current) return;
        if (!status.isLoaded) {
          if (status.error) {
            stop();
            setPhase('failed');
            setError('This audio file could not be played.');
          }
        } else if (status.didJustFinish) {
          stop();
        }
      });
      await player.playAsync();
      if (tag === epoch.current) setPhase('playing');
    } catch {
      if (tag === epoch.current) {
        stop();
        setPhase('failed');
        setError('Could not play this file. Check the link or try again.');
      }
    }
  }, [url, stop]);
  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      let active = true;
      const initial = epoch.current;
      setError('');
      setAutomatic(false);
      if (direct && !preview) {
        const prefs = require('expo-secure-store') as typeof import('expo-secure-store');
        void prefs
          .getItemAsync(preference)
          .then((value) => {
            if (!active) return;
            setAutomatic(value === 'on');
            if (
              value === 'on' &&
              initial === epoch.current &&
              !guidanceActive() &&
              AppState.currentState === 'active'
            )
              void play();
          })
          .catch(() => {});
      }
      const off = onGuidanceStart(stop);
      const app = AppState.addEventListener('change', (state) => {
        if (state !== 'active') stop();
      });
      return () => {
        active = false;
        focused.current = false;
        off();
        app.remove();
        stop();
      };
    }, [direct, preference, preview, play, stop]),
  );
  async function toggleAuto(value: boolean) {
    try {
      await (require('expo-secure-store') as typeof import('expo-secure-store')).setItemAsync(
        preference,
        value ? 'on' : 'off',
      );
      setAutomatic(value);
      if (!value) stop();
    } catch {
      setError('Could not save your listening preference.');
    }
  }
  async function press() {
    if (!direct) {
      try {
        await Linking.openURL(url);
      } catch {
        setError('Could not open the music provider.');
      }
      return;
    }
    if (phase === 'playing' && sound.current) {
      const tag = epoch.current;
      try {
        await sound.current.pauseAsync();
        if (tag === epoch.current) setPhase('paused');
      } catch {
        stop();
      }
    } else await play();
  }
  const label = direct
    ? { ready: 'Play', playing: 'Pause', paused: 'Resume', loading: 'Loading…', failed: 'Retry' }[
        phase
      ]
    : new URL(url).hostname === 'open.spotify.com'
      ? 'Listen on Spotify'
      : 'Listen on Apple Music';
  return (
    <View style={s.block}>
      {!!title && <Text style={s.title}>{title}</Text>}
      <Pressable
        accessibilityRole="button"
        onPress={() => void press()}
        disabled={phase === 'loading'}
        style={s.control}
      >
        <Text style={s.play}>{label}</Text>
      </Pressable>
      {direct && !preview && (
        <View style={s.pref}>
          <Text style={s.label}>Autoplay on profile visits</Text>
          <Switch
            accessibilityLabel="Autoplay on profile visits"
            value={automatic}
            onValueChange={(v) => void toggleAuto(v)}
          />
        </View>
      )}
      {!!error && (
        <Text accessibilityRole="alert" style={s.label}>
          {error}
        </Text>
      )}
    </View>
  );
}
const s = StyleSheet.create({
  block: { gap: 8 },
  title: { color: '#F4F2EC', fontSize: 18 },
  control: {
    alignSelf: 'flex-start',
    paddingHorizontal: 18,
    minHeight: 44,
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 22,
    borderColor: '#8D959B',
  },
  play: { color: '#FFF', fontWeight: '700' },
  pref: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { color: '#D0D1D4', fontSize: 13 },
});
