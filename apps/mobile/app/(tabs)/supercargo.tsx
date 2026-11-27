import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '../../src/session/SessionContext';
import {
  claimEnvelope,
  decideExchange,
  readClubMarks,
  readCommissions,
  readEnvelopes,
  readExchanges,
  readFeatured,
  readLedger,
  readIsAdmin,
  readMap,
  readMyModeration,
  readSettings,
  saveSettings,
  type ClubMarks,
  type Commission,
  type ExchangeRow,
  type Folio,
  type MapSighting,
  type ModerationNote,
  type SealedEnvelope,
} from '../../src/supercargo/client';
import {
  decisionText,
  exchangeStatusText,
  groupByTier,
  mapQueryBounds,
  parseSection,
  supercargoCopy,
  supercargoSectionLabels,
  supercargoSections,
  tierLabel,
  tierNote,
  type Bounds,
  type SupercargoSection,
} from '../../src/supercargo/copy';
import { currentFix } from '../../src/supercargo/location';
import { SightingsLayer } from '../../src/supercargo/SightingsLayer';
import { TierMark } from '../../src/supercargo/TierMark';
import { Action, Caption, Rule, ui } from '../../src/supercargo/ui';

/**
 * SupercarGO tab. Three sections (Map, Ledger, Exchange), one big capture
 * button on every section, every core action within two taps of the tab.
 */
export default function SupercargoTab() {
  const { state } = useSession();
  if (state.status !== 'authenticated') {
    return (
      <View style={[ui.screen, { justifyContent: 'center', padding: 24 }]}>
        <Text style={ui.body}>Sign in to use SupercarGO.</Text>
      </View>
    );
  }
  return <Hub />;
}

