import { StyleSheet, View } from 'react-native';
import { Text } from '@underground/ui';
import type { FeedCardModel } from '../../data/feed-v2';
import { shell } from '../../theme/shell';

function formatStamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

/** Visual Newswire card — imagery plate, identity, territory, timestamp, interactions stub. */
export function NewswireCard({ card }: { card: FeedCardModel }) {
  const sim = card.provenance === 'sim';
  const fixture = card.provenance === 'fixture';

  return (
    <View
      style={[styles.card, sim && styles.cardSim, fixture && styles.cardFixture]}
      accessibilityRole="summary"
      accessibilityLabel={`${card.badge}. ${card.headline}`}
    >
      <View style={styles.imagePlate}>
        <Text variant="caption" gold>
          {card.imageLabel}
        </Text>
      </View>
      <View style={styles.body}>
        <Text variant="caption" gold>
          {card.badge}
        </Text>
        <View style={styles.identity}>
          <Text>{card.actorName}</Text>
          {card.actorMemberNumber ? (
            <Text variant="caption" style={styles.meta}>
              #{card.actorMemberNumber}
            </Text>
          ) : null}
        </View>
        <Text variant="title" style={styles.headline}>
          {card.headline}
        </Text>
        <Text style={styles.copy}>{card.body}</Text>
        {card.territoryLabel ? (
          <Text variant="caption" style={styles.meta}>
            TERRITORY · {card.territoryLabel}
          </Text>
        ) : null}
        <View style={styles.footer}>
          <Text variant="caption" style={styles.meta}>
            {formatStamp(card.createdAt)}
          </Text>
          <Text variant="caption" style={styles.meta}>
            {typeof card.cloutDelta === 'number' ? `CLOUT ${card.cloutDelta >= 0 ? '+' : ''}${card.cloutDelta}` : '—'}
          </Text>
          <Text variant="caption" gold>
            RESPECT
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(197,165,114,0.28)',
    overflow: 'hidden',
    backgroundColor: 'rgba(18,20,26,0.65)',
  },
  cardSim: {
    borderColor: 'rgba(197,165,114,0.55)',
  },
  cardFixture: {
    borderStyle: 'dashed',
  },
  imagePlate: {
    height: 148,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: shell.tabBar,
  },
  body: {
    padding: 14,
    gap: 8,
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headline: {
    marginTop: 2,
  },
  copy: {
    color: shell.muted,
    lineHeight: 21,
  },
  meta: {
    color: shell.muted,
  },
  footer: {
    marginTop: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
