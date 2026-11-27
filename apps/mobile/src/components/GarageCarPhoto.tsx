import { FounderR8Cover } from './FounderR8Cover';
import { coverKey, liveCover, localCover } from '../garage/cover';
import { FittedPhoto } from './FittedPhoto';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@underground/ui';
import Storage from 'expo-sqlite/kv-store';
import { GaragePhotoUpload } from './GaragePhotoUpload';

type Photo={id:string;readUrl:string|null};
type Props={founderCover?:boolean;memberId:string;vehicleId:string;label:string;photos?:Photo[];onRefresh?:()=>void};
export function GarageCarPhoto({memberId,vehicleId,label,photos,onRefresh,founderCover}:Props){
  const key=coverKey(memberId,vehicleId,!!photos);
  const [preferred,setPreferred]=useState<string|null>(null);
  const [failed,setFailed]=useState<string|null>(null);
  const revision=useRef(0);
  useEffect(()=>{let active=true;const version=revision.current;
    Storage.getItem(key).then(id=>{if(active && version===revision.current)setPreferred(id);}).catch(()=>{});
    return ()=>{active=false;};
  },[key]);
  const fs=()=>require('expo-file-system') as typeof import('expo-file-system');
  const uri=photos ? liveCover(photos,preferred) : localCover(preferred);
  async function select(id:string){await Storage.setItem(key,id);revision.current++;setPreferred(id);setFailed(null);}
  async function saveLocal(source:string){
    const dir=fs().documentDirectory;
    if(!dir)throw Error('No local storage');
    const filename='garage-'+vehicleId+'-'+Date.now()+'.jpg';
    await fs().copyAsync({from:source,to:dir+filename});
    try{await select(filename);}catch(error){await fs().deleteAsync(dir+filename,{idempotent:true});throw error;}
    if(preferred && /^garage-[\w-]+\.jpg$/.test(preferred))void fs().deleteAsync(dir+preferred,{idempotent:true}).catch(()=>{});
  }
  return <View>
    {!!uri && uri!==failed ? <FittedPhoto source={{uri}} radius={8} accessibilityLabel={label+' garage photograph'} onError={()=>setFailed(uri)}/>
    : founderCover ? <FounderR8Cover /> : <View style={s.empty}><Text>{uri?'Photo unavailable':'Your car photo goes here'}</Text></View>}
    {uri && uri===failed && <Text accessibilityRole="button" onPress={()=>{setFailed(null);onRefresh?.();}}>Retry photo</Text>}
    <GaragePhotoUpload memberId={memberId} vehicleId={vehicleId} hasPhoto={!!uri} onLocalPreview={saveLocal} onRegistered={select} onPlanned={onRefresh}/>
  </View>;
}
const s=StyleSheet.create({empty:{minHeight:96,alignItems:'center',justifyContent:'center',backgroundColor:'#171b1e',borderRadius:8}});
