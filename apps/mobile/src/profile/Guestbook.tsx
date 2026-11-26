import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Text } from '@underground/ui';
import { notes, removeNote, signBook, type Note } from './guestbook-store';

export function Guestbook({
  viewer,
  target,
  preview,
}: {
  viewer: string;
  target: string;
  preview: boolean;
}) {
  const [items, setItems] = useState<Note[]>([]),
    [draft, setDraft] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const lock = useRef(false),
    generation = useRef(0);
  const load = useCallback(async () => {
    const request = ++generation.current;
    try {
      const list = await notes(viewer, target);
      if (request === generation.current) {
        setItems(list);
        setError('');
      }
    } catch (e) {
      if (request === generation.current) {
        setItems([]);
        setError(e instanceof Error ? e.message : 'Could not open guestbook.');
      }
    }
  }, [viewer, target]);
  useEffect(() => {
    void load();
    return () => {
      generation.current++;
    };
  }, [load]);
  async function change(id?: string) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      if (id) await removeNote(viewer, target, id);
      else {
        await signBook(viewer, target, draft);
        setDraft('');
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update guestbook.');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <View style={{ gap: 9 }}>
      {!items.length && !error && <Text style={s.muted}>No signatures yet.</Text>}
      {items.map((n) => (
        <View key={n.id} style={s.note}>
          <Text style={s.name}>{n.name}</Text>
          <Text style={s.body}>{n.body}</Text>
          {!preview && (viewer === target || viewer === n.author) && (
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => void change(n.id)}
              style={s.action}
            >
              <Text style={s.muted}>Remove note</Text>
            </Pressable>
          )}
        </View>
      ))}
      {!preview && viewer !== target && (
        <>
          <TextInput
            accessibilityLabel="Guestbook note"
            placeholder="Leave a note"
            placeholderTextColor="#A5A9AC"
            multiline
            maxLength={300}
            value={draft}
            onChangeText={setDraft}
            style={s.input}
          />
          <Pressable
            accessibilityRole="button"
            disabled={busy || !draft.trim()}
            onPress={() => void change()}
            style={s.action}
          >
            <Text style={s.name}>Sign guestbook</Text>
          </Pressable>
        </>
      )}
      {!!error && (
        <Text accessibilityRole="alert" style={s.muted}>
          {error}
        </Text>
      )}
    </View>
  );
}
const s = StyleSheet.create({
  note: { gap: 4, paddingVertical: 6 },
  name: { fontWeight: '700', color: '#ECE9E1' },
  body: { color: '#DFDFDA' },
  muted: { color: '#B7BABD', fontSize: 13 },
  action: { minHeight: 42, justifyContent: 'center', alignSelf: 'flex-start' },
  input: { backgroundColor: '#1C2024', borderRadius: 6, color: '#FFF', padding: 11 },
});
