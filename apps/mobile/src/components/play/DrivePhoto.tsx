import type { ImageSourcePropType } from 'react-native';
import { FittedPhoto } from '../FittedPhoto';

export function DrivePhoto({ source, label, thumbnail = false }: {
  source: ImageSourcePropType;
  label?: string;
  thumbnail?: boolean;
}) {
  return <FittedPhoto source={source} accessibilityLabel={label}
    width={thumbnail ? 72 : undefined} radius={thumbnail ? 4 : 0} />;
}
