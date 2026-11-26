import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Text } from '@underground/ui';
import { useSession } from '../session/SessionContext';
import type { Connections } from './page';
import { findMemberPage, answerConnection, getConnections, requestConnection } from './store';

export function FriendPages() {
  const { state } = useSession();
  return state.status === 'authenticated' ? (
    <Contacts key={state.member.memberId} viewer={state.member.memberId} />
  ) : null;
}
function Contacts({ viewer }: { viewer: string }) {
  const router = useRouter(),
    revision = useRef(0),
    lock = useRef(false);
  const [list, setList] = useState<Connections | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const tag = ++revision.current;
    setError('');
    try {
      const result = await getConnections(viewer);
      if (tag === revision.current) setList(result);
    } catch (e) {
      if (tag === revision.current)
        setError(e instanceof Error ? e.message : 'Could not load friends.');
    }
  }, [viewer]);
  useFocusEffect(
    useCallback(() => {
      void load();
      return () => {
        ++revision.current;
      };
    }, [load]),
  );
  const [number,setNumber]=useState('');
  const [notice,setNotice]=useState('');
  async function visit() {
    if (lock.current) return;
    lock.current = true; setBusy(true); setNotice(''); setError('');
    try {
      const id = await findMemberPage(viewer, number.trim());
      router.push({ pathname: '/members/[id]', params: { id } });
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not open this page.'); }
    finally { lock.current = false; setBusy(false); }
  }
  async function send() {
    if (lock.current) return;
    lock.current=true; setBusy(true); setNotice(''); setError('');
    try { setNotice(await requestConnection(viewer,number.trim())); setNumber(''); await load(); }
    catch(e) { setError(e instanceof Error ? e.message : 'Could not send request.'); }
    finally { lock.current=false; setBusy(false); }
  }
  async function respond(id: string, accept: boolean) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      await answerConnection(viewer, id, accept);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update the request.');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function link(label: string, action: () => void, disabled = false) {
    return (
      <Pressable accessibilityRole="button" disabled={disabled} onPress={action} style={s.link}>
        <Text gold>{label}</Text>
      </Pressable>
    );
  }
  return (
    <View style={s.group}>
      {!!error && (
        <>
          <Text accessibilityRole="alert" style={s.body}>
            {error}
          </Text>
          {link('Retry', () => void load())}
        </>
      )}
      {!list && !error && <ActivityIndicator />}
      {list && (
        <>
          <Text style={s.title}>Friend pages</Text>
          <TextInput accessibilityLabel="Member number" placeholder="Six-digit member number" placeholderTextColor="#9EA1A9"
            keyboardType="number-pad" maxLength={6} value={number} onChangeText={setNumber} style={[s.body,{minHeight:44}]}/>
          {link('View member page', () => void visit(), busy || number.length !== 6)}
          {link('Send friend request', () => void send(), busy || number.length !== 6)}
          {!!notice && <Text accessibilityLiveRegion="polite" style={s.body}>{notice}</Text>}
          {list.accepted.length === 0 && (
            <Text style={s.body}>Your accepted friends appear here.</Text>
          )}
          {list.accepted.map((f) => (
            <View key={f.id} style={s.row}>
              <Text style={s.name}>{f.name}</Text>
              {link('View profile', () =>
                router.push({ pathname: '/members/[id]', params: { id: f.id } }),
              )}
            </View>
          ))}
          {list.incoming.length > 0 && <Text style={s.title}>Friend requests</Text>}
          {list.incoming.map((f) => (
            <View key={f.id} style={s.row}>
              <Text style={s.name}>{f.name}</Text>
              {link('Accept', () => void respond(f.id, true), busy)}
              {link('Decline', () => void respond(f.id, false), busy)}
            </View>
          ))}
        </>
      )}
    </View>
  );
}
const s = StyleSheet.create({
  group: { gap: 9, marginVertical: 8 },
  link: { alignSelf: 'flex-start', justifyContent: 'center', minHeight: 44, paddingHorizontal: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { flex: 1, color: '#E6E6E2' },
  title: { fontSize: 23, fontFamily: 'BarlowCondensed_700Bold', color: '#F0ECE6' },
  body: { color: '#B8BAC0', lineHeight: 20 },
});
