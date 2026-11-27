import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@underground/ui';
import { getMobileSupabaseClient, isLiveAuthConfigured } from '../session/supabase-session';
import { previewVehicles } from '../garage/preview-vehicles';
import { readPreview } from './preview-store';
import type { Vehicle } from './page';

type Detail = { label: string; color: string; mods: { title: string; status: string }[] };
export function SharedGarage({
  viewer,
  target,
  vehicle,
}: {
  viewer: string;
  target: string;
  vehicle: Vehicle;
}) {
  const [detail, setDetail] = useState<Detail | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  async function open() {
    if (detail) {
      setDetail(null);
      return;
    }
    setBusy(true);
    setError('');
    try {
      if (isLiveAuthConfigured()) {
        const { data, error } = await getMobileSupabaseClient()!.rpc('profile_featured_garage', {
          target,
          car: vehicle.id,
        });
        if (error || !data) throw new Error('This garage is unavailable.');
        setDetail(data);
      } else {
        const p = await readPreview(viewer, target);
        if (
          p.settings.vehicleId !== vehicle.id ||
          !p.vehicles.some((v) => v.id === vehicle.id && v.visibility !== 'private')
        )
          throw new Error('This garage is private.');
        const car = (await previewVehicles(target)).find(record => record.id === vehicle.id);
        if (!car) throw new Error('This car is unavailable.');
        setDetail({
          label: vehicle.label,
          color: [car.color, car.wrap].filter(Boolean).join(' / '),
          mods: [car.wheels, car.brakes, car.suspension, car.aero, car.carbon, car.exhaust, car.installed]
            .filter(Boolean).map(title => ({ title, status: 'Installed' }))
            .concat(car.planned ? [{ title: car.planned, status: 'Planned' }] : []),
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open garage.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: !!detail }}
        disabled={busy}
        onPress={() => void open()}
        style={{ minHeight: 44, justifyContent: 'center' }}
      >
        <Text style={{ color: '#E6E5DD', textDecorationLine: 'underline' }}>
          {detail ? 'Close garage' : busy ? 'Opening…' : 'View garage'}
        </Text>
      </Pressable>
      {detail && (
        <View style={{ gap: 6 }}>
          <Text style={{ color: '#DBDCD6' }}>{detail.color}</Text>
          {detail.mods.map((mod, i) => (
            <Text key={i} style={{ color: '#DBDCD6' }}>
              {mod.title} · {mod.status}
            </Text>
          ))}
        </View>
      )}
      {!!error && (
        <Text accessibilityRole="alert" style={{ color: '#F2CABD' }}>
          {error}
        </Text>
      )}
    </View>
  );
}
