import {useState} from 'react';
import {Pressable, TextInput, View} from 'react-native';
import {Text} from '@underground/ui';
import catalog from '../data/garage-models.json';
import {shell} from '../theme/shell';

const steps=['year','make','model','trim'] as const;
const names=['Year','Make','Model','Trim / factory configuration'];
type Key=typeof steps[number];
type Identity=Record<Key,string>;
type Row=[number,string,string,string,string,string,string,string];
const rows=catalog as Row[];
function matches(row:Row,car:Identity,depth:number){
  return steps.slice(0,depth).every((key,i)=>String(row[i])===car[key]);
}
export function catalogMatch(car:Identity){return rows.find(row=>matches(row,car,4));}
export function VehiclePicker({value,onChange,disabled}:{value:Identity;onChange:(v:Identity)=>void;disabled:boolean}){
  const [open,setOpen]=useState<number|null>(null);
  const [query,setQuery]=useState('');
  function toggle(index:number|null){setOpen(index);setQuery('');}
  const options=open===null?[]:[...new Set(rows.filter(row=>matches(row,value,open)).map(row=>String(row[open])))];
  options.sort(open===0?(a,b)=>Number(b)-Number(a):(a,b)=>a.localeCompare(b));
  const clean=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  return <View style={{gap:8}}>{steps.map((key,i)=>{
    const enabled=!disabled && (i===0 || rows.some(row=>matches(row,value,i)));
    return <View key={key}>
      <Text gold variant="caption">{names[i]}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={'Choose '+names[i]} accessibilityState={{disabled:!enabled,expanded:open===i}}
        disabled={!enabled} onPress={()=>toggle(open===i?null:i)} style={{minHeight:46,padding:12,backgroundColor:'#181c20',opacity:enabled?1:0.5}}>
        <Text>{value[key] || 'Select '+names[i].toLowerCase()} ▾</Text>
      </Pressable>
      {open===i && <View style={{padding:8,gap:4}}>
        {options.length>8 && <TextInput accessibilityLabel={'Search '+names[i]} placeholder="Search" placeholderTextColor={shell.muted} value={query} onChangeText={setQuery} style={{color:shell.text,padding:10}}/>}
        {options.filter(item=>clean(item).includes(clean(query))).map(item=><Pressable key={item} accessibilityRole="button" accessibilityLabel={item} style={{padding:10,minHeight:44}} onPress={()=>{
          if(item!==value[key]){
            const next={year:value.year,make:value.make,model:value.model,trim:value.trim};
            next[key]=item;
            steps.slice(i+1).forEach(k=>{next[k]='';});
            onChange(next);
          }
          toggle(i===3?null:i+1);
        }}><Text>{item}</Text></Pressable>)}
        {options.every(item=>!clean(item).includes(clean(query))) && <Text>No catalog matches.</Text>}
      </View>}
    </View>;
  })}</View>;
}
