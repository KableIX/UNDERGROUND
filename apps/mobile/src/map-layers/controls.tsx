import { useEffect, useState } from 'react';
import { Linking, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '@underground/ui';
import { initialLayers, snapshot, type Layer, type Layers } from './cameras';
import { getMobileSupabaseClient } from '../session/supabase-session';
import { type Zone } from './history';

export function useLayers(): Layers { return initialLayers; }
const labels: Record<Layer,string>={plate:'Plate readers',speed:'Speed cameras',history:'Recurring speed checks'};

export function MapLayersButton({compact=false}:{compact?:boolean}) {
  const [open,setOpen]=useState(false);
  const data=open ? snapshot() : null;
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel="Map layers" onPress={()=>setOpen(true)} style={s.button}>
      <Text style={s.buttonText}>{compact ? 'Layers' : 'Map layers'}</Text>
    </Pressable>
    {open && <Modal visible transparent animationType="fade" onRequestClose={()=>setOpen(false)}>
      <View style={s.backdrop}><ScrollView style={s.sheet} contentContainerStyle={s.content} accessibilityViewIsModal>
        <Text accessibilityRole="header" style={s.title}>Map layers</Text>
        {(Object.keys(labels) as Layer[]).map(k=><View style={s.row} key={k}>
          <Text style={s.text}>{labels[k]}</Text>
          <Text style={{color: '#A1F572', fontSize: 12}}>ALWAYS ON</Text>
        </View>)}
        <Text style={s.note}>{data ? 'California · saved '+data.retrieved+' · works offline. Zoom to street level for camera points. Coverage varies by area.' : 'Camera data unavailable.'}</Text>
        <Text style={s.note}>Recurring checks appear on routes with reports from at least three members on three separate days in 90 days.</Text>
        <Pressable accessibilityRole="link" onPress={()=>void Linking.openURL('https://www.openstreetmap.org/copyright')}><Text style={s.note}>© OpenStreetMap contributors · ODbL</Text></Pressable>
        <Text style={s.note}>Municipal sources · LADOT, OakDOT, San José DOT and SFMTA</Text>
        <Pressable accessibilityRole="button" onPress={()=>setOpen(false)} style={s.button}><Text style={s.buttonText}>Done</Text></Pressable>
      </ScrollView></View>
    </Modal>}
  </>;
}
export function useRouteHistory(route:string|null,enabled:boolean) {
  const [result,setResult]=useState<{key:string; zones: Zone[]; failed:boolean} | null>(null);
  useEffect(()=>{
    if (!enabled || !route) return;
    let current=true;
    async function load(){
      try {
        const client=getMobileSupabaseClient();
        if (!client) throw Error('offline');
        const response=await client.rpc('route_speed_history',{slug:route});
        if(response.error || !Array.isArray(response.data)) throw Error('unavailable');
        if(current)setResult({key:route!,zones:response.data,failed:false});
      } catch { if(current)setResult({key:route!,zones:[],failed:true}); }
    }
    void load();
    return ()=>{current=false;};
  },[route,enabled]);
  return enabled && result?.key===route ? result : null;
}
const s=StyleSheet.create({
  button:{alignSelf:'flex-start',minHeight:44,justifyContent:'center',paddingHorizontal:12,borderRadius:10,backgroundColor:'#151c21'},
  buttonText:{color:'#ddd6c9',fontSize:13},backdrop:{flex:1,justifyContent:'center',padding:22,backgroundColor:'#0008'},
  sheet:{flexGrow:0,backgroundColor:'#151c21',borderRadius:14},content:{padding:18,gap:12},
  row:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',minHeight:44},
  text:{color:'#f4f5f2'},title:{color:'#fff',fontSize:19},note:{fontSize:12,color:'#bdc4c8'},
});
