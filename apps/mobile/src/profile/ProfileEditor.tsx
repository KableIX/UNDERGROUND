import { isFounderR8 } from '../garage/founder-r8';
import { ProfilePhoto, FrameControls } from './ProfilePhoto';
import { fill, whole, type Frame, type Section, type Vehicle } from './page';
import { useRouter } from 'expo-router';
import { ownerCover } from '../garage/cover';
import { useSession } from '../session/SessionContext';
import { editorSections, type EditorSection, profileCoverRatio } from './page';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Text } from '@underground/ui';
import { curatedRuns } from '../data/curated-runs';
import { accents, move, sectionTitles, type Connections, type Page, type Settings } from './page';
import { ProfileBody } from './ProfileBody';
import { profileLink, type Look } from './page';
import { getDraft, putDraft, clearDraft } from './drafts';
import { Soundtrack } from './Soundtrack';
import { pickPhoto, prepareProfilePhoto, savePage } from './store';

function Action({
  label,
  onPress,
  selected = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  selected?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[s.action, selected && s.chosen, disabled && { opacity: 0.48 }]}
    >
      <Text style={selected ? s.activeText : s.actionText}>{label}</Text>
    </Pressable>
  );
}
function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={s.group}>
      <Text style={s.groupTitle}>{title}</Text>
      {children}
    </View>
  );
}

type EditorProps = {
  page: Page;
  initial?: Settings;
  initialSection?: EditorSection;
  connections: Connections;
  onCancel: () => void;
  onSaved: (saved: Settings) => void;
};

export function ProfileEditor(props: EditorProps) {
  const { state } = useSession();
  if (state.status !== 'authenticated' || state.member.memberId !== props.page.member.id)
    return <Text>Only the owner can edit this profile.</Text>;
  return <OwnerEditor {...props} viewer={state.member.memberId} />;
}

