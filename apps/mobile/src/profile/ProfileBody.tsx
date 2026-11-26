import { FittedPhoto } from '../components/FittedPhoto';
import { visitorPage, type Visitor } from './audience';
import { FounderR8Cover } from '../components/FounderR8Cover';
import { isFounderR8 } from '../garage/founder-r8';
import { ProfilePhoto } from './ProfilePhoto';
import { useState } from 'react';

import {
  Alert,
  Image,
  ImageBackground,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  View, useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Text, Screen } from '@underground/ui';
import { curatedRuns } from '../data/curated-runs';
import { useSession } from '../session/SessionContext';

import { sectionEditor, type EditorSection, profileCoverRatio, accents, sectionTitles, type Page } from './page';
import { Soundtrack } from './Soundtrack';
import { Guestbook } from './Guestbook';
import { SharedGarage } from './SharedGarage';
function LinkButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={s.button}>
      <Text style={s.buttonText}>{label}</Text>
    </Pressable>
  );
}
function external(url: string) {
  void Linking.openURL(url).catch(() => Alert.alert('Could not open the link'));
}

export function ProfileBody({
  page,
  viewer,
  preview,
  onEdit,
  onPreview,
  onCopy,
  drafting = false,
}: {
  page: Page;
  viewer: string;
  preview: boolean;
  onEdit?: (section: EditorSection) => void;
  onPreview: () => void;
  onCopy?: () => void;
  drafting?: boolean;
}) {
  const router = useRouter(),
    { signOut } = useSession();
  const window = useWindowDimensions();
  const [viewAs, setViewAs] = useState<Visitor>('friends');
  const [crewPhoto, setCrewPhoto] = useState<number | null>(null);
  const switchView = <View style={s.actions}>
    <LinkButton label={'Friends' + (viewAs === 'friends' ? ' ✓' : '')} onPress={() => setViewAs('friends')} />
    <LinkButton label={'Other members' + (viewAs === 'members' ? ' ✓' : '')} onPress={() => setViewAs('members')} />
    <LinkButton label={drafting ? 'Back to editing' : 'Return to my profile'} onPress={onPreview} />
  </View>;
  if (preview) {
    const projected = visitorPage(page, viewAs);
    if (!projected) return <Screen>{switchView}<Text style={s.body}>This page is private to this audience.</Text></Screen>;
    page = projected;
  }
  const target = page.member.id,
    owner = target === viewer;
  const d = page.settings,
    accent = d.custom.accentColor || accents[d.accent],
    mine = owner && !preview;
  const vehicle = page.vehicles.find(
    (v) => v.id === d.vehicleId && (mine || v.visibility !== 'private'),
  );
  const drive = curatedRuns.find((r) => r.slug === d.driveSlug);
  const show = (key: keyof typeof sectionTitles) =>
    !d.look.hidden.includes(key) &&
    Boolean(
      {
        journal: d.entries.length,
        guestbook: true,
        collection: d.custom.owned.length,
        about: d.bio || d.custom.links.length,
        garage: d.featuredCar || vehicle,
        drive,
        friends: page.featuredFriends.length,
        music: d.music,
        work: d.work || d.linkedin,
      }[key],
    );
  const AvatarFrame = mine ? Pressable : View;
  const wallpaper =
    d.custom.wallpaper?.photo ? { uri: d.custom.wallpaper.photo } : d.look.wallpaper === 'Saratoga'
      ? require('../../assets/runs/saratoga-club-cars.jpg')
      : d.look.wallpaper === 'Pacific'
        ? require('../../assets/runs/catalog-m01.jpg')
        : d.look.wallpaper === 'My cover' && d.cover
          ? { uri: d.cover }
          : null;
  const headingFont =
    d.look.heading === 'Classic'
      ? 'Georgia'
      : d.look.heading === 'Modern'
        ? 'Inter_600SemiBold'
        : 'BarlowCondensed_700Bold';
  return (
    <Screen padded={false}>
      {d.custom.wallpaper?.photo ? <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <ProfilePhoto uri={d.custom.wallpaper.photo} frame={d.custom.wallpaper.frame} ratio={window.width / window.height} label="Profile wallpaper" />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(7,11,16,0.79)' }]} />
      </View> : wallpaper && (
        <ImageBackground
          source={wallpaper}
          resizeMode="cover"
          style={StyleSheet.absoluteFill}
          accessibilityLabel="Profile wallpaper"
        >
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(7,11,16,0.79)' }]} />
        </ImageBackground>
      )}
      <ScrollView
        style={{ backgroundColor: 'transparent' }}
        contentContainerStyle={[
          s.content,
          { backgroundColor: wallpaper ? 'transparent' : '#101114' },
        ]}
        accessibilityLabel="Member page"
      >
        {!owner && (
          <LinkButton
            label="Back to Friends"
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/friends'))}
          />
        )}
        {preview && switchView}
        <View style={{ borderBottomWidth: 2, borderColor: accent }}>
          {d.cover ? <ProfilePhoto uri={d.cover} frame={d.custom.coverFrame} ratio={profileCoverRatio(d.look.coverSize)} label="Profile cover" /> :
            <Image source={require('../../assets/runs/catalog-m01.jpg')} style={{ width: '100%', aspectRatio: profileCoverRatio(d.look.coverSize) }} />}
        </View>
        <View style={s.identity}>
          <AvatarFrame style={[s.avatar, { borderColor: accent }]} accessibilityRole={mine ? 'button' : undefined}
            accessibilityLabel={mine ? 'Edit profile photo' : undefined} onPress={mine ? () => onEdit?.('Identity') : undefined}>
            {d.avatar ? (
              <ProfilePhoto uri={d.avatar} frame={d.custom.avatarFrame} ratio={1} label="Profile photo" />
            ) : (
              <Text style={[s.monogram, { color: accent }]}>
                {d.displayName.slice(0, 2).toUpperCase()}
              </Text>
            )}
          </AvatarFrame>
          <Text style={[s.number, { color: accent }]}>
            {page.member.founder ? 'FOUNDER' : 'MEMBER'} #{page.member.number}
          </Text>
          <Text accessibilityRole="header" style={[s.name, { fontFamily: headingFont }]}>
            {d.displayName}
          </Text>
          {!!d.custom.handle && <Text style={s.home}>@{d.custom.handle}</Text>}
          {!!d.home && <Text style={s.home}>{d.home}</Text>}
          {!!d.status && <Text style={[s.status, { borderLeftColor: accent }]}>{d.status}</Text>}
          <View style={s.stats}>
            <Text style={s.meta}>
              {page.friendCount} {page.friendCount === 1 ? 'friend' : 'friends'}
            </Text>
            {d.custom.showRuns && page.verifiedRuns != null && <Text style={s.meta}>{page.verifiedRuns} verified Runs</Text>}
            {d.custom.showTerritories && page.territories != null && <Text style={s.meta}>{page.territories} solo territories</Text>}
            {d.custom.showClout && page.clout !== null && <Text style={s.meta}>{page.clout} CLOUT</Text>}
          </View>
          {mine && (
            <View style={s.actions}>
              <Pressable
                accessibilityRole="button"
                style={[s.editButton, { backgroundColor: accent }]}
                onPress={() => onEdit?.('Identity')}
              >
                <Text style={s.editText}>Edit profile</Text>
              </Pressable>
              <LinkButton label="Customize page" onPress={() => onEdit?.('Customize page')} />
              <LinkButton label="My Run Records" onPress={() => router.push('/trips/personal-records')} />
              <LinkButton label="Preview as a visitor" onPress={onPreview} />
            </View>
          )}
          {!owner && onCopy && <LinkButton label="Use this layout" onPress={onCopy} />}
          {mine && (
            <Text style={s.meta}>
              {d.audience === 'members' ? 'Visible to UNDERGROUND members' : d.audience === 'friends' ? 'Visible to accepted friends' : 'Only you can visit'}
            </Text>
          )}
        </View>
        <View style={s.sections}>
          {d.layout.filter(show).map((key) => (
            <View
              key={key}
              style={[
                s.section,
                d.custom.formats[key] === 'compact' && { marginHorizontal: 8, padding: 6 },
                d.custom.formats[key] === 'full' && { marginHorizontal: -12 },
                d.look.large.includes(key) && { paddingVertical: 26, gap: 14 },
                d.look.panels !== 'Lines' && {
                  padding: 14,
                  borderWidth: 1,
                  borderRadius: 8,
                  borderColor: accent + '55',
                  backgroundColor: d.look.panels === 'Glass' ? 'rgba(23,27,34,.76)' : '#202329',
                },
                !!d.custom.panelColor && { backgroundColor: d.custom.panelColor, padding: 14 },
              ]}
            >
              <Text
                style={[
                  s.heading,
                  {
                    color: accent,
                    fontFamily: headingFont,
                    fontSize: d.look.large.includes(key) ? 32 : 24,
                  },
                ]}
              >
                {d.custom.labels[key] || sectionTitles[key]}
              </Text>
              {mine && <LinkButton label={(show(key) ? 'Edit ' : 'Set up ') + sectionTitles[key]}
                onPress={() => onEdit?.(sectionEditor[key])} />}
              {key === 'about' && <>
                {!!d.bio && <Text style={s.body}>{d.bio}</Text>}
                {d.custom.links.map((url, i) => <LinkButton key={i} label={url} onPress={() => external(url)} />)}
              </>}
              {key === 'collection' && <View style={d.custom.formats.collection === 'gallery' ? s.grid : s.stack}>
                {d.custom.owned.map(item => {
                  const car = page.vehicles.find(v => v.id === item.id);
                  if (!car) return null;
                  return <View key={item.id} style={d.custom.formats.collection === 'gallery' ? s.tile : s.stack}>
                    {!!item.photo && <ProfilePhoto uri={item.photo} frame={item.frame} label={car.label} />}
                    <Text style={s.feature}>{car.label}</Text>
                  </View>;
                })}
              </View>}

              {key === 'garage' && vehicle && !d.featuredCar && isFounderR8(page.member.founder, vehicle.label) && <FounderR8Cover />}
              {key === 'garage' && d.featuredCar?.photo && (!d.featuredCar.linkedVehicleId || vehicle) &&
                <ProfilePhoto uri={d.featuredCar.photo} frame={d.custom.featureFrame} label={vehicle?.label ?? d.featuredCar.name} />}
              {key === 'garage' && !!d.custom.gallery.length && <View style={d.custom.formats.garage === 'gallery' ? s.grid : s.stack}>
                {d.custom.gallery.map((item, i) => item.photo && <View key={i} style={d.custom.formats.garage === 'gallery' ? s.tile : s.stack}>
                  <ProfilePhoto uri={item.photo} frame={item.frame} label={'Featured car photo ' + (i + 2)} />
                </View>)}
              </View>}
              {key === 'garage' && !!vehicle && !!d.featuredCar?.story && <Text style={s.body}>{d.featuredCar.story}</Text>}
              {key === 'garage' && d.featuredCar && !d.featuredCar.linkedVehicleId && <>
                <Text style={s.feature}>{d.featuredCar.name}</Text>
                {!!d.featuredCar.story && <Text style={s.body}>{d.featuredCar.story}</Text>}
              </>}
              {key === 'garage' && vehicle && (
                <>
                  <Text style={s.feature}>{vehicle.label}</Text>
                  {mine ? (
                    <LinkButton label="My garage" onPress={() => router.push('/(tabs)/garage')} />
                  ) : (
                    !preview && !drafting && <SharedGarage viewer={viewer} target={target} vehicle={vehicle} />
                  )}
                </>
              )}
              {key === 'drive' && drive && (
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    router.push({ pathname: '/runs/[slug]', params: { slug: drive.slug } })
                  }
                >
                  {drive.cover && (
                    <FittedPhoto source={drive.cover} radius={6} />
                  )}
                  <Text style={s.feature}>{drive.title}</Text>
                  <Text style={s.meta}>
                    {drive.territory}
                    {drive.mapped
                      ? ' · ' + (drive.mapped.distanceMeters / 1609.344).toFixed(1) + ' mi'
                      : ''}
                  </Text>
                </Pressable>
              )}
              {key === 'friends' && (
                <View style={s.actions}>
                  {page.featuredFriends.map((friend, i) => (
                    <Pressable
                      key={friend.id}
                      accessibilityRole="button"
                      style={s.friend}
                      onPress={() =>
                        router.push({ pathname: '/members/[id]', params: { id: friend.id } })
                      }
                    >
                      <Text style={[s.number, { color: accent }]}>
                        {String(i + 1).padStart(2, '0')}
                      </Text>
                      <Text style={s.body}>{friend.name}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
              {key === 'journal' &&
                d.entries.map((entry, i) => (
                  <View key={i} style={{ gap: 5, marginVertical: 5 }}>
                    {entry.photo &&
                      (entry.crew &&
                      !d.look.hidden.includes('friends') &&
                      page.featuredFriends.length > 0 ? (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={'See crew in ' + entry.title}
                          onPress={() => setCrewPhoto(crewPhoto === i ? null : i)}
                        >
                          <ProfilePhoto uri={entry.photo} frame={entry.frame} label={entry.title} radius={6} />
                          <Text style={s.buttonText}>View crew</Text>
                        </Pressable>
                      ) : (
                        <ProfilePhoto uri={entry.photo} frame={entry.frame} label={entry.title} radius={6} />
                      ))}
                    {crewPhoto === i &&
                      entry.crew &&
                      !d.look.hidden.includes('friends') &&
                      page.featuredFriends.map((f) => (
                        <LinkButton
                          key={f.id}
                          label={f.name}
                          onPress={() =>
                            router.push({ pathname: '/members/[id]', params: { id: f.id } })
                          }
                        />
                      ))}
                    <Text style={s.feature}>{entry.title}</Text>
                    {!!entry.note && <Text style={s.body}>{entry.note}</Text>}
                  </View>
                ))}
              {key === 'guestbook' &&
                (drafting ? (
                  <Text style={s.meta}>Friends can leave a note here.</Text>
                ) : (
                  <Guestbook viewer={viewer} target={target} preview={preview} />
                ))}
              {key === 'music' && !!d.music && (
                <Soundtrack
                  key={d.music}
                  viewer={viewer}
                  title={d.trackTitle}
                  url={d.music}
                  preview={drafting}
                />
              )}
              {key === 'work' && (
                <>
                  {!!d.work && <Text style={s.body}>{d.work}</Text>}
                  {!!d.linkedin && (
                    <LinkButton
                      label="View LinkedIn profile"
                      onPress={() => external(d.linkedin)}
                    />
                  )}
                </>
              )}
            </View>
          ))}
        </View>
        {mine && (
          <View style={s.footer}>
            <LinkButton label="My friends" onPress={() => router.push('/(tabs)/friends')} />
            <LinkButton
              label="Sign out"
              onPress={() => {
                signOut();
                router.replace('/welcome');
              }}
            />
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}
const s = StyleSheet.create({
  content: { paddingBottom: 48, backgroundColor: '#101114', flexGrow: 1 },
  message: { padding: 20, gap: 14 },
  cover: { width: '100%', aspectRatio: 2.25, borderBottomWidth: 2 },
  identity: { paddingHorizontal: 20, gap: 6 },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 2,
    backgroundColor: '#17191D',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -30,
    marginBottom: 4,
  },
  avatarImage: { width: '100%', height: '100%' },
  monogram: { fontSize: 31, fontFamily: 'BarlowCondensed_700Bold' },
  number: { fontFamily: 'Inter_600SemiBold', fontSize: 11, letterSpacing: 1.6 },
  name: { fontFamily: 'BarlowCondensed_700Bold', fontSize: 43, lineHeight: 48, color: '#FAF9F6' },
  home: { color: '#C7C7CA', fontSize: 15 },
  status: {
    borderLeftWidth: 2,
    paddingLeft: 12,
    marginVertical: 8,
    color: '#F0EFED',
    fontSize: 17,
    lineHeight: 24,
  },
  stack: { gap: 8 }, grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, tile: { width: '48%', gap: 4 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginVertical: 4 },
  meta: { color: '#B8BAC0', fontSize: 13 },
  actions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center' },
  editButton: { minHeight: 44, paddingHorizontal: 18, borderRadius: 4, justifyContent: 'center' },
  editText: { color: '#141518', fontWeight: '700' },
  button: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  buttonText: { color: '#E4E3DE', fontSize: 14, textDecorationLine: 'underline' },
  sections: { paddingHorizontal: 20 },
  section: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: '#45464B',
    marginTop: 21,
    paddingTop: 16,
    gap: 7,
  },
  heading: { fontFamily: 'BarlowCondensed_700Bold', fontSize: 24 },
  body: { color: '#E6E5E2', fontSize: 16, lineHeight: 23 },
  feature: { color: '#F1F0ED', fontFamily: 'BarlowCondensed_700Bold', fontSize: 24, marginTop: 4 },
  friend: { padding: 10, minWidth: 90, borderColor: '#4A4948', borderWidth: 1, borderRadius: 5 },
  footer: { paddingHorizontal: 12, flexDirection: 'row', marginTop: 24 },
});
