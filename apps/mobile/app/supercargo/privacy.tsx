import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '../../src/session/SessionContext';
import {
  clearHomeZone,
  readGarageOptOuts,
  readHomeZone,
  readSettings,
  saveSettings,
  setHomeZone,
  setOptOut,
  type GarageCar,
} from '../../src/supercargo/client';
import { currentFix } from '../../src/supercargo/location';
import { Action, Caption, ui } from '../../src/supercargo/ui';

function Row({ label, detail, value, onChange }: { label: string; detail?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={ui.notice}>{label}</Text>
        {detail ? <Text style={ui.body}>{detail}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: '#8F7A52', false: '#2C2D31' }} accessibilityLabel={label} />
    </View>
  );
}

export default function Privacy() {
  const router = useRouter();
  const inset = useSafeAreaInsets();
  const { state } = useSession();
  const memberId = state.status === 'authenticated' ? state.member.memberId : '';
  const [settings, setSettings] = useState<{ enabled: boolean; creditPublic: boolean } | null>(null);
  const [home, setHome] = useState<{ radiusM: number } | null | undefined>(undefined);
  const [cars, setCars] = useState<GarageCar[]>([]);
  const [message, setMessage] = useState('');

  useEffect(() => {
    readSettings().then(setSettings).catch(() => setSettings({ enabled: false, creditPublic: false }));
    readHomeZone().then(setHome).catch(() => setHome(null));
    if (memberId) readGarageOptOuts(memberId).then(setCars).catch(() => setCars([]));
  }, [memberId]);

  async function run(work: () => Promise<void>, done: string) {
    setMessage('');
    try {
      await work();
      setMessage(done);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Try again.');
    }
  }

  return (
    <ScrollView style={ui.screen} contentContainerStyle={[ui.content, { paddingTop: inset.top + 12, paddingBottom: inset.bottom + 32 }]}>
      <Pressable accessibilityRole="button" onPress={() => router.back()}>
        <Text style={ui.back}>‹ SUPERCARGO</Text>
      </Pressable>
      <Text style={ui.heading}>Privacy</Text>
      {message ? <Text accessibilityLiveRegion="polite" style={ui.notice}>{message}</Text> : null}
      {!settings ? <ActivityIndicator color="#C6B08B" /> : (
        <>
          <Row label="SupercarGO" detail="Off hides the tab's map, Ledger and Exchange." value={settings.enabled}
            onChange={(v) => { const next = { ...settings, enabled: v }; setSettings(next); void run(() => saveSettings(next.enabled, next.creditPublic), 'Saved.'); }} />
          <Row label="Show my member number" detail="On your public sightings. Off by default." value={settings.creditPublic}
            onChange={(v) => { const next = { ...settings, creditPublic: v }; setSettings(next); void run(() => saveSettings(next.enabled, next.creditPublic), 'Saved.'); }} />
        </>
      )}

      <Caption>HOME ZONE</Caption>
      <Text style={ui.body}>Nothing captured within 400 m of your home reaches the map. Nobody can see where it is.</Text>
      {home === undefined ? <ActivityIndicator color="#C6B08B" /> : home ? (
        <Action title="Clear my home zone" onPress={() => void run(async () => { await clearHomeZone(); setHome(null); }, 'Home zone cleared.')} />
      ) : (
        <Action primary title="Set my home zone here" onPress={() => void run(async () => { const f = await currentFix(); await setHomeZone(f.lat, f.lng); setHome({ radiusM: 400 }); }, 'Home zone set.')} />
      )}

      <Caption>MY CARS</Caption>
      <Text style={ui.body}>Opt a car out and sightings of it near your home area stay private. Matched by make, model and area. Plates are never read.</Text>
      {cars.length === 0 ? <Text style={ui.body}>No cars in your garage.</Text> : null}
      {cars.map((c) => (
        <Row key={c.id} label={`${c.year} ${c.make} ${c.model}`} value={c.optedOut}
          onChange={(v) => { setCars((list) => list.map((x) => (x.id === c.id ? { ...x, optedOut: v } : x))); void run(() => setOptOut(c.id, v), v ? 'Opted out.' : 'Opt-out removed.'); }} />
      ))}
    </ScrollView>
  );
}
