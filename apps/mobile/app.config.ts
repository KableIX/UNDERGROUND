import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Expo config wrapper — keeps secrets out of committed JSON.
 * Public runtime token: EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN (pk.*)
 * Private native download token: RNMAPBOX_MAPS_DOWNLOAD_TOKEN (sk.*) — EAS secret only
 *
 * New Architecture is disabled (app.json newArchEnabled: false) so
 * react-native-maps Apple MapKit remains stable on Expo 52 / RN 0.76.9.
 * Fast Refresh never adds native modules — install a new development build after
 * changing native deps (maps, linear-gradient, sqlite, location, mapbox).
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const downloadToken = process.env.RNMAPBOX_MAPS_DOWNLOAD_TOKEN?.trim();

  /**
   * Only link the native Mapbox config plugin when the private download token
   * is present (EAS secret). Without it, Apple MapKit via react-native-maps is
   * the geographic basemap — never require Mapbox for real roads.
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
      ['expo-av', { microphonePermission: false }],
      // react-native-maps + expo-linear-gradient autolink (no Expo config plugin).
      // They must be dependencies of the EAS build; Fast Refresh cannot add them.
      'expo-secure-store',
      'expo-file-system',
      ['expo-image-picker', {
        cameraPermission: 'Take a photo for Spotted, your garage, or a run finish.',
        photosPermission: 'Choose a photo for Spotted, your garage, or a run finish.',
      }],
      'expo-sqlite',
      ['expo-location', {
        locationWhenInUsePermission: 'UNDERGROUND uses your location to show your position on the map and, when you choose Start Drive, record your trip.',
        locationAlwaysAndWhenInUsePermission: 'Allow Always so a run keeps recording when your phone locks. UNDERGROUND records location only between Start and End of a run or drive you begin.',
        locationAlwaysPermission: 'Allow Always so a run keeps recording when your phone locks. UNDERGROUND records location only between Start and End of a run or drive you begin.',
        // iOS: background GPS only during a recording the member starts (UIBackgroundModes: location,
        // expo-task-manager task in src/drive/background-location.ts). The blue indicator stays on.
        isIosBackgroundLocationEnabled: true,
        // Android stays foreground-only until there is an Android build to test.
        isAndroidBackgroundLocationEnabled: false,
      }],
      'expo-task-manager',
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
        compatibilityClaim: 'declared_for_expo52_rn076_apple_maps_fallback_new_arch_off',
      },
      maps: {
        appleMapKitFallback: true,
        reactNativeMapsVersion: '1.18.0',
        newArchEnabled: false,
      },
    },
  };
};
