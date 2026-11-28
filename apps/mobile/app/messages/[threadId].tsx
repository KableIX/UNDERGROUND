import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { type ChatMessage, type ReportReason, MESSAGE_BODY_MAX } from '@underground/domain';
import { Screen, Text } from '@underground/ui';
import { MessagesError, messageText, messagesApi } from '../../src/messages/api';
import { useSession } from '../../src/session/SessionContext';
import { shell } from '../../src/theme/shell';

const POLL_MS = 4000;

function sameMessage(a: ChatMessage, b: ChatMessage): boolean {
  return a.id === b.id;
}

export default function ThreadScreen() {
  const { threadId, title } = useLocalSearchParams<{ threadId: string; title?: string }>();
  const { state } = useSession();
  const navigation = useNavigation();
  const me = state.status === 'authenticated' ? state.member.memberId : null;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const list = useRef<FlatList<ChatMessage>>(null);

  useEffect(() => {
    if (title) navigation.setOptions({ title });
  }, [title, navigation]);

  const refresh = useCallback(async () => {
    if (!me || !threadId) return;
    try {
      const reply = await messagesApi.list(threadId);
      setMessages(reply.messages);
      setError('');
      void messagesApi.markRead(threadId).catch(() => undefined);
    } catch (e) {
      setError(e instanceof MessagesError ? messageText(e.message) : 'Could not load this conversation.');
    } finally {
      setLoading(false);
    }
  }, [me, threadId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // New messages arrive by polling while this screen is open; push alerts come later.
  useEffect(() => {
    const timer = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  async function send() {
    const body = draft.trim();
    if (!me || !threadId || !body || sending) return;
    setSending(true);
    try {
      const { message } = await messagesApi.send(threadId, body);
      setDraft('');
      setMessages((current) => (current.some((m) => sameMessage(m, message)) ? current : [...current, message]));
      list.current?.scrollToEnd({ animated: true });
    } catch (e) {
      const code = e instanceof MessagesError ? e.message : 'send_failed';
      if (code === 'blocked') setBlocked(true);
      setError(messageText(code));
    } finally {
      setSending(false);
    }
  }

  async function report(message: ChatMessage, reason: ReportReason) {
    if (!threadId) return;
    try {
      await messagesApi.report(message.id, reason);
      Alert.alert('Reported', 'Thanks. A reviewer will look at it.');
    } catch (e) {
      Alert.alert('Could not report', e instanceof MessagesError ? messageText(e.message) : undefined);
    }
  }

  async function block(senderId: string) {
    if (!me || senderId === me) return;
    try {
      await messagesApi.block(senderId);
      setBlocked(true);
      Alert.alert('Member blocked', 'They can no longer message you directly.');
    } catch (e) {
      Alert.alert('Could not block', e instanceof MessagesError ? messageText(e.message) : undefined);
    }
  }

  function actions(message: ChatMessage) {
    if (!me || message.senderId === me) return;
    Alert.alert(`Message from ${message.senderName}`, message.body.slice(0, 120), [
      { text: 'Report spam', onPress: () => void report(message, 'spam') },
      { text: 'Report harassment', onPress: () => void report(message, 'harassment') },
      { text: 'Block member', style: 'destructive', onPress: () => void block(message.senderId) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  return (
    <Screen padded={false}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        {loading ? (
          <ActivityIndicator color={shell.accent} style={styles.center} />
        ) : (
          <FlatList
            ref={list}
            data={messages}
            keyExtractor={(message) => message.id}
            onContentSizeChange={() => list.current?.scrollToEnd({ animated: false })}
            contentContainerStyle={styles.list}
            ListEmptyComponent={<Text style={styles.empty}>No messages yet. Say hello.</Text>}
            renderItem={({ item }) => {
              const mine = item.senderId === me;
              return (
                <Pressable
                  onLongPress={() => actions(item)}
                  style={[styles.bubble, mine ? styles.mine : styles.theirs]}
                >
                  {!mine && !!item.senderName && <Text style={styles.sender}>{item.senderName}</Text>}
                  <Text style={mine ? styles.mineText : styles.text}>{item.body}</Text>
                </Pressable>
              );
            }}
          />
        )}
        {!!error && (
          <Text accessibilityLiveRegion="polite" style={styles.error}>
            {error}
          </Text>
        )}
        {blocked ? (
          <Text style={styles.error}>This conversation is blocked.</Text>
        ) : (
          <View style={styles.compose}>
            <TextInput
              accessibilityLabel="Message"
              placeholder="Message"
              placeholderTextColor="#A5A7AF"
              value={draft}
              onChangeText={setDraft}
              multiline
              maxLength={MESSAGE_BODY_MAX}
              style={styles.input}
            />
            <Pressable
              accessibilityRole="button"
              disabled={sending || !draft.trim()}
              style={styles.send}
              onPress={() => void send()}
            >
              <Text gold>{sending ? '…' : 'SEND'}</Text>
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1 },
  list: { padding: 16, gap: 8 },
  bubble: { maxWidth: '82%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14 },
  mine: { alignSelf: 'flex-end', backgroundColor: shell.accent },
  theirs: { alignSelf: 'flex-start', backgroundColor: '#141519' },
  sender: { color: shell.accent, fontSize: 11, letterSpacing: 1, marginBottom: 4 },
  text: { color: 'white', fontSize: 15, lineHeight: 20 },
  mineText: { color: shell.background, fontSize: 15, lineHeight: 20 },
  empty: { color: shell.muted, textAlign: 'center', marginTop: 40 },
  error: { color: '#E58A8A', paddingHorizontal: 16, paddingTop: 6 },
  compose: {
    flexDirection: 'row',
    gap: 10,
    padding: 12,
    alignItems: 'flex-end',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(197,165,114,0.2)',
  },
  input: {
    flex: 1,
    color: 'white',
    borderColor: '#55565D',
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    maxHeight: 120,
  },
  send: { minHeight: 44, paddingHorizontal: 14, justifyContent: 'center', backgroundColor: '#242428', borderRadius: 9 },
});
