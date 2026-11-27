import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@underground/ui';
import { RUN_ABORT_LABELS, RUN_ABORT_REASONS, type RunAbortReason } from '@underground/domain';

type Props = {
  visible: boolean;
  /** Progress along the route, 0..100. */
  progressPct: number;
  busy?: boolean;
  onCancel: () => void;
  onEnd: (reason: RunAbortReason) => void;
};

/** End run: one tap for the reason. The attempt and how far you got are logged. */
export function RunEndSheet({ visible, progressPct, busy, onCancel, onEnd }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <Pressable style={s.scrim} onPress={busy ? undefined : onCancel} accessibilityLabel="Keep driving" />
      <View style={s.sheet}>
        <Text style={s.title}>End run</Text>
        <Text style={s.note}>{Math.round(progressPct)}% complete. Choose a reason.</Text>
        <View style={s.grid}>
          {RUN_ABORT_REASONS.map(reason => (
            <Pressable key={reason} disabled={busy} accessibilityRole="button" style={s.reason} onPress={() => onEnd(reason)}>
              <Text style={s.reasonText}>{RUN_ABORT_LABELS[reason]}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable disabled={busy} accessibilityRole="button" style={s.keep} onPress={onCancel}>
          <Text style={s.keepText}>Keep driving</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: '#000000AA' },
  sheet: { backgroundColor: '#080B0C', padding: 22, paddingBottom: 40, borderTopWidth: 1, borderColor: '#D0B88F55', gap: 12 },
  title: { color: '#FFFFFF', fontSize: 28, fontFamily: 'BarlowCondensed_700Bold' },
  note: { color: '#AAB5B0', fontSize: 13 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  reason: { width: '47%', minHeight: 52, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#D0B88F', borderRadius: 5 },
  reasonText: { color: '#D0B88F', fontSize: 15, fontWeight: '700' },
  keep: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  keepText: { color: '#FFFFFF', fontSize: 14 },
});
