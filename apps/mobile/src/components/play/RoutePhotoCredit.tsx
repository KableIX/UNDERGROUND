import { Linking, Pressable } from 'react-native';
import { Text } from '@underground/ui';
import type { CuratedRun } from '../../data/curated-runs';

export function RoutePhotoCredit({ photo }: { photo?: CuratedRun['photo'] }) {
  if (!photo) return null;
  if (!photo.source) return <Text variant="caption">{photo.caption} Supplied for the UNDERGROUND beta.</Text>;
  return <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(photo.source)}>
    <Text variant="caption">{photo.caption} Photo by {photo.author} · {photo.license} · cropped. View source.</Text>
  </Pressable>;
}
