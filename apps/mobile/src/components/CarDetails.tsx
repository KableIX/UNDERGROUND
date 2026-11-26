import { useState } from 'react';
import { Linking, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Text } from '@underground/ui';
import { shell } from '../theme/shell';

import {VehiclePicker,catalogMatch} from './VehiclePicker';

import {FactoryOptions} from './FactoryOptions';
import type {Selection} from '../data/factory-options';

const labels = {
  year: 'Year', make: 'Make', model: 'Model', trim: 'Trim or edition',
  color: 'Paint color', wrap: 'Wrap', interior: 'Interior', transmission: 'Transmission',
  wheels: 'Wheels', tires: 'Tires', brakes: 'Brakes', suspension: 'Suspension',
  aero: 'Aero', carbon: 'Carbon parts', exhaust: 'Exhaust', engine: 'Engine and tune',
  installed: 'Other installed modifications', planned: 'Planned modifications', notes: 'Build notes',
};
type Field = keyof typeof labels;
export const fields = Object.keys(labels) as Field[];
export type CarDetails = Record<Field,string> & {factoryOptions?:Selection;factoryNote?:string};
export const blankCar:CarDetails = Object.fromEntries(fields.map(field => [field,''])) as Record<Field,string>;
export type GarageCar = CarDetails & { id: string };
const normalize = (value:string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
export function factoryFacts(car: CarDetails) {
  const make = normalize(car.make);
  const model = normalize(car.model);
  const variant = model + ' ' + normalize(car.trim);
  if (make === 'audi' && /^r8\b/.test(model) && car.year === '2010' && /\bv10\b|\b5\.2\b/.test(variant))
    return {text:'5.2-liter V10 Â· quattro all-wheel drive', source:'Audi MediaCenter',url:'https://www.audi-mediacenter.com/en/press-releases/homage-to-ten-years-of-the-v10-engine-the-audi-r8-v10-decennium-11338'};
  if (make === 'lamborghini' && /^huracan\b/.test(model) && /\bsto\b/.test(variant) && Number(car.year)>=2021 && Number(car.year)<=2024)
    return {text:'Naturally aspirated V10 Â· 640 CV Â· rear-wheel drive', source:'Lamborghini',url:'https://www.lamborghini.com/es-en/noticias/new-lamborghini-huracan-sto-from-racetrack-to-road'};
  const row=catalogMatch(car);
  if(row)return {text:[row[4],row[5],row[6]].filter(Boolean).join(' Â· '),source:'FuelEconomy.gov',url:'https://www.fueleconomy.gov/feg/Find.do?action=sbs&id='+row[7]};
  return null;
}
export function Action({label,onPress,disabled=false}:{label:string;onPress:()=>void;disabled?:boolean}) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={s.button}><Text gold>{label}</Text></Pressable>;
}
export function CarRecord({car}:{car:CarDetails}) {
  const facts = factoryFacts(car);
  return <View style={s.group}>
    <Text variant="title">{[car.year,car.make,car.model,car.trim].filter(Boolean).join(' ')}</Text>
    <FactoryOptions car={car}/>
    {fields.slice(4).filter(field=>car[field]).map(field=><View key={field}><Text gold variant="caption">{labels[field]}</Text><Text>{car[field]}</Text></View>)}
    {facts && <View><Text gold variant="caption">Factory specifications</Text><Text>{facts.text}</Text><Action label={facts.source} onPress={()=>{void Linking.openURL(facts.url).catch(()=>{});}}/></View>}
  </View>;
}
export function CarForm({initial,onSave,onCancel}:{initial:CarDetails;onSave:(v:CarDetails)=>Promise<void>;onCancel:()=>void}) {
  const [draft,setDraft]=useState({...blankCar,...initial});
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  async function submit() {
    const car:CarDetails=Object.fromEntries(fields.map(k=>[k,draft[k].trim()])) as Record<Field,string>;
    if(draft.factoryNote?.trim())car.factoryNote=draft.factoryNote.trim();
    if(draft.factoryOptions && Object.keys(draft.factoryOptions).length)car.factoryOptions=draft.factoryOptions;
    if (!/^\d{4}$/.test(car.year) || +car.year<1886 || +car.year>new Date().getFullYear()+1 || !car.make || !car.model) {
      setError('Choose your year, make, and model from the catalog.');return;
    }
    const existingIdentity=!!initial.make && (['year','make','model','trim'] as const).every(key=>car[key]===initial[key]);
    if(!existingIdentity && !catalogMatch(car)){setError('Select a year, make, model, and factory configuration.');return;}
    setBusy(true);setError('');
    try {await onSave(car);} catch(e) {setError(e instanceof Error?e.message:'Unable to save your car.');} finally {setBusy(false);}
  }
  const saveButton = <Action label={busy ? 'Saving...' : 'Save car'} disabled={busy} onPress={() => void submit()} />;
  const saveError = error ? <Text accessibilityRole="alert">{error}</Text> : null;
  return <View style={s.group}>
    <VehiclePicker value={draft} disabled={busy} onChange={identity=>setDraft(current=>({...current,...identity,factoryOptions:undefined,factoryNote:undefined}))}/>
    {saveError}
    {saveButton}
    <FactoryOptions key={[draft.year,draft.make,draft.model,draft.trim].join('|')} car={draft} disabled={busy} onChange={factoryOptions=>setDraft(c=>({...c,factoryOptions}))} onNote={factoryNote=>setDraft(c=>({...c,factoryNote}))}/>
    <Text variant="title">Current build</Text>
    {fields.slice(4).map(field=><View key={field}><Text variant="caption" gold>{labels[field]}</Text>
      <TextInput accessibilityLabel={labels[field]} value={draft[field]} editable={!busy} onChangeText={value=>setDraft(current=>({...current,[field]:value}))}
        keyboardType={field==='year'?'number-pad':'default'} maxLength={field==='year'?4:1000} multiline={['installed','planned','notes'].includes(field)} style={s.input}/>
    </View>)}
    {saveError}
    {saveButton}<Action label="Cancel" disabled={busy} onPress={onCancel}/>
  </View>;
}
const s=StyleSheet.create({group:{gap:12,paddingVertical:12},input:{color:shell.text,backgroundColor:'#181c20',padding:12,borderRadius:6,minHeight:46},button:{minHeight:44,justifyContent:'center',alignSelf:'flex-start',paddingHorizontal:8}});
