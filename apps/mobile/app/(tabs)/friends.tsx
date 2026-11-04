import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import {
  applyClubInvitationAction,
  applyFriendshipAccept,
  applyFriendshipReject,
  listDirectoryMembers,
  type ClubInvitation,
  type Friendship,
} from '@underground/domain';
import { GoldRule, Screen, Text } from '@underground/ui';
import {
  clubFixture,
  directoryFixtures,
  ownerMembership,
  pendingClubInvite,
  pendingFriendship,
} from '../../src/data/clubs';
import { shell } from '../../src/theme/shell';

/**
 * Friends + clubs stubs wired to typed domain contracts / fixtures.
 * Persistence waits on Supabase credentials.
 */
export default function FriendsScreen() {
  const [friendship, setFriendship] = useState<Friendship>(pendingFriendship);
  const [invite, setInvite] = useState<ClubInvitation>(pendingClubInvite);
  const [market, setMarket] = useState<'california' | 'miami'>('california');

  const directory = useMemo(
    () => listDirectoryMembers(directoryFixtures, market),
    [market],
  );

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="title" gold>
          Friends
        </Text>
        <Text variant="caption" style={styles.meta}>
          REQUEST · ACCEPT · REJECT · CLUBS · DIRECTORY OPT-IN
        </Text>
        <GoldRule />

        <Text variant="caption" gold>
          FRIENDSHIP
        </Text>
        <View style={styles.row}>
          <Text>Inbound · {friendship.status.toUpperCase()}</Text>
          <View style={styles.actions}>
            <Pressable
              onPress={() => {
                const r = applyFriendshipAccept(
                  friendship,
                  friendship.addresseeId,
                  new Date().toISOString(),
                );
                if (r.ok) setFriendship(r.friendship);
              }}
            >
              <Text variant="caption" gold>
                ACCEPT
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                const r = applyFriendshipReject(
                  friendship,
                  friendship.addresseeId,
                  new Date().toISOString(),
                );
                if (r.ok) setFriendship(r.friendship);
              }}
            >
              <Text variant="caption" gold>
                REJECT
              </Text>
            </Pressable>
          </View>
        </View>

        <Text variant="caption" gold style={styles.section}>
          CLUB · {clubFixture.name.toUpperCase()}
        </Text>
        <Text style={styles.body}>
          {clubFixture.foundingMarket} · owner role {ownerMembership.role} · scoring uses club
          track (independent of solo)
        </Text>
        <View style={styles.row}>
          <Text>Invite · {invite.status.toUpperCase()}</Text>
          <View style={styles.actions}>
            <Pressable
              onPress={() => {
                const r = applyClubInvitationAction(
                  invite,
                  invite.inviteeId,
                  'accept',
                  new Date().toISOString(),
                );
                if (r.ok) setInvite(r.invitation);
              }}
            >
              <Text variant="caption" gold>
                ACCEPT
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                const r = applyClubInvitationAction(
                  invite,
                  invite.inviteeId,
                  'reject',
                  new Date().toISOString(),
                );
                if (r.ok) setInvite(r.invitation);
              }}
            >
              <Text variant="caption" gold>
                REJECT
              </Text>
            </Pressable>
          </View>
        </View>

        <Text variant="caption" gold style={styles.section}>
          LOCAL DIRECTORY
        </Text>
        <View style={styles.actions}>
          <Pressable onPress={() => setMarket('california')} style={styles.chip}>
            <Text variant="caption" gold={market === 'california'}>
              CA
            </Text>
          </Pressable>
          <Pressable onPress={() => setMarket('miami')} style={styles.chip}>
            <Text variant="caption" gold={market === 'miami'}>
              MIAMI
            </Text>
          </Pressable>
        </View>
        {directory.length === 0 ? (
          <Text style={styles.body}>No opted-in members in this market.</Text>
        ) : (
          directory.map((entry) => (
            <Text key={entry.memberId} style={styles.body}>
              {entry.visibleDisplayName}
            </Text>
          ))
        )}
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
  body: {
    marginTop: 8,
    color: shell.muted,
  },
  section: {
    marginTop: 28,
    marginBottom: 8,
  },
  row: {
    marginTop: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(197,165,114,0.2)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(197,165,114,0.35)',
  },
});
