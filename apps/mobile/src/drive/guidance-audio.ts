import type {Audio as ExpoAudio} from 'expo-av';
import {clips} from './guidance-clips';
import {routeClips} from './route-clips';

const fixed:Record<string,string>={sample:'sample',meetup:'start',approach:'approach','approach-end':'approach-end','approach-off-route':'refresh','off-route':'off',finish:'finish'};
export function recordedPrompt(key:string,line:string,maneuver?:string,allowGeneric=false){
  if(fixed[key])return clips[fixed[key]];
  const ahead=key.endsWith('-ahead');
  const raw=(maneuver||line).trim().toLowerCase();
  const stored=routeClips[(ahead?'ahead:':'')+raw];
  if(stored)return stored;
  if(/^follow scott boulevard towards san tomas expressway\.?$/i.test(raw))return clips.scott;
  const campus:Record<string,string>={'turn right onto san tomas expressway.':'tomas','turn right onto walsh avenue.':'walsh','turn right onto bowers avenue.':'bowers'};
  if(campus[raw])return clips[campus[raw]+(ahead?'-ahead':'')];
  if(!allowGeneric)return undefined;
  const direction=/^(turn (?:slightly )?(?:left|right)|bear (?:left|right)|keep (?:left|right)|continue straight)\b/.exec(raw)?.[1];
  if(!direction)return clips['start-road'];
  const kind=direction.replace(/^(turn )/,'').replace(/^(?:bear |slightly )/,'slight-').replace('keep ','keep-').replace('continue straight','straight');
  return clips[kind+(ahead?'-ahead':'')];
}

export function clipPlayer(){
  let sound:ExpoAudio.Sound|null=null;
  let generation=0;
  async function stop(){
    ++generation;
    const previous=sound;sound=null;
    if(previous)await previous.unloadAsync().catch(()=>{});
  }
  return {stop,async play(asset:number){
    const releasing=stop();
    const token=generation;
    await releasing;
    const {Audio,InterruptionModeIOS}=require('expo-av') as typeof import('expo-av');
    if(token!==generation)return;
    await Audio.setAudioModeAsync({playsInSilentModeIOS:true,allowsRecordingIOS:false,interruptionModeIOS:InterruptionModeIOS.DuckOthers,shouldDuckAndroid:true});
    if(token!==generation)return;
    const loaded=await Audio.Sound.createAsync(asset,{shouldPlay:false,volume:1});
    if(token!==generation){await loaded.sound.unloadAsync();return;}
    sound=loaded.sound;
    sound.setOnPlaybackStatusUpdate(status=>{
      if(status.isLoaded&&status.didJustFinish&&sound===loaded.sound)void stop();
    });
    await loaded.sound.playAsync();
  }};
}
