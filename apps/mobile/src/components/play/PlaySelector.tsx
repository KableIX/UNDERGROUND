import { DrivePhoto } from './DrivePhoto';
import { useCallback, useState } from 'react';
import { BackHandler, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Text } from '@underground/ui';
import { curatedRuns, masterCatalog, type CuratedRun } from '../../data/curated-runs';
import { regionCovers, stateCovers, type StateBook } from '../../data/road-book-covers';
import { saratogaPhoto } from '../../data/saratoga-photo';
import saratogaRoute from '../../data/saratoga-club-route.json';
import { useFloridaAccess } from '../../lib/use-florida-access';
import { shell } from '../../theme/shell';
import { BookCover, type BookArt } from './BookCover';

const categoryName = { RUN: 'Run', CRUISE: 'Cruise', TEST: 'POC' };
const levels = ['region', 'district', 'territory'] as const;
type Level = (typeof levels)[number];
type Entry = Record<Level, string> & { state: StateBook; art: BookArt; run?: CuratedRun };

const entries: Entry[] = masterCatalog.map((run) => ({
  state: run.catalog.state ?? 'CA',
  region: run.catalog.region,
  district: run.catalog.district,
  territory: run.territory,
  art: run,
  run,
}));
// These mapped drives predate the statewide catalog and have distinct start or finish points.
const additionalTerritories: Record<string, [string,string]> = {
  'skyline-ridge-cruise': ['Silicon Valley','Skyline Ridge'],
  'la-honda-highway-84': ['Silicon Valley','La Honda'],
  'half-moon-bay-coast': ['Half Moon Bay','Half Moon Bay Coast'],
};
for (const run of curatedRuns) {
  const place = additionalTerritories[run.slug];
  if (!run.catalog && place) entries.push({ state:'CA',region:'San Francisco Bay',district:place[0],territory:place[1],run,art:run });
}
entries.push({
  state: 'CA',
  region: 'San Francisco Bay',
  district: 'Silicon Valley',
  territory: 'Saratoga Club Drives',
  art: saratogaPhoto,
});

function groups(rows: Entry[], level: Level) {
  const result = new Map<string, Entry[]>();
  for (const row of rows) {
    const name = row[level];
    const group = result.get(name);
    if (group) group.push(row);
    else result.set(name, [row]);
  }
  return result;
}

function artwork(state: StateBook, path: string[], rows: Entry[]): BookArt {
  // Only consider drives in the selected place, even for future regions.
  let preferred: string | undefined;
  if (!path.length) preferred = stateCovers[state].id;
  else if (path.length === 1) preferred = regionCovers[state][path[0]];
  else if (state === 'CA' && path[1] === 'Silicon Valley') preferred = 'S01';
  return (
    rows.find((r) => preferred && r.run?.catalog?.id === preferred && r.art.cover)?.art ??
    rows.find((r) => r.art.cover)?.art ??
    {}
  );
}

function count(n: number, word: string) {
  return n + ' ' + word + (n === 1 ? '' : 's');
}
function Choice({
  title,
  detail,
  art,
  onPress,
}: {
  title: string;
  detail?: string;
  art?: BookArt;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[title, detail].filter(Boolean).join(', ')}
      style={s.choice}
      onPress={onPress}
    >
      {art?.cover && (
        <DrivePhoto source={art.cover} thumbnail />
      )}
      <View style={s.choiceText}>
        <Text style={s.choiceTitle}>{title}</Text>
        {!!detail && <Text style={s.note}>{detail}</Text>}
      </View>
      <MaterialCommunityIcons name="chevron-right" size={22} color="#CBB994" />
    </Pressable>
  );
}

export function SoloRunSelector() {
  return <CatalogBrowser />;
}
export function DriveMenu() {
  return <CatalogBrowser />;
}

