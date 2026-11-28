import {useIntelCatalog} from '../../lib/use-intel-weather';
import {currentWeather,currentWeatherCheck,type IntelAssessment} from '../../lib/intel-weather';
import {runAdvisories,winterNavigationPaused} from '../../data/route-advisories';
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

function RunIntelBadge({run,assessment,clock}:{run:CuratedRun;assessment:IntelAssessment|null;clock:number}){
 const weather=currentWeather(assessment,clock);
 const checked=currentWeatherCheck(assessment,clock);
 const saved=runAdvisories(run.slug,run.catalog?.id,clock*1000);
 const paused=winterNavigationPaused(run.catalog?.id,clock*1000);
 const caution=weather.length>0||saved.length>0;
 return <View style={{alignSelf:'flex-start',borderWidth:1,borderRadius:6,borderColor:paused?'#F19C86':caution?'#E8B96D':'#48545C',paddingHorizontal:8,paddingVertical:4}}>
  <Text style={{fontSize:11,color:paused?'#F19C86':caution?'#E8B96D':'#AAB3B8'}}>{paused?'INTEL / SEASONAL RESTRICTION':caution?'INTEL / REVIEW '+(weather.length+saved.length)+' ADVISOR'+(weather.length+saved.length===1?'Y':'IES'):checked?'INTEL / WEATHER CHECKED - PARTIAL':'INTEL / CONDITIONS UNKNOWN'}</Text>
 </View>;
}
export function SoloRunSelector() {
  return <CatalogBrowser />;
}
export function DriveMenu() {
  const [mode, setMode] = useState<'cruise' | 'conquest' | null>(null);
  const intel=useIntelCatalog(mode==='cruise');
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const back = useCallback(() => {
    if (!mode) return false;
    setMode(null);
    return true;
  }, [mode]);
  useFocusEffect(useCallback(() => {
    const listener = BackHandler.addEventListener('hardwareBackPress', back);
    return () => listener.remove();
  }, [back]));
  if (mode === 'conquest') return <CatalogBrowser conquestOnly onExit={back} />;
  if (mode === 'cruise') return (
    <ScrollView style={s.root} contentContainerStyle={[s.content, {paddingTop: insets.top + 12, paddingBottom: insets.bottom + 28}]}>
      <Choice title="Back to Drive" onPress={back} />
      <Text accessibilityRole="header" style={s.heading}>Cruise</Text>
      <Text style={s.section}>Featured cruises</Text>
      {entries.filter(row => row.run?.category === 'CRUISE' && row.state === 'CA').sort((a,b) => Number(b.run?.slug === 'highway-1-cruise') - Number(a.run?.slug === 'highway-1-cruise')).map(({run,art}) => run && (
        <Pressable key={run.slug} accessibilityRole="button" accessibilityLabel={'View ' + run.title} style={s.route} onPress={() => router.push({pathname:'/runs/[slug]',params:{slug:run.slug}})}>
          {art.cover && <DrivePhoto source={art.cover} />}
          <View style={s.routeBody}><Text style={s.meta}>{run.catalog?.id} · CRUISE</Text><Text style={s.routeTitle}>{run.title}</Text><RunIntelBadge run={run} assessment={intel.data?.get(run.slug)??null} clock={intel.clock}/><Text style={s.note}>{run.sequence[0]} → {run.sequence[run.sequence.length-1]}</Text></View>
        </Pressable>
      ))}
      <Choice title="Club Drives" detail="Saved drives and scheduled meetups" onPress={() => router.push('/club-drives')} />
      <Choice title="Local events" onPress={() => router.push('/local-events')} />
    </ScrollView>
  );
  return <ScrollView style={s.root} contentContainerStyle={[s.content,{paddingTop:insets.top+12,paddingBottom:insets.bottom+28}]}>
    <Text accessibilityRole="header" style={s.heading}>Drive</Text>
    <View style={s.books}>
      <BookCover title="CRUISE" detail="Scenic and social drives" variant="state" selected art={{cover:require('../../../assets/runs/saratoga-club-cars.jpg')}} onPress={()=>setMode('cruise')} />
      <BookCover title="CONQUEST" detail="Territories and challenges" variant="state" art={{cover:require('../../../assets/runs/conquest-cover.png')}} onPress={()=>setMode('conquest')} />
    </View>
  </ScrollView>;
}

