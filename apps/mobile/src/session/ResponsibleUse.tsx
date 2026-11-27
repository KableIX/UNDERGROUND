import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@underground/ui';
import { useSession } from './SessionContext';
import { getMobileSupabaseClient } from './supabase-session';

export const POLICY_VERSION = 'eula-1.0';
export const DRIVE_NOTICE = 'Obey posted speed limits and all traffic laws. GPS timing records your drive; it does not authorize racing or reckless driving. Never use UNDERGROUND to facilitate unlawful activity or evade law enforcement.';

const EULA_SECTIONS = [["1. Acceptance of Agreement", "By selecting I Agree, you acknowledge that you have read, understood and agreed to this End User License Agreement."], ["2. License and Intended Use", "UNDERGROUND grants authorized members a limited, non-exclusive, non-transferable, revocable license to use the application for lawful automotive exploration, navigation, recreational driving, social interaction and community participation."], ["3. Responsible Driving", "Members are solely responsible for the safe and lawful operation of their vehicles. All applicable traffic laws, posted speed limits, roadway restrictions and licensing requirements must be observed. UNDERGROUND does not authorize, endorse or encourage illegal street racing, reckless driving, excessive speeding or unlawful speed contests."], ["4. GPS Timing and Performance Records", "GPS-based route timing, personal records, leaderboards, territory progression and achievements are recreational application features. Recorded times represent individual driving statistics. They do not constitute instructions or authorization to exceed posted speed limits, disregard traffic regulations or engage in unlawful competition. Compliance with traffic laws takes precedence over every application objective."], ["5. Navigation and Road Intelligence", "Navigation, maps, traffic information, camera locations, community reports and road intelligence are provided for general situational awareness. Information may be inaccurate, incomplete, outdated or unavailable. Members must independently observe actual road conditions, posted signs and official instructions. Use of UNDERGROUND to facilitate illegal activity or unlawfully evade law enforcement is strictly prohibited."], ["6. Mobile Device Safety", "Members must not interact with the application while operating a vehicle whenever doing so is unsafe or prohibited by law."], ["7. Community Conduct", "Harassment, unauthorized tracking, fraudulent GPS submissions, manipulation of driving records and other unlawful or abusive conduct are prohibited. UNDERGROUND reserves the right to suspend or terminate access for violations of this agreement."], ["8. Location Data and Privacy", "Location-based features require access to device location services. GPS information may be processed to provide navigation, route completion, driving records and territory-related functionality. Personal information is handled in accordance with the UNDERGROUND Privacy Policy and applicable law."], ["9. Disclaimer and Limitation of Liability", "To the maximum extent permitted by applicable law, UNDERGROUND is provided as is and as available, without warranties regarding uninterrupted availability, accuracy or fitness for a particular purpose. Members remain responsible for their driving decisions and conduct. Nothing in this agreement excludes liability or consumer rights that cannot lawfully be excluded."], ["10. Changes to This Agreement", "UNDERGROUND may update this agreement. Members will be notified of material changes and required to accept the revised agreement before continuing to use the application."]];

export function ResponsibleUseGate({children}: {children: ReactNode}) {
  const {state, signOut} = useSession();
  const member = state.status === 'authenticated' ? state.member.memberId : null;
  const beta = state.status === 'authenticated' && state.via === 'dev_bypass';
  const [accepted,setAccepted] = useState<string|null>(null);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');
  const [saving,setSaving] = useState(false);
  const insets = useSafeAreaInsets();
  useEffect(() => {
    let live = true;
    setAccepted(null); setError(''); setLoading(true);
    if (!member) {setLoading(false); return;}
    if (beta) {setLoading(false); return;}
    const client = getMobileSupabaseClient();
    if (!client) {setError('Account verification unavailable.');setLoading(false);return;}
    void client.auth.getUser().then(({data,error})=>{
      if(!live)return;
      if(error || !data.user) setError('Could not verify policy acceptance.');
      else if(data.user.user_metadata?.responsible_use?.version === POLICY_VERSION) setAccepted(member);
      setLoading(false);
    }).catch(()=>{if(live){setError('Could not verify policy acceptance.');setLoading(false);}});
    return ()=>{live=false;};
  },[member,beta]);
  async function accept(){
    if(!member || saving)return;
    setSaving(true);setError('');
    try {
      if(!beta){
        const client=getMobileSupabaseClient();
        if(!client)throw Error('Account service unavailable.');
        const {data,error}=await client.auth.updateUser({data:{responsible_use:{version:POLICY_VERSION,accepted_at:new Date().toISOString()}}});
        if(error || data.user?.user_metadata?.responsible_use?.version !== POLICY_VERSION)throw Error('Acceptance could not be saved. Retry.');
      }
      setAccepted(member);
    }catch(e){setError(e instanceof Error?e.message:'Acceptance could not be saved.');}
    finally{setSaving(false);}
  }
  if(!member || accepted===member)return <>{children}</>;
  return <>{children}<Modal visible animationType="fade" presentationStyle="fullScreen" onRequestClose={()=>{}}><View style={[s.root,{paddingTop:insets.top+24,paddingBottom:insets.bottom+16}]}>
    <ScrollView contentContainerStyle={s.content}>
      <Text gold variant="caption">UNDERGROUND / LICENSE AGREEMENT</Text>
      <Text style={s.title}>END USER LICENSE AGREEMENT</Text>
      <Text gold>Version 1.0 / Responsible Use Policy</Text>
      {EULA_SECTIONS.map(([heading,body]) => <View key={heading} style={{gap:8}}>
        <Text gold style={{fontSize:17,fontWeight:'600'}}>{heading}</Text>
        <Text style={{fontSize:15,lineHeight:23}}>{body}</Text>
      </View>)}
      <Text gold>DRIVE RESPONSIBLY. RESPECT THE ROAD.</Text>
      <Text style={s.note}>By selecting I Agree, you accept this agreement.</Text>
      {!!error && <Text style={s.note}>{error}</Text>}
      {loading ? <ActivityIndicator color="#C5A572"/> : <Pressable accessibilityRole="button" disabled={saving} onPress={()=>void accept()} style={s.button}><Text style={s.buttonText}>{saving?'SAVING...':'I AGREE / CONTINUE'}</Text></Pressable>}
      <Pressable accessibilityRole="button" onPress={signOut}><Text gold>Decline and sign out</Text></Pressable>
    </ScrollView>
  </View></Modal></>;
}
const s=StyleSheet.create({root:{flex:1,backgroundColor:'#080B0D'},content:{padding:24,gap:22},title:{fontSize:36,fontFamily:'BarlowCondensed_700Bold',color:'#E7C892'},note:{color:'#AAB3B8',fontSize:13},button:{backgroundColor:'#A1F572',padding:16,borderRadius:10},buttonText:{color:'#101810',textAlign:'center',fontWeight:'700'}});