function CatalogBrowser() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { access } = useFloridaAccess(true);
  const [selectedBook, setSelectedBook] = useState<StateBook | null>(null);
  const [path, setPath] = useState<string[]>([]);
  const [browseCruises, setBrowseCruises] = useState(false);
  const book = selectedBook ?? (access === 'inside' ? 'FL' : 'CA');
  const goBack = useCallback(() => {
    if (browseCruises) {
      setBrowseCruises(false);
      return true;
    }
    if (path.length) {
      setPath(path.slice(0, -1));
      return true;
    }
    return false;
  }, [browseCruises, path]);
  useFocusEffect(
    useCallback(() => {
      const listener = BackHandler.addEventListener('hardwareBackPress', goBack);
      return () => listener.remove();
    }, [goBack]),
  );
  const depth = path.length;
  const level: Level | undefined = levels[depth];
  const rows = entries.filter(
    (row) => row.state === book && path.every((name, i) => row[levels[i]] === name),
  );
  const children = level ? groups(rows, level) : new Map<string, Entry[]>();
  const cruises = depth === 2 ? rows.filter((row) => row.run?.category === 'CRUISE') : [];
  const listed = browseCruises ? cruises : level ? [] : rows;
  const title = browseCruises ? path[depth - 1] + ' Cruises' : path[depth - 1];
  const hero = artwork(book, path, rows);
  const backTitle = browseCruises
    ? path[depth - 1]
    : (path[depth - 2] ?? stateCovers[book].name + ' regions');
  const preview = book === 'FL' && access !== 'inside';

  function enter(name: string) {
    setSelectedBook(book);
    setPath([...path, name]);
  }
  return (
    <ScrollView
      key={[book, ...path, browseCruises ? 'cruises' : ''].join('/')}
      style={s.root}
      contentContainerStyle={[
        s.content,
        { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 28 },
      ]}
    >
      {depth === 0 ? (
        <>
          <Text accessibilityRole="header" style={s.heading}>
            Drive
          </Text>
          <View style={s.books}>
            {(['CA', 'FL'] as const).map((state) => (
              <BookCover
                key={state}
                title={stateCovers[state].name}
                variant="state"
                selected={state === book}
                art={artwork(
                  state,
                  [],
                  entries.filter((r) => r.state === state),
                )}
                detail={
                  state === 'FL' && access !== 'inside'
                    ? 'Preview region'
                    : state === book
                      ? 'Open book'
                      : 'Explore'
                }
                onPress={() => setSelectedBook(state)}
              />
            ))}
          </View>
          {book==='CA' && <Choice title="Local events" detail="Bay Area club drives and Cars & Coffee" onPress={()=>router.push('/local-events')}/>}
          <Text accessibilityRole="header" style={s.section}>
            {stateCovers[book].name} regions
          </Text>
          {preview && (
            <Text style={s.note}>
              Explore every route. Navigation unlocks when you arrive in Florida.
            </Text>
          )}
        </>
      ) : (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={'Back to ' + backTitle}
            style={s.back}
            onPress={goBack}
          >
            <MaterialCommunityIcons name="chevron-left" color="#E4CA9C" size={22} />
            <Text style={s.backText}>{backTitle}</Text>
          </Pressable>
          <BookCover
            title={title}
            art={hero}
            variant="header"
            detail={count(browseCruises ? cruises.length : rows.length, 'drive')}
          />
        </>
      )}
      {!browseCruises && cruises.length > 0 && (
        <Choice
          title="Cruises"
          detail={count(cruises.length, 'local drive')}
          onPress={() => setBrowseCruises(true)}
        />
      )}
      {!browseCruises && depth > 0 && level && (
        <Text accessibilityRole="header" style={s.section}>
          {level === 'district' ? 'Districts' : 'Territories'}
        </Text>
      )}
      {!browseCruises &&
        Array.from(children, ([name, group]) => {
          const art = artwork(book, [...path, name], group);
          return !depth ? (
            <BookCover
              key={name}
              title={name}
              detail={count(group.length, 'drive')}
              art={art}
              variant="region"
              onPress={() => enter(name)}
            />
          ) : (
            <Choice
              key={name}
              title={name}
              detail={count(group.length, 'drive')}
              art={art}
              onPress={() => enter(name)}
            />
          );
        })}
      {listed.map(({ run, art }) => {
        if (!run)
          return (
            <Choice
              key="club-saratoga"
              title="Saratoga Club Loop"
              art={art.cover === hero.cover ? undefined : art}
              detail={
                (saratogaRoute.properties.distanceMeters / 1609.344).toFixed(1) + ' mi · Club Drive. From Saratoga, loop through Hicks Road and Morgan Hill before the climb to Metcalf and the return to the village.'
              }
              onPress={() =>
                router.push({ pathname: '/club-drives', params: { route: 'saratoga' } })
              }
            />
          );
        const detail = [
          run.catalog?.id,
          run.catalog?.status === 'official' ? 'Official ' + categoryName[run.category] : categoryName[run.category],
          run.catalog?.tier ? 'Tier ' + run.catalog.tier + '/5' : null,
          run.mapped ? (run.mapped.distanceMeters / 1609.344).toFixed(1) + ' mi' : null,
        ]
          .filter(Boolean)
          .join(' · ');
        return (
          <Pressable
            key={run.slug}
            accessibilityRole="button"
            accessibilityLabel={'View ' + run.title}
            style={s.route}
            onPress={() => router.push({ pathname: '/runs/[slug]', params: { slug: run.slug } })}
          >
            {art.cover && (listed.length > 1 || art.cover !== hero.cover) && (
              <DrivePhoto source={art.cover} />
            )}
            <View style={s.routeBody}>
              <Text style={s.meta}>{detail}</Text>
              <Text style={s.routeTitle}>{run.title}</Text>
              <Text style={s.note}>{run.subtitle}</Text>
              <Text style={s.note}>
                {run.sequence[0]} → {run.sequence[run.sequence.length - 1]}
              </Text>
            </View>
          </Pressable>
        );
      })}
      {!depth && (
        <>
          <Choice
            title="Club Drives"
            detail="Saved drives and scheduled meetups"
            onPress={() => router.push('/club-drives')}
          />
          <Choice
            title="Spotted"
            detail="Your car spotting collection"
            onPress={() => router.push('/spotted')}
          />
          <Choice
            title="SupercarGO"
            detail="Sightings, envelopes and the Ledger"
            onPress={() => router.push('/(tabs)/supercargo')}
          />
        </>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#080B0D' },
  content: { paddingHorizontal: 16, gap: 11 },
  heading: {
    fontFamily: 'BarlowCondensed_700Bold',
    fontSize: 42,
    lineHeight: 48,
    color: '#FAF8F3',
  },
  books: { flexDirection: 'row', alignItems: 'stretch', gap: 9 },
  section: {
    fontFamily: 'BarlowCondensed_700Bold',
    color: '#F2EEE5',
    fontSize: 25,
    lineHeight: 31,
    marginTop: 6,
  },
  note: { fontFamily: 'Inter_400Regular', color: shell.muted, fontSize: 13, lineHeight: 19 },
  back: { flexDirection: 'row', alignItems: 'center', minHeight: 44, alignSelf: 'flex-start' },
  backText: { flexShrink: 1, fontFamily: 'Inter_600SemiBold', color: '#E4CA9C', fontSize: 13 },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 62,
    borderRadius: 7,
    padding: 10,
    borderWidth: 1,
    borderColor: '#343C3E',
    backgroundColor: '#14191B',
  },
  choiceText: { flex: 1, gap: 2 },
  choiceTitle: {
    fontFamily: 'BarlowCondensed_700Bold',
    color: '#F6F4EE',
    fontSize: 23,
    lineHeight: 27,
  },
  route: {
    backgroundColor: '#131719',
    borderColor: '#343C3E',
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  routeBody: { gap: 4, padding: 14 },
  routeTitle: {
    fontFamily: 'BarlowCondensed_700Bold',
    color: '#FAF8F3',
    fontSize: 28,
    lineHeight: 32,
  },
  meta: { fontFamily: 'Inter_600SemiBold', color: '#DFCA9F', fontSize: 11, lineHeight: 16 },
});
