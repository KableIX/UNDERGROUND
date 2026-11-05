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
      // react-native-maps + expo-linear-gradient autolink (no Expo config plugin).
      // They must be dependencies of the EAS build; Fast Refresh cannot add them.
      'expo-secure-store',
      'expo-file-system',
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
