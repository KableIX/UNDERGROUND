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

type PickerModule = {
  requestMediaLibraryPermissionsAsync: () => Promise<{ granted: boolean }>;
  launchImageLibraryAsync: (opts: {
    mediaTypes: string;
    quality: number;
    allowsMultipleSelection: boolean;
  }) => Promise<{ canceled: boolean; assets?: Array<{ uri: string }> }>;
};

function tryLoadImagePicker(): PickerModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-image-picker') as PickerModule;
  } catch {
    return null;
  }
}

/**
 * Founder garage photo upload UI.
 * Prefers expo-image-picker when present in the native dev client;
 * falls back to a marked placeholder URI when the module/permission is unavailable.
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
        : `SIGNED UPLOAD READY · ${plan.storagePath}`,
    );
    onPlanned?.(plan);
  }

  async function onAddPhoto() {
    const ImagePicker = tryLoadImagePicker();
    if (!ImagePicker) {
      const localUri = `file://local/garage/r8-upload-${Date.now()}.PLACEHOLDER.jpg`;
      planFromLocalUri(localUri, 'Founder R8 garage upload (picker module unavailable)');
      return;
    }

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setStatus('Photo library permission denied — using placeholder plan.');
        planFromLocalUri(
          `file://local/garage/r8-denied-${Date.now()}.PLACEHOLDER.jpg`,
          'Permission denied placeholder',
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        quality: 0.85,
        allowsMultipleSelection: false,
      });

      if (result.canceled || !result.assets?.[0]?.uri) {
        setStatus('Picker canceled.');
        return;
      }

      planFromLocalUri(result.assets[0].uri, 'Founder R8 garage upload');
    } catch {
      planFromLocalUri(
        `file://local/garage/r8-upload-${Date.now()}.PLACEHOLDER.jpg`,
        'Founder R8 garage upload (picker error fallback)',
      );
    }
  }

  return (
    <View style={styles.root}>
      <Text variant="caption" gold>
        PRIVATE STORAGE · GARAGE ORIGINALS
      </Text>
      <Text style={styles.body}>
        Uploads target the private garage-originals bucket. Without Supabase the planner returns a
        marked PLACEHOLDER path — no binaries committed.
      </Text>
      <Pressable style={styles.cta} onPress={() => void onAddPhoto()}>
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
