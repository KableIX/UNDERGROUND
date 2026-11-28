import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  createMeet,
  decide,
  deleteMeet,
  photoUrl,
  readAnchors,
  readCatalog,
  readFeaturedWeeks,
  readIsAdmin,
  readMeets,
  readQueue,
  saveAnchor,
  setFeatured,
  stockAnchor,
  type AdminAnchor,
  type CatalogCar,
  type Meet,
  type QueueItem,
} from '../../src/supercargo/client';
import {
  anchorKindLabels,
  anchorKinds,
  anchorProblems,
  anchorSlug,
  reportReasonText,
  tierLabel,
  weekStartOf,
} from '../../src/supercargo/copy';
import { currentFix } from '../../src/supercargo/location';
import { TierMark } from '../../src/supercargo/TierMark';
import { Action, Caption, ui } from '../../src/supercargo/ui';

const sections = ['queue', 'places', 'meets', 'featured'] as const;
type Section = (typeof sections)[number];
const sectionLabels: Record<Section, string> = { queue: 'Queue', places: 'Places', meets: 'Meets', featured: 'Featured' };

function Field(props: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; numeric?: boolean; multiline?: boolean }) {
  return (
    <View style={{ gap: 6, flex: 1 }}>
      <Text style={ui.caption}>{props.label.toUpperCase()}</Text>
      <TextInput
        value={props.value}
        onChangeText={props.onChange}
        placeholder={props.placeholder}
        placeholderTextColor="#5A5B60"
        keyboardType={props.numeric ? 'numbers-and-punctuation' : 'default'}
        multiline={props.multiline}
        accessibilityLabel={props.label}
        style={[s.input, props.multiline && { minHeight: 70, textAlignVertical: 'top' }]}
      />
    </View>
  );
}

