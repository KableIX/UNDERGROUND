import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  GarageMediaUploadIntentSchema,
  planGarageMediaUpload,
  type GarageMediaUploadPlan,
} from '@underground/domain';
import { Text } from '@underground/ui';
import { supabaseConfigured } from '../lib/env';
import { shell } from '../theme/shell';

type Props = {
  vehicleId: string;
  memberId: string;
  onPlanned?: (plan: GarageMediaUploadPlan) => void;
};

/**
 * Founder garage photo upload UI.
 * Plans private storage uploads; placeholders when Supabase creds absent.
 * No proprietary binaries are committed — local URI is a client hint only.
 */
export function GaragePhotoUpload({ vehicleId, memberId, onPlanned }: Props) {
  const [lastPlan, setLastPlan] = useState<GarageMediaUploadPlan | null>(null);
  const [status, setStatus] = useState('Tap ADD PHOTO to plan a private garage upload.');

  function planFromLocalUri(localUri: string, caption: string) {
    const intent = GarageMediaUploadIntentSchema.parse({
      vehicleId,
      memberId,
      contentType: 'image/jpeg',
      caption,
      sortOrder: Date.now() % 1000,
      localUri,
    });
    const plan = planGarageMediaUpload({
      intent,
      supabaseReady: supabaseConfigured,
    });
    setLastPlan(plan);
    setStatus(
      plan.mode === 'placeholder'
        ? `PLACEHOLDER PATH · ${plan.storagePath} · Supabase absent`
        : `UPLOAD PLAN CREATED · ${plan.storagePath} · transfer not implemented`,
    );
    onPlanned?.(plan);
  }

  function onAddPhoto() {
    // The installed development client predates expo-image-picker.
    // Do not import a missing native module until a new IPA is installed.
    setStatus('Photo selection requires the next native development build.');
  }

  return (
    <View style={styles.root}>
      <Text variant="caption" gold>
        PRIVATE STORAGE · GARAGE ORIGINALS
      </Text>
      <Text style={styles.body}>
        Uploads target the private `garage-originals` bucket. Without Supabase credentials the
        planner returns a marked PLACEHOLDER path — no binaries committed.
      </Text>
      <Pressable style={styles.cta} onPress={onAddPhoto}>
        <Text variant="caption" gold>
          ADD PHOTO
        </Text>
      </Pressable>
      <Text variant="caption" style={styles.status}>
        {status}
      </Text>
      {lastPlan ? (
        <Text variant="caption" style={styles.meta}>
          MODE {lastPlan.mode.toUpperCase()} · BUCKET {lastPlan.bucket}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    marginTop: 16,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(197,165,114,0.35)',
    gap: 10,
  },
  body: {
    color: shell.muted,
  },
  cta: {
    marginTop: 4,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: shell.accent,
  },
  status: {
    color: shell.accent,
  },
  meta: {
    color: shell.muted,
  },
});