function Hub() {
  const router = useRouter();
  const inset = useSafeAreaInsets();
  const params = useLocalSearchParams<{ section?: string }>();
  const [section, setSection] = useState<SupercargoSection>(parseSection(params.section));
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [message, setMessage] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [tick, setTick] = useState(0);
  const [waiting, setWaiting] = useState(0);
  const [admin, setAdmin] = useState(false);

  useEffect(() => {
    if (params.section) setSection(parseSection(params.section));
  }, [params.section]);
  useEffect(() => {
    readIsAdmin().then(setAdmin).catch(() => setAdmin(false));
  }, []);
  useFocusEffect(
    useCallback(() => {
      readSettings()
        .then((s) => setEnabled(s.enabled))
        .catch(() => setEnabled(false));
      setTick((t) => t + 1);
    }, []),
  );

  function refresh() {
    setRefreshing(true);
    setTick((t) => t + 1);
    setTimeout(() => setRefreshing(false), 400);
  }

  async function turnOn() {
    try {
      const current = await readSettings();
      await saveSettings(true, current.creditPublic);
      setEnabled(true);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not turn it on.');
    }
  }

  if (enabled === null) {
    return (
      <View style={[ui.screen, { justifyContent: 'center' }]}>
        <ActivityIndicator color="#C6B08B" />
      </View>
    );
  }

  return (
    <View style={ui.screen}>
      <View style={[s.header, { paddingTop: inset.top + 10 }]}>
        <View style={s.titleRow}>
          <Text style={s.title}>{supercargoCopy.name}</Text>
          <View style={s.links}>
            {admin ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Admin tools" onPress={() => router.push('/supercargo/admin')} hitSlop={10}>
                <Text style={s.link}>ADMIN</Text>
              </Pressable>
            ) : null}
            <Pressable accessibilityRole="button" accessibilityLabel="Privacy and settings" onPress={() => router.push('/supercargo/privacy')} hitSlop={10}>
              <Text style={s.link}>PRIVACY</Text>
            </Pressable>
          </View>
        </View>
        {enabled ? (
          <View style={s.segments} accessibilityRole="tablist">
            {supercargoSections.map((key) => (
              <Pressable
                key={key}
                accessibilityRole="tab"
                accessibilityState={{ selected: section === key }}
                onPress={() => {
                  setMessage('');
                  setSection(key);
                }}
                style={[s.segment, section === key && s.segmentOn]}
              >
                <Text style={[s.segmentText, section === key && s.segmentTextOn]}>
                  {supercargoSectionLabels[key].toUpperCase()}
                  {key === 'exchange' && waiting > 0 ? ` · ${waiting}` : ''}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>

      <ScrollView
        contentContainerStyle={[ui.content, { paddingTop: 16, paddingBottom: 120 }]}
        refreshControl={<RefreshControl tintColor="#C6B08B" refreshing={refreshing} onRefresh={refresh} />}
      >
        {message ? (
          <Text accessibilityLiveRegion="polite" style={ui.notice}>
            {message}
          </Text>
        ) : null}
        {!enabled ? (
          <View style={{ gap: 14 }}>
            <Rule />
            <Text style={ui.notice}>{supercargoCopy.tagline}</Text>
            <Text style={ui.body}>{supercargoCopy.optIn}</Text>
            <Text style={ui.body}>{supercargoCopy.mapNote}</Text>
            <Action primary title="Turn on SupercarGO" onPress={() => void turnOn()} />
          </View>
        ) : section === 'map' ? (
          <MapSection tick={tick} onMessage={setMessage} />
        ) : section === 'ledger' ? (
          <LedgerSection tick={tick} />
        ) : (
          <ExchangeSection tick={tick} onWaiting={setWaiting} onMessage={setMessage} />
        )}
      </ScrollView>

      {enabled ? (
        <View style={s.captureBar} pointerEvents="box-none">
          <Pressable accessibilityRole="button" accessibilityLabel="Log a sighting" onPress={() => router.push('/supercargo/capture')} style={s.capture}>
            <Text style={s.captureText}>LOG A SIGHTING</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const envelopeText: Record<string, string> = {
  claimed: 'Opened. The folio is in your Ledger.',
  too_far: 'Closer. Envelopes open within 60 meters.',
  weak_fix: 'Location is too rough here. Step into the open.',
  already: 'You have already opened this one.',
  empty: 'This envelope has been taken.',
  closed: 'This envelope has closed.',
};

function MapSection({ tick, onMessage }: { tick: number; onMessage: (m: string) => void }) {
  const router = useRouter();
  const queried = useRef<Bounds | null>(null);
  const [sightings, setSightings] = useState<MapSighting[] | null>(null);
  const [envelopes, setEnvelopes] = useState<SealedEnvelope[]>([]);
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [featured, setFeatured] = useState<Awaited<ReturnType<typeof readFeatured>>>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const fix = await currentFix();
        if (!live) return;
        setCenter({ lat: fix.lat, lng: fix.lng });
        const span = 0.25;
        const bounds = { west: fix.lng - span, east: fix.lng + span, south: fix.lat - span, north: fix.lat + span };
        queried.current = bounds;
        const [map, near, feat] = await Promise.all([
          readMap(bounds),
          readEnvelopes(fix.lng, fix.lat),
          readFeatured().catch(() => null),
        ]);
        if (!live) return;
        setSightings(map);
        setEnvelopes(near);
        setFeatured(feat);
      } catch (e) {
        if (!live) return;
        setSightings([]);
        onMessage(e instanceof Error ? e.message : 'The map is unavailable.');
      }
    })();
    return () => {
      live = false;
    };
  }, [tick, onMessage]);

  // Reload as the member pans: only when the view leaves what was last fetched.
  const panTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onBounds = useCallback(
    (visible: Bounds) => {
      if (panTimer.current) clearTimeout(panTimer.current);
      panTimer.current = setTimeout(() => {
        const next = mapQueryBounds(queried.current, visible);
        if (!next) return;
        queried.current = next;
        readMap(next)
          .then(setSightings)
          .catch(() => onMessage('The map is unavailable.'));
      }, 350);
    },
    [onMessage],
  );
  useEffect(
    () => () => {
      if (panTimer.current) clearTimeout(panTimer.current);
    },
    [],
  );

  async function open(envelope: SealedEnvelope) {
    if (busy) return;
    setBusy(true);
    onMessage('');
    try {
      const result = await claimEnvelope(envelope.id, await currentFix());
      onMessage(envelopeText[result.result] ?? 'Not opened.');
      if (result.ok) setEnvelopes((list) => list.filter((e) => e.id !== envelope.id));
    } catch (e) {
      onMessage(e instanceof Error ? e.message : 'Not opened.');
    } finally {
      setBusy(false);
    }
  }

  if (sightings === null) return <ActivityIndicator color="#C6B08B" />;
  return (
    <View style={{ gap: 14 }}>
      <SightingsLayer sightings={sightings} envelopes={envelopes} center={center} onBounds={onBounds} />
      <Caption>{supercargoCopy.mapNote.toUpperCase()}</Caption>
      {sightings.length === 0 ? <Text style={ui.body}>{supercargoCopy.mapEmpty}</Text> : null}
      {sightings.slice(0, 8).map((x) => (
        <View key={x.id} style={s.line}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={ui.notice}>
              {x.make} {x.model}
            </Text>
            <Text style={ui.caption}>{`${tierLabel(x.tier).toUpperCase()} · ${x.seen_on}${x.spotter_number ? ` · NO. ${x.spotter_number}` : ''}`}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Report ${x.make} ${x.model}`}
            hitSlop={10}
            onPress={() => router.push({ pathname: '/supercargo/report', params: { id: x.id, title: `${x.make} ${x.model}` } })}
          >
            <Text style={s.report}>REPORT</Text>
          </Pressable>
        </View>
      ))}
      {featured ? (
        <View style={ui.card}>
          <Caption>FEATURED THIS WEEK</Caption>
          <Text style={ui.cardTitle}>
            {featured.make} {featured.model}
          </Text>
          <TierMark tier={featured.tier} />
          <Text style={ui.body}>{featured.note ?? 'In about one envelope in ten this week.'}</Text>
        </View>
      ) : null}
      <Caption>SEALED ENVELOPES NEARBY</Caption>
      {envelopes.length === 0 ? <Text style={ui.body}>None within 5 km. They appear at overlooks, route starts and curated meets.</Text> : null}
      {envelopes.map((e) => (
        <View key={e.id} style={ui.card}>
          <Text style={ui.cardTitle}>{e.anchor_name}</Text>
          <Text style={ui.body}>Sealed. Open it in person, within 60 meters.</Text>
          <Action title="Open envelope" disabled={busy} onPress={() => void open(e)} />
        </View>
      ))}
    </View>
  );
}

function LedgerSection({ tick }: { tick: number }) {
  const [folios, setFolios] = useState<Folio[] | null>(null);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [clubs, setClubs] = useState<ClubMarks[]>([]);
  const [reviews, setReviews] = useState<ModerationNote[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    Promise.all([readLedger(), readCommissions().catch(() => [] as Commission[]), readClubMarks(), readMyModeration().catch(() => [])])
      .then(([f, c, k, r]) => {
        if (!live) return;
        setFolios(f);
        setCommissions(c);
        setClubs(k);
        setReviews(r);
      })
      .catch((e: unknown) => {
        if (!live) return;
        setFolios([]);
        setError(e instanceof Error ? e.message : 'The Ledger is unavailable.');
      });
    return () => {
      live = false;
    };
  }, [tick]);

  if (folios === null) return <ActivityIndicator color="#C6B08B" />;
  const rows = folios.flatMap((f) =>
    f.supercargo_catalog ? [{ ...f, tier: f.supercargo_catalog.tier, make: f.supercargo_catalog.make, model: f.supercargo_catalog.model }] : [],
  );
  return (
    <View style={{ gap: 14 }}>
      {error ? <Text style={ui.notice}>{error}</Text> : null}
      <Text style={ui.body}>
        {rows.length} {rows.length === 1 ? 'folio' : 'folios'} · {new Set(rows.map((r) => r.catalog_id)).size} models
      </Text>

      <Caption>COMMISSIONS · THIS WEEK</Caption>
      {commissions.length === 0 ? <Text style={ui.body}>{supercargoCopy.commissionsEmpty}</Text> : null}
      {commissions.map((c) => (
        <View key={c.commission_id} style={s.line}>
          <Text style={[ui.notice, { flex: 1 }, c.have >= c.need && { color: '#C6B08B' }]}>{c.title}</Text>
          <Text style={ui.body}>
            {Math.min(c.have, c.need)} of {c.need}
          </Text>
        </View>
      ))}

      {clubs.length > 0 ? (
        <View style={{ gap: 6 }}>
          <Caption>YOUR CLUBS</Caption>
          {clubs.map((c) => (
            <View key={c.club_id} style={s.line}>
              <Text style={[ui.notice, { flex: 1 }]}>{c.club_name}</Text>
              <Text style={ui.body}>
                {c.marks_this_week} this week · {c.marks_all_time} in all
              </Text>
            </View>
          ))}
          <Text style={ui.caption}>{supercargoCopy.clubNote.toUpperCase()}</Text>
        </View>
      ) : null}

      {reviews.length > 0 ? (
        <View style={{ gap: 8 }}>
          <Caption>REVIEWS OF YOUR SIGHTINGS</Caption>
          {reviews.slice(0, 5).map((r, i) => (
            <View key={`${r.sighting_id}-${i}`} style={[ui.card, r.status === 'held' && { borderColor: '#8F7A52' }]}>
              <Caption>{`${decisionText(r.status).toUpperCase()} · ${new Date(r.at).toLocaleDateString()}`}</Caption>
              <Text style={ui.notice}>
                {r.make} {r.model}
              </Text>
              <Text style={ui.body}>{r.reason}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {rows.length === 0 ? <Text style={ui.body}>{supercargoCopy.ledgerEmpty}</Text> : null}
      {groupByTier(rows).map((group) => (
        <View key={group.tier} style={{ gap: 10 }}>
          <View style={{ gap: 2, marginTop: 8 }}>
            <Caption>{tierLabel(group.tier).toUpperCase()}</Caption>
            <Text style={ui.body}>{tierNote(group.tier)}</Text>
          </View>
          {group.items.map((f) => (
            <View key={f.id} style={[ui.card, f.tier === 'singular' && { borderColor: '#8F7A52' }]}>
              <Text style={ui.cardTitle}>
                {f.make} {f.model}
              </Text>
              <TierMark tier={f.tier} />
              <Text style={ui.body}>
                {f.origin === 'sighting' ? 'Seen' : 'Envelope'} · {new Date(f.acquired_at).toLocaleDateString()}
              </Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

function ExchangeSection({
  tick,
  onWaiting,
  onMessage,
}: {
  tick: number;
  onWaiting: (n: number) => void;
  onMessage: (m: string) => void;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<ExchangeRow[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    readExchanges()
      .then((r) => {
        setRows(r);
        onWaiting(r.filter((x) => x.incoming && x.status === 'open').length);
      })
      .catch((e: unknown) => {
        setRows([]);
        onMessage(e instanceof Error ? e.message : 'The Exchange is unavailable.');
      });
  }, [onWaiting, onMessage]);
  useEffect(() => load(), [load, tick]);

  async function decide(id: string, accept: boolean) {
    setBusy(id);
    try {
      const result = await decideExchange(id, accept);
      onMessage(result === 'accepted' ? 'Exchanged. Both Ledgers are updated.' : result === 'void' ? 'No longer valid. A folio has moved.' : 'Done.');
      load();
    } catch (e) {
      onMessage(e instanceof Error ? e.message : 'Try again.');
    } finally {
      setBusy(null);
    }
  }

  if (rows === null) return <ActivityIndicator color="#C6B08B" />;
  const list = (items: ExchangeRow['offered']) => items.map((f) => `${f.make} ${f.model} (${tierLabel(f.tier)})`).join(', ');
  return (
    <View style={{ gap: 14 }}>
      <Action primary title="Propose an exchange" onPress={() => router.push('/supercargo/propose')} />
      <Text style={ui.body}>{supercargoCopy.exchangeNote}</Text>
      {rows.length === 0 ? <Text style={ui.body}>{supercargoCopy.exchangeEmpty}</Text> : null}
      {rows.map((x) => (
        <View key={x.id} style={ui.card}>
          <Caption>{`${x.incoming ? 'FROM' : 'TO'} NO. ${x.other_number} · ${exchangeStatusText(x.status, x.incoming).toUpperCase()}`}</Caption>
          <Text style={ui.notice}>
            {x.incoming ? 'They give' : 'You give'}: {list(x.offered)}
          </Text>
          <Text style={ui.notice}>
            {x.incoming ? 'You give' : 'They give'}: {list(x.requested)}
          </Text>
          {x.status === 'open' && x.incoming ? (
            <View style={s.pair}>
              <View style={{ flex: 1 }}>
                <Action primary title="Accept" disabled={busy === x.id} onPress={() => void decide(x.id, true)} />
              </View>
              <View style={{ flex: 1 }}>
                <Action title="Decline" disabled={busy === x.id} onPress={() => void decide(x.id, false)} />
              </View>
            </View>
          ) : null}
          {x.status === 'open' && !x.incoming ? <Action title="Withdraw" disabled={busy === x.id} onPress={() => void decide(x.id, false)} /> : null}
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 10, gap: 12, backgroundColor: '#08090A', borderBottomWidth: 1, borderColor: '#1E1F23' },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontFamily: 'BarlowCondensed_700Bold', fontSize: 34, color: '#F4F2ED' },
  links: { flexDirection: 'row', gap: 18 },
  link: { fontFamily: 'DMSans_600SemiBold', fontSize: 12, letterSpacing: 1.4, color: '#C6B08B' },
  segments: { flexDirection: 'row', borderWidth: 1, borderColor: '#2C2D31' },
  segment: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  segmentOn: { backgroundColor: '#1A1C24' },
  segmentText: { fontFamily: 'DMSans_600SemiBold', fontSize: 12, letterSpacing: 1.4, color: '#8F8F92' },
  segmentTextOn: { color: '#F4F2ED' },
  line: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  report: { fontFamily: 'DMSans_600SemiBold', fontSize: 11, letterSpacing: 1.4, color: '#8F8F92' },
  pair: { flexDirection: 'row', gap: 10 },
  captureBar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingBottom: 12 },
  capture: { backgroundColor: '#D0B88F', paddingVertical: 18, alignItems: 'center' },
  captureText: { fontFamily: 'DMSans_600SemiBold', fontSize: 16, letterSpacing: 2, color: '#08090A' },
});
