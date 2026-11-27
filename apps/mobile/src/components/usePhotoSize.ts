import { useEffect, useState } from 'react';
import { Image } from 'react-native';

type PhotoSize = { uri: string; width: number; height: number };

// iOS onLoad can report the downsampled display bitmap. Read the source file
// dimensions so laying out an image never makes its next measurement smaller.
export function usePhotoSize(uri?: string) {
  const [size, setSize] = useState<PhotoSize>();
  useEffect(() => {
    if (!uri) return;
    let active = true;
    Image.getSize(uri).then(({ width, height }) => {
      if (active && width > 0 && height > 0) setSize({ uri, width, height });
    }).catch(() => {
      // Keep the caller's fallback ratio if metadata is unavailable.
    });
    return () => { active = false; };
  }, [uri]);
  return size?.uri === uri ? size : undefined;
}
