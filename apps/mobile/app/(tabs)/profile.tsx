import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { FOUNDER_DISPLAY_NAME, FOUNDER_MEMBER_NUMBER } from '@underground/domain';
import { GoldRule, Screen, Text } from '@underground/ui';
import { rankingFixtures } from '../../src/data/rankings';
import { founderGarageSeed } from '../../src/data/founder-garage';
import { useSession } from '../../src/session/SessionContext';
import { isLiveAuthConfigured } from '../../src/session/supabase-session';
import { shell } from '../../src/theme/shell';

const TOP_EIGHT_SLOTS = Array.from({ length: 8 }, (_, i) => i);

/**
 * Founder #000001 STARK premium profile.
 * Founder designation ≠ admin. No invented verified achievements.
 */
export default function ProfileScreen() {
  const router = useRouter();
  const { state, signOut } = useSession();
  const member =
    state.status === 'authenticated'
      ? state.member
      : {
          displayName: FOUNDER_DISPLAY_NAME,
          memberNumber: FOUNDER_MEMBER_NUMBER,
          isFounder: true,
          role: 'member' as const,
        };

  const cloutTotal = isLiveAuthConfigured()
    ? 0 // Awaiting authenticated ledger read; never show fixture CLOUT as real.
    : (rankingFixtures.find((r) => r.memberNumber === member.memberNumber)?.cloutTotal ?? 0);

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.content} accessibilityLabel="Profile">
        <View style={styles.cover}>
          <Text variant="caption" gold>
            COVER · PLACEHOLDER
          </Text>
        </View>
        <View style={styles.avatarRow}>
          <View style={styles.avatar}>
            <Text variant="caption" gold>
              PHOTO
            </Text>
          </View>
          <View style={styles.identity}>
            <Text variant="brand" gold>
              {member.displayName}
            </Text>
            <Text variant="caption" style={styles.meta}>
              MEMBER #{member.memberNumber}
              {member.isFounder ? ' · FOUNDER' : ''}
            </Text>
            <Text variant="caption" style={styles.meta}>
              ROLE {member.role.toUpperCase()} · FOUNDER ≠ ADMIN
            </Text>
          </View>
        </View>
        <GoldRule />
        <Text style={styles.body}>
          {isLiveAuthConfigured()
            ? 'Personal biography will appear after profile persistence is enabled.'
            : founderGarageSeed.profile.bio}
        </Text>

        <View style={styles.row}>
          <Stat label="FRIENDS" value="0" />
          <Stat label="FOLLOWERS" value="0" />
          <Stat label="CLOUT" value={String(cloutTotal)} />
          <Stat label="VISITS" value="0" />
        </View>

        <Text variant="caption" gold style={styles.section}>
          TOP 8
        </Text>
        <Text style={styles.body}>Empty until accepted friends are featured — no invented slots.</Text>
        <View style={styles.topEight}>
          {TOP_EIGHT_SLOTS.map((slot) => (
            <View key={slot} style={styles.slot} accessibilityLabel={`Top 8 empty slot ${slot + 1}`}>
              <Text variant="caption" style={styles.slotLabel}>
                {slot + 1}
              </Text>
            </View>
          ))}
        </View>

        <Text variant="caption" gold style={styles.section}>
          TERRITORY
        </Text>
        <Text style={styles.body}>
          No verified production crowns claimed in this build. SV DEV sim captures never write
          ownership.
        </Text>

        <Text variant="caption" gold style={styles.section}>
          CUSTOMIZABLE SECTIONS
        </Text>
        <Text style={styles.body}>
          Bio, cover, Top 8, and garage feature-preview destinations are editable when persistence
          is connected. Preview entitlements ≠ admin privilege.
        </Text>

        <Pressable
          style={styles.link}
          onPress={() => router.push('/(tabs)/garage')}
          accessibilityRole="button"
        >
          <Text variant="caption" gold>
            OPEN GARAGE
          </Text>
        </Pressable>

        <Pressable
          style={styles.signOut}
          onPress={() => {
            signOut();
            router.replace('/welcome');
          }}
          accessibilityRole="button"
        >
          <Text variant="caption" style={styles.meta}>
            SIGN OUT
          </Text>
        </Pressable>
      </ScrollView>
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
  content: {
    paddingBottom: 48,
  },
  cover: {
    height: 140,
    backgroundColor: shell.tabBar,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarRow: {
    paddingHorizontal: 16,
    marginTop: -28,
    flexDirection: 'row',
    gap: 14,
    alignItems: 'flex-end',
  },
  avatar: {
    width: 72,
    height: 72,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: shell.accent,
    backgroundColor: shell.mapVoid,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identity: {
    flex: 1,
    paddingBottom: 4,
  },
  meta: {
    marginTop: 4,
    color: shell.muted,
  },
  body: {
    marginTop: 8,
    paddingHorizontal: 16,
    color: shell.muted,
    lineHeight: 21,
  },
  row: {
    marginTop: 24,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stat: {
    gap: 6,
  },
  section: {
    marginTop: 28,
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  topEight: {
    paddingHorizontal: 16,
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
  link: {
    marginTop: 28,
    marginHorizontal: 16,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: shell.accent,
  },
  signOut: {
    marginTop: 20,
    alignItems: 'center',
    paddingVertical: 12,
  },
});
