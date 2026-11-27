import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Screen, Text } from '@underground/ui';
import {
  discoveryRows,
  initialFeeds,
  refreshOrganizer,
  sources,
  type SourceFeed,
} from '../../data/local-events';

const time = (n: number) =>
  new Date(n).toLocaleString('en-US', {
    timeZone: 'America/Los_Angeles',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });
const storageKey = 'local-events-bay-v1';
const storage = () =>
  (require('expo-sqlite/kv-store') as typeof import('expo-sqlite/kv-store')).default;
export function LocalEventFeed({ embedded = false }: { embedded?: boolean }) {
  const [feeds, setFeeds] = useState<SourceFeed[]>(initialFeeds),
    [errors, setErrors] = useState<string[]>([]),
    [busy, setBusy] = useState(false),
    [now, setNow] = useState(Date.now),
    [openError, setOpenError] = useState('');
  const ref = useRef(initialFeeds),
    generation = useRef(0);
  const refresh = useCallback(async () => {
    const token = ++generation.current;
    setBusy(true);
    setNow(Date.now());
    let old = ref.current;
    try {
      const raw = await storage().getItem(storageKey);
      if (raw) {
        const saved = JSON.parse(raw) as SourceFeed[];
        if (Array.isArray(saved))
          old = sources
            .map(
              (s) =>
                [...old, ...saved]
                  .filter((f) => f.id === s.id && Array.isArray(f.events))
                  .sort((a, b) => b.checked - a.checked)[0],
            )
            .filter(Boolean);
      }
    } catch {}
    if (token !== generation.current) return;
    ref.current = old;
    setFeeds(old);
    const results = await Promise.allSettled(sources.map(refreshOrganizer));
    if (token !== generation.current) return;
    const failed: string[] = [];
    const latest = sources.flatMap((source, i) => {
      const r = results[i];
      if (r.status === 'fulfilled') return [r.value];
      failed.push(source.name);
      return old.filter((f) => f.id === source.id);
    });
    ref.current = latest;
    setFeeds(latest);
    setErrors(failed);
    setBusy(false);
    setNow(Date.now());
    void storage()
      .setItem(storageKey, JSON.stringify(latest))
      .catch(() => {});
  }, []);
  useFocusEffect(
    useCallback(() => {
      void refresh();
      const sub = AppState.addEventListener('change', (state) => {
        if (state === 'active') void refresh();
      });
      const timer = setInterval(() => {
        if (AppState.currentState === 'active') void refresh();
      }, 15 * 60000);
      return () => {
        generation.current++;
        sub.remove();
        clearInterval(timer);
      };
    }, [refresh]),
  );
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);
  const calendarRows = feeds
    .flatMap((f) =>
      f.events
        .filter((e) => e.ends >= now)
        .map((e) => ({ ...e, source: sources.find((s) => s.id === f.id)!, checked: f.checked })),
    )
    .sort((a, b) => a.starts - b.starts);
  const byUrl = new Set(calendarRows.map((row) => row.url));
  const rows = [...calendarRows, ...discoveryRows(now).filter((row) => !byUrl.has(row.url))].sort(
    (a, b) => a.starts - b.starts,
  );
  const content = (
    <>
      <Text variant="caption" gold>
        SAN FRANCISCO BAY AREA
      </Text>
      <Text variant="title">Local drives &amp; Cars and Coffee</Text>
      <Pressable
        accessibilityRole="button"
        disabled={busy}
        onPress={() => void refresh()}
        style={s.link}
      >
        <Text gold>{busy ? 'Checking organizers…' : 'Refresh events'}</Text>
      </Pressable>
      {!!errors.length && (
        <Text style={s.muted}>
          Couldn’t refresh {errors.join(', ')}. Previously checked listings show their original
          timestamp.
        </Text>
      )}
      {!rows.length && !busy && <Text>No upcoming listings from these calendars.</Text>}
      {(embedded ? rows.slice(0, 5) : rows).map((e) => (
        <View key={e.id} style={s.card}>
          <Text variant="caption" gold>
            {e.cancelled ? 'CANCELLED / POSTPONED' : e.kind}
          </Text>
          <Text variant="title">{e.title}</Text>
          <Text>{time(e.starts)}</Text>
          <Text>{e.place || 'Meeting point from the organizer'}</Text>
          <Text style={s.muted}>
            {e.source.name} · Checked {time(e.checked)}
          </Text>
          <Pressable
            accessibilityRole="link"
            style={s.link}
            onPress={() =>
              void Linking.openURL(e.url).catch(() =>
                setOpenError('Could not open the organizer page.'),
              )
            }
          >
            <Text gold>Organizer details &amp; registration ↗</Text>
          </Pressable>
        </View>
      ))}
      {!!openError && <Text accessibilityRole="alert">{openError}</Text>}
    </>
  );
  return embedded ? (
    <View style={{ gap: 10 }}>{content}</View>
  ) : (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={s.page}>{content}</ScrollView>
    </Screen>
  );
}
const s = StyleSheet.create({
  page: { padding: 18, gap: 10 },
  card: { paddingVertical: 16, gap: 7, borderTopWidth: 1, borderColor: '#343B3B' },
  muted: { color: '#B9C1BF', fontSize: 13, lineHeight: 19 },
  link: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
});
