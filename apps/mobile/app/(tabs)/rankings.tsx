import { ScrollView, StyleSheet, View } from 'react-native';
import { rankMembers } from '@underground/domain';
import { GoldRule, Screen, Text } from '@underground/ui';
import {useCallback,useState} from 'react';
import {useFocusEffect} from 'expo-router';
import type {RankingEntry} from '@underground/domain';
import {getMobileSupabaseClient,isLiveAuthConfigured} from '../../src/session/supabase-session';
import { shell } from '../../src/theme/shell';

/**
 * Rankings — CLOUT / territory standings from fixtures until live ledgers persist.
 */
export default function RankingsScreen() {
  const [ranked,setRanked]=useState<RankingEntry[]>([]);
  const [status,setStatus]=useState('');
  useFocusEffect(useCallback(()=>{
    let active=true;
    async function load(){
      setRanked([]);
      if(!isLiveAuthConfigured()){setStatus('Verified standings will appear when this beta connects to the club.');return;}
      setStatus('Loading standings…');
      const client=getMobileSupabaseClient();if(!client)throw Error();
      const {data,error}=await client.rpc('member_standings');if(error)throw error;
      if(active){setRanked(rankMembers(data??[]));setStatus(data?.length?'':'No verified standings yet.');}
    }
    void load().catch(()=>{if(active)setStatus('Standings are unavailable.');});
    return ()=>{active=false;};
  },[]));

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="title" gold>
          Rankings
        </Text>
        <GoldRule />
        {!!status && <Text style={styles.body}>{status}</Text>}
        {ranked.map((entry) => (
          <View key={entry.memberId} style={styles.row}>
            <Text variant="caption" gold style={styles.rank}>
              #{entry.rank}
            </Text>
            <View style={styles.copy}>
              <Text>
                {entry.displayName} · #{entry.memberNumber}
              </Text>
              <Text style={styles.body}>
                CLOUT {entry.cloutTotal} · TERRITORIES {entry.territoriesHeld}
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 40,
  },
  meta: {
    marginTop: 6,
    color: shell.muted,
  },
  body: {
    marginTop: 8,
    color: shell.muted,
  },
  row: {
    marginTop: 18,
    flexDirection: 'row',
    gap: 14,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(197,165,114,0.2)',
  },
  rank: {
    width: 36,
    marginTop: 2,
  },
  copy: {
    flex: 1,
  },
});
