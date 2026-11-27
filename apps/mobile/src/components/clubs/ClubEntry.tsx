import { useState } from 'react';
import { ScrollView } from 'react-native';
import { Screen, Text } from '@underground/ui';
import { useRouter } from 'expo-router';
import { ClubButton, ClubField } from './ClubHub';
import { getMobileSupabaseClient } from '../../session/supabase-session';
import { useSession } from '../../session/SessionContext';

export function ClubEntry(){
  const {signInWithEmail}=useSession();
  const router=useRouter();
  const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  async function proceed(create:boolean){
    if(busy)return;
    setBusy(true);setMessage('');
    try{
      const client=getMobileSupabaseClient();
      if(!client)throw Error('Club service unavailable.');
      if(create){
        const {error,data}=await client.auth.signUp({email:email.trim(),password});
        if(error)throw Error(error.message);
        if(!data.session){setMessage('Check your email to confirm your account, then return here and tap Open invitation.');return;}
      }
      const result=await signInWithEmail(email.trim(),password);
      if(!result.ok)throw Error(result.error==='invalid_credentials'?'Check your email and password, or create an account below.':result.error);
    }catch(e){setMessage(e instanceof Error?e.message:'Could not open invitation.');}finally{setBusy(false);}
  }
  return <Screen><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{padding:20,gap:12}}>
    <Text gold variant="title">Your club invitation</Text><Text>Use the email address your invitation was sent to.</Text>
    <ClubField email label="Invited email" value={email} change={setEmail}/><ClubField secret label="Password" value={password} change={setPassword}/>
    <ClubButton label="Open invitation" disabled={busy||!email.trim()||!password} onPress={()=>void proceed(false)}/>
    <ClubButton label="Create my account" disabled={busy||!email.trim()||!password} onPress={()=>void proceed(true)}/>
    {!!message&&<Text accessibilityLiveRegion="polite">{message}</Text>}<ClubButton label="Back" onPress={()=>router.back()}/>
  </ScrollView></Screen>;
}
