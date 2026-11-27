import {
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  View,
  type ImageSourcePropType,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Text } from '@underground/ui';
import { DrivePhoto } from './DrivePhoto';
import type { CuratedRun } from '../../data/curated-runs';

export type BookArt = { cover?: ImageSourcePropType; photo?: CuratedRun['photo'] };

function showCredit(photo: NonNullable<CuratedRun['photo']>) {
  const credit = photo.source
    ? [photo.caption, [photo.author, photo.license].filter(Boolean).join(' · ')]
        .filter(Boolean)
        .join('\n\n')
    : photo.caption + '\n\nSupplied for the UNDERGROUND beta.';
  Alert.alert('Cover photograph', credit, [
    ...(photo.source
      ? [
          {
            text: 'View source',
            onPress: () => {
              void Linking.openURL(photo.source).catch(() =>
                Alert.alert('Could not open the photo source'),
              );
            },
          },
        ]
      : []),
    { text: 'Close', style: 'cancel' },
  ]);
}

type Props = {
  title: string;
  detail?: string;
  art: BookArt;
  variant: 'state' | 'region' | 'header' | 'club';
  onPress?: () => void;
  selected?: boolean;
};

export function BookCover({ title, detail, art, variant, onPress, selected }: Props) {
  const state = variant === 'state';
  const header = variant === 'header';
  const label = (
    <View style={s.caption}>
      <Text
        accessibilityRole={header ? 'header' : undefined}
        style={[s.title, state && s.stateTitle, header && s.headerTitle]}
      >
        {title}
      </Text>
      {!!detail && <Text style={s.detail}>{detail}</Text>}
    </View>
  );
  const contents = (
    <>
      {art.cover && <DrivePhoto source={art.cover} />}
      {label}
    </>
  );
  return (
    <View style={[s.card, state && s.book, selected && s.selected]}>
      {onPress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={[title, detail].filter(Boolean).join(', ')}
          accessibilityState={state ? { selected } : undefined}
          onPress={onPress}
        >
          {contents}
        </Pressable>
      ) : (
        contents
      )}
      {(header || (state && selected)) && art.photo && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={'Photo credit for ' + title}
          onPress={() => showCredit(art.photo!)}
          style={s.creditHit}
        >
          <View style={s.credit}>
            <MaterialCommunityIcons name="information-outline" color="#fff" size={17} />
          </View>
        </Pressable>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: '#353B3A',
    borderRadius: 9,
    overflow: 'hidden',
    backgroundColor: '#141819',
  },
  book: { flex: 1, minWidth: 0 },
  selected: { borderColor: '#E6BF79' },
  caption: { paddingHorizontal: 11, paddingVertical: 9, gap: 2 },
  title: { fontFamily: 'BarlowCondensed_700Bold', color: '#FAF9F5', fontSize: 28, lineHeight: 32 },
  stateTitle: { fontSize: 25, lineHeight: 28 },
  headerTitle: { fontSize: 34, lineHeight: 38 },
  detail: { fontFamily: 'Inter_500Medium', color: '#DECCAA', fontSize: 12, lineHeight: 17 },
  creditHit: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  credit: { backgroundColor: 'rgba(8,13,15,0.78)', borderRadius: 16, padding: 4 },
});
