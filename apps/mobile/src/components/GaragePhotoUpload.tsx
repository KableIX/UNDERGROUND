import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import {
  GarageMediaUploadIntentSchema,
  planGarageMediaUpload,
  type GarageMediaUploadPlan,
} from '@underground/domain';
import { Text } from '@underground/ui';
import { isLiveAuthConfigured } from '../session/supabase-session';
import { useSession } from '../session/SessionContext';
import { uploadPrivateGarageJpeg } from '../lib/garage-photo-transfer';
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
  }) => Promise<{
    canceled: boolean;
    assets?: Array<{ uri: string; width?: number; height?: number }>;
  }>;
};

function tryLoadImagePicker(): PickerModule | null {
  try {
    // Older dev-client binaries may not have the photo picker. Avoid crashing launch.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-image-picker') as PickerModule;
  } catch {
    return null;
  }
}

/** In-memory preview in development; authenticated private upload in live mode. */
export function GaragePhotoUpload({ vehicleId, memberId, onPlanned }: Props) {
  const [status, setStatus] = useState('Add an actual garage photograph.');
  const [busy, setBusy] = useState(false);
  const { state } = useSession();

  async function onAddPhoto() {
    if (busy) return;
    const picker = tryLoadImagePicker();
    if (!picker) {
      setStatus('Photo picker requires a newer signed development build.');
      return;
    }
    setBusy(true);
    try {
      const permission = await picker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setStatus('Photo-library permission denied; nothing was uploaded.');
        return;
      }
      const selected = await picker.launchImageLibraryAsync({
        mediaTypes: 'images',
        quality: 0.85,
        allowsMultipleSelection: false,
      });
      if (selected.canceled || !selected.assets?.[0]?.uri) {
        setStatus('Selection canceled.');
        return;
      }

      const asset = selected.assets[0];
      // Normalize iPhone HEIC/PNG/JPEG to JPEG for the authorized upload endpoint.
      // Load only on user action: older installed dev clients lack this native module.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const ImageManipulator = require('expo-image-manipulator') as typeof import('expo-image-manipulator');
      const maxSide = Math.max(asset.width ?? 0, asset.height ?? 0);
      const resize = maxSide > 2400
        ? [{ resize: asset.width && asset.height && asset.width >= asset.height
          ? { width: 2400 } : { height: 2400 } }]
        : [];
      const photo = await ImageManipulator.manipulateAsync(
        asset.uri,
        resize,
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
      );

      if (state.status !== 'authenticated') {
        setStatus('Sign in as a verified member before uploading.');
        return;
      }
      if (memberId !== state.member.memberId) {
        setStatus('You cannot upload photos to another member’s garage.');
        return;
      }

      if (!isLiveAuthConfigured()) {
        const intent = GarageMediaUploadIntentSchema.parse({
          vehicleId, memberId, contentType: 'image/jpeg', caption: 'Garage photograph',
          sortOrder: Date.now() % 100000, localUri: photo.uri,
        });
        const plan = planGarageMediaUpload({ intent, supabaseReady: false });
        onPlanned?.(plan);
        setStatus('Photo selected locally. Persistent uploads are not configured.');
        return;
      }

      const result = await uploadPrivateGarageJpeg({
        vehicleId, memberId,
        localUri: photo.uri,
        caption: 'Garage photograph',
        sortOrder: Date.now() % 100000,
      });
      if (!result.ok) {
        setStatus(`Upload failed: ${result.error}`);
        return;
      }
      onPlanned?.(result.plan);
      setStatus('Private garage photo uploaded and registered.');
    } catch {
      setStatus('Unable to prepare the photograph. Nothing was published.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.root}>
      <Text variant="caption" gold>PRIVATE GARAGE PHOTOGRAPHY</Text>
      <Text style={styles.body}>
        Images remain private until explicitly approved for sharing. Original location metadata
        must never appear in public galleries.
      </Text>
      <Pressable
        style={styles.cta}
        disabled={busy}
        onPress={() => void onAddPhoto()}
        accessibilityRole="button"
      >
        {busy ? <ActivityIndicator color={shell.accent} /> :
          <Text variant="caption" gold>ADD PHOTO</Text>}
      </Pressable>
      <Text variant="caption" style={styles.status}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    marginTop: 16, padding: 16, borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(197,165,114,0.35)', gap: 10,
  },
  body: { color: shell.muted },
  cta: {
    marginTop: 4, paddingVertical: 14, alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth, borderColor: shell.accent,
  },
  status: { color: shell.accent },
});
