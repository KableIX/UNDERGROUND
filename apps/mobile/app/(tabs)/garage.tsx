import { FounderR8Cover } from '../../src/components/FounderR8Cover';
import { isFounderR8 } from '../../src/garage/founder-r8';
import { useEffect, useState } from 'react';
import { ScrollView } from 'react-native';
import Storage from 'expo-sqlite/kv-store';
import { Screen, Text } from '@underground/ui';
import { GarageCarPhoto } from '../../src/components/GarageCarPhoto';
import { LiveGarage } from '../../src/components/LiveGarage';
import { EditGarageProfile, GarageStoreLink } from '../../src/components/GarageFirstLook';
import { Action, blankCar, CarForm, CarRecord, type GarageCar, type CarDetails } from '../../src/components/CarDetails';
import { useSession } from '../../src/session/SessionContext';
import { isLiveAuthConfigured } from '../../src/session/supabase-session';

export default function GarageScreen() {
  const {state}=useSession();
  if(state.status!=='authenticated') return null;
  if(isLiveAuthConfigured()) return <LiveGarage key={state.member.memberId}/>;
  return <PreviewGarage key={state.member.memberId} memberId={state.member.memberId} founder={state.member.isFounder}/>;
}

function PreviewGarage({memberId,founder}:{memberId:string;founder:boolean}) {
  const key='garage-cars.v1.'+memberId;
  const [cars,setCars]=useState<GarageCar[]|null>(null);
  const [edit,setEdit]=useState<string|null>(null);
  const [error,setError]=useState('');
  const [attempt,setAttempt]=useState(0);
  useEffect(()=>{
    let active=true;
    Storage.getItem(key).then(raw=>{
      const records:GarageCar[]=raw?JSON.parse(raw):[];
      if(!Array.isArray(records)) throw Error();
      if(active){setCars(records);setError('');}
    }).catch(()=>{if(active)setError('Unable to load your saved garage.');});
    return ()=>{active=false;};
  },[key,attempt]);
  async function save(car:CarDetails) {
    if(!cars || !edit)throw Error('Reopen the garage and try again.');
    let next:GarageCar[];
    if(edit==='new'){
      // Preview-only identifier for the existing UUID-based photo picker.
      let id='xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{
        const n=Math.floor(Math.random()*16);return (c==='x'?n:(n&3)|8).toString(16);
      });
      const original='44444444-4444-4444-8444-444444444401';
      if(founder && car.year==='2010' && car.make.toLowerCase()==='audi' && /^r8\b/i.test(car.model) && !cars.some(c=>c.id===original))id=original;
      next=[...cars,{...car,id}];
    } else next=cars.map(c=>c.id===edit?{...car,id:c.id}:c);
    await Storage.setItem(key,JSON.stringify(next));
    setCars(next);setEdit(null);
  }
  return <Screen padded={false}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{padding:18,paddingBottom:50,gap:10}}>
    <Text variant="title">{founder?'Founder’s Garage':'My Garage'}</Text><EditGarageProfile/>
    {founder && !edit && cars && !cars.some(car => isFounderR8(founder, [car.year, car.make, car.model].join(' '))) &&
      <FounderR8Cover />}
    {error && <><Text>{error}</Text><Action label="Retry" onPress={()=>setAttempt(a=>a+1)}/></>}
    {cars && (edit ? <CarForm key={edit} initial={cars.find(c=>c.id===edit)??blankCar} onSave={save} onCancel={()=>setEdit(null)}/> : <>
      <Action label="Add car" onPress={()=>setEdit('new')}/>
      {cars.map(car=><GarageEntry key={car.id} car={car} memberId={memberId} founder={founder} onEdit={()=>setEdit(car.id)}/>)}
    </>)}
    <GarageStoreLink/>
  </ScrollView></Screen>;
}
function GarageEntry({car,memberId,founder,onEdit}:{car:GarageCar;memberId:string;founder:boolean;onEdit:()=>void}){
  return <><GarageCarPhoto founderCover={isFounderR8(founder, [car.year, car.make, car.model].join(' '))} memberId={memberId} vehicleId={car.id} label={car.make+' '+car.model}/><Action label="Edit car" onPress={onEdit}/><CarRecord car={car}/></>;
}
