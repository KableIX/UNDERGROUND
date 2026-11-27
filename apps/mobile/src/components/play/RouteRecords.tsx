import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Text } from '@underground/ui';
import { getCuratedRun } from '../../data/curated-runs';
import { useSession } from '../../session/SessionContext';
import { cruiseCompleted, onResultChange, readTimes, type RecordRow } from '../../drive/result-store';
import { shell } from '../../theme/shell';

type Props = { route?: string; cruise?: boolean };
export function RouteRecords({route, cruise = false}: Props) {
  const {state} = useSession();
  const member = state.status === 'authenticated' ? state.member.memberId : undefined;
  const [rows, setRows] = useState<RecordRow[]>([]);
  const [status, setStatus] = useState('');
  useFocusEffect(useCallback(() => {
    let version = 0;
    async function load() {
      const ticket = ++version;
      if (!member) return;
      try {
        if (cruise && route) {
          const done = await cruiseCompleted(member,route);
          if (ticket === version) setStatus(done ? 'Completed' : 'Not completed yet');
        } else {
          const times = await readTimes(member, route);
          if (ticket === version) { setRows(times); setStatus(times.length ? '' : 'No finishes yet.'); }
        }
      } catch { if (ticket === version) setStatus('Results unavailable.'); }
    }
    setRows([]); setStatus('Loading…');
    void load();
    const unsubscribe = onResultChange(() => { void load(); });
    return () => { version++; unsubscribe(); };
  },[member,route,cruise]));
  return <View style={s.section}>
    {route && <Text gold variant="caption">{cruise ? 'YOUR CRUISE' : 'RUN TOP 3'}</Text>}
    {!!status && <Text style={s.muted}>{status}</Text>}
    {rows.map((row,i) => <View key={row.route + ':' + row.place}>
      {!route && rows[i-1]?.route !== row.route && <Text gold style={s.heading}>{getCuratedRun(row.route)?.title ?? row.route}</Text>}
      <View style={s.line}><Text>#{row.place}{route ? '  ' + row.name : ''}</Text>
        <Text style={s.time}>{formatResult(row.millis)}</Text></View>
    </View>)}
  </View>;
}
function formatResult(ms: number) {
  const seconds = Math.floor(ms/1000);
  const digits = (v: number) => String(v).padStart(2,'0');
  return [digits(Math.floor(seconds/3600)),digits(Math.floor(seconds/60)%60),digits(seconds%60)].join(':') + '.' + String(ms%1000).padStart(3,'0');
}
const s = StyleSheet.create({
  section:{gap:8, paddingVertical:8}, heading:{marginVertical:8}, muted:{color:shell.muted},
  line:{flexDirection:'row', justifyContent:'space-between', gap:12, paddingVertical:4},
  time:{fontVariant:['tabular-nums']},
});
