import { FounderR8Cover } from './FounderR8Cover';
import { isFounderR8 } from '../garage/founder-r8';
import { useFocusEffect } from 'expo-router';
import { FittedPhoto } from './FittedPhoto';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { GoldRule, Screen, Text } from '@underground/ui';
import { getMobileSupabaseClient } from '../session/supabase-session';
import { publicEnv } from '../lib/env';
import { useSession } from '../session/SessionContext';
import { EditGarageProfile, GarageStoreLink } from './GarageFirstLook';
import { GarageCarPhoto } from './GarageCarPhoto';
import { shell } from '../theme/shell';

import { Action, blankCar, CarForm, CarRecord, type CarDetails } from './CarDetails';

type GarageVehicle = {
  transmission: string|null; wheels:string|null; brakes:string|null; build_details?:Partial<CarDetails>;
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
    mods?: { id: string; vehicle_id: string; title: string; status: 'installed' | 'pending' }[];
  };
};

function editable(v:GarageVehicle):CarDetails {
  return {...blankCar,...v.build_details,year:String(v.year),make:v.make,model:v.model,trim:v.trim??'',color:v.color,
    transmission:v.transmission??'',wheels:v.wheels??'',brakes:v.brakes??''};
}

/** Real, owner-scoped garage; no founder fixtures or public storage paths. */
export function LiveGarage() {
  const { state } = useSession();
  const [garage, setGarage] = useState<PrivateGarageResponse['profile'] | null>(null);
  const [error, setError] = useState('');
  const [editing,setEditing]=useState<string|null>(null);
  const [loading, setLoading] = useState(true);


  const requestVersion = useRef(0);
  const loadGarage = useCallback(async () => {
    const version = ++requestVersion.current;
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
      const rows=await client!.from('vehicles').select('*').eq('owner_member_id',result.profile.member.id).order('created_at');
      if(rows.error) throw Error('Unable to load your vehicles.');
      if (version !== requestVersion.current) return;
      setGarage({...result.profile,vehicles:rows.data as GarageVehicle[]});
    } catch (e) {
      if (version === requestVersion.current) setError(e instanceof Error ? e.message : 'Garage unavailable');
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void loadGarage();
    return () => { requestVersion.current++; };
  }, [loadGarage]));

  if (state.status !== 'authenticated') return null;

  async function saveCar(car:CarDetails) {
    const client=getMobileSupabaseClient();
    if(!client || !garage || !editing)throw Error('Sign in to save your vehicle.');
    const {year,make,model,trim,color,transmission,wheels,brakes,...details}=car;
    const core={year:Number(year),make,model,trim,color,transmission,wheels,brakes};
    const existing=garage.vehicles.find(v=>v.id===editing);
    const hasExtended=existing?.build_details!==undefined || Object.values(details).some(Boolean);
    const payload=hasExtended?{...core,build_details:details}:core;
    const identityChanged=existing && (existing.year!==core.year || existing.make!==make || existing.model!==model || (existing.trim??'')!==trim);
    if(identityChanged && existing.verification_status!=='unverified' && existing.build_details===undefined)
      throw Error('This server needs the garage update to change a verified vehicle identity.');
    const query=editing==='new'?client.from('vehicles').insert({...payload,owner_member_id:garage.member.id}):
      client.from('vehicles').update(payload).eq('owner_member_id',garage.member.id).eq('id',editing);
    const result=await query.select('*').single();
    if(result.error)throw Error('Unable to save your car. '+result.error.message);
    const vehicle=result.data as GarageVehicle;
    requestVersion.current++;
    setLoading(false);
    setGarage(current => current ? {...current, vehicles: current.vehicles.some(v => v.id === vehicle.id)
      ? current.vehicles.map(v => v.id === vehicle.id ? vehicle : v) : [...current.vehicles, vehicle]} : current);
    setEditing(null);
  }

  return (
    <Screen padded={false}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <EditGarageProfile />

        <Text variant="caption" gold>UNDERGROUND · PRIVATE GARAGE</Text>
        <Text variant="title" style={styles.title}>
          {garage?.member.display_name ?? state.member.displayName}
        </Text>
        <Text variant="caption" style={styles.meta}>
          MEMBER #{garage?.member.member_number ?? state.member.memberNumber}
        </Text>
        <GoldRule />
        {state.member.isFounder && !editing && garage && !garage.vehicles.some(v => isFounderR8(true, [v.year, v.make, v.model].join(' '))) &&
          <FounderR8Cover />}
        {loading ? <ActivityIndicator color={shell.accent} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {garage && !editing && <Action label="Add car" onPress={()=>setEditing('new')}/>}
        {garage && editing && <CarForm key={editing}
          initial={editing==='new'?blankCar:editable(garage.vehicles.find(v=>v.id===editing)!)}
          onCancel={()=>setEditing(null)} onSave={saveCar}/>}
        {!editing && garage?.vehicles.map(vehicle => {
          const photos = garage.media.filter(m => m.vehicleId === vehicle.id && m.readUrl);

          const journal = garage.mods?.filter(mod => mod.vehicle_id === vehicle.id) ?? [];
          return (
            <View key={vehicle.id} style={styles.vehicle}>
              <GarageCarPhoto founderCover={isFounderR8(state.member.isFounder, [vehicle.year, vehicle.make, vehicle.model].join(' '))} key={garage.member.id+vehicle.id} label={vehicle.make+' '+vehicle.model} memberId={garage.member.id} vehicleId={vehicle.id} photos={photos} onRefresh={()=>void loadGarage()} />
              <Action label="Edit car" onPress={()=>setEditing(vehicle.id)}/>
              <CarRecord car={editable(vehicle)}/>
              <Text style={styles.meta}>
                Vehicle verification / {vehicle.verification_status.replace(/_/g, ' ')}
              </Text>
              <Text style={styles.meta}>
                VISIBILITY: {vehicle.visibility.toUpperCase()}
              </Text>
              {(['installed', 'pending'] as const).map(status => {
                const entries = journal.filter(mod => mod.status === status);
                return entries.length > 0 ? <View key={status} style={styles.journal}>
                  <Text variant="caption" gold>{status === 'installed' ? 'CURRENT BUILD / INSTALLED' : 'PLANNED BUILD'}</Text>
                  {entries.map(mod => <Text key={mod.id}>{mod.title}</Text>)}
                </View> : null;
              })}
              <View style={styles.gallery}>
                {photos.map(m => (
                  <View key={m.id} style={styles.photo}>
                    <FittedPhoto
                      source={{ uri: m.readUrl! }}
                      accessibilityLabel={m.caption ?? 'Private garage photograph'}
                    />
                    <Text style={styles.meta}>{m.caption ?? 'Garage photograph'}</Text>
                  </View>
                ))}
              </View>
            </View>
          );
        })}
        <GarageStoreLink />
        <Pressable disabled={!!editing || loading} onPress={() => void loadGarage()} style={styles.refresh}>
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
  cover: { width: '100%', aspectRatio: 16 / 9, borderRadius: 10, marginBottom: 12 },
  journal: { gap: 5, marginVertical: 10 },
  gallery: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 },
  photo: { width: '47%' },
  refresh: { padding: 18, alignItems: 'center' },
});
