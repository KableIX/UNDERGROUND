import { reserveGuidanceAudio } from '../profile/soundtrack-session';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { britishVoices, claimCue, spokenInstruction, type Voice, type VoiceCue } from './navigation-voice';

import {clipPlayer,recordedPrompt} from './guidance-audio';
const emma:Voice={name:'Emma',identifier:'underground.emma',language:'en-GB',quality:'Premium'};
type Speech = typeof import('expo-speech');
type NavigationAudio = {
  speakNavigationPrompt(text: string, voice: string | null): Promise<void>;
  stopNavigationPrompt(): Promise<void>;
};
type Speaker = { native: NavigationAudio | null; speech: Speech | null; audio:boolean };
const preference = 'navigation.voice.woman.v2';
const sample = 'In a quarter mile, turn left onto Saratoga Avenue.';
async function preferences() {
  return require('expo-secure-store') as typeof import('expo-secure-store');
}
function stop(output: Speaker) {
  void output.native?.stopNavigationPrompt().catch(() => {});
  void output.speech?.stop().catch(() => {});
}

export function useNavigationVoice(enabled: boolean, reliable: boolean, cue: VoiceCue | null, scope: object | string | null, maneuver?:string) {
  useEffect(() => enabled ? reserveGuidanceAudio() : undefined, [enabled]);
  const [speaker, setSpeaker] = useState<Speaker | null>(null);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [selected, setSelected] = useState<string>();
  const [error, setError] = useState('');
  const [needsUpdate, setNeedsUpdate] = useState(false);
  const [muted, setMuted] = useState(false);
  const [foreground, setForeground] = useState(AppState.currentState == null || AppState.currentState === 'active');
  const [player]=useState(clipPlayer);
  const revision = useRef(0);
  const seen = useRef(new Set<string>());
  const last = useRef<{key: string; time: number} | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const module = requireOptionalNativeModule<NavigationAudio>('UndergroundDirections');
    const native = typeof module?.speakNavigationPrompt === 'function' && typeof module.stopNavigationPrompt === 'function' ? module : null;
    const speech: Speech | null = requireOptionalNativeModule('ExpoSpeech') ? require('expo-speech') : null;
    const audio=!!requireOptionalNativeModule('ExponentAV');
    const output = { native, speech, audio };
    const active = () => AppState.currentState == null || AppState.currentState === 'active';
    let refresh = 0;
    const discover = async () => {
      const tag = ++refresh;
      const [installed, saved] = await Promise.all([
        speech?.getAvailableVoicesAsync().catch(() => []) ?? [],
        preferences().then(p => p.getItemAsync(preference)).catch(() => null),
      ]);
      if (!alive || tag !== refresh) return;
      const options = [...(audio?[emma]:[]),...britishVoices(installed)];
      setVoices(options);
      setSelected(options.find(v => v.identifier === saved)?.identifier ?? options[0]?.identifier);
      setSpeaker(options.length ? output : null);
      if(!options.length)setError('British female guidance is unavailable in this build.');
    };
    setNeedsUpdate(!audio && !native && !speech);
    setError(audio || native || speech ? '' : 'This build supports on-screen turns only.');
    setForeground(active());
    void discover();
    const listener = AppState.addEventListener('change', state => {
      setForeground(state === 'active');
      if (state === 'active') void discover();
    });
    return () => { alive = false; listener.remove(); ++revision.current; void player.stop(); stop(output); };
  }, [enabled]);

  const play = useCallback((text: string, voice = selected, key='sample', original?:string) => {
    if (!enabled || !speaker || !foreground) return;
    const current = ++revision.current;
    setError('');
    const failed = () => { if (current === revision.current) setError('Could not play guidance. Tap Test voice to retry.'); };
    const line = spokenInstruction(text);
    const output = speaker;
    async function speak() {
      const deviceVoice=voice===emma.identifier?voices.find(v=>v.identifier!==emma.identifier)?.identifier:voice;
      const asset=recordedPrompt(key,line,original,!deviceVoice);
      if(voice===emma.identifier && asset!==undefined && output.audio){
        stop(output);
        try{await player.play(asset);return;}catch{if(current!==revision.current)return;}
      }
      await player.stop();
      if(current!==revision.current || !deviceVoice){failed();return;}
      if (output.native) {
        try { await output.native.speakNavigationPrompt(line, deviceVoice); return; }
        catch { if (current !== revision.current) return; }
      }
      const speech = output.speech;
      if (!speech) { failed(); return; }
      await speech.stop();
      if (current === revision.current) speech.speak(line, { language: 'en-GB', voice:deviceVoice, rate: 0.94, onError: failed });
    }
    void speak().catch(failed);
  }, [enabled, speaker, foreground, selected, player, voices]);

  useEffect(() => { seen.current.clear(); last.current = null; }, [enabled, scope]);
  useEffect(() => {
    if (speaker && (muted || !foreground)) { ++revision.current; void player.stop(); stop(speaker); }
  }, [speaker, muted, foreground]);
  useEffect(() => {
    if (!enabled || !speaker || muted || !foreground || !reliable) return;
    if (!cue?.key.includes('off-route')) {
      seen.current.delete('off-route'); seen.current.delete('approach-off-route');
    }
    if (!cue) return;
    const time = Date.now();
    if (!claimCue(seen.current, last.current, cue.key, time)) return;
    last.current = { key: cue.key, time };
    play(cue.text,selected,cue.key, /-(ahead|now|continue)$/.test(cue.key)?maneuver:undefined);
  }, [enabled, speaker, scope, muted, foreground, reliable, cue?.key, cue?.text, play, selected, maneuver]);

  function choose(id: string) {
    setSelected(id);
    void preferences().then(p => p.setItemAsync(preference, id)).catch(() => {});
    play(sample, id);
  }
  return { error, needsUpdate, muted, voices, selected, choose, ready: enabled && !!speaker && foreground,
    test: () => play(sample), toggle: () => setMuted(value => !value) };
}
