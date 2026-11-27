import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '../../src/session/SessionContext';
import { claimEnvelope, readEnvelopes, readMap, readSettings, saveSettings, type MapSighting, type SealedEnvelope } from '../../src/supercargo/client';
import { supercargoCopy } from '../../src/supercargo/copy';
import { currentFix } from '../../src/supercargo/location';
import { SightingsLayer } from '../../src/supercargo/SightingsLayer';
import { Action, Caption, Entry, Rule, ui } from '../../src/supercargo/ui';

export default function SupercarGO() {
  const { state } = useSession();
  return state.status === 'authenticated' ? <Home /> : null;
}

function Home() {
  const router = useRouter();
  const inset = useSafeAreaInsets();
  const [settings, setSettings] = useState<{ enabled: boolean; creditPublic: boolean } | null>(null);
  const [sightings, setSightings] = useState<MapSighting[]>([]);
  const [envelopes, setEnvelopes] = useState<SealedEnvelope[]>([]);
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    readSettings().then(setSettings).catch(() => setSettings({ enabled: false, creditPublic: false }));
  }, []);

  const refresh = useCallback(async () => {
    const fix = await currentFix();
    setCenter({ lat: fix.lat, lng: fix.lng });
    const span = 0.25;
    const [map, near] = await Promise.all([
      readMap({ west: fix.lng - span, east: fix.lng + span, south: fix.lat - span, north: fix.lat + span }),
      readEnvelopes(fix.lng, fix.lat),
    ]);
    setSightings(map);
    setEnvelopes(near);
  }, []);

  useEffect(() => {
    if (settings?.enabled) refresh().catch((e: unknown) => setMessage(e instanceof Error ? e.message : 'The map is unavailable.'));
  }, [settings?.enabled, refresh]);

  async function toggle(next: { enabled: boolean; creditPublic: boolean }) {
    setSettings(next);
    try {
      await saveSettings(next.enabled, next.creditPublic);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not save.');
    }
  }

  async function open(envelope: SealedEnvelope) {
    if (busy) return;
    setBusy(true);
    setMessage('');
    try {
      const result = await claimEnvelope(envelope.id, await currentFix());
      const text: Record<string, string> = {
        claimed: 'Opened. The folio is in your Ledger.',
        too_far: 'Closer. Envelopes open within 60 meters.',
        weak_fix: 'Location is too rough here. Step into the open.',
        already: 'You have already opened this one.',
        empty: 'This envelope has been taken.',
        closed: 'This envelope has closed.',
      };
      setMessage(text[result.result] ?? 'Not opened.');
      if (result.ok) setEnvelopes((list) => list.filter((e) => e.id !== envelope.id));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Not opened.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={ui.screen} contentContainerStyle={[ui.content, { paddingTop: inset.top + 12, paddingBottom: inset.bottom + 32 }]}>
      <Pressable accessibilityRole="button" onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/conquest'))}>
        <Text style={ui.back}>‹ DRIVE</Text>
      </Pressable>
      <Text style={ui.heading}>{supercargoCopy.name}</Text>
      <Text style={ui.body}>{supercargoCopy.tagline}</Text>
      <Rule />
      {!settings ? (
        <ActivityIndicator color="#C6B08B" />
      ) : (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={ui.notice}>Turn on SupercarGO</Text>
            <Switch value={settings.enabled} onValueChange={(v) => toggle({ ...settings, enabled: v })} trackColor={{ true: '#8F7A52', false: '#2C2D31' }} />
          </View>
          {!settings.enabled ? (
            <Text style={ui.body}>{supercargoCopy.optIn}</Text>
          ) : (
            <>
              {message ? <Text accessibilityLiveRegion="polite" style={ui.notice}>{message}</Text> : null}
              <SightingsLayer sightings={sightings} envelopes={envelopes} center={center} />
              <Caption>{supercargoCopy.mapNote.toUpperCase()}</Caption>
              <Entry title="Log a sighting" detail={supercargoCopy.captureNote} onPress={() => router.push('/supercargo/capture')} />
              <Entry title="The Ledger" detail="Your folios, rarest first. Commissions and the Exchange." onPress={() => router.push('/supercargo/ledger')} />
              {envelopes.length > 0 ? (
                <View style={{ gap: 10 }}>
                  <Caption>SEALED ENVELOPES NEARBY</Caption>
                  {envelopes.map((e) => (
                    <View key={e.id} style={ui.card}>
                      <Text style={ui.cardTitle}>{e.anchor_name}</Text>
                      <Text style={ui.body}>Sealed. Open it in person, within 60 meters.</Text>
                      <Action title="Open envelope" disabled={busy} onPress={() => void open(e)} />
                    </View>
                  ))}
                </View>
              ) : null}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={[ui.body, { flex: 1 }]}>Show my member number on my sightings</Text>
                <Switch value={settings.creditPublic} onValueChange={(v) => toggle({ ...settings, creditPublic: v })} trackColor={{ true: '#8F7A52', false: '#2C2D31' }} />
              </View>
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}
