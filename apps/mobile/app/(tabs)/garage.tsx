import { ScrollView, StyleSheet, View } from 'react-native';
import { GoldRule, Screen, Text } from '@underground/ui';
import { VehicleViewerStub } from '../../src/components/VehicleViewerStub';
import { founderGarageSeed } from '../../src/data/founder-garage';
import { shell } from '../../src/theme/shell';

export default function GarageScreen() {
  const { vehicle, mods, media } = founderGarageSeed;

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="title" gold>
          Garage
        </Text>
        <Text variant="caption" style={styles.meta}>
          FRIEND-ONLY · {vehicle.verificationStatus.toUpperCase()}
        </Text>
        <GoldRule />
        <Text variant="caption" gold>
          #{founderGarageSeed.memberNumber} {founderGarageSeed.displayName}
        </Text>
        <Text variant="title" style={styles.car}>
          {vehicle.year} {vehicle.make} {vehicle.model}
        </Text>
        <Text style={styles.body}>{vehicle.trim}</Text>
        <Text style={styles.body}>
          {vehicle.color} · {vehicle.transmission} · {vehicle.wheels} · {vehicle.brakes}
        </Text>

        <Text variant="caption" gold style={styles.section}>
          MODS
        </Text>
        {mods.map((mod) => (
          <View key={mod.title} style={styles.modRow}>
            <Text>{mod.title}</Text>
            <Text variant="caption" gold>
              {mod.status.toUpperCase()}
            </Text>
          </View>
        ))}

        <Text variant="caption" gold style={styles.section}>
          MEDIA
        </Text>
        {media.map((item) => (
          <View key={item.storagePath} style={styles.mediaRow}>
            <Text variant="caption" gold>
              PLACEHOLDER
            </Text>
            <Text style={styles.body}>{item.caption}</Text>
          </View>
        ))}

        <VehicleViewerStub label={`${vehicle.year} ${vehicle.make} ${vehicle.model} V10`} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 40,
  },
  meta: {
    marginTop: 6,
    color: shell.muted,
  },
  car: {
    marginTop: 8,
  },
  body: {
    marginTop: 6,
    color: shell.muted,
  },
  section: {
    marginTop: 28,
    marginBottom: 10,
  },
  modRow: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(197,165,114,0.2)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  mediaRow: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(197,165,114,0.2)',
  },
});
