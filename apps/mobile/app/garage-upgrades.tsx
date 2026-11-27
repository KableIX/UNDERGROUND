import { FittedPhoto } from '../src/components/FittedPhoto';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Stack } from 'expo-router';
import { Screen, Text } from '@underground/ui';
import { shell } from '../src/theme/shell';

const upgrades = [
  { title: 'Private Garage Theme', category: 'Environment', credits: 500,
    image: require('../assets/garage/private-garage.jpg'),
    detail: 'A private showroom with dark walls, polished concrete and recessed lighting.' },
  { title: 'Premium Lighting', category: 'Customization', credits: 250,
    image: require('../assets/garage/premium-lighting.jpg'),
    detail: 'Overhead strips and warm accent lights pick out the lines of the car.' },
  { title: 'Rotating Display', category: 'Garage accessory', credits: 750,
    image: require('../assets/garage/rotating-display.jpg'),
    detail: 'A circular turntable designed to show a featured car from every angle.' },
  { title: 'Trophy Showcase', category: 'Profile accessory', credits: 1000,
    image: require('../assets/garage/trophy-showcase.jpg'),
    detail: 'An illuminated display for the trophies a driver earns.' },
] as const;

export default function GarageUpgradeStore() {
  const { width, fontScale } = useWindowDimensions();
  const oneColumn = width < 350 || fontScale > 1.35;
  const [selected, setSelected] = useState<(typeof upgrades)[number] | null>(null);
  return <Screen padded={false}>
    <Stack.Screen options={{ title: 'Garage Upgrade Store', headerShown: true,
      headerTintColor: shell.text, headerStyle: { backgroundColor: shell.tabBar } }} />
    <ScrollView contentContainerStyle={styles.content}>
      <Text variant="caption" gold>PREVIEW · SAMPLE PRICES</Text>
      <View style={styles.grid}>
        {upgrades.map(item => <Pressable key={item.title} accessibilityRole="button"
          accessibilityLabel={`Preview ${item.title}, ${item.credits.toLocaleString('en-US')} credits`}
          style={[styles.card, oneColumn && styles.full]} onPress={() => setSelected(item)}>
          <FittedPhoto source={item.image} radius={10} />
          <Text style={styles.name}>{item.title}</Text>
          <Text style={styles.category}>{item.category}</Text>
          <Text style={styles.price}>{item.credits.toLocaleString('en-US')} credits</Text>
        </Pressable>)}
      </View>
    </ScrollView>
    <Modal visible={!!selected} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelected(null)}>
      {selected && <Screen>
        <ScrollView contentContainerStyle={styles.detail}>
          <Pressable accessibilityRole="button" style={styles.close} onPress={() => setSelected(null)}>
            <Text gold>Close preview</Text>
          </Pressable>
          <FittedPhoto source={selected.image} radius={12} accessibilityLabel={selected.title} />
          <Text variant="caption" gold>{selected.category}</Text>
          <Text accessibilityRole="header" style={styles.detailName}>{selected.title}</Text>
          <Text style={styles.description}>{selected.detail}</Text>
          <Text style={styles.price}>Sample price · {selected.credits.toLocaleString('en-US')} credits</Text>
        </ScrollView>
      </Screen>}
    </Modal>
  </Screen>;
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 16, paddingBottom: 36 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 24 },
  card: { width: '48%', gap: 4 },
  full: { width: '100%' },
  name: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: shell.text, marginTop: 4 },
  category: { color: shell.muted, fontSize: 13 },
  price: { color: shell.accent, fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  detail: { gap: 12, paddingBottom: 40 },
  close: { minHeight: 48, alignSelf: 'flex-end', justifyContent: 'center' },
  detailName: { fontFamily: 'BarlowCondensed_700Bold', fontSize: 32 },
  description: { color: shell.muted, lineHeight: 22 },
});
