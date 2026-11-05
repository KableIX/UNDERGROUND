import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { NewswireStory, SimNewswireStory } from '@underground/domain';
import { GoldRule, Screen, Text } from '@underground/ui';
import {
  listNewswireFeed,
  subscribeSimNewswire,
} from '../../src/lib/sim-workflow';
import { shell } from '../../src/theme/shell';

/**
 * Newswire feed: live sim_capture_v1 stories + deterministic production fixtures.
 * Sim stories never imply production ownership or CLOUT.
 */
export default function NewswireScreen() {
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

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="brand" gold>
          UNDERGROUND
        </Text>
        <Text variant="caption" style={styles.tagline}>
          OWNERSHIP IS THE ENTRY.
        </Text>
        <GoldRule />
        <Text variant="title">Newswire</Text>
        <Text style={styles.body}>
          Live SIM captures from SV DEV appear below. Production fixtures use
          `capture_accepted_v1` only — no fabricated achievements.
        </Text>

        <Text variant="caption" gold style={styles.section}>
          SIM CAPTURES ({sim.length})
        </Text>
        {sim.length === 0 ? (
          <Text style={styles.body}>
            No sim stories yet — run SIM CAPTURE → NEWSWIRE on the Conquest tab (SV DEV).
          </Text>
        ) : (
          sim.map((story) => (
            <View key={story.id} style={styles.story}>
              <Text variant="caption" gold>
                {story.templateId.toUpperCase()} · CLOUT +{story.cloutDelta} · NO OWNERSHIP
              </Text>
              <Text variant="title" style={styles.headline}>
                {story.headline}
              </Text>
              <Text style={styles.body}>{story.body}</Text>
            </View>
          ))
        )}

        <Text variant="caption" gold style={styles.section}>
          PRODUCTION FIXTURES ({fixtures.length})
        </Text>
        {fixtures.map((story) => (
          <View key={story.id} style={styles.story}>
            <Text variant="caption" gold>
              {story.templateId.toUpperCase()} · CLOUT +{story.cloutDelta}
            </Text>
            <Text variant="title" style={styles.headline}>
              {story.headline}
            </Text>
            <Text style={styles.body}>{story.body}</Text>
          </View>
        ))}
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
  tagline: {
    marginTop: 8,
    color: shell.muted,
  },
  body: {
    marginTop: 8,
    color: shell.muted,
  },
  section: {
    marginTop: 28,
    marginBottom: 4,
  },
  story: {
    marginTop: 24,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(197,165,114,0.25)',
  },
  headline: {
    marginTop: 8,
  },
});
