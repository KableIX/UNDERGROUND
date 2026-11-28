import { useState, type ReactNode } from 'react';
import { Animated, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { SupercargoCatalogEntry, SupercargoTier } from '@underground/domain';
import { goldTouch } from '../components/GoldTouch';
import { CarArt } from './CarArt';
import { tierLabel, tierNote, tierRank } from './copy';
import { FoilFilm, FoilFrame } from './Foil';
import type { FoilMotion } from './useFoilMotion';
import { finishFor, productionLine, serial, spotDate, spotLine, yearLine } from './scan';

const GOLD = '#C6B08B';
const BRIGHT = '#E7C892';

/** Round wax-style seal: double gold ring, the tier initial, six rank ticks. */
export function RaritySeal({ tier, size = 64 }: { tier: SupercargoTier; size?: number }) {
  const rank = tierRank(tier);
  const finish = finishFor(tier);
  const ring = finish === 'matte' ? '#5A5B60' : BRIGHT;
  return (
    <View style={{ alignItems: 'center', gap: 6 }} accessibilityLabel={tierLabel(tier) + ' tier'}>
      <View style={[seal.outer, { width: size, height: size, borderRadius: size / 2, borderColor: ring }, finish !== 'matte' && seal.glow]}>
        <View style={[seal.inner, { width: size - 8, height: size - 8, borderRadius: (size - 8) / 2, borderColor: ring }]}>
          <Text style={[seal.letter, { color: finish === 'matte' ? '#B7B7B8' : BRIGHT, fontSize: size * 0.38 }]}>{tierLabel(tier).slice(0, 1)}</Text>
          <View style={seal.ticks}>
            {Array.from({ length: 6 }, (_, i) => (
              <View key={i} style={[seal.tick, { backgroundColor: i < rank ? ring : '#2C2D31' }]} />
            ))}
          </View>
        </View>
      </View>
      <Text style={[seal.label, { color: finish === 'matte' ? '#B7B7B8' : BRIGHT }]}>{tierLabel(tier).toUpperCase()}</Text>
    </View>
  );
}

function Spec({ n, label, value }: { n: number; label: string; value: string }) {
  return (
    <View style={c.spec}>
      <Text style={c.specN}>{String(n).padStart(2, '0')}</Text>
      <Text style={c.specLabel}>{label}</Text>
      <Text style={c.specValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

export type SpotCardProps = {
  make: string;
  model: string;
  tier: SupercargoTier;
  entry: SupercargoCatalogEntry | null;
  catalogId: string | null;
  /** Signed URL of the plate- and face-blurred copy. Never the original. */
  photoUri: string | null;
  spottedAt: string;
  area: string | null;
  spotNumber: number | null;
  reduceMotion: boolean;
  width: number;
  /** Device-motion values: the foil follows the tilt and the card leans a little. */
  motion?: FoilMotion | null;
};

/**
 * The Underground card made after a sighting is logged. The photo is the blurred
 * derivative from the API; with none (a private sighting) the card shows the
 * catalog render instead. The area is a neighborhood or town, never a place.
 */
export function SpotCard(p: SpotCardProps) {
  const finish = finishFor(p.tier);
  const [photoFailed, setPhotoFailed] = useState(false);
  const photoW = p.width - 2 * 18 - 4;
  const photoH = Math.round((photoW * 3) / 4);
  const rows: Array<[string, string]> = [['Production', productionLine(p.entry)]];
  const year = yearLine(p.entry);
  if (year) rows.push(['First year', year.replace('From ', '')]);
  rows.push(['Spotted', spotDate(p.spottedAt)]);
  if (p.area) rows.push(['Area', p.area]);
  const mine = spotLine(p.spotNumber, p.model);
  if (mine) rows.push(['Your spot', mine]);

  const lean = p.motion
    ? [
        { perspective: 900 },
        { rotateX: p.motion.rotX.interpolate({ inputRange: [-10, 10], outputRange: ['-10deg', '10deg'] }) },
        { rotateY: p.motion.rotY.interpolate({ inputRange: [-10, 10], outputRange: ['-10deg', '10deg'] }) },
      ]
    : [];
  return (
    <Animated.View style={{ width: p.width, alignSelf: 'center', transform: lean }}>
    <FoilFrame finish={finish} style={{ width: p.width, alignSelf: 'center' }}>
      <LinearGradient colors={finish === 'matte' ? ['#121316', '#0A0A0B'] : ['#1A150D', '#0B0B0C', '#0E0C09']} style={c.card}>
        <View style={c.head}>
          <Text style={c.brand}>UNDERGROUND</Text>
          <Text style={c.serial}>SUPERCARGO · {serial(p.spotNumber)}</Text>
        </View>

        <View style={[c.mat, { borderColor: finish === 'matte' ? '#3A3B40' : GOLD }]}>
          {p.photoUri && !photoFailed ? (
            <Image
              source={{ uri: p.photoUri }}
              style={{ width: photoW, height: photoH }}
              resizeMode="cover"
              onError={() => setPhotoFailed(true)}
              accessibilityLabel={`Your photo of the ${p.make} ${p.model}, plates and faces blurred`}
            />
          ) : (
            <View style={{ width: photoW, height: photoH, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000' }}>
              {p.catalogId ? <CarArt catalogId={p.catalogId} width={Math.min(photoW, Math.round((photoH * 4) / 3))} /> : null}
              <Text style={c.artNote}>STUDIO RENDER · YOUR PHOTO STAYS PRIVATE</Text>
            </View>
          )}
        </View>

        <View style={c.titleRow}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={c.make}>{p.make.toUpperCase()}</Text>
            <Text style={c.model} numberOfLines={2} adjustsFontSizeToFit>
              {p.model}
            </Text>
          </View>
          <RaritySeal tier={p.tier} />
        </View>

        <View style={c.rule} />
        <View>
          {rows.map(([label, value], i) => (
            <Spec key={label} n={i + 1} label={label} value={value} />
          ))}
        </View>
        <Text style={c.note}>{tierNote(p.tier)}</Text>
      </LinearGradient>
      <FoilFilm finish={finish} reduceMotion={p.reduceMotion} motion={p.motion ?? null} />
    </FoilFrame>
    </Animated.View>
  );
}

/** Primary gold action: brushed-gold gradient, gold glow while pressed. */
export function GoldButton({ title, onPress, disabled }: { title: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={title} disabled={disabled} onPress={onPress}>
      {({ pressed }) => (
        <View style={[pressed && !disabled && { ...goldTouch, backgroundColor: 'transparent', borderWidth: 0 }, disabled && { opacity: 0.45 }]}>
          <LinearGradient colors={['#F1DDAE', '#D0B07A', '#A9864C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={b.gold}>
            <Text style={b.goldText}>{title}</Text>
          </LinearGradient>
        </View>
      )}
    </Pressable>
  );
}

/** Secondary action: hairline gold outline. */
export function LineButton({ title, onPress, disabled, children }: { title: string; onPress: () => void; disabled?: boolean; children?: ReactNode }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={title} disabled={disabled} onPress={onPress} style={({ pressed }) => [b.line, pressed && goldTouch, disabled && { opacity: 0.45 }]}>
      {children}
      <Text style={b.lineText}>{title}</Text>
    </Pressable>
  );
}

const seal = StyleSheet.create({
  outer: { borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0B0B0C' },
  glow: { shadowColor: '#E6B755', shadowOpacity: 0.55, shadowRadius: 10, shadowOffset: { width: 0, height: 0 } },
  inner: { borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  letter: { fontFamily: 'Cinzel_600SemiBold', marginTop: -2 },
  ticks: { flexDirection: 'row', gap: 2, marginTop: 1 },
  tick: { width: 2, height: 5 },
  label: { fontFamily: 'DMSans_600SemiBold', fontSize: 10, letterSpacing: 2.4 },
});

const c = StyleSheet.create({
  card: { padding: 18, gap: 14 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brand: { fontFamily: 'Cinzel_600SemiBold', fontSize: 13, letterSpacing: 4.5, color: BRIGHT },
  serial: { fontFamily: 'DMSans_500Medium', fontSize: 10, letterSpacing: 2, color: '#8F8F92' },
  mat: { borderWidth: 1, padding: 2, backgroundColor: '#000', alignSelf: 'center' },
  artNote: { position: 'absolute', bottom: 8, fontFamily: 'DMSans_500Medium', fontSize: 9, letterSpacing: 1.8, color: '#6E6E72' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  make: { fontFamily: 'DMSans_600SemiBold', fontSize: 12, letterSpacing: 3.5, color: GOLD },
  model: { fontFamily: 'BarlowCondensed_700Bold', fontSize: 40, lineHeight: 44, color: '#F4F2ED' },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: GOLD, opacity: 0.6 },
  spec: { flexDirection: 'row', alignItems: 'baseline', paddingVertical: 7, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#2A2B30', gap: 10 },
  specN: { fontFamily: 'BarlowCondensed_600SemiBold', fontSize: 13, color: '#8F7A52', width: 18 },
  specLabel: { fontFamily: 'DMSans_500Medium', fontSize: 10, letterSpacing: 1.8, color: '#8F8F92', width: 86 },
  specValue: { flex: 1, fontFamily: 'DMSans_500Medium', fontSize: 15, color: '#F4F2ED', textAlign: 'right' },
  note: { fontFamily: 'DMSans_400Regular', fontSize: 12, color: '#8F8F92', textAlign: 'center', letterSpacing: 0.4 },
});

const b = StyleSheet.create({
  gold: { paddingVertical: 17, alignItems: 'center' },
  goldText: { fontFamily: 'DMSans_600SemiBold', fontSize: 15, letterSpacing: 4, color: '#0A0A0B' },
  line: { paddingVertical: 15, alignItems: 'center', borderWidth: 1, borderColor: '#8F7A52', flexDirection: 'row', justifyContent: 'center', gap: 8 },
  lineText: { fontFamily: 'DMSans_600SemiBold', fontSize: 14, letterSpacing: 3, color: BRIGHT },
});
