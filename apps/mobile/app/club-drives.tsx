import { FittedPhoto } from '../src/components/FittedPhoto';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { BookCover } from '../src/components/play/BookCover';
import { saratogaPhoto } from '../src/data/saratoga-photo';
import { DriveRouteMap } from '../src/components/play/DriveRouteMap';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getMobileSupabaseClient } from '../src/session/supabase-session';
import { useSession } from '../src/session/SessionContext';
import campus from '../src/data/nvidia-campus-route.json';

import { countyBulletin, routeNotices } from '../src/lib/county-closures';
import saratogaTurns from '../src/data/saratoga-turns.json';
import saratogaGuide from '../src/data/saratoga-drive-brief.json';
import saratoga from '../src/data/saratoga-club-route.json';

const saratogaRoute = {
  id: 'saratoga',
  title: 'Saratoga',
  meet: saratoga.properties.startLabel,
  roads: saratoga.properties.direction,
  notes: 'Preview follows the shared stops using OpenStreetMap routing.',
  distance_m: saratoga.properties.distanceMeters,
  coordinates: saratoga.geometry.coordinates,
};
type Club = { id: string; name: string; organizer: boolean };
type Route = {
  id: string;
  title: string;
  meet: string;
  notes: string;
  roads: string;
  coordinates: number[][];
  distance_m: number;
};
type Event = {
  id: string;
  drive_route_id: string;
  starts_at: string;
  meet_at: string;
  event_tz: string;
  cancelled: boolean;
};
type Guest = {
  event_id: string;
  member_id: string;
  vehicle_id: string;
  driver_name: string;
  car: string;
  entry_class: string;
};
type Car = { id: string; year: number; make: string; model: string; trim: string | null };
const db = getMobileSupabaseClient;