function Chips<T extends string>({ items, value, onChange, label }: { items: readonly T[]; value: T | null; onChange: (v: T) => void; label: (v: T) => string }) {
  return (
    <View style={s.chips}>
      {items.map((it) => (
        <Pressable
          key={it}
          accessibilityRole="radio"
          accessibilityState={{ selected: value === it }}
          onPress={() => onChange(it)}
          style={[s.chip, value === it && s.chipOn]}
        >
          <Text style={[s.chipText, value === it && s.chipTextOn]}>{label(it)}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/** Admin tools for SupercarGO: one screen, four sections, everything within two taps. */
export default function Admin() {
  const router = useRouter();
  const inset = useSafeAreaInsets();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [section, setSection] = useState<Section>('queue');
  const [message, setMessage] = useState('');

  useEffect(() => {
    readIsAdmin().then(setAllowed).catch(() => setAllowed(false));
  }, []);

  return (
    <View style={ui.screen}>
      <View style={[s.header, { paddingTop: inset.top + 8 }]}>
        <Pressable accessibilityRole="button" onPress={() => router.back()}>
          <Text style={ui.back}>‹ SUPERCARGO</Text>
        </Pressable>
        <Text style={s.title}>Admin</Text>
        {allowed ? (
          <View style={s.segments} accessibilityRole="tablist">
            {sections.map((key) => (
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
                <Text style={[s.segmentText, section === key && s.segmentTextOn]}>{sectionLabels[key].toUpperCase()}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[ui.content, { paddingTop: 16, paddingBottom: inset.bottom + 40 }]}>
        {message ? (
          <Text accessibilityLiveRegion="polite" style={ui.notice}>
            {message}
          </Text>
        ) : null}
        {allowed === null ? <ActivityIndicator color="#C6B08B" /> : null}
        {allowed === false ? <Text style={ui.body}>Admins only.</Text> : null}
        {allowed && section === 'queue' ? <QueueSection onMessage={setMessage} /> : null}
        {allowed && section === 'places' ? <PlacesSection onMessage={setMessage} /> : null}
        {allowed && section === 'meets' ? <MeetsSection onMessage={setMessage} /> : null}
        {allowed && section === 'featured' ? <FeaturedSection onMessage={setMessage} /> : null}
      </ScrollView>
    </View>
  );
}

// ---- Moderation queue ----

function QueueSection({ onMessage }: { onMessage: (m: string) => void }) {
  const [items, setItems] = useState<QueueItem[] | null>(null);
  const [catalog, setCatalog] = useState<CatalogCar[]>([]);
  const load = useCallback(() => {
    readQueue()
      .then(setItems)
      .catch((e: unknown) => {
        setItems([]);
        onMessage(e instanceof Error ? e.message : 'The queue is unavailable.');
      });
  }, [onMessage]);
  useEffect(() => {
    load();
    readCatalog().then(setCatalog).catch(() => setCatalog([]));
  }, [load]);

  if (items === null) return <ActivityIndicator color="#C6B08B" />;
  return (
    <View style={{ gap: 14 }}>
      <Text style={ui.body}>Sightings with reports since their last decision. Held ones first. Reporters are not shown.</Text>
      {items.length === 0 ? <Text style={ui.notice}>Nothing to review.</Text> : null}
      {items.map((item) => (
        <QueueCard key={item.sighting_id} item={item} catalog={catalog} onDone={(m) => { onMessage(m); load(); }} />
      ))}
    </View>
  );
}

function QueueCard({ item, catalog, onDone }: { item: QueueItem; catalog: CatalogCar[]; onDone: (m: string) => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [correcting, setCorrecting] = useState(false);
  const [search, setSearch] = useState('');
  const [pick, setPick] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    photoUrl(item.photo_path).then(setUrl).catch(() => setUrl(null));
  }, [item.photo_path]);

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (q ? catalog.filter((c) => `${c.make} ${c.model}`.toLowerCase().includes(q)) : catalog).slice(0, 6);
  }, [catalog, search]);

  async function run(decision: 'restore' | 'remove' | 'correct_model') {
    setBusy(true);
    setError('');
    try {
      await decide(item.sighting_id, decision, reason, decision === 'correct_model' ? pick ?? undefined : undefined);
      onDone(decision === 'remove' ? 'Removed. The spotter can read your reason.' : decision === 'restore' ? 'Restored. The spotter can read your reason.' : 'Model corrected. The spotter can read your reason.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Not saved.');
    } finally {
      setBusy(false);
    }
  }

  const reasonOk = reason.trim().length >= 3;
  return (
    <View style={[ui.card, item.visibility === 'held' && { borderColor: '#8F7A52' }]}>
      <Caption>{(item.visibility === 'held' ? 'OFF THE MAP' : 'ON THE MAP') + ' · ' + item.captured_on}</Caption>
      <Text style={ui.cardTitle}>
        {item.make} {item.model}
      </Text>
      <TierMark tier={item.tier} />
      {url ? <Image source={{ uri: url }} style={s.photo} resizeMode="cover" accessibilityLabel="Blurred sighting photo" /> : null}
      {(item.reports ?? []).map((r) => (
        <Text key={r.reason} style={ui.notice}>
          {(reportReasonText[r.reason]?.label ?? r.reason) + (r.count > 1 ? ` · ${r.count}` : '')}
        </Text>
      ))}
      {(item.notes ?? []).map((n, i) => (
        <Text key={i} style={ui.body}>
          “{n}”
        </Text>
      ))}
      <Field label="Reason the spotter will read" value={reason} onChange={(t) => setReason(t.slice(0, 280))} placeholder="Plain and specific." multiline />
      {error ? <Text style={ui.notice}>{error}</Text> : null}
      {correcting ? (
        <View style={{ gap: 8 }}>
          <Field label="Find the right model" value={search} onChange={setSearch} placeholder="Make or model" />
          {matches.map((c) => (
            <Pressable key={c.id} accessibilityRole="radio" accessibilityState={{ selected: pick === c.id }} onPress={() => setPick(c.id)} style={[s.pickRow, pick === c.id && s.chipOn]}>
              <Text style={[ui.notice, { flex: 1 }]}>
                {c.make} {c.model}
              </Text>
              <Text style={ui.caption}>{tierLabel(c.tier).toUpperCase()}</Text>
            </Pressable>
          ))}
          <View style={s.pair}>
            <View style={{ flex: 1 }}>
              <Action primary title="Save correction" disabled={busy || !reasonOk || !pick} onPress={() => void run('correct_model')} />
            </View>
            <View style={{ flex: 1 }}>
              <Action title="Cancel" onPress={() => setCorrecting(false)} />
            </View>
          </View>
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          <View style={s.pair}>
            <View style={{ flex: 1 }}>
              <Action title="Restore" disabled={busy || !reasonOk || item.visibility !== 'held'} onPress={() => void run('restore')} />
            </View>
            <View style={{ flex: 1 }}>
              <Action title="Remove" disabled={busy || !reasonOk} onPress={() => void run('remove')} />
            </View>
          </View>
          <Action title="Correct the model" disabled={busy} onPress={() => setCorrecting(true)} />
        </View>
      )}
    </View>
  );
}

// ---- Envelope places and stocking ----

function PlacesSection({ onMessage }: { onMessage: (m: string) => void }) {
  const [anchors, setAnchors] = useState<AdminAnchor[] | null>(null);
  const [adding, setAdding] = useState(false);
  const load = useCallback(() => {
    readAnchors()
      .then(setAnchors)
      .catch((e: unknown) => {
        setAnchors([]);
        onMessage(e instanceof Error ? e.message : 'Places are unavailable.');
      });
  }, [onMessage]);
  useEffect(load, [load]);

  if (anchors === null) return <ActivityIndicator color="#C6B08B" />;
  return (
    <View style={{ gap: 14 }}>
      {adding ? (
        <PlaceForm onCancel={() => setAdding(false)} onSaved={(m) => { setAdding(false); onMessage(m); load(); }} />
      ) : (
        <Action primary title="Add a place" onPress={() => setAdding(true)} />
      )}
      <Text style={ui.body}>Public places only: route starts and finishes, overlooks, venues, museums, events and curated meets. Never a residential street.</Text>
      {anchors.length === 0 ? <Text style={ui.notice}>No places yet.</Text> : null}
      {anchors.map((a) => (
        <PlaceCard key={a.id} anchor={a} onDone={(m) => { onMessage(m); load(); }} />
      ))}
    </View>
  );
}

function PlaceForm({ onCancel, onSaved }: { onCancel: () => void; onSaved: (m: string) => void }) {
  const [name, setName] = useState('');
  const [kind, setKind] = useState<(typeof anchorKinds)[number]>('overlook');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [publicPlace, setPublicPlace] = useState(false);
  const [error, setError] = useState('');
  const problems = anchorProblems({ name, lat, lng, publicPlace });

  async function here() {
    try {
      const fix = await currentFix();
      setLat(fix.lat.toFixed(5));
      setLng(fix.lng.toFixed(5));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No location.');
    }
  }

  async function save() {
    setError('');
    try {
      await saveAnchor({ id: anchorSlug(name), name: name.trim(), kind, lat: Number(lat), lng: Number(lng), active: true, publicPlace });
      onSaved(`${name.trim()} saved.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Place not saved.');
    }
  }

  return (
    <View style={ui.card}>
      <Caption>NEW PLACE</Caption>
      <Field label="Name" value={name} onChange={setName} placeholder="Skyline overlook" />
      <Chips items={anchorKinds} value={kind} onChange={setKind} label={(k) => anchorKindLabels[k] ?? k} />
      <View style={s.pair}>
        <Field label="Latitude" value={lat} onChange={setLat} numeric />
        <Field label="Longitude" value={lng} onChange={setLng} numeric />
      </View>
      <Action title="Use where I am" onPress={() => void here()} />
      <View style={s.switchRow}>
        <Text style={[ui.notice, { flex: 1 }]}>This is a public place, not a residential street.</Text>
        <Switch value={publicPlace} onValueChange={setPublicPlace} trackColor={{ true: '#8F7A52', false: '#2C2D31' }} accessibilityLabel="Confirm public place" />
      </View>
      {problems.length && (name || lat || lng) ? <Text style={ui.body}>{problems.join(' ')}</Text> : null}
      {error ? <Text style={ui.notice}>{error}</Text> : null}
      <View style={s.pair}>
        <View style={{ flex: 1 }}>
          <Action primary title="Save place" disabled={problems.length > 0} onPress={() => void save()} />
        </View>
        <View style={{ flex: 1 }}>
          <Action title="Cancel" onPress={onCancel} />
        </View>
      </View>
    </View>
  );
}

function PlaceCard({ anchor, onDone }: { anchor: AdminAnchor; onDone: (m: string) => void }) {
  const [open, setOpen] = useState(false);
  const [hours, setHours] = useState('24');
  const [count, setCount] = useState('3');
  const [stock, setStock] = useState('5');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function stockIt() {
    setBusy(true);
    setError('');
    try {
      const n = await stockAnchor(anchor.id, Number(hours), Number(count), Number(stock));
      onDone(`${n} ${n === 1 ? 'envelope' : 'envelopes'} placed at ${anchor.name}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Not stocked.');
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive() {
    setBusy(true);
    try {
      await saveAnchor({ ...anchor, active: !anchor.active, publicPlace: true });
      onDone(anchor.active ? `${anchor.name} paused.` : `${anchor.name} active again.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Not saved.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={[ui.card, !anchor.active && { opacity: 0.6 }]}>
      <Caption>{(anchorKindLabels[anchor.kind] ?? anchor.kind).toUpperCase() + (anchor.active ? '' : ' · PAUSED')}</Caption>
      <Text style={ui.cardTitle}>{anchor.name}</Text>
      <Text style={ui.body}>
        {anchor.open_envelopes} open · {anchor.remaining} left to claim
      </Text>
      {open ? (
        <View style={{ gap: 8 }}>
          <View style={s.pair}>
            <Field label="Hours" value={hours} onChange={setHours} numeric />
            <Field label="Envelopes" value={count} onChange={setCount} numeric />
            <Field label="Each holds" value={stock} onChange={setStock} numeric />
          </View>
          <Text style={ui.body}>Contents follow the rarity draw, with this week’s featured car in about one in ten.</Text>
          {error ? <Text style={ui.notice}>{error}</Text> : null}
          <View style={s.pair}>
            <View style={{ flex: 1 }}>
              <Action primary title="Stock now" disabled={busy || !anchor.active} onPress={() => void stockIt()} />
            </View>
            <View style={{ flex: 1 }}>
              <Action title="Close" onPress={() => setOpen(false)} />
            </View>
          </View>
        </View>
      ) : (
        <View style={s.pair}>
          <View style={{ flex: 1 }}>
            <Action title="Stock" disabled={!anchor.active} onPress={() => setOpen(true)} />
          </View>
          <View style={{ flex: 1 }}>
            <Action title={anchor.active ? 'Pause' : 'Resume'} disabled={busy} onPress={() => void toggleActive()} />
          </View>
        </View>
      )}
    </View>
  );
}

// ---- Curated meets ----

function MeetsSection({ onMessage }: { onMessage: (m: string) => void }) {
  const [meets, setMeets] = useState<Meet[] | null>(null);
  const [places, setPlaces] = useState<AdminAnchor[]>([]);
  const [anchorId, setAnchorId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [startsIn, setStartsIn] = useState('0');
  const [hours, setHours] = useState('3');
  const [radius, setRadius] = useState('200');
  const [error, setError] = useState('');

  const load = useCallback(() => {
    readMeets()
      .then(setMeets)
      .catch((e: unknown) => {
        setMeets([]);
        onMessage(e instanceof Error ? e.message : 'Meets are unavailable.');
      });
    readAnchors()
      .then((a) => setPlaces(a.filter((x) => x.kind === 'curated_meet' && x.active)))
      .catch(() => setPlaces([]));
  }, [onMessage]);
  useEffect(load, [load]);

  async function save() {
    if (!anchorId) return;
    setError('');
    try {
      await createMeet({
        anchorId,
        name: name.trim(),
        startsAt: new Date(Date.now() + Number(startsIn) * 3_600_000),
        hours: Number(hours),
        radiusM: Number(radius),
      });
      setName('');
      onMessage('Meet saved. Sightings inside it show after one hour.');
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Meet not saved.');
    }
  }

  async function remove(id: string) {
    try {
      await deleteMeet(id);
      onMessage('Meet removed.');
      load();
    } catch (e) {
      onMessage(e instanceof Error ? e.message : 'Could not remove that meet.');
    }
  }

  const placeName = (id: string) => places.find((p) => p.id === id)?.name ?? id;
  if (meets === null) return <ActivityIndicator color="#C6B08B" />;
  return (
    <View style={{ gap: 14 }}>
      <Text style={ui.body}>A meet shortens the hold to one hour for sightings inside it. Still neighborhood scale, members only, never near a home.</Text>
      <View style={ui.card}>
        <Caption>NEW MEET</Caption>
        {places.length === 0 ? <Text style={ui.body}>Add a curated-meet place under Places first.</Text> : null}
        <Chips items={places.map((p) => p.id)} value={anchorId} onChange={setAnchorId} label={placeName} />
        <Field label="Name" value={name} onChange={setName} placeholder="Saturday Cars and Coffee" />
        <View style={s.pair}>
          <Field label="Starts in (hours)" value={startsIn} onChange={setStartsIn} numeric />
          <Field label="Lasts (hours, max 12)" value={hours} onChange={setHours} numeric />
          <Field label="Radius (m)" value={radius} onChange={setRadius} numeric />
        </View>
        {error ? <Text style={ui.notice}>{error}</Text> : null}
        <Action primary title="Save meet" disabled={!anchorId || name.trim().length < 3} onPress={() => void save()} />
      </View>
      <Caption>UPCOMING AND RUNNING</Caption>
      {meets.length === 0 ? <Text style={ui.notice}>No meets scheduled.</Text> : null}
      {meets.map((m) => (
        <View key={m.id} style={ui.card}>
          <Text style={ui.cardTitle}>{m.name}</Text>
          <Text style={ui.body}>
            {placeName(m.anchor_id)} · {new Date(m.starts_at).toLocaleString()} to {new Date(m.ends_at).toLocaleTimeString()} · {m.radius_m} m
          </Text>
          <Action title="Remove meet" onPress={() => void remove(m.id)} />
        </View>
      ))}
    </View>
  );
}

// ---- Featured car of the week ----

function FeaturedSection({ onMessage }: { onMessage: (m: string) => void }) {
  const weeks = useMemo(() => [weekStartOf(new Date()), weekStartOf(new Date(), 1)], []);
  const [week, setWeek] = useState(weeks[0]!);
  const [catalog, setCatalog] = useState<CatalogCar[] | null>(null);
  const [current, setCurrent] = useState<Record<string, { catalog_id: string; note: string | null }>>({});
  const [search, setSearch] = useState('');
  const [pick, setPick] = useState<string | null>(null);
  const [note, setNote] = useState('');

  const load = useCallback(() => {
    readCatalog().then(setCatalog).catch(() => setCatalog([]));
    readFeaturedWeeks(weeks)
      .then((rows) => setCurrent(Object.fromEntries(rows.map((r) => [r.week_start, r]))))
      .catch(() => setCurrent({}));
  }, [weeks]);
  useEffect(load, [load]);
  useEffect(() => {
    setPick(current[week]?.catalog_id ?? null);
    setNote(current[week]?.note ?? '');
  }, [week, current]);

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = catalog ?? [];
    return (q ? list.filter((c) => `${c.make} ${c.model}`.toLowerCase().includes(q)) : list).slice(0, 12);
  }, [catalog, search]);

  async function save() {
    if (!pick) return;
    try {
      await setFeatured(week, pick, note);
      onMessage('Featured car saved. It goes into about one envelope in ten that week.');
      load();
    } catch (e) {
      onMessage(e instanceof Error ? e.message : 'Not saved.');
    }
  }

  if (catalog === null) return <ActivityIndicator color="#C6B08B" />;
  const chosen = catalog.find((c) => c.id === current[week]?.catalog_id);
  return (
    <View style={{ gap: 14 }}>
      <Chips items={weeks} value={week} onChange={setWeek} label={(w) => (w === weeks[0] ? `This week · ${w}` : `Next week · ${w}`)} />
      <Text style={ui.body}>{chosen ? `Set: ${chosen.make} ${chosen.model}.` : 'Nothing set for this week.'}</Text>
      <Field label="Find a car" value={search} onChange={setSearch} placeholder="Make or model" />
      {matches.map((c) => (
        <Pressable key={c.id} accessibilityRole="radio" accessibilityState={{ selected: pick === c.id }} onPress={() => setPick(c.id)} style={[s.pickRow, pick === c.id && s.chipOn]}>
          <Text style={[ui.notice, { flex: 1 }]}>
            {c.make} {c.model}
          </Text>
          <Text style={ui.caption}>{tierLabel(c.tier).toUpperCase()}</Text>
        </Pressable>
      ))}
      <Field label="Note members will read (optional)" value={note} onChange={(t) => setNote(t.slice(0, 200))} multiline />
      <Action primary title="Save featured car" disabled={!pick} onPress={() => void save()} />
    </View>
  );
}

const s = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 10, gap: 8, backgroundColor: '#08090A', borderBottomWidth: 1, borderColor: '#1E1F23' },
  title: { fontFamily: 'BarlowCondensed_700Bold', fontSize: 34, color: '#F4F2ED' },
  segments: { flexDirection: 'row', borderWidth: 1, borderColor: '#2C2D31' },
  segment: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  segmentOn: { backgroundColor: '#1A1C24' },
  segmentText: { fontFamily: 'DMSans_600SemiBold', fontSize: 11, letterSpacing: 1.2, color: '#8F8F92' },
  segmentTextOn: { color: '#F4F2ED' },
  input: { padding: 10, borderWidth: 1, borderColor: '#2C2D31', backgroundColor: '#0B0C0E', color: '#F4F2ED', fontFamily: 'DMSans_400Regular', fontSize: 15 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: '#2C2D31' },
  chipOn: { borderColor: '#C6B08B', backgroundColor: '#14130F' },
  chipText: { fontFamily: 'DMSans_500Medium', fontSize: 13, color: '#B7B7B8' },
  chipTextOn: { color: '#C6B08B' },
  pair: { flexDirection: 'row', gap: 10 },
  pickRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderWidth: 1, borderColor: '#24252A' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  photo: { width: '100%', aspectRatio: 4 / 3, backgroundColor: '#0B0C0E' },
});
