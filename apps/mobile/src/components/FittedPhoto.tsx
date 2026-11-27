import { usePhotoSize } from './usePhotoSize';
import { Image, StyleSheet, useWindowDimensions, View, type ImageProps } from 'react-native';

type Props = Pick<ImageProps, 'source' | 'accessibilityLabel' | 'onError'> & {
  width?: number | `${number}%`;
  radius?: number;
};

export function FittedPhoto({ source, accessibilityLabel, onError, width, radius = 0 }: Props) {
  const { scale } = useWindowDimensions();
  const asset = source ? Image.resolveAssetSource?.(source) : undefined;
  const uri = asset?.uri ?? (source && typeof source === 'object' && 'uri' in source ? source.uri : undefined);
  const hasSize = !!(asset && asset.width > 0 && asset.height > 0);
  const measured = usePhotoSize(hasSize ? undefined : uri);
  const size = hasSize ? asset : measured;
  const maxWidth = size && size.width * (size === asset ? (asset?.scale || 1) : 1) / scale;
  return (
    <View style={{
      alignSelf: 'center', width: width ?? '100%', maxWidth,
      aspectRatio: size ? size.width / size.height : 16 / 9,
      overflow: 'hidden', borderRadius: radius,
    }}>
      <Image key={uri} source={source} resizeMode="contain" accessible={!!accessibilityLabel}
        accessibilityLabel={accessibilityLabel} onError={onError} style={styles.image} />
    </View>
  );
}

const styles = StyleSheet.create({
  image: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
});
