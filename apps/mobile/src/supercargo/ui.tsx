import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export function Action({ title, onPress, primary, disabled }: { title: string; onPress: () => void; primary?: boolean; disabled?: boolean }) {
  return (
    <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[ui.button, primary && ui.primary, disabled && { opacity: 0.45 }]}>
      <Text style={[ui.action, primary && { color: '#08090A' }]}>{title}</Text>
    </Pressable>
  );
}

export function Entry({ title, detail, onPress }: { title: string; detail: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={ui.entry}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={ui.entryTitle}>{title}</Text>
        <Text style={ui.body}>{detail}</Text>
      </View>
      <Text style={ui.chevron}>›</Text>
    </Pressable>
  );
}

export function Rule() {
  return <View style={{ height: 1, backgroundColor: '#C6B08B', opacity: 0.35, width: 48 }} />;
}

export function Caption({ children }: { children: ReactNode }) {
  return <Text style={ui.caption}>{children}</Text>;
}

export const ui = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#08090A' },
  content: { paddingHorizontal: 20, gap: 16 },
  back: { fontFamily: 'DMSans_600SemiBold', fontSize: 13, color: '#C6B08B', paddingVertical: 10 },
  heading: { fontFamily: 'BarlowCondensed_700Bold', fontSize: 44, lineHeight: 52, color: '#F4F2ED' },
  body: { fontFamily: 'DMSans_400Regular', fontSize: 14, lineHeight: 20, color: '#B7B7B8' },
  caption: { fontFamily: 'DMSans_500Medium', fontSize: 11, letterSpacing: 1.6, color: '#8F8F92' },
  notice: { fontFamily: 'DMSans_400Regular', fontSize: 14, color: '#E8E2D6' },
  button: { padding: 14, borderWidth: 1, borderColor: '#47443F', alignItems: 'center' },
  primary: { backgroundColor: '#D0B88F', borderColor: '#D0B88F' },
  action: { fontFamily: 'DMSans_600SemiBold', fontSize: 15, color: '#F4F2ED' },
  entry: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderColor: '#1E1F23' },
  entryTitle: { fontFamily: 'BarlowCondensed_700Bold', fontSize: 24, color: '#F4F2ED' },
  chevron: { fontFamily: 'DMSans_400Regular', fontSize: 24, color: '#5A5B60' },
  card: { backgroundColor: '#111215', borderWidth: 1, borderColor: '#24252A', padding: 14, gap: 8 },
  cardTitle: { fontFamily: 'BarlowCondensed_700Bold', fontSize: 24, lineHeight: 28, color: '#F4F2ED' },
});