function Button({
  title,
  onPress,
  selected = false,
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  selected?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      style={[s.button, selected && s.selected, disabled && { opacity: 0.45 }]}
    >
      <Text style={s.label}>{title}</Text>
    </Pressable>
  );
}
function Field({
  label,
  value,
  set,
  multi = false,
}: {
  label: string;
  value: string;
  set: (v: string) => void;
  multi?: boolean;
}) {
  return (
    <View>
      <Text style={s.muted}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={set}
        style={s.field}
        multiline={multi}
        autoCapitalize="none"
        placeholderTextColor="#8b9094"
      />
    </View>
  );
}
function parseTime(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) throw new Error('Enter the date and time as YYYY-MM-DD HH:MM.');
  const [year, month, day, hour, minute] = match.slice(1).map(Number);
  const d = new Date(year, month - 1, day, hour, minute);
  if (
    d.getFullYear() !== year ||
    d.getMonth() !== month - 1 ||
    d.getDate() !== day ||
    d.getHours() !== hour ||
    d.getMinutes() !== minute
  )
    throw new Error('Choose a valid local date and time.');
  return d.toISOString();
}
function localInput(value: string) {
  const d = new Date(value);
  const two = (n: number) => String(n).padStart(2, '0');
  return (
    d.getFullYear() +
    '-' +
    two(d.getMonth() + 1) +
    '-' +
    two(d.getDate()) +
    ' ' +
    two(d.getHours()) +
    ':' +
    two(d.getMinutes())
  );
}
function RouteMap({ route, guided }: { route: Route; guided: boolean }) {
  return <DriveRouteMap routeId={guided ? 'saratoga-club-loop' : route.id} title={route.title} coordinates={route.coordinates} maneuvers={guided ? saratogaTurns : undefined} />;
}
const driveGuides = [{ coordinates: saratogaRoute.coordinates, guide: saratogaGuide }];
function guideFor(route: Route) {
  return driveGuides.find(({ coordinates }) => coordinates === route.coordinates ||
    (coordinates.length === route.coordinates.length && coordinates.every(([lng, lat], i) =>
      route.coordinates[i][0] === lng && route.coordinates[i][1] === lat)))?.guide;
}
function RoadConditions({ roads, snapshot }: { roads: string[]; snapshot: { date: string; notices: string[] } }) {
  const lastCheck = 'County bulletin reviewed ' + snapshot.date + '. ' + (snapshot.notices.join(' / ') || 'No notices matched the listed road names.');
  const [bulletin, setBulletin] = useState(lastCheck);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    async function check() {
      const response = await fetch(countyBulletin, { signal: controller.signal });
      if (!response.ok) throw Error();
      const notices = routeNotices(await response.text(), roads);
      const summary = notices.length ? notices.join('\n\n') : 'No county notices matched the named roads on this itinerary.';
      if (active) setBulletin(summary + '\nSanta Clara County bulletin checked ' + new Date().toLocaleString() + '. City streets and state highways may have separate advisories.');
    }
    void check().catch(() => { if (active) setBulletin(lastCheck + ' Live refresh unavailable. City and state advisories are separate.'); }).finally(() => clearTimeout(timeout));
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, [roads, lastCheck]);
  return <View style={s.panel}><Text style={s.h2}>Road conditions</Text><Text style={s.muted}>{bulletin}</Text></View>;
}
function DriveBrief({ route, guests }: { route: Route; guests?: Guest[] }) {
  const guide = useMemo(() => guideFor(route), [route]);
  const first = route.coordinates[0];
  const last = route.coordinates[route.coordinates.length - 1];
  const loop = first && last && first[0] === last[0] && first[1] === last[1];
  return <View style={s.panel}>
    {guests && <View style={s.driverStrip}>
      <Text style={s.label}>Club drivers / {guests.length}</Text>
      {guests.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {guests.map(g => <View key={g.member_id} style={s.driver}><Text style={s.label}>{g.driver_name}</Text><Text style={s.muted}>{g.car}</Text></View>)}
      </ScrollView> : <Text style={s.muted}>No drivers have joined yet.</Text>}
    </View>}
    <RouteMap route={route} guided={!!guide} />
    <Image source={require('../assets/brand/underground-lockup-silver.png')} accessibilityLabel="UNDERGROUND" resizeMode="contain" style={{ width: 164, height: 31 }} />
    <Text style={s.heading}>{route.title}</Text>
    <Text style={s.label}>{(route.distance_m / 1609.344).toFixed(1)} mi{guide ? `    /    ${Math.floor(guide.drivingMinutes / 60)} hr ${guide.drivingMinutes % 60} min driving` : ''}{loop ? '    /    Loop' : ''}</Text>
    <Text style={s.muted}>Meet / {route.meet}</Text>
    {guide && <FittedPhoto source={saratogaPhoto.cover} accessibilityLabel={saratogaPhoto.photo.caption} radius={6} />}
    <Text style={s.h2}>Description</Text>
    {guide ? <>
      {guide.description.map(paragraph => <Text key={paragraph} style={s.muted}>{paragraph}</Text>)}
      <Text style={s.h2}>Stops and waypoints</Text>
      <Text style={s.muted}>Waypoints shape the route. Confirm parking and planned stops with the organizer.</Text>
      {guide.stops.map((stop, i) => (
        <View key={i} style={s.stop}>
          <Text style={s.mileage}>{(stop.distanceM / 1609.344).toFixed(1)} mi</Text>
          <View style={{ flex: 1 }}><Text style={s.label}>{stop.name}</Text><Text style={s.muted}>{stop.latitude.toFixed(5)}, {stop.longitude.toFixed(5)}</Text></View>
        </View>
      ))}
      <RoadConditions roads={guide.conditionsRoads} snapshot={guide.countySnapshot} />
      <Text style={s.muted}>{guide.credit}</Text>
    </> : <Text style={s.muted}>{route.roads}</Text>}
    {route.notes && route !== saratogaRoute && <Text style={s.muted}>{guide ? route.notes.replace('Original route: ' + saratoga.properties.sourceUrl, '').trim() : route.notes}</Text>}
  </View>;
}
export default function ClubDrives() {
  const { state } = useSession();
  const router = useRouter();
  const inset = useSafeAreaInsets();
  const member = state.status === 'authenticated' ? state.member.memberId : '';
  const [clubs, setClubs] = useState<Club[]>([]),
    [club, setClub] = useState(''),
    [loading, setLoading] = useState(true),
    [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let current = true;
    const client = db();
    setLoading(true);
    setError('');
    setClubs([]);
    setClub('');
    async function load() {
      if (!client || !member) return;
      const [m, v] = await Promise.all([
        client.from('club_memberships').select('club_id,role,clubs(name)').eq('member_id', member),
        client.from('drive_verified_clubs').select('club_id'),
      ]);
      if (m.error || v.error)
        throw new Error('Could not load your clubs. Check the club service and retry.');
      const allowed = new Set(v.data.map((row) => row.club_id));
      const list = m.data
        .filter((row) => allowed.has(row.club_id))
        .map((row) => ({
          id: row.club_id as string,
          name: (row.clubs as unknown as { name: string })?.name ?? 'Club',
          organizer: ['owner', 'officer'].includes(row.role),
        }));
      if (current) {
        setClubs(list);
        setClub(list[0]?.id ?? '');
      }
    }
    load()
      .catch((e) => {
        if (current) setError(e.message);
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [member, reload]);
  const { route } = useLocalSearchParams<{ route?: string }>();
  const [showSaratoga, setShowSaratoga] = useState(false);
  const fromCatalog = route === 'saratoga';
  const active = clubs.find((c) => c.id === club);
  if (fromCatalog || showSaratoga) return <ScrollView key="brief" style={s.screen} contentContainerStyle={[s.content, { paddingTop: inset.top + 8, paddingBottom: inset.bottom + 24 }]}>
    <Button title={fromCatalog ? "Back to Drive" : "Back to Club Drives"} onPress={() => {
        if (fromCatalog) { if (router.canGoBack()) router.back(); else router.replace('/runs'); }
        else setShowSaratoga(false);
      }} />
    <DriveBrief route={saratogaRoute} />
  </ScrollView>;
  return (
    <ScrollView
      style={s.screen}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[
        s.content,
        { paddingTop: inset.top + 10, paddingBottom: inset.bottom + 24 },
      ]}
    >
      <Button
        title="‹ Drive"
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/conquest'))}
      />
      <Text style={s.heading}>Club Drives</Text>
      <BookCover title="Saratoga Club Loop" detail="View route" art={saratogaPhoto} variant="club" onPress={() => setShowSaratoga(true)} />
      {error ? (
        <>
          <Text style={s.muted}>{error}</Text>
          <Button title="Retry" onPress={() => setReload((x) => x + 1)} />
        </>
      ) : loading ? (
        <Text style={s.muted}>Loading clubs…</Text>
      ) : !db() ? (
        <Text style={s.muted}>Connect the signed-in club service to view private drives.</Text>
      ) : !active ? (
        <Text style={s.muted}>Your verified clubs will appear here once you join one.</Text>
      ) : (
        <>
          {clubs.map((c) => (
            <Button
              key={c.id}
              title={c.name}
              selected={c.id === club}
              onPress={() => setClub(c.id)}
            />
          ))}
          <Planner key={member + club} club={active} member={member} />
        </>
      )}
    </ScrollView>
  );
}
function Planner({ club, member }: { club: Club; member: string }) {
  const client = db()!;
  const [routes, setRoutes] = useState<Route[]>([]),
    [events, setEvents] = useState<Event[]>([]),
    [guests, setGuests] = useState<Guest[]>([]),
    [cars, setCars] = useState<Car[]>([]);
  const [routeId, setRoute] = useState(''),
    [eventId, setEvent] = useState(''),
    [car, setCar] = useState(''),
    [kind, setKind] = useState('Collector');
  const [screen, setScreen] = useState<'list' | 'new' | 'route' | 'schedule' | 'event'>('list');
  const [title, setTitle] = useState(''),
    [meet, setMeet] = useState(''),
    [roads, setRoads] = useState(''),
    [notes, setNotes] = useState(''),
    [geo, setGeo] = useState('');
  const [meeting, setMeeting] = useState(''),
    [departure, setDeparture] = useState('');
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const load = useCallback(async () => {
    const [r, e, c] = await Promise.all([
      client
        .from('club_drive_routes')
        .select('*')
        .eq('club_id', club.id)
        .order('created_at', { ascending: false }),
      client
        .from('club_events')
        .select('id,drive_route_id,starts_at,meet_at,event_tz,cancelled')
        .eq('club_id', club.id)
        .not('drive_route_id', 'is', null)
        .order('starts_at'),
      client.from('vehicles').select('id,year,make,model,trim').eq('owner_member_id', member),
    ]);
    if (r.error || e.error || c.error) throw new Error('Could not load drives and vehicles.');
    const ids = e.data.map((row) => row.id);
    const g = ids.length
      ? await client.from('club_drive_rsvps').select('*').in('event_id', ids)
      : { data: [], error: null };
    if (g.error) throw new Error('Could not load the roster.');
    setRoutes(r.data);
    setEvents(e.data);
    setCars(c.data);
    setGuests(g.data ?? []);
  }, [client, club.id, member]);
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [load]);
  async function doWork(fn: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save. Refresh and try again.');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const route = routes.find((r) => r.id === routeId);
  const event = events.find((e) => e.id === eventId);
  const roster = guests.filter((g) => g.event_id === eventId);
  const mine = roster.find((g) => g.member_id === member);
  async function rpc(name: string, args: Record<string, unknown>) {
    const result = await client.rpc(name, args);
    if (result.error) throw new Error(result.error.message);
    return result.data;
  }
  function openEvent(e: Event) {
    setEvent(e.id);
    setRoute(e.drive_route_id);
    const mine = guests.find((g) => g.member_id === member && g.event_id === e.id);
    setKind(mine?.entry_class ?? 'Collector');
    setCar(mine?.vehicle_id ?? cars[0]?.id ?? '');
    setScreen('event');
    setError('');
  }
  const [personal, setPersonal] = useState<
    { id: string; title: string; geometry: unknown }[] | null
  >(null);
  const [advanced, setAdvanced] = useState(false);
  async function personalRoutes() {
    const result = await client
      .from('route_plans')
      .select('id,title,geometry')
      .eq('owner_member_id', member)
      .not('geometry', 'is', null)
      .order('updated_at', { ascending: false });
    if (result.error) throw new Error('Could not load personal routes.');
    setPersonal(result.data);
  }
  function openSchedule(edit?: Event) {
    setEvent(edit?.id ?? '');
    setMeeting(edit ? localInput(edit.meet_at) : '');
    setDeparture(edit ? localInput(edit.starts_at) : '');
    setScreen('schedule');
  }
  function saveRoute() {
    void doWork(async () => {
      let parsed;
      try {
        parsed = JSON.parse(geo);
      } catch {
        throw new Error('Paste a route as GeoJSON or select the NVIDIA loop.');
      }
      const line = parsed?.type === 'Feature' ? parsed.geometry : parsed;
      if (line?.type !== 'LineString') throw new Error('Choose a GeoJSON LineString.');
      const id = await rpc('save_club_drive', {
        c: club.id,
        title_text: title,
        roads_text: roads,
        meet_text: meet,
        notes_text: notes,
        points: line.coordinates,
      });
      setRoute(id);
      setScreen('route');
    });
  }
  function join(withdraw: boolean) {
    void doWork(async () => {
      await rpc('rsvp_club_drive', {
        occurrence: eventId,
        vehicle: withdraw ? null : car,
        class: kind,
      });
    });
  }
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  function when(value: string, z: string) {
    return new Date(value).toLocaleString(undefined, {
      timeZone: z,
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    });
  }
  const closed = !!event && (event.cancelled || new Date(event.starts_at).getTime() <= Date.now());
  return (
    <View style={s.panel}>
      {error ? (
        <Text accessibilityLiveRegion="polite" style={s.err}>
          {error}
        </Text>
      ) : null}
      {busy ? <Text style={s.muted}>Updating…</Text> : null}
      {screen !== 'list' && (
        <Button
          title="‹ All drives"
          onPress={() => {
            setScreen('list');
            setError('');
          }}
          disabled={busy}
        />
      )}
      {screen === 'list' && (
        <>
          <Text style={s.h2}>Upcoming drives</Text>
          {events
            .filter((e) => !e.cancelled && Date.parse(e.starts_at) > Date.now())
            .map((e) => (
              <Button
                key={e.id}
                title={
                  (routes.find((r) => r.id === e.drive_route_id)?.title ?? 'Club drive') +
                  ' · ' +
                  when(e.starts_at, e.event_tz)
                }
                onPress={() => openEvent(e)}
              />
            ))}
          {!events.some((e) => !e.cancelled && Date.parse(e.starts_at) > Date.now()) && (
            <Text style={s.muted}>No upcoming departures.</Text>
          )}
          <Text style={s.h2}>Saved drives</Text>
          {routes.map((r) => (
            <Button
              key={r.id}
              title={r.title + ' · ' + (r.distance_m / 1609.344).toFixed(1) + ' mi'}
              onPress={() => {
                setRoute(r.id);
                setScreen('route');
              }}
            />
          ))}
          {club.organizer && (
            <Button
              title="Save a drive"
              onPress={() => {
                setTitle('');
                setMeet('');
                setRoads('');
                setNotes('');
                setGeo('');
                setPersonal(null);
                setAdvanced(false);
                setScreen('new');
              }}
            />
          )}
          <Button title="Refresh" disabled={busy} onPress={() => void doWork(async () => {})} />
        </>
      )}
      {screen === 'new' && (
        <>
          <Button
            title="Use Saratoga"
            onPress={() => {
              setTitle(saratogaRoute.title);
              setMeet(saratogaRoute.meet);
              setRoads(saratogaRoute.roads);
              setNotes('Route preview from OpenStreetMap contributors.');
              setGeo(JSON.stringify(saratoga.geometry));
              setAdvanced(false);
            }}
          />
          <Button
            title="Use NVIDIA Campus Loop"
            onPress={() => {
              setTitle('NVIDIA Campus Loop');
              setMeet(campus.properties.startLabel);
              setRoads(campus.properties.direction);
              setGeo(JSON.stringify(campus.geometry));
            }}
          />
          <Button
            title="Choose from my routes"
            disabled={busy}
            onPress={() => void doWork(personalRoutes)}
          />
          {personal?.length === 0 && (
            <Text style={s.muted}>No routes with saved geometry yet.</Text>
          )}
          {personal?.map((plan) => (
            <Button
              key={plan.id}
              title={plan.title}
              onPress={() => {
                setTitle(plan.title);
                setGeo(
                  typeof plan.geometry === 'string' ? plan.geometry : JSON.stringify(plan.geometry),
                );
                setPersonal(null);
                setRoads('');
                setMeet('');
                setAdvanced(false);
              }}
            />
          ))}
          <Field label="Drive name" value={title} set={setTitle} />
          <Field label="Meet spot at route start" value={meet} set={setMeet} />
          <Field label="Roads in driving order" value={roads} set={setRoads} />
          <Field label="Road conditions (optional)" value={notes} set={setNotes} />
          <Button
            title={advanced ? 'Close route import' : 'Import route coordinates'}
            onPress={() => setAdvanced(!advanced)}
          />
          {advanced && (
            <Field
              label="Road-following route · GeoJSON LineString"
              value={geo}
              set={setGeo}
              multi
            />
          )}
          <Button
            title="Save to club library"
            disabled={busy || !title.trim() || !meet.trim() || !roads.trim() || !geo.trim()}
            onPress={saveRoute}
          />
        </>
      )}
      {route && screen !== 'list' && screen !== 'new' && (
        <DriveBrief key={route.id} route={route} guests={screen === 'event' ? roster : undefined} />
      )}
      {screen === 'route' && club.organizer && (
        <Button title="Schedule this drive" onPress={() => openSchedule()} />
      )}
      {screen === 'schedule' && (
        <>
          <Text style={s.muted}>Times in {zone}</Text>
          <Field label="Meet · YYYY-MM-DD HH:MM" value={meeting} set={setMeeting} />
          <Field label="Depart · YYYY-MM-DD HH:MM" value={departure} set={setDeparture} />
          <Button
            title={eventId ? 'Save new time' : 'Schedule drive'}
            disabled={busy}
            onPress={() =>
              void doWork(async () => {
                const id = await rpc('schedule_club_drive', {
                  route: routeId,
                  meeting: parseTime(meeting),
                  departure: parseTime(departure),
                  zone,
                  occurrence: eventId || null,
                });
                setEvent(id);
                setCar(cars[0]?.id ?? '');
                setScreen('event');
              })
            }
          />
        </>
      )}
      {screen === 'event' && event && (
        <>
          <Text style={s.label}>
            {event.cancelled ? 'Cancelled' : 'Meet ' + when(event.meet_at, event.event_tz)}
          </Text>
          <Text style={s.muted}>Departure · {when(event.starts_at, event.event_tz)}</Text>
          {!closed && (
            <>
              <Text style={s.h2}>Your entry</Text>
              {cars.map((v) => (
                <Button
                  key={v.id}
                  selected={v.id === car}
                  title={[v.year, v.make, v.model, v.trim].filter(Boolean).join(' ')}
                  onPress={() => setCar(v.id)}
                />
              ))}
              {!cars.length && <Text style={s.muted}>Add a vehicle to your garage to join.</Text>}
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {['Daily', 'Collector'].map((k) => (
                  <Button key={k} title={k} selected={k === kind} onPress={() => setKind(k)} />
                ))}
              </View>
              <Button
                title={mine ? 'Update my RSVP' : 'Join drive'}
                disabled={!car || busy}
                onPress={() => join(false)}
              />
              {mine && <Button title="Withdraw" disabled={busy} onPress={() => join(true)} />}
              {club.organizer && (
                <>
                  <Button title="Reschedule" disabled={busy} onPress={() => openSchedule(event)} />
                  <Button
                    title="Cancel this departure"
                    disabled={busy}
                    onPress={() =>
                      Alert.alert('Cancel this departure?', route?.title, [
                        { text: 'Keep drive', style: 'cancel' },
                        {
                          text: 'Cancel departure',
                          style: 'destructive',
                          onPress: () =>
                            void doWork(async () => {
                              await rpc('cancel_club_drive', { occurrence: event.id });
                            }),
                        },
                      ])
                    }
                  />
                </>
              )}
            </>
          )}
          <Button
            title="Refresh roster"
            disabled={busy}
            onPress={() => void doWork(async () => {})}
          />
        </>
      )}
    </View>
  );
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#08090A' },
  content: { paddingHorizontal: 18, gap: 12 },
  panel: { gap: 12 },
  driverStrip: { gap: 6 },
  driver: { paddingRight: 16 },
  stop: { flexDirection: 'row', gap: 12, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderColor: '#32404A' },
  mileage: { width: 62, color: '#A5F29B', fontSize: 14, fontVariant: ['tabular-nums'] },
  heading: { fontFamily: 'BarlowCondensed_700Bold', fontSize: 44, lineHeight: 52, color: 'white' },
  h2: { fontFamily: 'BarlowCondensed_700Bold', fontSize: 27, lineHeight: 32, color: 'white' },
  label: { color: '#F4F2ED', fontFamily: 'DMSans_600SemiBold', fontSize: 15 },
  muted: { color: '#BCBCBD', fontFamily: 'DMSans_400Regular', fontSize: 14 },
  button: { backgroundColor: '#18191B', padding: 13, borderWidth: 1, borderColor: '#514B42' },
  selected: { borderColor: '#D0B88F', backgroundColor: '#3B362F' },
  field: { backgroundColor: '#171819', color: 'white', padding: 11, marginTop: 4 },
  err: { color: '#FFD2AD' },
});
