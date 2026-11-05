import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Expo config wrapper — keeps secrets out of committed JSON.
 * Public runtime token: EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN (pk.*)
 * Private native download token: RNMAPBOX_MAPS_DOWNLOAD_TOKEN (sk.*) — EAS secret only
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const downloadToken = process.env.RNMAPBOX_MAPS_DOWNLOAD_TOKEN?.trim();

  /**
   * Only link the native Mapbox config plugin when the private download token
   * is present (EAS secret). Without it, JS still ships and uses tactical fallback;
   * CocoaPods/Maven would fail if the plugin ran with no sk token.
   */
  const mapboxPlugins: ExpoConfig['plugins'] = downloadToken
    ? [
        [
          '@rnmapbox/maps',
          {
            RNMapboxMapsVersion: '11.8.0',
            RNMapboxMapsDownloadToken: downloadToken,
          },
        ],
      ]
    : [];

  return {
    ...config,
    name: config.name ?? 'UNDERGROUND',
    slug: config.slug ?? 'underground',
    plugins: [
      ...(config.plugins ?? []),
      ...mapboxPlugins,
      'expo-image-picker',
      'expo-sqlite',
      ['expo-location', {
        locationWhenInUsePermission: 'UNDERGROUND uses your location to show your position and record a drive only when you choose Start Drive.',
        // Foreground tracking first — do not silently enable background GPS here.
        isIosBackgroundLocationEnabled: false,
        isAndroidBackgroundLocationEnabled: false,
      }],
    ],
    extra: {
      ...(config.extra ?? {}),
      mapbox: {
        runtimeTokenConfigured: Boolean(
          process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim(),
        ),
        downloadTokenConfigured: Boolean(downloadToken),
        nativePluginLinked: Boolean(downloadToken),
        /** Native Mapbox requires a custom dev client — Expo Go unsupported. */
        requiresDevClient: true,
        compatibilityClaim: 'declared_for_expo52_rn076_unverified_on_device',
      },
    },
  };
};
