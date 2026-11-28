import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SupercargoReportReasons } from '@underground/domain';
import { fileReport } from '../../src/supercargo/client';
import { reportReasonText } from '../../src/supercargo/copy';
import { Action, Caption, ui } from '../../src/supercargo/ui';

/** Report a sighting. Reporters stay anonymous to the spotter. */
export default function Report() {
  const router = useRouter();
  const inset = useSafeAreaInsets();
  const { id, title } = useLocalSearchParams<{ id?: string; title?: string }>();
  const [reason, setReason] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function send() {
    if (!id || !reason) return;
    setBusy(true);
    setMessage('');
    try {
      await fileReport(id, reason, note);
      setSent(true);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Report not sent.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView
      style={ui.screen}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[ui.content, { paddingTop: inset.top + 12, paddingBottom: inset.bottom + 32 }]}
    >
      <Pressable accessibilityRole="button" onPress={() => router.back()}>
        <Text style={ui.back}>‹ MAP</Text>
      </Pressable>
      <Text style={ui.heading}>Report</Text>
      {title ? <Text style={ui.notice}>{title}</Text> : null}
      {sent ? (
        <View style={{ gap: 14 }}>
          <Text style={ui.notice}>Thank you. A moderator will look at it. The spotter never sees who reported.</Text>
          <Action primary title="Back to the map" onPress={() => router.back()} />
        </View>
      ) : (
        <>
          <Text style={ui.body}>The spotter never sees who reported. Safety reports take the sighting off the map at once.</Text>
          {message ? (
            <Text accessibilityLiveRegion="polite" style={ui.notice}>
              {message}
            </Text>
          ) : null}
          <Caption>WHAT IS WRONG</Caption>
          <View style={{ gap: 8 }}>
            {SupercargoReportReasons.map((r) => {
              const on = reason === r;
              const text = reportReasonText[r] ?? { label: r, detail: '' };
              return (
                <Pressable
                  key={r}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  onPress={() => setReason(r)}
                  style={[ui.card, on && { borderColor: '#C6B08B' }]}
                >
                  <Text style={[ui.notice, on && { color: '#C6B08B' }]}>{text.label}</Text>
                  <Text style={ui.body}>{text.detail}</Text>
                </Pressable>
              );
            })}
          </View>
          <Caption>NOTE FOR THE MODERATOR (OPTIONAL)</Caption>
          <TextInput
            value={note}
            onChangeText={(t) => setNote(t.slice(0, 280))}
            multiline
            placeholder="What should they look at?"
            placeholderTextColor="#5A5B60"
            accessibilityLabel="Note for the moderator"
            style={{ minHeight: 80, padding: 12, borderWidth: 1, borderColor: '#2C2D31', backgroundColor: '#111215', color: '#F4F2ED', textAlignVertical: 'top' }}
          />
          <Action primary title="Send report" disabled={!reason || !id || busy} onPress={() => void send()} />
        </>
      )}
    </ScrollView>
  );
}