function OwnerEditor({
  viewer,
  page,
  initial,
  initialSection = 'Identity',
  connections,
  onCancel,
  onSaved,
}: EditorProps & { viewer: string }) {
  const router = useRouter();
  const [sectionOptions, setSectionOptions] = useState<Section | null>(null);
  const [section, setSection] = useState<EditorSection>(initialSection);
  function openSection(next: EditorSection) {
    setSection(next);
    scroll.current?.scrollTo({ y: 0, animated: false });
  }
  const scroll = useRef<ScrollView>(null);
  const [draft, setDraft] = useState<Settings>(initial ?? page.settings);
  const [preview, setPreview] = useState(false),
    [sample, setSample] = useState(''),
    [savedDraft, setSavedDraft] = useState<Settings | null>(null);
  useEffect(() => {
    let active = true;
    void getDraft(page.member.id, page.revision)
      .then((v) => {
        if (active) setSavedDraft(v);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [page.member.id, page.revision]);
  const [busy, setBusy] = useState(false),
    [photoBusy, setPhotoBusy] = useState(false),
    [error, setError] = useState('');
  const lock = useRef(false);
  const [finding, setFinding] = useState(false),
    [query, setQuery] = useState('');
  const hits = finding
    ? curatedRuns
        .filter(
          (r) =>
            r.category !== 'TEST' &&
            (r.title + ' ' + r.territory).toLowerCase().includes(query.trim().toLowerCase()),
        )
        .slice(0, 8)
    : [];
  function field<K extends keyof Settings>(key: K, value: Settings[K]) {
    setDraft((old) => ({ ...old, [key]: value }));
    if (key === 'music') setSample('');
    setError('');
  }
  type Custom = Settings['custom'];
  function custom<K extends keyof Custom>(key: K, value: Custom[K]) {
    setDraft(d => ({ ...d, custom: { ...d.custom, [key]: value } }));
    setError('');
  }
  function textField(label: string, value: string, change: (v: string) => void, limit: number) {
    return <View><Text style={s.label}>{label}</Text><TextInput accessibilityLabel={label} value={value}
      onChangeText={change} autoCapitalize="none" autoCorrect={false} maxLength={limit} style={s.input} /></View>;
  }
  async function garagePhoto(car: Vehicle) {
    let uri = await ownerCover(viewer, car.id);
    if (!uri && isFounderR8(page.member.founder, car.label)) {
      const { Asset } = require('expo-asset') as typeof import('expo-asset');
      const asset = await Asset.fromModule(require('../../assets/garage/founder-first-look.jpg')).downloadAsync();
      uri = asset.localUri ?? asset.uri;
    }
    if (!uri) return null;
    const size = await Image.getSize(uri);
    return prepareProfilePhoto({ uri, width: size.width, height: size.height }, 'featured');
  }
  async function photoTask(action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true; setPhotoBusy(true); setError('');
    try { await action(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not load this photo.'); }
    finally { lock.current = false; setPhotoBusy(false); }
  }
  function photoEditor(uri: string, frame: Frame, change: (f: Frame) => void, label: string, ratio?: number) {
    return <View style={s.group}><ProfilePhoto uri={uri} frame={frame} label={label} ratio={ratio} radius={6} />
      <FrameControls frame={frame} change={change} fixed={!!ratio} /></View>;
  }
  function resetFeature(car?: Vehicle) {
    setDraft(d => ({ ...d, vehicleId: car?.id ?? null, featuredCar: car ? null : { name: '', story: '' },
      custom: { ...d.custom, gallery: [], featureFrame: whole } }));
  }
  function chooseOwnedFeature(car: Vehicle) {
    if (draft.vehicleId === car.id) return;
    void photoTask(async () => {
      const photo = await garagePhoto(car);
      setDraft(d => ({ ...d, vehicleId: car.id, featuredCar: { name: car.label, linkedVehicleId: car.id, story: '', photo },
        custom: { ...d.custom, gallery: [], featureFrame: whole } }));
    });
  }
  function template(first: Section[], hidden: Section[], panels: Look['panels']) {
    setDraft(d => ({ ...d, layout: [...first, ...d.layout.filter(k => !first.includes(k))],
      look: { ...d.look, hidden, panels } }));
  }
  function setSectionOption(key: Section, field: 'labels' | 'access' | 'formats', value: string) {
    setDraft(d => ({ ...d, custom: { ...d.custom, [field]: { ...d.custom[field], [key]: value } } }));
  }
  function input(
    label: string,
    key: 'displayName' | 'home' | 'status' | 'bio' | 'work' | 'linkedin' | 'music' | 'trackTitle',
    max: number,
  ) {
    const url = key === 'linkedin' || key === 'music';
    return (
      <View>
        <Text style={s.label}>{label}</Text>
        <TextInput
          accessibilityLabel={label}
          value={draft[key]}
          onChangeText={(v) => field(key, v)}
          maxLength={max}
          multiline={key === 'bio'}
          autoCapitalize={url ? 'none' : 'sentences'}
          autoCorrect={!url}
          keyboardType={url ? 'url' : 'default'}
          selectionColor="#DFBF88"
          style={[s.input, key === 'bio' && s.bio]}
        />
      </View>
    );
  }
  function photoControl(key: 'avatar' | 'cover') {
    return (
            <View key={key}>
              {draft[key] && (
                <View style={{ width: key === 'avatar' ? 128 : '100%' }}>
                  <ProfilePhoto uri={draft[key]!} frame={draft.custom[key === 'avatar' ? 'avatarFrame' : 'coverFrame']}
                    ratio={key === 'avatar' ? 1 : profileCoverRatio(draft.look.coverSize)}
                    radius={key === 'avatar' ? 64 : 0} label={key + ' preview'} />
                </View>
              )}
              {draft[key] && <FrameControls fixed frame={draft.custom[key === 'avatar' ? 'avatarFrame' : 'coverFrame']}
                change={f => custom(key === 'avatar' ? 'avatarFrame' : 'coverFrame', f)} />}
              <View style={s.row}>
                <Action
                  label={(draft[key] ? 'Change ' : 'Add ') + (key === 'avatar' ? 'profile photo' : 'cover photo')}
                  disabled={photoBusy || busy}
                  onPress={() => void choose(key)}
                />
                {draft[key] && (
                  <Action
                    label={'Remove ' + key}
                    disabled={photoBusy || busy}
                    onPress={() => field(key, null)}
                  />
                )}
              </View>
            </View>
    );
  }
  async function chooseFeaturedPhoto(fromGarage = false) {
    if (lock.current) return;
    const id = draft.vehicleId;
    const car = page.vehicles.find(v => v.id === id);
    lock.current = true;
    setPhotoBusy(true);
    setError('');
    try {
      let photo: string | null;
      if (fromGarage && car) {
        photo = await garagePhoto(car);
        if (!photo) throw Error('Add a photo to this car in Garage first.');
      } else {
        photo = await pickPhoto('featured');
      }
      if (photo) setDraft(d => {
        if (d.vehicleId !== id) return d;
        return { ...d, featuredCar: { ...(d.featuredCar ?? (car ? { name: car.label, story: '', linkedVehicleId: car.id } : { name: '', story: '' })), photo } };
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open the featured car photo.');
    } finally { lock.current = false; setPhotoBusy(false); }
  }
  async function choose(kind: 'avatar' | 'cover') {
    if (lock.current) return;
    lock.current = true;
    setPhotoBusy(true);
    try {
      const result = await pickPhoto(kind);
      if (result) field(kind, result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open the photo library.');
    } finally {
      lock.current = false;
      setPhotoBusy(false);
    }
  }
  function cancel() {
    if (lock.current) return;
    if (JSON.stringify(draft) === JSON.stringify(page.settings)) return onCancel();
    Alert.alert('Discard these edits?', undefined, [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: onCancel },
    ]);
  }
  async function save() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      let published = draft;
      const linked = page.vehicles.find(v => v.id === draft.vehicleId);
      if (linked && !draft.featuredCar) {
        const photo = await garagePhoto(linked);
        if (photo) published = { ...draft, featuredCar: { name: linked.label, linkedVehicleId: linked.id, story: '', photo } };
      }
      await savePage(viewer, page, published, connections);
      await clearDraft(page.member.id).catch(() => {});
      onSaved(published);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed. Your edits are still here.');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function choice<K extends Exclude<keyof Look, 'hidden' | 'large'>>(
    title: string,
    key: K,
    values: readonly Look[K][],
  ) {
    return (
      <View>
        <Text style={s.label}>{title}</Text>
        <View style={s.row}>
          {values.map((v) => (
            <Action
              key={v}
              label={v}
              selected={draft.look[key] === v}
              onPress={() => field('look', { ...draft.look, [key]: v })}
            />
          ))}
        </View>
      </View>
    );
  }
  async function journalPhoto(index: number) {
    if (lock.current) return;
    lock.current = true;
    setPhotoBusy(true);
    try {
      const photo = await pickPhoto('journal');
      if (photo)
        setDraft((d) => ({
          ...d,
          entries: d.entries.map((e, i) => (i === index ? { ...e, photo } : e)),
        }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not choose photo.');
    } finally {
      setPhotoBusy(false);
      lock.current = false;
    }
  }
  function previewPage() {
    try {
      const music = profileLink(draft.music, 'music');
      setSample(music);
      setPreview(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Check the soundtrack link.');
    }
  }
  if (preview) {
    const featuredFriends = draft.topEight
      .map((id) => connections.accepted.find((f) => id === f.id))
      .filter((f): f is Connections['accepted'][number] => !!f);
    return (
      <ProfileBody
        page={{ ...page, featuredFriends, settings: { ...draft, music: sample } }}
        viewer={page.member.id}
        preview
        drafting
        onPreview={() => setPreview(false)}
      />
    );
  }
  const fav = curatedRuns.find((r) => r.slug === draft.driveSlug);
  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={s.bar}>
        <Action label="Cancel" onPress={cancel} disabled={busy || photoBusy} />
        <Text accessibilityRole="header" style={s.barTitle}>
          {section === 'Identity' ? (page.revision === 0 ? 'Set up profile' : 'Edit profile') : 'Customize page'}
        </Text>
        <Action
          label={busy ? 'Saving...' : 'Save'}
          selected
          onPress={() => void save()}
          disabled={busy || photoBusy}
        />
      </View>
      {!!error && (
        <View>
          <Text accessibilityRole="alert" style={s.error}>
            {error}
          </Text>
          {error.includes('page changed') && <Action label="Reload saved page" onPress={cancel} />}
        </View>
      )}
      <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
        {section === 'Customize page' && <Group title="Page settings">
          {editorSections.filter(name => name !== 'Identity').map(name => (
            <Pressable key={name} accessibilityRole="button" style={s.menuRow} onPress={() => openSection(name)}>
              <Text style={s.menuLabel}>{name === 'Off the road' ? 'Work and LinkedIn' : name}</Text>
              <Text accessible={false} style={s.hint}>{'\u203A'}</Text>
            </Pressable>
          ))}
        </Group>}
        {section !== 'Identity' && section !== 'Customize page' &&
          <Action label="All page settings" onPress={() => openSection('Customize page')} />}
        {section === 'Identity' && <Group title="Profile details">
          {photoControl('avatar')}
          {input('Display name', 'displayName', 64)}
          {textField('Handle', draft.custom.handle, v => custom('handle', v), 24)}
          {draft.custom.links.map((url, i) => <View key={i}>
            {textField('Profile link ' + (i + 1), url, v => custom('links', draft.custom.links.map((old, n) => n === i ? v : old)), 350)}
            <Action label="Remove link" onPress={() => custom('links', draft.custom.links.filter((_, n) => n !== i))} />
          </View>)}
          {draft.custom.links.length < 6 && <Action label="Add profile link" onPress={() => custom('links', [...draft.custom.links, ''])} />}
          {input('Home base', 'home', 64)}
          {input('Bio', 'bio', 500)}
          {input('Status', 'status', 120)}
          {photoControl('cover')}
        </Group>}
        {section === 'Page style' && <Group title="Page style">
          {choice('Wallpaper', 'wallpaper', ['Midnight', 'Saratoga', 'Pacific', 'My cover'])}
          {choice('Title type', 'heading', ['Condensed', 'Classic', 'Modern'])}
          {choice('Panels', 'panels', ['Lines', 'Glass', 'Solid'])}
          {choice('Cover size', 'coverSize', ['Compact', 'Wide', 'Portrait'])}
          {photoControl('cover')}
          <Action label={draft.custom.wallpaper ? 'Change wallpaper photo' : 'Upload wallpaper'} disabled={photoBusy} onPress={() => void photoTask(async () => {
            const photo = await pickPhoto('cover');
            if (photo) custom('wallpaper', { photo, frame: fill });
          })} />
          {draft.custom.wallpaper?.photo && <>{photoEditor(draft.custom.wallpaper.photo, draft.custom.wallpaper.frame,
            frame => custom('wallpaper', { photo: draft.custom.wallpaper!.photo, frame }), 'Wallpaper', 0.6)}
            <Action label="Remove wallpaper photo" onPress={() => custom('wallpaper', null)} /></>}
          {textField('Custom accent · #RRGGBB', draft.custom.accentColor, v => custom('accentColor', v), 7)}
          {textField('Card background · #RRGGBB', draft.custom.panelColor, v => custom('panelColor', v), 7)}
          {photoBusy && <ActivityIndicator />}
          <Text style={s.label}>Accent</Text>
          <View style={s.row}>
            {(Object.keys(accents) as Settings['accent'][]).map((c) => (
              <Pressable
                key={c}
                accessibilityRole="radio"
                accessibilityState={{ checked: c === draft.accent }}
                onPress={() => setDraft(d => ({ ...d, accent: c, custom: { ...d.custom, accentColor: '' } }))}
                style={[
                  s.action,
                  {
                    borderColor: accents[c],
                    backgroundColor: c === draft.accent ? accents[c] : '#141518',
                  },
                ]}
              >
                <Text style={c === draft.accent ? s.activeText : s.actionText}>{c}</Text>
              </Pressable>
            ))}
          </View>
        </Group>}
        {section === 'Featured car' && <Group title="Featured car">
          <View style={s.row}>
            <Action
              label="None"
              selected={!draft.vehicleId && !draft.featuredCar}
              onPress={() => setDraft(d => ({ ...d, featuredCar: null, vehicleId: null, custom: { ...d.custom, gallery: [] } }))}
            />
            <Action label="Feature any car" selected={!!draft.featuredCar && !draft.vehicleId}
                onPress={() => { if (!draft.featuredCar || draft.vehicleId) resetFeature(); }} />
              {page.vehicles.map((v) => (
              <Action
                key={v.id}
                label={v.label}
                selected={draft.vehicleId === v.id}
                onPress={() => { chooseOwnedFeature(v); }}
              />
            ))}
          </View>
          {page.vehicles.some((v) => v.id === draft.vehicleId && v.visibility === 'private') && (
            <Text style={s.hint}>Only you can see this car.</Text>
          )}
          {<>
              {!!draft.featuredCar?.photo && photoEditor(draft.featuredCar.photo, draft.custom.featureFrame, f => custom('featureFrame', f), 'Featured car photo')}
              {!!draft.vehicleId && <Action label="Use garage photo" disabled={busy || photoBusy}
                onPress={() => void chooseFeaturedPhoto(true)} />}
              <Action label={draft.featuredCar?.photo ? 'Change car photo' : 'Add car photo'} disabled={busy || photoBusy} onPress={() => void chooseFeaturedPhoto()} />
              {!!draft.featuredCar?.photo && <Action label="Remove car photo" onPress={() => field('featuredCar', { ...draft.featuredCar!, photo: null })} />}
            </>}
            {(draft.featuredCar || draft.vehicleId) && <>
              {draft.custom.gallery.map((item, i) => <View key={i}>
                {item.photo && photoEditor(item.photo, item.frame, frame => custom('gallery', draft.custom.gallery.map((v, n) => n === i ? { ...v, frame } : v)), 'Gallery photo')}
                {i > 0 && <Action label="Move photo up" onPress={() => custom('gallery', move(draft.custom.gallery, i, -1))} />}
                <Action label="Remove gallery photo" onPress={() => custom('gallery', draft.custom.gallery.filter((_, n) => n !== i))} />
              </View>)}
              {draft.custom.gallery.length < 5 && <Action label="Add gallery photo" disabled={photoBusy} onPress={() => void photoTask(async () => {
                const photo = await pickPhoto('featured');
                if (photo) custom('gallery', [...draft.custom.gallery, { photo, frame: whole }]);
              })} />}
            </>}
            {draft.featuredCar && draft.vehicleId && textField('Why this car?', draft.featuredCar.story,
              story => field('featuredCar', { ...draft.featuredCar!, story }), 500)}
            {draft.featuredCar && !draft.vehicleId && <>
              <Text style={s.label}>Car name</Text>
              <TextInput accessibilityLabel="Featured car name" placeholder="e.g. Porsche Carrera GT" placeholderTextColor="#929599"
                style={s.input} value={draft.featuredCar.name} maxLength={100}
                onChangeText={name => field('featuredCar', { ...draft.featuredCar!, name })} />
              <Text style={s.label}>Why this car?</Text>
              <TextInput accessibilityLabel="Why this car?" multiline style={[s.input, s.bio]}
                value={draft.featuredCar.story} maxLength={500}
                onChangeText={story => field('featuredCar', { ...draft.featuredCar!, story })} />
            </>}
        </Group>}
        {section === 'My garage' && <Group title="My garage">
          {draft.custom.owned.map((item, i) => <View key={item.id} style={s.group}>
            <Text style={s.orderTitle}>{page.vehicles.find(v => v.id === item.id)?.label}</Text>
            {item.photo && photoEditor(item.photo, item.frame, frame => custom('owned', draft.custom.owned.map(v => v.id === item.id ? { ...v, frame } : v)), 'Garage photo')}
            <Action label={item.photo ? 'Change photo' : 'Add photo'} disabled={photoBusy} onPress={() => void photoTask(async () => {
              const photo = await pickPhoto('featured');
              if (photo) custom('owned', draft.custom.owned.map(v => v.id === item.id ? { ...v, photo } : v));
            })} />
            {i > 0 && <Action label="Move car up" onPress={() => custom('owned', move(draft.custom.owned, i, -1))} />}
            <Action label="Remove from profile" onPress={() => custom('owned', draft.custom.owned.filter(v => v.id !== item.id))} />
          </View>)}
          {draft.custom.owned.length < 12 && page.vehicles.filter(v => !draft.custom.owned.some(item => item.id === v.id)).map(car =>
            <Action key={car.id} label={'Add ' + car.label} disabled={photoBusy} onPress={() => void photoTask(async () => {
              const photo = await garagePhoto(car);
              custom('owned', [...draft.custom.owned, { id: car.id, photo, frame: whole }]);
            })} />)}
          {!page.vehicles.length && <Action label="Add your first car in Garage" onPress={() => void putDraft(page.member.id, page.revision, draft)
            .then(() => router.push('/(tabs)/garage')).catch(() => setError('Could not save your profile draft.'))} />}
        </Group>}
        {section === 'Favorite drive' && <Group title="Favorite drive">
          <View style={s.row}>
            <Action label={fav?.title ?? 'Choose a drive'} onPress={() => setFinding((v) => !v)} />
            {draft.driveSlug !== '' && (
              <Action
                label="Remove drive"
                onPress={() => {
                  field('driveSlug', '');
                  setFinding(false);
                }}
              />
            )}
          </View>
          {finding && (
            <View>
              <TextInput
                autoFocus
                placeholder="Search drives or territories"
                placeholderTextColor="#999BA0"
                accessibilityLabel="Search drives"
                style={s.input}
                value={query}
                onChangeText={setQuery}
              />
              {hits.map((r) => (
                <Action
                  key={r.slug}
                  label={r.title}
                  onPress={() => {
                    field('driveSlug', r.slug);
                    setFinding(false);
                  }}
                />
              ))}
              {!hits.length && <Text style={s.hint}>No matching drives.</Text>}
            </View>
          )}
        </Group>}
        {section === 'Top 8' && <Group title="Top 8">
          {draft.topEight.map((id, i) => (
            <View key={id} style={s.order}>
              <Text style={s.orderTitle}>
                {i + 1}. {connections.accepted.find((f) => f.id === id)?.name}
              </Text>
              {i > 0 && (
                <Action label="Up" onPress={() => field('topEight', move(draft.topEight, i, -1))} />
              )}
              <Action
                label="Remove"
                onPress={() =>
                  field(
                    'topEight',
                    draft.topEight.filter((x) => x !== id),
                  )
                }
              />
            </View>
          ))}
          <View style={s.row}>
            {connections.accepted
              .filter((f) => !draft.topEight.includes(f.id))
              .map((f) => (
                <Action
                  key={f.id}
                  label={'+ ' + f.name}
                  disabled={draft.topEight.length >= 8}
                  onPress={() => field('topEight', [...draft.topEight, f.id])}
                />
              ))}
          </View>
          {!connections.accepted.length && (
            <Text style={s.hint}>Accept a friend in Friends to feature them here.</Text>
          )}
        </Group>}
        {section === 'Build journal' && <Group title="Build journal">
          {draft.entries.map((e, i) => (
            <View key={i} style={s.group}>
              <TextInput
                style={s.input}
                accessibilityLabel={'Entry ' + (i + 1) + ' title'}
                placeholder="Entry title"
                placeholderTextColor="#A8AAAC"
                value={e.title}
                maxLength={80}
                onChangeText={(title) =>
                  field(
                    'entries',
                    draft.entries.map((v, n) => (n === i ? { ...v, title } : v)),
                  )
                }
              />
              <TextInput
                style={s.input}
                multiline
                accessibilityLabel={'Entry ' + (i + 1) + ' note'}
                placeholder="Build notes"
                placeholderTextColor="#A8AAAC"
                value={e.note}
                maxLength={450}
                onChangeText={(note) =>
                  field(
                    'entries',
                    draft.entries.map((v, n) => (n === i ? { ...v, note } : v)),
                  )
                }
              />
              {e.photo && photoEditor(e.photo, e.frame ?? whole, frame => field('entries', draft.entries.map((v,n) => n === i ? { ...v, frame } : v)), e.title || 'Journal photo')}
              <View style={s.row}>
                <Action
                  label="Choose entry photo"
                  disabled={photoBusy}
                  onPress={() => void journalPhoto(i)}
                />
                <Action
                  label={e.crew ? 'Detach Top 8' : 'Tag Top 8 crew'}
                  selected={e.crew}
                  onPress={() =>
                    field(
                      'entries',
                      draft.entries.map((v, n) => (i === n ? { ...v, crew: !v.crew } : v)),
                    )
                  }
                />
                {e.photo && (
                  <Action
                    label="Remove photo"
                    onPress={() =>
                      field(
                        'entries',
                        draft.entries.map((v, n) => (i === n ? { ...v, photo: null } : v)),
                      )
                    }
                  />
                )}
                {i > 0 && (
                  <Action
                    label="Move entry up"
                    disabled={photoBusy}
                    onPress={() => field('entries', move(draft.entries, i, -1))}
                  />
                )}
                <Action
                  label="Remove entry"
                  disabled={photoBusy}
                  onPress={() =>
                    field(
                      'entries',
                      draft.entries.filter((_, n) => n !== i),
                    )
                  }
                />
              </View>
            </View>
          ))}
          {draft.entries.length < 4 && (
            <Action
              label="Add journal entry"
              onPress={() =>
                field('entries', [
                  ...draft.entries,
                  { title: '', note: '', photo: null, crew: false },
                ])
              }
            />
          )}
        </Group>}
        {section === 'Soundtrack' && <Group title="Soundtrack">
          {input('Track title', 'trackTitle', 80)}
          {input('Audio file, Spotify or Apple Music URL', 'music', 350)}
          <Text style={s.hint}>Direct MP3, M4A, AAC and WAV links play on your page.</Text>
          <Action
            label="Test soundtrack"
            onPress={() => {
              try {
                setSample(profileLink(draft.music, 'music'));
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Check the link.');
              }
            }}
          />
          {!!sample && (
            <Soundtrack url={sample} title={draft.trackTitle} viewer={page.member.id} preview />
          )}
        </Group>}
        {section === 'Off the road' && <Group title="Off the road">
          {input('Off the road · professional headline', 'work', 100)}
          {input('LinkedIn profile · optional', 'linkedin', 350)}
        </Group>}
        {section === 'Section order' && <Group title="Section order">
          <Text style={s.label}>Starting layout</Text>
          <View style={s.row}>
            <Action label="Showroom" onPress={() => template(['garage','collection','music','about'], ['work','journal'], 'Glass')} />
            <Action label="Driver journal" onPress={() => template(['about','journal','drive','music'], ['work'], 'Lines')} />
            <Action label="Blank page" onPress={() => field('look', { ...draft.look, hidden: [...draft.layout] })} />
            <Action label="Show all sections" onPress={() => field('look', { ...draft.look, hidden: [] })} />
          </View>
          {draft.layout.map((key, i) => (
            <View key={key} style={s.group}>
              <Pressable accessibilityRole="button" accessibilityState={{ expanded: sectionOptions === key }} style={s.menuRow}
                onPress={() => setSectionOptions(sectionOptions === key ? null : key)}>
                <Text style={s.orderTitle}>{i + 1}. {draft.custom.labels[key] || sectionTitles[key]}</Text>
                <Text style={s.hint}>{draft.look.hidden.includes(key) ? 'Removed' : sectionOptions === key ? 'Close' : 'Edit'}</Text>
              </Pressable>
              {sectionOptions === key && <>
              {textField('Section title', draft.custom.labels[key] ?? '', v => setSectionOption(key, 'labels', v), 48)}
              <View style={s.row}>{(['members','friends','private'] as const).map(a =>
                <Action key={a} label={{members:'Members',friends:'Friends',private:'Only me'}[a]}
                  selected={(draft.custom.access[key] ?? 'members') === a} onPress={() => setSectionOption(key, 'access', a)} />)}</View>
              <View style={s.row}>{(['compact','full', ...(['garage','collection'].includes(key) ? ['gallery'] as const : [])] as const).map(f =>
                <Action key={f} label={{compact:'Compact card',full:'Full width',gallery:'Gallery'}[f]}
                  selected={(draft.custom.formats[key] ?? 'full') === f} onPress={() => setSectionOption(key, 'formats', f)} />)}</View>
              <View style={s.row}>
              <Action
                label={draft.look.large.includes(key) ? 'Standard heading' : 'Large heading'}
                onPress={() =>
                  field('look', {
                    ...draft.look,
                    large: draft.look.large.includes(key)
                      ? draft.look.large.filter((k) => k !== key)
                      : [...draft.look.large, key],
                  })
                }
              />
              <Action
                label={draft.look.hidden.includes(key) ? 'Add section' : 'Remove section'}
                onPress={() =>
                  field('look', {
                    ...draft.look,
                    hidden: draft.look.hidden.includes(key)
                      ? draft.look.hidden.filter((k) => k !== key)
                      : [...draft.look.hidden, key],
                  })
                }
              />
              {i > 0 && (
                <Action label="Up" onPress={() => field('layout', move(draft.layout, i, -1))} />
              )}
              {i < draft.layout.length - 1 && (
                <Action label="Down" onPress={() => field('layout', move(draft.layout, i, 1))} />
              )}</View></>}
            </View>
          ))}
        </Group>}
        {(section === 'Identity' || section === 'Who can visit?') && <Group title="Who can see my profile?">
          <View style={s.row}>
            <Action
              label="All UNDERGROUND members" selected={draft.audience === 'members'} onPress={() => field('audience', 'members')} />
            <Action
              label="Accepted friends"
              selected={draft.audience === 'friends'}
              onPress={() => field('audience', 'friends')}
            />
            <Action
              label="Only me"
              selected={draft.audience === 'private'}
              onPress={() => field('audience', 'private')}
            />
          </View>
        </Group>}
        {section === 'Who can visit?' && <Group title="Verified activity">
          {(['showClout','showRuns','showTerritories'] as const).map(k => <Action key={k}
            label={({showClout:'Show CLOUT',showRuns:'Show verified Runs',showTerritories:'Show solo territories'})[k]}
            selected={draft.custom[k]} onPress={() => custom(k, !draft.custom[k])} />)}
        </Group>}
        {section === 'Identity' && <Group title="My page">
          {(['Featured car','My garage','Soundtrack','Section order','Customize page'] as const).map(item =>
            <Pressable accessibilityRole="button" key={item} style={s.menuRow} onPress={() => openSection(item)}>
              <Text style={s.menuLabel}>{item === 'Section order' ? 'Arrange sections and visibility' : item}</Text><Text style={s.hint}>›</Text>
            </Pressable>)}
        </Group>}
        {section === 'Customize page' && <Action label="Edit profile details" onPress={() => openSection('Identity')} />}
        <View style={s.row}>
          <Action label="Preview page" onPress={previewPage} />
          <Action
            label="Save draft"
            disabled={photoBusy || busy}
            onPress={() => {
              void putDraft(page.member.id, page.revision, draft)
                .then(() => {
                  setSavedDraft(draft);
                  Alert.alert('Draft saved', 'Visible only on this device.');
                })
                .catch(() => setError('Could not save the draft.'));
            }}
          />
          {savedDraft && <Action label="Restore draft" onPress={() => setDraft(savedDraft)} />}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#101114' },
  bar: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderColor: '#34353A',
  },
  barTitle: { fontFamily: 'BarlowCondensed_700Bold', fontSize: 23, color: '#FFF' },
  content: { padding: 18, paddingBottom: 54, gap: 24 },
  menuRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#46464B' },
  menuLabel: { color: '#F0EEE9', fontSize: 16 },
  group: { gap: 10 },
  groupTitle: { fontFamily: 'BarlowCondensed_700Bold', color: '#F0EEE9', fontSize: 25 },
  label: { color: '#C6C5C4', fontSize: 13, marginBottom: 5 },
  input: {
    backgroundColor: '#1C1E22',
    borderWidth: 1,
    borderColor: '#404047',
    color: '#F5F4EF',
    fontSize: 16,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 6,
  },
  bio: { minHeight: 86, textAlignVertical: 'top' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  action: {
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: 5,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#46464B',
  },
  chosen: { backgroundColor: '#DFBF88' },
  actionText: { color: '#E3E3DF', fontSize: 13 },
  activeText: { color: '#121315', fontSize: 13, fontWeight: '700' },
  cover: { width: '100%', aspectRatio: 2.25, marginBottom: 6 },
  avatar: { width: 64, height: 64, borderRadius: 32, marginBottom: 6 },
  order: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  orderTitle: { flex: 1, color: '#ECEAE5' },
  hint: { color: '#B8B8BC', lineHeight: 20 },
  error: { color: '#FFB8AC', padding: 12 },
});
