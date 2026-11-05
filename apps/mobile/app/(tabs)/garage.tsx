import { ScrollView, StyleSheet, View } from 'react-native';
import { GoldRule, Screen, Text } from '@underground/ui';
import { VehicleViewerStub } from '../../src/components/VehicleViewerStub';
import { founderGarageSeed } from '../../src/data/founder-garage';
import { shell } from '../../src/theme/shell';

export default function GarageScreen() {
  const { vehicle, mods, media, profile } = founderGarageSeed;
  const installed = mods.filter((m) => m.status === 'installed');
  const pending = mods.filter((m) => m.status === 'pending');

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="caption" gold>
          MEMBER #{founderGarageSeed.memberNumber}
        </Text>
        <Text variant="brand" gold style={styles.owner}>
          {founderGarageSeed.displayName}
        </Text>
        <Text variant="caption" style={styles.meta}>
          FOUNDER ≠ ADMIN · GARAGE {vehicle.visibility.toUpperCase()} ·{' '}
          {vehicle.verificationStatus.toUpperCase()}
        </Text>
        <GoldRule />

        <View style={styles.heroBlock}>
          <Text variant="caption" gold>
            PRIMARY VEHICLE
          </Text>
          <Text variant="title" style={styles.car}>
            {vehicle.year} {vehicle.make} {vehicle.model}
          </Text>
          <Text style={styles.body}>{vehicle.trim}</Text>
        </View>

        <View style={styles.specGrid}>
          <Spec label="COLOR" value={vehicle.color} />
          <Spec label="TRANS" value={vehicle.transmission} />
          <Spec label="WHEELS" value={vehicle.wheels} />
          <Spec label="BRAKES" value={vehicle.brakes} />
        </View>

        <Text variant="caption" gold style={styles.section}>
          INSTALLED MODS ({installed.length})
        </Text>
        {installed.map((mod) => (
          <View key={mod.title} style={styles.modRow}>
            <View style={styles.modCopy}>
              <Text>{mod.title}</Text>
              <Text style={styles.body}>{mod.description}</Text>
            </View>
            <Text variant="caption" gold>
              INSTALLED
            </Text>
          </View>
        ))}

        <Text variant="caption" gold style={styles.section}>
          PENDING MODS ({pending.length})
        </Text>
        {pending.map((mod) => (
          <View key={mod.title} style={styles.modRow}>
            <View style={styles.modCopy}>
              <Text>{mod.title}</Text>
              <Text style={styles.body}>{mod.description}</Text>
            </View>
            <Text variant="caption" gold>
              PENDING
            </Text>
          </View>
        ))}

        <Text variant="caption" gold style={styles.section}>
          MEDIA GALLERY
        </Text>
        <Text style={styles.body}>{profile.mediaNote}</Text>
        <View style={styles.gallery}>
          {media.map((item) => (
            <View key={item.storagePath} style={styles.mediaCard}>
              <View style={styles.mediaPlate}>
                <Text variant="caption" gold>
                  PLACEHOLDER ASSET
                </Text>
              </View>
              <Text variant="caption" style={styles.meta}>
                {item.caption}
              </Text>
              <Text variant="caption" style={styles.path}>
                {item.storagePath}
              </Text>
            </View>
          ))}
        </View>

        <VehicleViewerStub label={`${vehicle.year} ${vehicle.make} ${vehicle.model} V10`} />
      </ScrollView>
    </Screen>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.spec}>
      <Text variant="caption" gold>
        {label}
      </Text>
      <Text style={styles.specValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 40,
  },
  owner: {
    marginTop: 6,
  },
  meta: {
    marginTop: 6,
    color: shell.muted,
  },
  heroBlock: {
    marginTop: 8,
  },
  car: {
    marginTop: 8,
  },
  body: {
    marginTop: 6,
    color: shell.muted,
  },
  specGrid: {
    marginTop: 20,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  spec: {
    width: '47%',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(197,165,114,0.2)',
  },
  specValue: {
    marginTop: 6,
    color: shell.text,
    textTransform: 'capitalize',
  },
  section: {
    marginTop: 28,
    marginBottom: 10,
  },
  modRow: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(197,165,114,0.2)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  modCopy: {
    flex: 1,
  },
  gallery: {
    marginTop: 12,
    gap: 12,
  },
  mediaCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(197,165,114,0.3)',
    padding: 12,
    gap: 8,
  },
  mediaPlate: {
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: shell.tabBar,
  },
  path: {
    color: shell.muted,
  },
});
