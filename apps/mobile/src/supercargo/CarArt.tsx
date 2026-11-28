import { Image, StyleSheet, View } from 'react-native';
import { carArtSource } from './art';

/**
 * Studio render of a catalog car for the right side of a Ledger card. Unspotted
 * cars get the silhouette. Renders an empty frame if the id has no art yet.
 */
export function CarArt({ catalogId, spotted = true, width = 132 }: { catalogId: string; spotted?: boolean; width?: number }) {
  const source = carArtSource(catalogId, spotted);
  const height = Math.round((width * 3) / 4);
  return (
    <View style={[s.frame, { width, height }]}>
      {source ? (
        <Image
          source={source}
          style={{ width, height }}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
          accessible={false}
        />
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  frame: { backgroundColor: '#000000', overflow: 'hidden' },
});
