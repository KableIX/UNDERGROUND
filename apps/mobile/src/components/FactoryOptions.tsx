import {useState} from 'react';
import {Linking,Pressable,TextInput,View} from 'react-native';
import {Text} from '@underground/ui';
import {guideFor,selectOption,type Selection} from '../data/factory-options';
import {shell} from '../theme/shell';
import type {CarDetails} from './CarDetails';

type Props={car:CarDetails;onChange?:(options:Selection)=>void;onNote?:(value:string)=>void;disabled?:boolean};
export function FactoryOptions({car,onChange,onNote,disabled}:Props){
  const [open,setOpen]=useState('');
  const [message,setMessage]=useState('');
  const guide=guideFor(car);
  const options=car.factoryOptions??{};
  const groups=guide?.groups(options)??[];
  if(!car.trim || (!onChange&&!guide&&!car.factoryNote))return null;
  return <View style={{gap:8,paddingVertical:12}}>
    <Text variant="title">Factory build sheet</Text>
    {guide && <><Text>{guide.title}</Text>{guide.standard && <Text>Standard equipment · {guide.standard}</Text>}</>}
    {onChange && <Text>{guide?'Partial option guide. Select the items on your build sheet.':'Enter factory options from your build sheet below.'}</Text>}
    {groups.map(g=>{
      const selected=options[g.name];
      if(!onChange)return selected?<Text key={g.name}>{g.name} · {selected}</Text>:null;
      function choose(value:string){
        const next=selectOption(guide!,options,g.name,value);
        const removed=Object.keys(options).filter(k=>k!==g.name&&!next[k]);
        setMessage(removed.length?'Cleared incompatible selections: '+removed.join(', '):'');
        onChange!(next);setOpen('');
      }
      return <View key={g.name}><Pressable accessibilityRole="button" accessibilityLabel={'Choose '+g.name} accessibilityState={{expanded:open===g.name}} disabled={disabled} onPress={()=>setOpen(open===g.name?'':g.name)} style={{minHeight:46,justifyContent:'center'}}>
        <Text variant="caption" gold>{g.name}</Text><Text>{selected||'Unknown'} ▾</Text></Pressable>
        {open===g.name&&['Unknown',...g.choices].map(v=><Pressable key={v} disabled={disabled} accessibilityRole="button" accessibilityLabel={v} onPress={()=>choose(v==='Unknown'?'':v)} style={{minHeight:44,padding:10}}><Text>{v}</Text></Pressable>)}
      </View>;
    })}
    {guide?.included?.(options).map(item=><Text key={item}>{item}</Text>)}
    {!!message&&onChange&&<Text accessibilityRole="alert">{message}</Text>}
    {onNote?<><Text variant="caption" gold>Other factory options or order codes</Text><TextInput accessibilityLabel="Other factory options or order codes" editable={!disabled} multiline maxLength={3000} value={car.factoryNote??''} onChangeText={onNote} style={{minHeight:48,color:shell.text,backgroundColor:'#181c20',padding:12}}/></>:car.factoryNote?<Text>Owner-entered · {car.factoryNote}</Text>:null}
    {Object.entries(guide?.links??{}).map(([name,url])=><Pressable key={name} accessibilityRole="link" onPress={()=>void Linking.openURL(url).catch(()=>setMessage('Source could not be opened.'))} style={{minHeight:44,justifyContent:'center'}}><Text gold>{name}</Text></Pressable>)}
  </View>;
}
