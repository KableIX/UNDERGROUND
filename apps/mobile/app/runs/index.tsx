import { Redirect } from 'expo-router';

/** Route alias retained for older native clients and development-map buttons.
 * Event discovery now has one canonical entry point: PLAY.
 */
export default function RunsRedirect() {
  return <Redirect href="/(tabs)/conquest" />;
}
