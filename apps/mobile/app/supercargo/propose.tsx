import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '../../src/session/SessionContext';
import { proposeExchange, readTradeable, type TradeFolio } from '../../src/supercargo/client';
import { toggleFolio } from '../../src/supercargo/copy';
import { TierMark } from '../../src/supercargo/TierMark';
import { Action, Caption, ui } from '../../src/supercargo/ui';

function Pick({ folios, selected, onToggle, empty }: { folios: TradeFolio[]; selected: string[]; onToggle: (id: string) => void; empty: string }) {
  if (folios.length === 0) return <Text style={ui.body}>{empty}</Text>;
  return (
    <View style={{ gap: 8 }}>
      {folios.map((f) => {
        const on = selected.includes(f.id);
        return (
          <Pressable key={f.id} accessibilityRole="checkbox" accessibilityState={{ checked: on }} onPress={() => onToggle(f.id)} style={[ui.card, on && { borderColor: '#C6B08B' }]}>
            <Text style={ui.cardTitle}>{f.make} {f.model}</Text>
            <TierMark tier={f.tier} />
          </Pressable>
        );
      })}
    </View>
  );
}

export default function Propose() {
  const router = useRouter();
  const inset = useSafeAreaInsets();
  const { state } = useSession();
  const myNumber = state.status === 'authenticated' ? state.member.memberNumber : '';
  const [mine, setMine] = useState<TradeFolio[] | null>(null);
  const [number, setNumber] = useState('');
  const [theirs, setTheirs] = useState<TradeFolio[] | null>(null);
  const [give, setGive] = useState<string[]>([]);
  const [get, setGet] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (myNumber) readTradeable(myNumber).then(setMine).catch(() => setMine([]));
  }, [myNumber]);

  async function lookUp() {
    setMessage('');
    setGet([]);
    try {
      const folios = await readTradeable(number);
      setTheirs(folios);
      if (!folios.length) setMessage('No tradeable folios for that member, or SupercarGO is off for them.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Try again.');
    }
  }

  async function send() {
    const counterparty = theirs?.[0]?.owner;
    if (!counterparty) return;
    setBusy(true);
    setMessage('');
    try {
      await proposeExchange(counterparty, give, get);
      router.replace({ pathname: '/(tabs)/supercargo', params: { section: 'exchange' } });
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Not sent.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={ui.screen} keyboardShouldPersistTaps="handled" contentContainerStyle={[ui.content, { paddingTop: inset.top + 12, paddingBottom: inset.bottom + 32 }]}>
      <Pressable accessibilityRole="button" onPress={() => router.back()}>
        <Text style={ui.back}>‹ EXCHANGE</Text>
      </Pressable>
      <Text style={ui.heading}>Propose</Text>
      <Text style={ui.body}>Envelope folios only, held 24 hours, up to three a side.</Text>
      {message ? <Text accessibilityLiveRegion="polite" style={ui.notice}>{message}</Text> : null}

      <Caption>1 · MEMBER NUMBER</Caption>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <TextInput
          value={number}
          onChangeText={(t) => setNumber(t.replace(/\D/g, '').slice(0, 6))}
          keyboardType="number-pad"
          placeholder="000000"
          placeholderTextColor="#5A5B60"
          accessibilityLabel="Member number"
          style={{ flex: 1, padding: 12, borderWidth: 1, borderColor: '#2C2D31', backgroundColor: '#111215', color: '#F4F2ED', fontSize: 18, letterSpacing: 3 }}
        />
        <View style={{ width: 110 }}>
          <Action title="Look up" disabled={number.length !== 6 || number === myNumber} onPress={() => void lookUp()} />
        </View>
      </View>

      <Caption>2 · YOU GIVE ({give.length}/3)</Caption>
      {mine === null ? <ActivityIndicator color="#C6B08B" /> : <Pick folios={mine} selected={give} onToggle={(id) => setGive((s) => toggleFolio(s, id))} empty="Nothing to offer yet. Envelope folios become tradeable 24 hours after you open them." />}

      {theirs ? (
        <>
          <Caption>3 · YOU GET ({get.length}/3)</Caption>
          <Pick folios={theirs} selected={get} onToggle={(id) => setGet((s) => toggleFolio(s, id))} empty="Nothing to choose from." />
        </>
      ) : null}

      <Action primary title="Send offer" disabled={busy || !give.length || !get.length} onPress={() => void send()} />
    </ScrollView>
  );
}
