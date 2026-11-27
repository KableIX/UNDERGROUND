import { useCallback, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Text } from '@underground/ui';
import { getMobileSupabaseClient } from '../../session/supabase-session';
import { shell } from '../../theme/shell';

type EditorialStory = {
  story_id: string;
  headline: string;
  body: string;
  action_label: string;
  source_url: string;
  verified_at: string;
};

export function EditorialFeed() {
  const [stories, setStories] = useState<EditorialStory[]>([]);
  const [failed, setFailed] = useState(false);
  useFocusEffect(useCallback(() => {
    const client = getMobileSupabaseClient();
    if (!client) return;
    let active = true;
    async function refresh() {
      const { data, error } = await client!.from('newswire_editorial')
        .select('story_id,headline,body,action_label,source_url,verified_at')
        .order('published_at', { ascending: false }).limit(50);
      if (!active) return;
      setFailed(Boolean(error));
      setStories(error ? [] : data ?? []);
    }
    void refresh().catch(() => {
      if (active) { setFailed(true); setStories([]); }
    });
    return () => { active = false; };
  }, []));
  return (
    <>
      {failed && <Text>Editorial updates are unavailable.</Text>}
      {stories.map((s) => (
        <View key={s.story_id} style={styles.story}>
          <Text variant="caption" gold>NEWSWIRE EDITORIAL</Text>
          <Text variant="title">{s.headline}</Text>
          <Text>{s.body}</Text>
          <Pressable accessibilityRole="link" onPress={() => {
            void Linking.openURL(s.source_url).catch(() => Alert.alert('Unable to open source'));
          }} style={styles.link}>
            <Text gold>{s.action_label}</Text>
          </Pressable>
        </View>
      ))}
    </>
  );
}
const styles = StyleSheet.create({
  story: { paddingVertical: 16, gap: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: shell.muted },
  link: { minHeight: 44, justifyContent: 'center' },
});
