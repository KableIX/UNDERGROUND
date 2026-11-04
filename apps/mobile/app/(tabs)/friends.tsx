import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { GoldRule, Screen, Text } from '@underground/ui';
import { shell } from '../../src/theme/shell';

type LocalFriendship = {
  id: string;
  name: string;
  status: 'pending_in' | 'pending_out' | 'accepted';
};

const INITIAL: LocalFriendship[] = [];

/**
 * Friends UI wired to local stub state until Supabase credentials exist.
 * Schema + RLS for request/accept/remove live in supabase/migrations.
 */
export default function FriendsScreen() {
  const [items, setItems] = useState<LocalFriendship[]>(INITIAL);

  function accept(id: string) {
    setItems((prev) =>
      prev.map((f) => (f.id === id ? { ...f, status: 'accepted' as const } : f)),
    );
  }

  function remove(id: string) {
    setItems((prev) => prev.filter((f) => f.id !== id));
  }

  return (
    <Screen>
      <Text variant="title" gold>
        Friends
      </Text>
      <Text variant="caption" style={styles.meta}>
        REQUEST · ACCEPT · REMOVE · RLS READY
      </Text>
      <GoldRule />
      <Text style={styles.body}>
        Founder garage visibility is friend-only. Graph mutations persist through audited API /
        RLS once Supabase is configured.
      </Text>
      {items.length === 0 ? (
        <View style={styles.placeholder}>
          <Text variant="caption" gold>
            NO CONNECTIONS YET
          </Text>
          <Pressable
            style={styles.cta}
            onPress={() =>
              setItems([
                {
                  id: 'demo-pending',
                  name: 'Awaiting real members',
                  status: 'pending_in',
                },
              ])
            }
          >
            <Text variant="caption" gold>
              SIMULATE INBOUND REQUEST (UI ONLY)
            </Text>
          </Pressable>
        </View>
      ) : (
        items.map((f) => (
          <View key={f.id} style={styles.row}>
            <View>
              <Text>{f.name}</Text>
              <Text variant="caption" style={styles.meta}>
                {f.status.toUpperCase()}
              </Text>
            </View>
            <View style={styles.actions}>
              {f.status === 'pending_in' ? (
                <Pressable onPress={() => accept(f.id)}>
                  <Text variant="caption" gold>
                    ACCEPT
                  </Text>
                </Pressable>
              ) : null}
              <Pressable onPress={() => remove(f.id)}>
                <Text variant="caption" gold>
                  REMOVE
                </Text>
              </Pressable>
            </View>
          </View>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  meta: {
    marginTop: 6,
    color: shell.muted,
  },
  body: {
    color: shell.muted,
  },
  placeholder: {
    marginTop: 32,
    paddingVertical: 40,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(197,165,114,0.35)',
    gap: 16,
  },
  cta: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: shell.accent,
  },
  row: {
    marginTop: 16,
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
  },
});
