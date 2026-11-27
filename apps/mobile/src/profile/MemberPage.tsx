import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Text, Screen } from '@underground/ui';
import { useSession } from '../session/SessionContext';
import { ProfileEditor } from './ProfileEditor';
import { type EditorSection, type Connections, type Page, type Settings } from './page';
import { copyLook } from './page';
import { ProfileBody } from './ProfileBody';
import { getConnections, getPage } from './store';

function LinkButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={s.button}>
      <Text style={s.buttonText}>{label}</Text>
    </Pressable>
  );
}
export function MemberPage({ target, editOnOpen = false, fromSetup = false }: { target?: string; editOnOpen?: boolean; fromSetup?: boolean }) {
  const { state } = useSession();
  if (state.status !== 'authenticated')
    return (
      <Screen>
        <ActivityIndicator />
      </Screen>
    );
  return (
    <Member
      key={state.member.memberId + ':' + (target ?? state.member.memberId)}
      fromSetup={fromSetup}
      editOnOpen={editOnOpen && (!target || target === state.member.memberId)}
      viewer={state.member.memberId}
      target={target ?? state.member.memberId}
    />
  );
}
function Member({ viewer, target, editOnOpen, fromSetup }: { viewer: string; target: string; editOnOpen: boolean; fromSetup: boolean }) {
  const router = useRouter();
  const { updateDisplayName } = useSession();
  const owner = viewer === target;
  const [page, setPage] = useState<Page | null>(null),
    [connections, setConnections] = useState<Connections>({ accepted: [], incoming: [] });
  const [editSection, setEditSection] = useState<EditorSection>('Identity');
  const [edit, setEdit] = useState(editOnOpen),
    [preview, setPreview] = useState(false),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true);
  const editing = useRef(false),
    version = useRef(0);
  const load = useCallback(async () => {
    const ticket = ++version.current;
    setError('');
    setLoading(true);
    try {
      const [p, c] = await Promise.all([
        getPage(viewer, target),
        owner ? getConnections(viewer) : Promise.resolve({ accepted: [], incoming: [] }),
      ]);
      if (ticket !== version.current) return;
      if (owner && editOnOpen) editing.current = true;
      setPage(p);
      setConnections(c);
    } catch (e) {
      if (ticket === version.current) {
        setPage(null);
        setError(e instanceof Error ? e.message : 'Could not load this page.');
      }
    } finally {
      if (ticket === version.current) setLoading(false);
    }
  }, [viewer, target, owner, editOnOpen]);
  useFocusEffect(
    useCallback(() => {
      if (!editing.current) void load();
      return () => {
        version.current++;
      };
    }, [load]),
  );
  function leaveEditor() {
    if (editOnOpen) {
      if (!fromSetup && router.canGoBack()) router.back();
      else router.replace('/(tabs)/profile');
      return;
    }
    editing.current = false;
    setEdit(false);
    void load();
  }
  function saved(draft: Settings) {
    updateDisplayName(viewer, draft.displayName.trim());
    leaveEditor();
  }
  const [copied, setCopied] = useState<{
    own: Page;
    contacts: Connections;
    draft: Settings;
  } | null>(null);
  async function copyDesign() {
    if (!page) return;
    try {
      const [own, contacts] = await Promise.all([getPage(viewer, viewer), getConnections(viewer)]);
      setCopied({ own, contacts, draft: copyLook(page.settings, own.settings) });
    } catch (e) {
      Alert.alert('Could not copy layout', e instanceof Error ? e.message : undefined);
    }
  }
  if (copied)
    return (
      <Screen padded={false}>
        <ProfileEditor
          page={copied.own}
          initial={copied.draft}
          initialSection="Page style"
          connections={copied.contacts}
          onSaved={(d) => {
            updateDisplayName(viewer, d.displayName);
            setCopied(null);
            router.push('/(tabs)/profile');
          }}
          onCancel={() => setCopied(null)}
        />
      </Screen>
    );
  if (edit && page && owner)
    return (
      <Screen padded={false}>
        <ProfileEditor
          page={page}
          initialSection={editSection}
          connections={connections}
          onSaved={saved}
          onCancel={leaveEditor}
        />
      </Screen>
    );
  if (loading || !page)
    return (
      <Screen>
        <View style={s.message}>
          {loading ? (
            <ActivityIndicator color="#DFBF88" />
          ) : (
            <>
              <Text style={s.body}>{error}</Text>
              <LinkButton label="Try again" onPress={() => void load()} />
            </>
          )}
          {!owner && (
            <LinkButton
              label="Back"
              onPress={() =>
                router.canGoBack() ? router.back() : router.replace('/(tabs)/friends')
              }
            />
          )}
        </View>
      </Screen>
    );
  return (
    <ProfileBody
      page={page}
      viewer={viewer}
      preview={preview}
      onEdit={(section) => {
        setEditSection(section);
        editing.current = true;
        setEdit(true);
      }}
      onPreview={() => setPreview((v) => !v)}
      onCopy={copyDesign}
    />
  );
}
const s = StyleSheet.create({
  message: { padding: 20, gap: 14 },
  body: { color: '#E6E5E2' },
  button: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  buttonText: { color: '#E4E3DE', textDecorationLine: 'underline' },
});
