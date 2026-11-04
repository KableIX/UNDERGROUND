import { ScrollView, StyleSheet, View } from 'react-native';
import { GoldRule, Screen, Text } from '@underground/ui';
import { newswireStoryFixtures } from '../../src/data/newswire';
import { shell } from '../../src/theme/shell';

/**
 * Newswire feed renders deterministic capture_accepted_v1 fixtures only.
 * Live stories appear only after server ACCEPTED on production evidence.
 */
export default function NewswireScreen() {
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
          Template `capture_accepted_v1` only — no fabricated achievements. Fixture feed until
          production ACCEPTED runs persist.
        </Text>
        {newswireStoryFixtures.map((story) => (
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
