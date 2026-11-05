import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { NewswireStory, SimNewswireStory } from '@underground/domain';
import { GoldRule, Screen, Text } from '@underground/ui';
import { NewswireCard } from '../src/components/feed/NewswireCard';
import { UndergroundMark } from '../src/components/brand/UndergroundMark';
import { feedFixtureCards, type FeedCardModel } from '../src/data/feed-v2';
import {
  listNewswireFeed,
  subscribeSimNewswire,
} from '../src/lib/sim-workflow';
import { useSession } from '../src/session/SessionContext';
import { shell } from '../src/theme/shell';

function simToCard(story: SimNewswireStory, displayName: string): FeedCardModel {
  return {
    id: story.id,
    kind: 'capture',
    provenance: 'sim',
    badge: 'SIM · NOT PRODUCTION',
    actorName: displayName,
    headline: story.headline,
    body: story.body,
    territoryLabel: story.territoryName,
    cloutDelta: 0,
    createdAt: story.createdAt,
    imageLabel: 'SIM ROUTE REPLAY',
  };
}

function fixtureCaptureToCard(story: NewswireStory, displayName: string): FeedCardModel {
  return {
    id: story.id,
    kind: 'capture',
    provenance: 'fixture',
    badge: 'FIXTURE SAMPLE · NOT LIVE VERIFIED',
    actorName: displayName,
    headline: story.headline,
    body: `${story.body} Marked fixture for UI — not a live verified production event in this build.`,
    territoryLabel: story.territoryName,
    cloutDelta: story.cloutDelta,
    createdAt: story.createdAt,
    imageLabel: 'FIXTURE MAP PLATE',
  };
}

/**
 * Newswire v2 — visual feed cards with explicit SIM / FIXTURE provenance.
 */
export default function NewswireScreen() {
  const router = useRouter();
  const { state, signOut } = useSession();
  const [sim, setSim] = useState<SimNewswireStory[]>([]);
  const [fixtures, setFixtures] = useState<NewswireStory[]>([]);

  useEffect(() => {
    const refresh = () => {
      const feed = listNewswireFeed();
      setSim(feed.sim);
      setFixtures(feed.productionFixtures);
    };
    refresh();
    return subscribeSimNewswire(refresh);
  }, []);

  const cards = useMemo(() => {
    const simCards = sim.map((s) =>
      simToCard(s, state.status === 'authenticated' ? state.member.displayName : 'MEMBER'),
    );
    const captureFixtures = fixtures.map((s) =>
      fixtureCaptureToCard(s, s.memberId.endsWith('01') ? 'STARK' : 'PACIFIC'),
    );
    return [...simCards, ...feedFixtureCards, ...captureFixtures].sort((a, b) =>
      a.createdAt < b.createdAt ? 1 : -1,
    );
  }, [sim, fixtures, state]);

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.content} accessibilityLabel="Newswire feed">
        <View style={styles.header}>
          <UndergroundMark size="compact" showWordmark={false} />
          <View style={styles.headerCopy}>
            <Text variant="brand" gold>
              UNDERGROUND
            </Text>
            <Text variant="caption" style={styles.tagline}>
              OWNERSHIP IS THE ENTRY.
            </Text>
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
        <Text variant="title">Newswire</Text>
        <Text style={styles.body}>
          Captures, garage moments, and club notes. Simulated and fixture cards are labeled — never
          presented as live verified production.
        </Text>

        {cards.map((card) => (
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

