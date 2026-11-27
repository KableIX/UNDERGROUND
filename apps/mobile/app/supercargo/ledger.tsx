import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { commissionProgress, type CommissionRule, type LedgerEvent } from '@underground/domain';
import { readLedger, type Folio } from '../../src/supercargo/client';
import { groupByTier, supercargoCopy, tierLabel, tierNote } from '../../src/supercargo/copy';
import { TierMark } from '../../src/supercargo/TierMark';
import { Caption, Rule, ui } from '../../src/supercargo/ui';

/** House commissions until they are served from supercargo_commissions. */
const thisWeek: Array<{ title: string; rule: CommissionRule }> = [
  { title: 'Three Numbered or rarer', rule: { kind: 'sightings', minTier: 'numbered', count: 3 } },
  { title: 'Four different marques', rule: { kind: 'distinct_makes', count: 4 } },
  { title: 'One envelope, opened in person', rule: { kind: 'envelopes', count: 1 } },
];

export default function Ledger() {
  const router = useRouter();
  const inset = useSafeAreaInsets();
  const [folios, setFolios] = useState<Folio[] | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    readLedger().then(setFolios).catch((e: unknown) => {
      setFolios([]);
      setMessage(e instanceof Error ? e.message : 'The Ledger is unavailable.');
    });
  }, []);

  const rows = useMemo(
    () => (folios ?? []).filter((f) => f.supercargo_catalog).map((f) => ({ ...f, tier: f.supercargo_catalog!.tier, make: f.supercargo_catalog!.make, model: f.supercargo_catalog!.model })),
    [folios],
  );
  const events: LedgerEvent[] = rows.map((r) => ({ origin: r.origin, tier: r.tier, make: r.make, cellId: null, at: new Date(r.acquired_at) }));
  const now = new Date();

  return (
    <ScrollView style={ui.screen} contentContainerStyle={[ui.content, { paddingTop: inset.top + 12, paddingBottom: inset.bottom + 32 }]}>
      <Pressable accessibilityRole="button" onPress={() => router.back()}>
        <Text style={ui.back}>‹ SUPERCARGO</Text>
      </Pressable>
      <Text style={ui.heading}>The Ledger</Text>
      <Text style={ui.body}>{rows.length} {rows.length === 1 ? 'folio' : 'folios'} · {new Set(rows.map((r) => r.catalog_id)).size} models</Text>
      <Rule />
      {message ? <Text style={ui.notice}>{message}</Text> : null}

      <Caption>COMMISSIONS · THIS WEEK</Caption>
      <Text style={ui.body}>{supercargoCopy.commissionsNote}</Text>
      {thisWeek.map((c) => {
        const p = commissionProgress(c.rule, events, now);
        return (
          <View key={c.title} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={[ui.notice, p.complete && { color: '#C6B08B' }]}>{c.title}</Text>
            <Text style={ui.body}>{p.have} of {p.need}</Text>
          </View>
        );
      })}

      {folios === null ? <ActivityIndicator color="#C6B08B" /> : null}
      {folios !== null && rows.length === 0 ? <Text style={ui.body}>{supercargoCopy.ledgerEmpty}</Text> : null}
      {groupByTier(rows).map((group) => (
        <View key={group.tier} style={{ gap: 10 }}>
          <View style={{ gap: 2, marginTop: 8 }}>
            <Caption>{tierLabel(group.tier).toUpperCase()}</Caption>
            <Text style={ui.body}>{tierNote(group.tier)}</Text>
          </View>
          {group.items.map((f) => (
            <View key={f.id} style={[ui.card, f.tier === 'singular' && { borderColor: '#8F7A52' }]}>
              <Text style={ui.cardTitle}>{f.make} {f.model}</Text>
              <TierMark tier={f.tier} />
              <Text style={ui.body}>
                {f.origin === 'sighting' ? 'Seen' : 'Envelope'} · {new Date(f.acquired_at).toLocaleDateString()}
              </Text>
            </View>
          ))}
        </View>
      ))}
      <Caption>THE EXCHANGE</Caption>
      <Text style={ui.body}>{supercargoCopy.exchangeNote}</Text>
    </ScrollView>
  );
}
