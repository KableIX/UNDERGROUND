import { FittedPhoto } from '../src/components/FittedPhoto';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useSession } from '../src/session/SessionContext';
import { modelKey, readSpots, saveSpot, v10Icons, type Sighting } from '../src/spotted/collection';
import { OwnerConfirmation } from '../src/spotted/OwnerConfirmation';
import { choosePhoto, suggestModel } from '../src/spotted/photo';

function Button({
  title,
  onPress,
  primary,
  disabled,
}: {
  title: string;
  onPress: () => void;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[s.button, primary && s.primary, disabled && { opacity: 0.45 }]}
    >
      <Text style={[s.action, primary && { color: '#08090a' }]}>{title}</Text>
    </Pressable>
  );
}

function Field({
  label,
  value,
  onChange,
  max,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  max: number;
}) {
  return (
    <View>
      <Text style={s.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        maxLength={max}
        editable
        autoCorrect={false}
        style={s.field}
      />
    </View>
  );
}

export default function Spotted() {
  const { state } = useSession();
  return state.status === 'authenticated' ? (
    <Album
      key={state.member.memberId}
      member={state.member.memberId}
      number={state.member.memberNumber}
    />
  ) : null;
}

function Album({ member, number }: { member: string; number: string }) {
  const router = useRouter();
  const inset = useSafeAreaInsets();
  const [spots, setSpots] = useState<Sighting[]>([]);
  const [photo, setPhoto] = useState<Awaited<ReturnType<typeof choosePhoto>>>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [place, setPlace] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const [loaded, setLoaded] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const scroll = useRef<ScrollView>(null);

  useEffect(() => {
    let current = true;
    readSpots(member)
      .then((records) => {
        if (current) {
          setSpots(records);
          setLoaded(true);
          setMessage('');
        }
      })
      .catch(() => {
        if (current) setMessage('Could not open the collection.');
      });
    return () => {
      current = false;
    };
  }, [member, attempt]);
  useEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, [photo, selected]);

  const models = new Map<string, Sighting[]>();
  for (const spot of spots) {
    const key = modelKey(spot.make, spot.model);
    const group = models.get(key);
    if (group) group.push(spot);
    else models.set(key, [spot]);
  }
  const entry = selected ? models.get(selected) : undefined;
  const latest = entry?.[0];
  const found = v10Icons.filter(([brand, name]) => models.has(modelKey(brand, name))).length;

  async function act(work: () => Promise<void>) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setMessage('');
    try {
      await work();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Could not complete this action. Try again.',
      );
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }

  function pick(camera: boolean) {
    void act(async () => {
      const image = await choosePhoto(camera);
      if (!image) return;
      setMake('');
      setModel('');
      setPlace('');
      setPhoto(image);
    });
  }
  function identify() {
    if (!photo) return;
    void act(async () => {
      const suggestion = await suggestModel(photo);
      setMake(suggestion.make);
      setModel(suggestion.model);
      setMessage('Suggested match. Confirm or edit the model below.');
    });
  }
  function save() {
    if (!photo) return;
    void act(async () => {
      const saved = await saveSpot(member, photo.uri, make, model, place);
      setSpots((previous) => [saved, ...previous]);
      setPhoto(null);
      setSelected(modelKey(saved.make, saved.model));
    });
  }
  function back() {
    setMessage('');
    if (photo) setPhoto(null);
    else if (selected) setSelected(null);
    else if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/conquest');
  }

  return (
    <ScrollView
      ref={scroll}
      style={s.screen}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[
        s.content,
        { paddingTop: inset.top + 12, paddingBottom: inset.bottom + 24 },
      ]}
    >
      <Pressable accessibilityRole="button" onPress={back} disabled={busy}>
        <Text style={s.back}>‹ {photo || selected ? 'COLLECTION' : 'DRIVE'}</Text>
      </Pressable>
      <Text style={s.heading}>
        {photo ? 'Confirm sighting' : latest ? latest.make + ' ' + latest.model : 'Spotted'}
      </Text>
      {message ? (
        <Text accessibilityLiveRegion="polite" style={s.notice}>
          {message}
        </Text>
      ) : null}
      {busy && <ActivityIndicator color="#C6B08B" />}
      {!loaded ? (
        <View>
          {message ? (
            <Button title="Retry" onPress={() => setAttempt((x) => x + 1)} />
          ) : (
            <ActivityIndicator />
          )}
        </View>
      ) : photo ? (
        <>
          <FittedPhoto source={{ uri: photo.uri }} />
          <Button title="Identify from photo" onPress={identify} disabled={busy} />
          <Field label="Make" value={make} onChange={setMake} max={80} />
          <Field label="Model or confirmed trim" value={model} onChange={setModel} max={100} />
          <Field label="Area or event · optional" value={place} onChange={setPlace} max={120} />
          <Button
            primary
            title="Save sighting"
            disabled={busy || !make.trim() || !model.trim()}
            onPress={save}
          />
        </>
      ) : latest && entry ? (
        <>
          <Text style={s.label}>
            {entry.length} {entry.length === 1 ? 'SIGHTING' : 'SIGHTINGS'}
          </Text>
          {entry.map((item) => (
            <View key={item.id} style={s.card}>
              <Image
                // eslint-disable-next-line @typescript-eslint/no-require-imports
                source={require('../assets/brand/underground-lockup-silver.png')}
                accessibilityLabel="UNDERGROUND"
                style={{ width: 145, height: 32, margin: 12, resizeMode: 'contain' }}
              />
              <FittedPhoto
                source={{ uri: item.photo }}
                accessibilityLabel={item.make + ' ' + item.model}
              />
              <View style={s.caption}>
                <Text style={s.cardTitle}>
                  {item.make} {item.model}
                </Text>
                <Text style={s.sub}>
                  {[item.place, new Date(item.date).toLocaleDateString()]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </View>
              <OwnerConfirmation member={member} number={number} spot={item} />
              <Button
                title="Share photo"
                disabled={busy}
                onPress={() =>
                  void act(async () => {
                    await Share.share({
                      message: item.make + ' ' + item.model + ' · Spotted on UNDERGROUND',
                      url: item.photo,
                    });
                  })
                }
              />
            </View>
          ))}
        </>
      ) : (
        <>
          <Text style={s.sub}>
            {models.size} models collected · {spots.length} sightings
          </Text>
          <Button primary title="Spot a Car" onPress={() => pick(true)} disabled={busy} />
          <Button title="From Photos" onPress={() => pick(false)} disabled={busy} />
          <OwnerConfirmation member={member} number={number} />
          <View style={s.set}>
            <Text style={s.cardTitle}>
              V10 Icons {found} / {v10Icons.length}
            </Text>
            {v10Icons.map(([brand, name]) => (
              <Text style={s.sub} key={name}>
                {models.has(modelKey(brand, name)) ? '✓' : '○'} {brand} {name}
              </Text>
            ))}
          </View>
          {Array.from(models, ([key, items]) => (
            <Pressable
              accessibilityRole="button"
              key={key}
              onPress={() => setSelected(key)}
              style={s.card}
            >
              <FittedPhoto source={{ uri: items[0].photo }} />
              <View style={s.caption}>
                <Text style={s.cardTitle}>
                  {items[0].make} {items[0].model}
                </Text>
                <Text style={s.sub}>
                  {items.length} {items.length === 1 ? 'sighting' : 'sightings'}
                </Text>
              </View>
            </Pressable>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#08090A' },
  content: { paddingHorizontal: 20, gap: 14 },
  heading: {
    fontFamily: 'BarlowCondensed_700Bold',
    fontSize: 44,
    lineHeight: 52,
    color: '#F4F2ED',
  },
  back: { fontFamily: 'DMSans_600SemiBold', fontSize: 13, color: '#C6B08B', paddingVertical: 10 },
  sub: { fontFamily: 'DMSans_400Regular', fontSize: 14, lineHeight: 20, color: '#B7B7B8' },
  label: { fontFamily: 'DMSans_600SemiBold', fontSize: 13, color: '#CDC7BE', marginBottom: 5 },
  button: { padding: 14, borderWidth: 1, borderColor: '#47443F', alignItems: 'center' },
  primary: { backgroundColor: '#D0B88F' },
  action: { fontFamily: 'DMSans_600SemiBold', fontSize: 15, color: '#F4F2ED' },
  field: {
    padding: 12,
    borderColor: '#48443D',
    borderWidth: 1,
    backgroundColor: '#151618',
    color: 'white',
    fontSize: 17,
  },
  set: { padding: 15, borderWidth: 1, borderColor: '#3D3934', gap: 4 },
  card: { backgroundColor: '#131416', borderWidth: 1, borderColor: '#343538' },
  caption: { padding: 14, gap: 3 },
  cardTitle: {
    fontFamily: 'BarlowCondensed_700Bold',
    fontSize: 25,
    lineHeight: 30,
    color: '#F4F2ED',
  },
  notice: { fontFamily: 'DMSans_400Regular', color: '#D0B88F', fontSize: 14 },
});
