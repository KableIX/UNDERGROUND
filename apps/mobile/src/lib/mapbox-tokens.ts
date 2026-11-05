/**
 * Mapbox token separation.
 * - Public runtime (pk.*): EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN — styles, Static API, MapView
 * - Private download (sk.*): RNMAPBOX_MAPS_DOWNLOAD_TOKEN — native SDK Maven/CocoaPods at build
 * Never log or commit either value.
 */

export type MapboxTokenStatus = {
  runtimePublicConfigured: boolean;
  downloadPrivateConfigured: boolean;
  /** True only when a public runtime token is present for MapView/Static. */
  canRenderMapboxStyle: boolean;
  requiresCustomDevClient: true;
  nativeModuleVerifiedOnDevice: false;
};

export function getMapboxTokenStatus(env: {
  EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN?: string;
  RNMAPBOX_MAPS_DOWNLOAD_TOKEN?: string;
}): MapboxTokenStatus {
  const runtimePublicConfigured = Boolean(env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim());
  const downloadPrivateConfigured = Boolean(env.RNMAPBOX_MAPS_DOWNLOAD_TOKEN?.trim());
  return {
    runtimePublicConfigured,
    downloadPrivateConfigured,
    canRenderMapboxStyle: runtimePublicConfigured,
    requiresCustomDevClient: true,
    // This Linux agent cannot verify native MapView on device.
    nativeModuleVerifiedOnDevice: false,
  };
}
