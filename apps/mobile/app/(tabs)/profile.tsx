import { StyleSheet, View } from 'react-native';
import { FOUNDER_DISPLAY_NAME, FOUNDER_MEMBER_NUMBER } from '@underground/domain';
import { GoldRule, Screen, Text } from '@underground/ui';
import { shell } from '../../src/theme/shell';

const TOP_EIGHT_SLOTS = Array.from({ length: 8 }, (_, i) => i);

export default function ProfileScreen() {
  return (
    <Screen>
      <Text variant="brand" gold>
        {FOUNDER_DISPLAY_NAME}
      </Text>
      <Text variant="caption" style={styles.meta}>
        MEMBER #{FOUNDER_MEMBER_NUMBER} · FOUNDER ≠ ADMIN
      </Text>
      <GoldRule />
      <Text style={styles.body}>
        Audited provisioning binds auth user → member {FOUNDER_MEMBER_NUMBER}. Persist via
        supabase/seed/founder_000001.sql when Supabase credentials exist. Feature-preview
        entitlement does not grant admin role.
      </Text>
      <View style={styles.row}>
        <Stat label="FRIENDS" value="0" />
        <Stat label="FOLLOWERS" value="0" />
        <Stat label="TOP 8" value="0/8" />
      </View>
      <Text variant="caption" gold style={styles.section}>
        TOP 8
      </Text>
      <View style={styles.topEight}>
        {TOP_EIGHT_SLOTS.map((slot) => (
          <View key={slot} style={styles.slot}>
            <Text variant="caption" style={styles.slotLabel}>
              {slot + 1}
            </Text>
          </View>
        ))}
      </View>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text variant="caption" gold>
        {label}
      </Text>
      <Text variant="title">{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  meta: {
    marginTop: 8,
    color: shell.muted,
  },
  body: {
    color: shell.muted,
  },
  row: {
    marginTop: 32,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stat: {
    gap: 6,
  },
  section: {
    marginTop: 28,
    marginBottom: 12,
  },
  topEight: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  slot: {
    width: 64,
    height: 64,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(197,165,114,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotLabel: {
    color: shell.muted,
  },
});
