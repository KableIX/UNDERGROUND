import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { GoldRule, Screen, Text } from '@underground/ui';
import { getMobileSupabaseClient } from '../session/supabase-session';
import { publicEnv } from '../lib/env';
import { useSession } from '../session/SessionContext';
import { GaragePhotoUpload } from './GaragePhotoUpload';
import { shell } from '../theme/shell';

type GarageVehicle = {
  id: string;
  year: number;
  make: string;
  model: string;
  trim: string | null;
  color: string;
  verification_status: string;
  visibility: string;
};
type GalleryItem = {
  id: string;
  vehicleId: string;
  readUrl: string | null;
  caption: string | null;
};
type PrivateGarageResponse = {
  ok: boolean;
  profile?: {
    member: {
      id: string; member_number: string; display_name: string;
    };
    vehicles: GarageVehicle[];
    media: GalleryItem[];
  };
};

/** Real, owner-scoped garage; no founder fixtures or public storage paths. */
export function LiveGarage() {
  const { state } = useSession();
  const [garage, setGarage] = useState<PrivateGarageResponse['profile'] | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const loadGarage = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const client = getMobileSupabaseClient();
      const { data } = await client?.auth.getSession() ?? { data: { session: null } };
      const token = data.session?.access_token;
      if (!token) throw new Error('Sign in to access your verified garage.');
      const response = await fetch(`${publicEnv.API_PUBLIC_URL!.replace(/\/$/, '')}/v1/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Your private garage could not be loaded.');
      const result = await response.json() as PrivateGarageResponse;
      if (!result.ok || !result.profile) throw new Error('Invalid garage response.');
      setGarage(result.profile);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Garage unavailable');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadGarage(); }, [loadGarage]);

  if (state.status !== 'authenticated') return null;

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="caption" gold>UNDERGROUND · PRIVATE GARAGE</Text>
        <Text variant="title" style={styles.title}>
          {garage?.member.display_name ?? state.member.displayName}
        </Text>
        <Text variant="caption" style={styles.meta}>
          MEMBER #{garage?.member.member_number ?? state.member.memberNumber}
        </Text>
        <GoldRule />
        {loading ? <ActivityIndicator color={shell.accent} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {garage?.vehicles.length === 0 ? (
          <Text style={styles.meta}>No verified vehicles registered yet.</Text>
        ) : null}
        {garage?.vehicles.map(vehicle => (
          <View key={vehicle.id} style={styles.vehicle}>
            <Text variant="title" gold>
              {vehicle.year} {vehicle.make} {vehicle.model}
            </Text>
            <Text style={styles.meta}>
              {vehicle.trim ?? ''} · {vehicle.color} · {vehicle.verification_status.toUpperCase()}
            </Text>
            <Text style={styles.meta}>
              VISIBILITY: {vehicle.visibility.toUpperCase()}
            </Text>
            <GaragePhotoUpload
              vehicleId={vehicle.id}
              memberId={garage.member.id}
              onPlanned={() => { void loadGarage(); }}
            />
            <View style={styles.gallery}>
              {garage.media.filter(m => m.vehicleId === vehicle.id && m.readUrl).map(m => (
                <View key={m.id} style={styles.photo}>
                  <Image
                    source={{ uri: m.readUrl! }}
                    resizeMode="cover"
                    style={styles.image}
                    accessibilityLabel={m.caption ?? 'Private garage photograph'}
                  />
                  <Text style={styles.meta}>{m.caption ?? 'Garage photograph'}</Text>
                </View>
              ))}
            </View>
          </View>
        ))}
        <Pressable onPress={() => void loadGarage()} style={styles.refresh}>
          <Text variant="caption" gold>REFRESH GARAGE</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}
const styles = StyleSheet.create({
  content: { padding: 18, paddingBottom: 48 },
  title: { marginTop: 8 },
  meta: { color: shell.muted, marginTop: 6 },
  error: { color: '#D66D6D', marginTop: 12 },
  vehicle: { borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(197,165,114,0.3)', paddingVertical: 18 },
  gallery: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 },
  photo: { width: '47%' },
  image: { width: '100%', aspectRatio: 1, backgroundColor: shell.tabBar },
  refresh: { padding: 18, alignItems: 'center' },
});