function CatalogBrowser({conquestOnly = false, onExit}: {conquestOnly?: boolean; onExit?: () => void} = {}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { access } = useFloridaAccess(true);
  const [selectedBook, setSelectedBook] = useState<StateBook | null>(null);
  const [path, setPath] = useState<string[]>([]);
  const [browseCruises, setBrowseCruises] = useState(false);
  const [browseRuns, setBrowseRuns] = useState(false);
  const book = selectedBook ?? (access === 'inside' ? 'FL' : 'CA');
  const goBack = useCallback(() => {
    if (browseRuns) {
      setBrowseRuns(false);
      return true;
    }
    if (browseCruises) {
      setBrowseCruises(false);
      return true;
    }
    if (path.length) {
      setPath(path.slice(0, -1));
      return true;
    }
    return false;
  }, [browseCruises, browseRuns, path]);
  useFocusEffect(
    useCallback(() => {
      const listener = BackHandler.addEventListener('hardwareBackPress', goBack);
      return () => listener.remove();
    }, [goBack]),
  );
  const depth = path.length;
  const level: Level | undefined = levels[depth];
  const rows = entries.filter(
    (row) => row.state === book && (!conquestOnly || row.run?.category !== 'CRUISE') && path.every((name, i) => row[levels[i]] === name),
  );
  const children = level ? groups(rows, level) : new Map<string, Entry[]>();
  const cruises = rows.filter((row) => row.run?.category === 'CRUISE');
  const runs = rows.filter((row) => row.run?.category === 'RUN');
  const browsing = browseCruises || browseRuns;
  const featured = cruises.find((row) => row.run?.slug === 'highway-1-cruise');
  const listed = browseCruises ? cruises : browseRuns ? runs : level ? [] : rows;
  const intel=useIntelCatalog(listed.length>0);
  const title = browsing ? (depth ? path[depth - 1] : stateCovers[book].name) + (browseCruises ? ' Cruises' : ' Runs') : path[depth - 1];
  const hero = artwork(book, path, rows);
  const backTitle = browsing
    ? (path[depth - 1] ?? 'Drive')
    : (path[depth - 2] ?? stateCovers[book].name + ' regions');
  const preview = book === 'FL' && access !== 'inside';

  function enter(name: string) {
    setSelectedBook(book);
    setPath([...path, name]);
  }
  return (
    <ScrollView
      key={[book, ...path, browseCruises ? 'cruises' : browseRuns ? 'runs' : ''].join('/')}
      style={s.root}
      contentContainerStyle={[
        s.content,
        { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 28 },
      ]}
    >
      {depth === 0 && !browsing ? (
        <>
          <Text accessibilityRole="header" style={s.heading}>
            {conquestOnly ? 'Conquest' : 'Drive'}
          </Text>
          {onExit && <Choice title="Back to Drive" onPress={onExit} />}
          {!conquestOnly && <Choice title="Cruises" detail={count(cruises.length, 'scenic and social drive')} onPress={() => setBrowseCruises(true)} />}
          {!conquestOnly && <Choice title="Runs" detail={count(runs.length, 'curated route')} onPress={() => setBrowseRuns(true)} />}
          {featured?.run && <Choice title="Highway 1 Cruise" detail="Featured cruise · Moss Landing → Venice Beach (Half Moon Bay)" art={featured.art} onPress={() => router.push({ pathname: '/runs/[slug]', params: { slug: 'highway-1-cruise' } })} />}
          <Choice title="Club Drives" detail="Saved drives and scheduled meetups" onPress={() => router.push('/club-drives')} />
          <Text accessibilityRole="header" style={s.section}>Explore by location</Text>
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
            detail={count(browsing ? listed.length : rows.length, 'drive')}
          />
        </>
      )}
      {!browsing && depth > 0 && depth < 3 && cruises.length > 0 && (
        <Choice
          title="Cruises"
          detail={count(cruises.length, 'local drive')}
          onPress={() => setBrowseCruises(true)}
        />
      )}
      {!browsing && depth > 0 && level && (
        <Text accessibilityRole="header" style={s.section}>
          {level === 'district' ? 'Districts' : 'Territories'}
        </Text>
      )}
      {!browsing &&
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
              <RunIntelBadge run={run} assessment={intel.data?.get(run.slug)??null} clock={intel.clock}/>
              <Text style={s.note}>{run.subtitle}</Text>
              <Text style={s.note}>
                {run.sequence[0]} → {run.sequence[run.sequence.length - 1]}
              </Text>
            </View>
          </Pressable>
        );
      })}
      {!depth && !browsing && (
        <>
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
