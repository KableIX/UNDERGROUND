import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';

import { GoldRule, Screen, Text } from '@underground/ui';
import { NewswireCard } from '../src/components/feed/NewswireCard';
import { UndergroundMark } from '../src/components/brand/UndergroundMark';
import type { FeedCardModel } from '../src/data/feed-v2';
import { EditorialFeed } from '../src/components/feed/EditorialFeed';
import { publicEnv } from '../src/lib/env';
import { LocalEventFeed } from '../src/components/feed/LocalEventFeed';
import { useSession } from '../src/session/SessionContext';
import { getMobileSupabaseClient, isLiveAuthConfigured } from '../src/session/supabase-session';
import { shell } from '../src/theme/shell';

export default function NewswireScreen() {
  const router = useRouter();
  const { state, signOut } = useSession();
  const live = isLiveAuthConfigured();
  const [verified, setVerified] = useState<FeedCardModel[]>([]);
  const [feedStatus, setFeedStatus] = useState('');
  useFocusEffect(
    useCallback(() => {
      let active = true;
      if (!live) return;
      async function load() {
        setFeedStatus('Loading club news…');
        const db = getMobileSupabaseClient();
        if (!db) throw Error();
        const { data, error } = await db
          .from('newswire_stories')
          .select('id,headline,body,territory_name,clout_delta,created_at,members(display_name)')
          .order('created_at', { ascending: false })
          .limit(75);
        if (error) throw error;
        if (active) {
          setVerified(
            (data ?? []).map((row) => ({
              id: row.id,
              kind: 'capture',
              provenance: 'live',
              badge: 'Verified run',
              actorName:
                (Array.isArray(row.members) ? row.members[0] : row.members)?.display_name ??
                'Member',
              headline: row.headline,
              body: row.body,
              territoryLabel: row.territory_name,
              cloutDelta: row.clout_delta,
              createdAt: row.created_at,
              imageLabel: row.territory_name,
            })),
          );
          setFeedStatus(data?.length ? '' : 'No verified runs published yet.');
        }
      }
      void load().catch(() => {
        if (active) {
          setVerified([]);
          setFeedStatus('Club news is unavailable.');
        }
      });
      return () => {
        active = false;
      };
    }, [live]),
  );
  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.content} accessibilityLabel="Newswire feed">
        <View style={styles.header}>
          <UndergroundMark size="compact" showWordmark={false} />
          <View style={styles.headerCopy}>
            <Text variant="title">Newswire</Text>
          </View>
          <Pressable
            onPress={() => router.push('/(tabs)/profile')}
            accessibilityRole="button"
            accessibilityLabel="Open profile and account"
            style={styles.account}
          >
            <Text variant="caption" gold>
              ACCOUNT
            </Text>
          </Pressable>
        </View>
        <GoldRule />
        {live && publicEnv.APP_ENV !== 'production' && state.status === 'authenticated' && <EditorialFeed />}
        <LocalEventFeed embedded />
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/local-events')}
          style={{ minHeight: 48, justifyContent: 'center' }}
        >
          <Text gold>View all local events</Text>
        </Pressable>
        {!!feedStatus && <Text style={styles.body}>{feedStatus}</Text>}
        {verified.map((card) => (
          <NewswireCard key={card.id} card={card} />
        ))}

        {state.status === 'authenticated' ? (
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
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 48,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerCopy: {
    flex: 1,
  },
  account: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  tagline: {
    marginTop: 4,
    color: shell.muted,
  },
  body: {
    marginTop: 8,
    color: shell.muted,
    lineHeight: 21,
  },
  meta: {
    color: shell.muted,
  },
  signOut: {
    marginTop: 32,
    alignItems: 'center',
    paddingVertical: 12,
  },
});
