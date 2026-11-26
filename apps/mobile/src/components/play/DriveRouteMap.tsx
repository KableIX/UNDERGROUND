import { useMemo } from 'react';
import { View } from 'react-native';
import { Text } from '@underground/ui';
import { MapboxTerritoryMap } from '../conquest/MapboxTerritoryMap';

type Props = {
  title: string;
  routeId?: string;
  resultKind?: 'RUN' | 'CRUISE';
  activity?: 'Run' | 'Cruise';
  previewOnly?: boolean;
  verifyStart?: () => Promise<boolean>;
  coordinates: readonly (readonly number[])[];
  signalGap?: { entryIndex: number; exitIndex: number };
  maneuvers?: { index: number; instruction: string }[];
};

export function DriveRouteMap({ title, routeId, resultKind, activity, coordinates, maneuvers, signalGap, previewOnly, verifyStart }: Props) {
  const points = useMemo(() => coordinates.map(([lng, lat]): [number, number] => [lng, lat]), [coordinates]);
  if (points.length < 2) return <Text>Route preview unavailable.</Text>;
  return <View style={{height: 340}}>
    <MapboxTerritoryMap territories={[]} selectedSlug={routeId ?? null} onSelect={() => {}}
      camera={{longitude: points[0][0], latitude: points[0][1], zoom: 11}}
      badge={title} resultKind={resultKind} activity={activity} navTitle={title} previewOnly={previewOnly} verifyStart={verifyStart} maneuvers={maneuvers} signalGap={signalGap} fitCoordinates={points} />
  </View>;
}
