import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Expo config wrapper — keeps secrets out of committed JSON.
 * Public runtime token: EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN (pk.*)
 * Private native download token: RNMAPBOX_MAPS_DOWNLOAD_TOKEN (sk.*) — EAS secret only
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const downloadToken = process.env.RNMAPBOX_MAPS_DOWNLOAD_TOKEN?.trim();

  const mapboxPlugin: [string, Record<string, string>] | string = downloadToken
    ? [
        '@rnmapbox/maps',
        {
          RNMapboxMapsVersion: '11.8.0',
          RNMapboxMapsDownloadToken: downloadToken,
        },
      ]
    : [
        '@rnmapbox/maps',
        {
          // Download token omitted on purpose when unset — document rebuild requirement.
          RNMapboxMapsVersion: '11.8.0',
        },
      ];

  return {
    ...config,
    name: config.name ?? 'UNDERGROUND',
    slug: config.slug ?? 'underground',
    plugins: [...(config.plugins ?? []), mapboxPlugin, 'expo-image-picker'],
    extra: {
      ...(config.extra ?? {}),
      mapbox: {
        runtimeTokenConfigured: Boolean(
          process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim(),
        ),
        downloadTokenConfigured: Boolean(downloadToken),
        /** Native Mapbox requires a custom dev client — Expo Go unsupported. */
        requiresDevClient: true,
        compatibilityClaim: 'declared_for_expo52_rn076_unverified_on_device',
      },
    },
  };
};
