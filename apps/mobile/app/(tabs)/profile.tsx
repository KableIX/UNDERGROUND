import { StyleSheet, View } from 'react-native';
import { FOUNDER_DISPLAY_NAME, FOUNDER_MEMBER_NUMBER } from '@underground/domain';
import { GoldRule, Screen, Text } from '@underground/ui';
import { shell } from '../../src/theme/shell';

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
        Profile fields, Top 8, and audited provisioning bind in Milestone B once Supabase
        credentials exist.
      </Text>
      <View style={styles.row}>
        <Stat label="FRIENDS" value="—" />
        <Stat label="FOLLOWERS" value="—" />
        <Stat label="TOP 8" value="0/8" />
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
});
