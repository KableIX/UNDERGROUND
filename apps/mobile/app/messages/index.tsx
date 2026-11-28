import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { type ChatThread } from '@underground/domain';
import { Screen, Text } from '@underground/ui';
import { MessagesError, messageText, messagesApi } from '../../src/messages/api';
import { findMemberPage } from '../../src/profile/store';
import { useSession } from '../../src/session/SessionContext';
import { shell } from '../../src/theme/shell';

const REFRESH_MS = 5000;

function shortTime(iso: string | null): string {
  if (!iso) return '';
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';
  const clock = at.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return at.toDateString() === new Date().toDateString()
    ? clock
    : `${at.toLocaleDateString([], { month: 'short', day: 'numeric' })} · ${clock}`;
}

/** All of a member's conversations: club chat first, then direct messages. */
export default function MessagesScreen() {
  const { state, liveAuthConfigured } = useSession();
  const router = useRouter();
  const memberId = state.status === 'authenticated' ? state.member.memberId : null;
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [number, setNumber] = useState('');

  const load = useCallback(async () => {
    if (!memberId) return;
    try {
      setThreads((await messagesApi.threads()).threads);
      setError('');
    } catch (e) {
      setError(e instanceof MessagesError ? messageText(e.message) : 'Could not load messages.');
    } finally {
      setLoading(false);
    }
  }, [memberId]);

  useFocusEffect(
    useCallback(() => {
      if (!memberId) return;
      void load();
      const timer = setInterval(() => void load(), REFRESH_MS);
      return () => clearInterval(timer);
    }, [memberId, load]),
  );

  async function openDirect(otherId: string, title: string) {
    if (busy) return;
    setBusy(true);
    try {
      const { threadId } = await messagesApi.openDirect(otherId);
      router.push({ pathname: '/messages/[threadId]', params: { threadId, title } });
    } catch (e) {
      Alert.alert('Could not open a message', e instanceof MessagesError ? messageText(e.message) : 'Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function openByNumber() {
    const wanted = number.trim();
    if (!/^\d{6}$/.test(wanted) || !memberId || busy) return;
    setBusy(true);
    let otherId: string;
    try {
      otherId = await findMemberPage(memberId, wanted);
    } catch (e) {
      Alert.alert('No member found', e instanceof Error ? e.message : undefined);
      return;
    } finally {
      setBusy(false);
    }
    await openDirect(otherId, `Member ${wanted}`);
  }

  function row(thread: ChatThread) {
    return (
      <Pressable
        key={thread.id}
        accessibilityRole="button"
        style={styles.row}
        onPress={() => router.push({ pathname: '/messages/[threadId]', params: { threadId: thread.id, title: thread.title } })}
      >
        <View style={styles.rowText}>
          <Text style={styles.title}>{thread.title}</Text>
          {!!thread.lastMessagePreview && (
            <Text style={styles.preview} numberOfLines={1}>
              {thread.lastMessagePreview}
            </Text>
          )}
        </View>
        <View style={styles.meta}>
          <Text style={styles.time}>{shortTime(thread.lastMessageAt)}</Text>
          {!!thread.unreadCount && (
            <View style={styles.badge} accessibilityLabel={`${thread.unreadCount} unread`}>
              <Text style={styles.badgeText}>{thread.unreadCount}</Text>
            </View>
          )}
        </View>
      </Pressable>
    );
  }

  const clubThreads = threads.filter((thread) => thread.kind === 'club');
  const directThreads = threads.filter((thread) => thread.kind !== 'club');

  return (
    <Screen padded={false}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={busy} onRefresh={load} tintColor={shell.accent} />}
        contentContainerStyle={styles.content}
      >
        {!liveAuthConfigured ? (
          <Text style={styles.body}>Chat needs a live sign-in. Connect the member service to use messages.</Text>
        ) : (
          <>
            <Text style={styles.section}>NEW MESSAGE</Text>
            <Text style={styles.body}>Message any member by number, or open a conversation below.</Text>
            <View style={styles.compose}>
              <TextInput
                accessibilityLabel="Member number"
                placeholder="Six-digit member number"
                placeholderTextColor="#A5A7AF"
                value={number}
                onChangeText={setNumber}
                keyboardType="number-pad"
                maxLength={6}
                style={styles.input}
              />
              <Pressable accessibilityRole="button" disabled={busy} style={styles.go} onPress={() => void openByNumber()}>
                <Text gold>OPEN</Text>
              </Pressable>
            </View>
            {loading ? <ActivityIndicator color={shell.accent} /> : null}
            {!!error && (
              <Text accessibilityLiveRegion="polite" style={styles.body}>
                {error}
              </Text>
            )}
            {clubThreads.length > 0 && <Text style={styles.section}>CLUB CHAT</Text>}
            {clubThreads.map(row)}
            <Text style={styles.section}>DIRECT MESSAGES</Text>
            {directThreads.length === 0 && !loading && <Text style={styles.body}>No direct messages yet.</Text>}
            {directThreads.map(row)}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 40 },
  section: { color: shell.accent, fontSize: 11, letterSpacing: 2, marginTop: 26, marginBottom: 8 },
  body: { color: shell.muted, marginTop: 6 },
  compose: { flexDirection: 'row', gap: 10, marginTop: 12, alignItems: 'center' },
  input: {
    flex: 1,
    color: 'white',
    borderColor: '#55565D',
    borderWidth: 1,
    borderRadius: 7,
    minHeight: 44,
    paddingHorizontal: 12,
  },
  go: { minHeight: 44, paddingHorizontal: 14, justifyContent: 'center', backgroundColor: '#242428', borderRadius: 7 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(197,165,114,0.2)',
  },
  rowText: { flex: 1, gap: 4 },
  title: { color: 'white', fontSize: 16, fontWeight: '600' },
  preview: { color: shell.muted, fontSize: 13 },
  meta: { alignItems: 'flex-end', gap: 6 },
  time: { color: shell.muted, fontSize: 11 },
  badge: {
    minWidth: 20,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: shell.accent,
    alignItems: 'center',
  },
  badgeText: { color: shell.background, fontSize: 11, fontWeight: '700' },
});
