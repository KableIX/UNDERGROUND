import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { Text } from '@underground/ui';
import { freshRadarFix, radarReportLabel } from '@underground/domain';
import { useSession } from '../src/session/SessionContext';
import { useRadar } from '../src/radar/RadarContext';
import { shell } from '../src/theme/shell';

export default function RadarScreen() {
  const radar = useRadar();
  const { state: session } = useSession();
  const memberId = session.status === 'authenticated' ? session.member.memberId : null;
  const canReport = Boolean(radar.clubId && freshRadarFix(radar.fix, radar.now));
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text variant="brand" gold>
        CLUB RADAR
      </Text>
      <Text>
        Detector alerts and recent observations from your club. Pins mark where a member observed an
        alert, not the source’s exact location.
      </Text>
      <View style={styles.card}>
        <Text variant="caption" gold>
          YOUR SESSION
        </Text>
        <Text>
          {radar.active
            ? radar.locationStatus
            : 'Start a session to connect your detector or report an observation.'}
        </Text>
        <Text style={styles.muted}>
          Runs while UNDERGROUND is open. Backgrounding the app ends the session and turns sharing
          off.
        </Text>
        <Action
          label={radar.active ? 'End radar session' : 'Start radar session'}
          onPress={() => (radar.active ? radar.stop() : void radar.start())}
        />
      </View>
      <View style={styles.card}>
        <Text variant="caption" gold>
          DETECTOR
        </Text>
        <Text accessibilityLiveRegion="polite">{radar.status}</Text>
        {radar.model && !radar.healthy ? (
          <Text style={styles.warning}>
            Detector data is stale · reconnect if it does not recover.
          </Text>
        ) : null}
        {radar.healthy && radar.snapshot?.recognized === false ? (
          <Text style={styles.warning}>
            Unrecognized detector data · check the detector display.
          </Text>
        ) : null}
        {radar.healthy && radar.snapshot?.recognized && !radar.snapshot.alerts.length ? (
          <Text>No active detector alerts</Text>
        ) : null}
        {radar.healthy
          ? radar.snapshot?.alerts.map((a, i) => (
              <Text key={i} style={styles.warning}>
                {a.band} · {a.direction.toUpperCase()} · {a.strength}/8
                {a.frequencyGhz ? ` · ${a.frequencyGhz.toFixed(3)} GHz` : ''}
                {a.muted ? ' · muted on detector' : ''}
              </Text>
            ))
          : null}
        <Action label="Find R8 / R8w" onPress={() => void radar.scan()} />
        <Text style={styles.muted}>
          Enable BT Pairing on the detector. Disconnect other detector apps before connecting here.
        </Text>
        {radar.devices.map((d) => (
          <Action key={d.id} label={`Connect ${d.name}`} onPress={() => void radar.connect(d)} />
        ))}
        <Text style={styles.muted}>
          R7: use manual reporting below. The stock R7 cannot pair over Bluetooth. The experimental
          adapter is not enabled in this build.
        </Text>
      </View>
      {radar.active ? (
        <View style={styles.card}>
          <Text variant="caption" gold>
            PRIVATE CLUB SHARING
          </Text>
          <Text>
            Choose who receives your reports. Each report includes your phone’s location at that
            moment. Radar reports expire after 5 minutes; sightings after 10.
          </Text>
          <Action
            label={!radar.clubId ? '✓ Local only' : 'Local only'}
            onPress={() => radar.selectClub(null)}
          />
          {radar.clubs.map((c) => (
            <Action
              key={c.id}
              label={`${radar.clubId === c.id ? '✓ ' : ''}${c.name}`}
              onPress={() => radar.selectClub(c.id)}
            />
          ))}
          {!radar.clubs.length ? (
            <Text style={styles.muted}>
              No live club memberships loaded. A verified member login and club membership are
              required to share reports.
            </Text>
          ) : null}
          {radar.clubId ? (
            <>
              <View style={styles.row}>
                <Text style={styles.grow}>Automatically share unmuted detector alerts</Text>
                <Switch
                  accessibilityLabel="Automatically share detector alerts with selected club"
                  value={radar.shareDetector}
                  onValueChange={radar.setShareDetector}
                />
              </View>
              <Action
                label="Report radar detected"
                disabled={!canReport}
                onPress={() => void radar.report('radar')}
              />
              <Action
                label="Report police sighting"
                disabled={!canReport}
                onPress={() => void radar.report('police_visual')}
              />
              {!canReport ? (
                <Text style={styles.muted}>
                  Waiting for a recent GPS fix with accuracy within 100 m.
                </Text>
              ) : null}
              <Text style={styles.muted}>
                {radar.feedStatus === 'live'
                  ? 'Club feed connected · refreshes every 5 seconds'
                  : radar.feedStatus === 'unavailable'
                    ? 'Club feed unavailable · reports are not currently visible'
                    : 'Connecting to club feed…'}
              </Text>
            </>
          ) : null}
        </View>
      ) : null}
      {radar.error ? (
        <Text accessibilityLiveRegion="polite" style={styles.warning}>
          {radar.error}
        </Text>
      ) : null}
      {radar.notice ? (
        <Text accessibilityLiveRegion="polite" gold>
          {radar.notice}
        </Text>
      ) : null}
      {radar.clubId ? (
        <View style={styles.card}>
          <Text variant="caption" gold>
            NEARBY · WITHIN 5 KM
          </Text>
          {radar.nearby.length === 0 ? (
            <Text style={styles.muted}>
              {freshRadarFix(radar.fix, radar.now)
                ? 'No recent club reports nearby.'
                : 'A fresh location is needed to show nearby reports.'}
            </Text>
          ) : null}
          {radar.nearby.map((r) => {
            const votes = radar.confirmations.filter((c) => c.report_id === r.id);
            return (
              <View key={r.id} style={styles.report}>
                <Text>{radarReportLabel(r)}</Text>
                <Text style={styles.muted}>
                  {Math.max(0, Math.floor((radar.now - Date.parse(r.created_at)) / 1000))} s ago ·{' '}
                  {votes.filter((v) => v.vote === 'still_present').length} still present ·{' '}
                  {votes.filter((v) => v.vote === 'gone').length} gone
                </Text>
                {r.reporter_id !== memberId ? (
                  <View style={styles.row}>
                    <Action
                      label="Still present"
                      onPress={() => void radar.confirm(r.id, 'still_present')}
                    />
                    <Action label="Gone" onPress={() => void radar.confirm(r.id, 'gone')} />
                  </View>
                ) : (
                  <Text style={styles.muted}>Your report</Text>
                )}
              </View>
            );
          })}
        </View>
      ) : null}
    </ScrollView>
  );
}

function Action({
  label,
  onPress,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.button, disabled && styles.disabled]}
    >
      <Text gold>{label}</Text>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: shell.background },
  content: { padding: 20, gap: 16, paddingBottom: 48 },
  card: {
    backgroundColor: shell.tabBar,
    borderColor: '#34323a',
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    gap: 12,
  },
  button: {
    borderWidth: 1,
    borderColor: shell.accent,
    padding: 12,
    minHeight: 44,
    borderRadius: 8,
  },
  disabled: { opacity: 0.4 },
  muted: { color: shell.muted, fontSize: 13 },
  warning: { color: '#ffbb66' },
  row: { flexDirection: 'row', gap: 10, alignItems: 'center', flexWrap: 'wrap' },
  grow: { flex: 1 },
  report: { gap: 8, paddingVertical: 10, borderTopWidth: 1, borderColor: '#34323a' },
});
