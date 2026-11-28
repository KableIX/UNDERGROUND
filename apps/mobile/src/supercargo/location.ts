/** One fresh fix. SupercarGO never tracks in the background. */
export async function currentFix() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Location = require('expo-location') as typeof import('expo-location');
  let permission = await Location.getForegroundPermissionsAsync();
  if (!permission.granted && permission.canAskAgain) permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) throw new Error('Allow location while using the app to log sightings.');
  const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  return {
    lat: p.coords.latitude,
    lng: p.coords.longitude,
    accuracyM: p.coords.accuracy ?? 9999,
    at: new Date(p.timestamp).toISOString(),
  };
}
