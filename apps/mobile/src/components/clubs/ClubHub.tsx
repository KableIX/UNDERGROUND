import { useCallback, useState } from 'react';
import { Linking, Pressable, Share, StyleSheet, TextInput, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Text } from '@underground/ui';
import { useSession } from '../../session/SessionContext';
import { getMobileSupabaseClient } from '../../session/supabase-session';
import { MessagesError, messageText, messagesApi } from '../../messages/api';

type Invite={id:string;purpose:'lead'|'roster';name:string|null};
type Club={id:string;name:string;role:string;badge:string;territory:string;roster:{number:string;name:string;role:string}[]};
type Hub={invites:Invite[];clubs:Club[];verified:boolean};
export function ClubButton({label,onPress,disabled=false}:{label:string;onPress:()=>void;disabled?:boolean}){
  return <Pressable accessibilityRole="button" accessibilityState={{disabled}} disabled={disabled} style={[s.button,disabled && s.disabled]} onPress={onPress}><Text gold>{label}</Text></Pressable>;
}
export function ClubField({label,value,change,email=false,secret=false}:{label:string;value:string;change:(v:string)=>void;email?:boolean;secret?:boolean}){
  return <TextInput accessibilityLabel={label} placeholder={label} placeholderTextColor="#A5A7AF" value={value} onChangeText={change}
    keyboardType={email?'email-address':'default'} autoCapitalize={email||secret?'none':'sentences'} autoCorrect={!email&&!secret} secureTextEntry={secret} style={s.input}/>;
}
export function ClubHub(){
  const {state}=useSession();
  const client=getMobileSupabaseClient();
  const router=useRouter();
  const [hub,setHub]=useState<Hub|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const [compose,setCompose]=useState<string|null>(null),[email,setEmail]=useState(''),[sent,setSent]=useState('');
  const [name,setName]=useState(''),[territory,setTerritory]=useState(''),[badge,setBadge]=useState('');
  const [market,setMarket]=useState('california');
  const refresh=useCallback(async()=>{
    if(!client)return;
    const reply=await client.rpc('my_club_hub');
    if(reply.error)throw Error(reply.error.message);
    setHub(reply.data);
  },[client]);
  useFocusEffect(useCallback(()=>{void refresh().catch(()=>setError('Could not load clubs.'));},[refresh]));
  if(state.status!=='authenticated')return null;
  const leadAccess=state.member.isFounder || state.member.role==='admin';
  async function act(task:()=>Promise<void>){
    if(busy)return;setBusy(true);setError('');
    try{await task();}catch(e){setError(e instanceof Error?e.message:'Please retry.');}finally{setBusy(false);}
  }
  async function rpc(fn:string,args:Record<string,unknown>){
    if(!client)throw Error('Club service unavailable.');
    const result=await client.rpc(fn,args);if(result.error)throw Error(result.error.message);
  }
  function answer(i:Invite,accept:boolean){
    void act(async()=>{await rpc('answer_club_access',{ticket:i.id,accept,club_name:name,territory,emblem:badge,market});await refresh();});
  }
  // One shared room per club. Only current members can open it; the server checks.
  async function openChat(c:Club){
    if(busy)return;setBusy(true);setError('');
    try{const {threadId}=await messagesApi.openClub(c.id);router.push({pathname:'/messages/[threadId]',params:{threadId,title:c.name}});}
    catch(e){setError(e instanceof MessagesError?messageText(e.message):'Could not open club chat.');}finally{setBusy(false);}
  }
  function inviteForm(target:string,title:string){
    if(compose!==target)return <ClubButton label={title} onPress={()=>{setCompose(target);setEmail('');setSent('');}}/>;
    const message=target==='lead'?'You’re invited to create your club on UNDERGROUND.':'You’re invited to join '+(hub?.clubs.find(c=>c.id===target)?.name ?? 'our club')+' on UNDERGROUND.';
    const body=message+' Open UNDERGROUND → Redeem invitation using '+sent+'. Already a member? Open Friends → My clubs.';
    if(sent)return <View style={s.group}><Text>Invitation ready for {sent}</Text>
      <ClubButton label="Email invitation" onPress={()=>void act(async()=>{await Linking.openURL('mailto:'+encodeURIComponent(sent)+'?subject=UNDERGROUND%20club%20invitation&body='+encodeURIComponent(body));})}/>
      <ClubButton label="Share invitation" onPress={()=>void act(async()=>{await Share.share({message:body});})}/>
      <ClubButton label="Done" onPress={()=>setCompose(null)}/></View>;
    return <View style={s.group}><ClubField email label={target==='lead'?'Club lead’s email':'Driver’s email'} value={email} change={setEmail}/>
      <ClubButton label="Create invitation" disabled={busy||!email.trim()} onPress={()=>void act(async()=>{
        await rpc('grant_club_access',{recipient:email.trim(),target:target==='lead'?null:target});setSent(email.trim());
      })}/><ClubButton label="Cancel" onPress={()=>setCompose(null)}/></View>;
  }
  return <View style={s.group}><Text gold variant="title">My clubs</Text>
    {!client?<Text>Connect to the club service to manage invitations.</Text>:<>
      {leadAccess&&inviteForm('lead','Grant club access')}
      {hub?.invites.map(i=><View key={i.id} style={s.card}>
        <Text gold>{i.purpose==='lead'?'Create your club':i.name}</Text>
        {i.purpose==='lead'?<>
          <ClubField label="Club name" value={name} change={setName}/><ClubField label="Club badge (1–6 characters)" value={badge} change={setBadge}/>
          <ClubField label="Home territory" value={territory} change={setTerritory}/>
          <View style={s.row}>{['california','miami'].map(v=><ClubButton key={v} label={(v==='miami'?'Miami':'California')+(market===v?' ✓':'')} onPress={()=>setMarket(v)}/>)}</View>
          <ClubButton label="Create club" disabled={busy||name.trim().length<2||territory.trim().length<2||!badge.trim()||badge.trim().length>6} onPress={()=>answer(i,true)}/>
        </>:hub.verified?<ClubButton label="Join club" disabled={busy} onPress={()=>answer(i,true)}/>:<>
          <Text>A verified garage vehicle is required to join. Your invitation stays here.</Text>
          <ClubButton label="Open garage" onPress={()=>router.push('/(tabs)/garage')}/></>}
        <ClubButton label="Decline invitation" disabled={busy} onPress={()=>answer(i,false)}/>
      </View>)}
      {hub?.clubs.map(c=><View key={c.id} style={s.card}>
        <Text gold>{[c.badge,c.name].filter(Boolean).join(' · ')}</Text><Text>{c.territory}</Text>
        {c.roster.map(r=><Text key={r.number}>{r.name} · {r.role}</Text>)}
        <ClubButton label="Club chat" disabled={busy} onPress={()=>void openChat(c)}/>
        {['owner','officer'].includes(c.role)&&inviteForm(c.id,'Invite driver')}
      </View>)}
      {hub&&!hub.clubs.length&&!hub.invites.length&&<Text>No club invitations yet.</Text>}
      <ClubButton label="Refresh clubs" disabled={busy} onPress={()=>void act(refresh)}/>
    </>}
    {!!error&&<Text accessibilityLiveRegion="polite">{error}</Text>}
  </View>;
}
const s=StyleSheet.create({group:{gap:8},card:{backgroundColor:'#141519',padding:14,borderRadius:10,gap:8},row:{flexDirection:'row',gap:8},
  button:{alignSelf:'flex-start',justifyContent:'center',minHeight:44,paddingHorizontal:12,backgroundColor:'#242428',borderRadius:7},disabled:{opacity:.48},
  input:{color:'white',borderColor:'#55565D',borderWidth:1,borderRadius:7,minHeight:44,paddingHorizontal:12}});
