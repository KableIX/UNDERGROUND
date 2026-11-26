import { useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { usePhotoSize } from '../components/usePhotoSize';
import { whole, type Frame } from './page';

export function ProfilePhoto({ uri, frame = whole, ratio, label, radius = 0 }: {
  uri: string; frame?: Frame; ratio?: number; label: string; radius?: number;
}) {
  const size = usePhotoSize(uri);
  const [width, setWidth] = useState(0);
  const sourceRatio = size ? size.width / size.height : undefined;
  const aspect = ratio ?? (frame.mode === 'whole' ? sourceRatio ?? 1.5 : 1.5);
  const height = width / aspect;
  const measured = width > 0 && !!sourceRatio;
  const scaleTo = frame.mode === 'fill' ? Math.max : Math.min;
  const w = measured ? scaleTo(width, height * sourceRatio!) : width;
  const h = measured ? w / sourceRatio! : height;
  return <View onLayout={e => setWidth(e.nativeEvent.layout.width)} style={{
    width: '100%', aspectRatio: aspect, overflow: 'hidden', borderRadius: radius, backgroundColor: '#17191d',
  }}>
    <Image key={uri} source={{ uri }} accessibilityLabel={label}
      resizeMode={measured ? 'stretch' : 'contain'} style={{ position: 'absolute',
        width: w || '100%', height: h || '100%', left: (width - w) * frame.x, top: (height - h) * frame.y }} />
  </View>;
}

export function FrameControls({ frame, change, fixed = false }: { frame: Frame; change: (f: Frame) => void; fixed?: boolean }) {
  const button = (label: string, selected: boolean, press: () => void) =>
    <Pressable key={label} accessibilityRole="button" accessibilityState={{ selected }} onPress={press}
      style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 9 }}>
      <Text style={{ color: selected ? '#E1BC82' : '#D1D3D7', fontWeight: selected ? '700' : '400' }}>{label}</Text>
    </Pressable>;
  return <View>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
      {button('Show whole photo', frame.mode === 'whole', () => change({ ...frame, mode: 'whole' }))}
      {button('Fill frame', frame.mode === 'fill', () => change({ ...frame, mode: 'fill' }))}
    </View>
    {(frame.mode === 'fill' || fixed) && <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
      {(['Left', 'Right', 'Up', 'Down'] as const).map((label, i) => {
        const key = i < 2 ? 'x' : 'y';
        return button(label, false, () => change({ ...frame, [key]: Math.max(0, Math.min(1, frame[key] + (i % 2 ? 0.1 : -0.1))) }));
      })}
      {button('Center', frame.x === 0.5 && frame.y === 0.5, () => change({ ...frame, x: 0.5, y: 0.5 }))}
    </View>}
  </View>;
}
