import { FittedPhoto } from '../components/FittedPhoto';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { getMobileSupabaseClient } from '../session/supabase-session';
import type { Sighting } from './collection';

type Vehicle = {
  owner_member_id: string;
  id: string;
  year: number;
  make: string;
  model: string;
  trim: string | null;
  color: string;
};
type Request = {
  id: string;
  decision: string;
  owner_number: string | null;
  context: string;
  thumbnail?: string;
  vehicles: Vehicle | null;
};
type Props = { member: string; number: string; spot?: Sighting };
const columns =
  'id,decision,owner_number,context,vehicles(id,owner_member_id,year,make,model,trim,color)';
function vehicleName(v: Vehicle) {
  return [v.year, v.color, v.make, v.model, v.trim].filter(Boolean).join(' ');
}

export function OwnerConfirmation({ member, number, spot }: Props) {
  const client = getMobileSupabaseClient();
  const [requests, setRequests] = useState<Request[]>([]);
  const [choices, setChoices] = useState<Vehicle[] | null>(null);
  const [garage, setGarage] = useState<Vehicle[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  const load = useCallback(async () => {
    if (!client) return [];
    const fields = spot ? columns : columns + ',thumbnail';
    let query = client.from('spotted_confirmations').select(fields);
    query = spot
      ? query.eq('spotter', member).eq('sighting', spot.id)
      : query.neq('spotter', member).eq('decision', 'pending');
    const result = await query.order('created_at', { ascending: false }).limit(20);
    if (result.error) throw new Error('Owner confirmation is unavailable.');
    return result.data as unknown as Request[];
  }, [client, member, spot]);
  useEffect(() => {
    let active = true;
    load()
      .then((rows) => {
        if (active) setRequests(rows);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [load]);
  async function perform(work: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update request.');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function action(label: string, fn: () => Promise<void>) {
    return (
      <Pressable
        key={label}
        accessibilityRole="button"
        disabled={busy}
        style={s.button}
        onPress={() => void perform(fn)}
      >
        <Text style={s.link}>{label}</Text>
      </Pressable>
    );
  }
  if (!client) return null;
  async function chooseVehicle() {
    const result = await client!
      .from('vehicles')
      .select('id,owner_member_id,year,make,model,trim,color')
      .neq('owner_member_id', member)
      .ilike('make', spot!.make.replace(/[%_\\]/g, '\\$&'))
      .limit(25);
    if (result.error) throw new Error('Could not load visible garages.');
    setChoices(result.data);
  }
  async function send(vehicle: Vehicle) {
    const { manipulateAsync, SaveFormat } = await imageTools();
    const thumb = await manipulateAsync(spot!.photo, [{ resize: { width: 420 } }], {
      base64: true,
      format: SaveFormat.JPEG,
      compress: 0.58,
    });
    if (!thumb.base64 || thumb.base64.length > 200000)
      throw new Error('Could not prepare the preview.');
    const result = await client!
      .from('spotted_confirmations')
      .insert({
        sighting: spot!.id,
        vehicle_id: vehicle.id,
        context: [spot!.make + ' ' + spot!.model, spot!.place, spot!.date.slice(0, 10)]
          .filter(Boolean)
          .join(' · '),
        thumbnail: thumb.base64,
      });
    if (result.error && result.error.code !== '23505')
      throw new Error('Could not send owner request.');
    setRequests(await load());
    setChoices(null);
  }
  async function decide(id: string, confirmed: boolean) {
    const result = await client!
      .from('spotted_confirmations')
      .update({
        decision: confirmed ? 'confirmed' : 'declined',
        owner_number: confirmed ? number : null,
      })
      .eq('id', id)
      .eq('decision', 'pending')
      .select('id')
      .single();
    if (result.error) throw new Error('Could not update this request. Refresh and try again.');
    setRequests(await load());
  }
  return (
    <View style={s.panel}>
      {busy && <ActivityIndicator />}
      {error && <Text style={s.text}>{error}</Text>}
      {spot &&
        !requests.length &&
        choices === null &&
        action('Request owner confirmation', chooseVehicle)}
      {choices !== null && (
        <>
          <Text style={s.text}>Select the owner’s car to send your photo for confirmation.</Text>
          {!choices.length && <Text style={s.text}>No matching cars in visible garages.</Text>}
          {choices.map((v) => action(vehicleName(v), () => send(v)))}
          {action('Cancel', async () => setChoices(null))}
        </>
      )}
      {requests.map((r) => (
        <View style={s.panel} key={r.id}>
          <Text style={s.text}>
            {spot
              ? r.decision === 'confirmed'
                ? 'Confirmed by member #' + r.owner_number
                : 'Owner request · ' + r.decision
              : 'Is this your car?'}
          </Text>
          {r.vehicles && <Text style={s.text}>{vehicleName(r.vehicles)}</Text>}
          {spot &&
            r.decision === 'confirmed' &&
            r.vehicles &&
            action('View member garage', async () => {
              const result = await client
                .from('vehicles')
                .select('id,owner_member_id,year,make,model,trim,color')
                .eq('owner_member_id', r.vehicles!.owner_member_id)
                .order('created_at', { ascending: false });
              if (result.error) throw new Error('Garage unavailable.');
              setGarage(result.data);
            })}
          {garage && spot && (
            <View style={s.panel}>
              <Text style={s.text}>
                {garage.length ? 'Visible garage vehicles' : 'No visible vehicles'}
              </Text>
              {garage.map((v) => (
                <Text style={s.text} key={v.id}>
                  {vehicleName(v)}
                </Text>
              ))}
              {action('Close garage', async () => setGarage(null))}
            </View>
          )}
          {!spot && (
            <>
              {r.thumbnail && (
                <FittedPhoto accessibilityLabel="Vehicle sighting" source={{ uri: 'data:image/jpeg;base64,' + r.thumbnail }} />
              )}
              <Text style={s.text}>{r.context}</Text>
              {action('Confirm vehicle', () => decide(r.id, true))}
              {action('Decline', () => decide(r.id, false))}
            </>
          )}
        </View>
      ))}
      {(!spot || requests.length > 0) &&
        action(spot ? 'Refresh owner status' : 'Check owner requests', async () => {
          const rows = await load();
          setRequests(rows);
          if (!spot && !rows.length) setError('No pending owner requests.');
        })}
    </View>
  );
}

function imageTools() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('expo-image-manipulator') as typeof import('expo-image-manipulator');
}
const s = StyleSheet.create({
  panel: { gap: 6 },
  button: { padding: 10 },
  link: { color: '#C6B08B', fontFamily: 'DMSans_600SemiBold' },
  text: { color: '#D5D4D0', fontFamily: 'DMSans_400Regular', paddingHorizontal: 10 },
});
