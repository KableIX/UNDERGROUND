import { FounderR8Cover } from '../components/FounderR8Cover';
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Text } from '@underground/ui';
import { FittedPhoto } from '../components/FittedPhoto';
import { ownerCover } from '../garage/cover';

export function OwnerGarageCover({ owner, vehicle, label, founderCover }: { founderCover: boolean; owner: string; vehicle: string; label: string }) {
  const [uri, setUri] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useFocusEffect(useCallback(() => {
    let active = true;
    setUri(null);
    setFailed(false);
    void ownerCover(owner, vehicle).then(value => { if (active) setUri(value); })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [owner, vehicle]));
  if (founderCover && (failed || !uri)) return <FounderR8Cover />;
  if (failed) return <Text>Could not load your garage photo.</Text>;
  return uri ? <FittedPhoto source={{ uri }} accessibilityLabel={label} onError={() => setFailed(true)} /> : null;
}
