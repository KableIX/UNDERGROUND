import Storage from 'expo-sqlite/kv-store';
import { resolveDriveVehicle, driveVehicleKey } from './drive-vehicle';
import {useState,useCallback} from 'react';
import {useFocusEffect} from 'expo-router';
import {Pressable,View} from 'react-native';
import {Text} from '@underground/ui';
import {previewVehicles} from '../garage/preview-vehicles';
import {useSession} from '../session/SessionContext';
import {getMobileSupabaseClient,isLiveAuthConfigured} from '../session/supabase-session';

type Car={id:string;year:string|number;make:string;model:string;trim?:string|null};
export function useGarageVehicles(){
  const {state}=useSession();
  const owner=state.status==='authenticated'?state.member.memberId:null;
  const key=owner ? driveVehicleKey(owner, isLiveAuthConfigured()) : null;
  const [loadedKey,setLoadedKey]=useState<string|null>(null);
  const [cars,setCars]=useState<Car[]>([]);
  const [selected,updateSelected]=useState<string|null>(null);
  const [error,setError]=useState('');
  useFocusEffect(useCallback(()=>{
    let active=true;
    setLoadedKey(null);setCars([]);updateSelected(null);setError('');
    async function load(){
      if(!owner || !key)return;
      let rows:Car[];
      if(isLiveAuthConfigured()){
        const db=getMobileSupabaseClient();if(!db)throw Error();
        const result=await db.from('vehicles').select('id,year,make,model,trim').eq('owner_member_id',owner).order('created_at');
        if(result.error)throw Error();rows=result.data;
      }else rows=await previewVehicles(owner);
      if (!active) return;
      let preferred: string | null = null;
      try {
        preferred = Storage.getItemSync(key);
      } catch {
        setError('Could not read your saved vehicle selection.');
      }
      setCars(rows);
      updateSelected(resolveDriveVehicle(rows, preferred));
      setLoadedKey(key);
    }
    void load().catch(()=>{if(active){setError('Garage unavailable. A private trip can still be recorded.');setLoadedKey(key);}});
    return ()=>{active=false;};
  },[owner,key]));
  const loading=key !== loadedKey;
  function setSelected(id: string) {
    if (loading || !key || !cars.some(c => c.id === id)) return;
    updateSelected(id);
    try {
      Storage.setItemSync(key, id);
      setError('');
    } catch {
      setError('Car selected for this drive. Could not save the selection on this device.');
    }
  }
  const car=cars.find(c=>c.id===selected);
  const label=(c:Car)=>[c.year,c.make,c.model,c.trim].filter(Boolean).join(' ');
  return {cars,selected,setSelected,loading,error,label,trip:{vehicleId:car?.id??null,vehicleLabel:car?label(car):null}};
}
export function GarageVehicleSelect({garage}:{garage:ReturnType<typeof useGarageVehicles>}){
  const [open,setOpen]=useState(false);
  return <View>{garage.error?<Text>{garage.error}</Text>:null}
    <Pressable disabled={!garage.cars.length} style={{minHeight:44,justifyContent:'center'}} accessibilityRole="button" onPress={()=>setOpen(!open)}>
      <Text gold>Vehicle · {garage.loading?'Loading garage...':garage.trip.vehicleLabel??(garage.cars.length?'Choose a car':'Unassigned')}</Text>
    </Pressable>
    {open&&garage.cars.map(car=><Pressable key={car.id} style={{minHeight:44,justifyContent:'center'}} onPress={()=>{garage.setSelected(car.id);setOpen(false);}}><Text>{garage.label(car)}</Text></Pressable>)}
  </View>;
}
