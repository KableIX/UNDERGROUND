import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { GarageMediaUploadPlan } from '@underground/domain';
import { GoldRule, Screen, Text } from '@underground/ui';
import { GaragePhotoUpload } from '../../src/components/GaragePhotoUpload';
import { VehicleViewerStub } from '../../src/components/VehicleViewerStub';
import { founderGarageSeed } from '../../src/data/founder-garage';
import { shell } from '../../src/theme/shell';

const FOUNDER_MEMBER_ID = '33333333-3333-4333-8333-333333333301';
const FOUNDER_VEHICLE_ID = '44444444-4444-4444-8444-444444444401';

/**
 * Immersive Founder's Garage — 2010 black Audi R8 V10 from seed only.
 * Does not invent installed mods or verified achievements.
 */
export default function GarageScreen() {
  const router = useRouter();
  const { vehicle, mods, media, profile, displayName, memberNumber } = founderGarageSeed;
  const installed = mods.filter((m) => m.status === 'installed');
  const pending = mods.filter((m) => m.status === 'pending');
  const [plannedUploads, setPlannedUploads] = useState<GarageMediaUploadPlan[]>([]);

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.content} accessibilityLabel="Founder garage">
        <View style={styles.heroPlate}>
          <Text variant="caption" gold>
            PLACEHOLDER PHOTOGRAPHY
          </Text>
          <Text variant="title" style={styles.heroTitle}>
            {vehicle.year} {vehicle.make} {vehicle.model}
          </Text>
          <Text style={styles.heroSub}>{vehicle.trim} · {vehicle.color}</Text>
        </View>

        <View style={styles.pad}>
          <Text variant="caption" gold>
            MEMBER #{memberNumber} · {displayName}
          </Text>
          <Text variant="caption" style={styles.meta}>
            VISIBILITY {vehicle.visibility.toUpperCase()} · {vehicle.verificationStatus.toUpperCase()} ·
            FOUNDER ≠ ADMIN
          </Text>
          <GoldRule />

          <Text style={styles.body}>{profile.mediaNote}</Text>

          <View style={styles.specGrid}>
            <Spec label="COLOR" value={vehicle.color} />
            <Spec label="TRANS" value={vehicle.transmission} />
            <Spec label="WHEELS" value={vehicle.wheels} />
            <Spec label="BRAKES" value={vehicle.brakes} />
          </View>

          <Text variant="caption" gold style={styles.section}>
            MOD JOURNAL · INSTALLED ({installed.length})
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
            PENDING ({pending.length})
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
            GALLERY
          </Text>
          <GaragePhotoUpload
            vehicleId={FOUNDER_VEHICLE_ID}
            memberId={FOUNDER_MEMBER_ID}
            onPlanned={(plan) => setPlannedUploads((prev) => [plan, ...prev])}
          />
          <View style={styles.gallery}>
            {plannedUploads.map((plan) => (
              <View key={`${plan.mode}:${plan.storagePath}`} style={styles.mediaCard}>
                <View style={styles.mediaPlate}>
                  <Text variant="caption" gold>
                    {plan.mode === 'placeholder' ? 'UPLOAD PLACEHOLDER' : 'SIGNED UPLOAD'}
                  </Text>
                </View>
                <Text variant="caption" style={styles.meta}>
                  {plan.bucket} · {plan.mode}
                </Text>
              </View>
            ))}
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
              </View>
            ))}
          </View>

          <Text variant="caption" gold style={styles.section}>
            CUSTOMIZATION PREVIEW
          </Text>
          <Text style={styles.body}>
            Feature-preview destination for friend-gated viewers. Entitlement grants view access only —
            not admin or ranking privilege.
          </Text>
          <VehicleViewerStub label={`${vehicle.year} ${vehicle.make} ${vehicle.model} V10`} />

          <Text variant="caption" gold style={styles.section}>
            TROPHIES / RUN HISTORY
          </Text>
          <Text style={styles.body}>
            Empty — no invented verified trophies. Production run history appears after accepted
            captures persist.
          </Text>
          <Text variant="caption" style={styles.meta}>
            VISIT STATS · 0 (fixture until persistence)
          </Text>

          <Pressable
            style={styles.link}
            onPress={() => router.push('/(tabs)/profile')}
            accessibilityRole="button"
          >
            <Text variant="caption" gold>
              VIEW PROFILE
            </Text>
          </Pressable>
        </View>
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
    paddingBottom: 48,
  },
  heroPlate: {
    height: 220,
    backgroundColor: shell.tabBar,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  heroTitle: {
    textAlign: 'center',
  },
  heroSub: {
    color: shell.muted,
    textTransform: 'capitalize',
  },
  pad: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  meta: {
    marginTop: 6,
    color: shell.muted,
  },
  body: {
    marginTop: 6,
    color: shell.muted,
    lineHeight: 21,
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
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: shell.tabBar,
  },
  link: {
    marginTop: 28,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: shell.accent,
  },
});
