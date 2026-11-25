import {
  freshRadarFix,
  type RadarAlert,
  type RadarFix,
  type RadarSource,
} from '@underground/domain';

/** Bound uploads to one per 30s; direction/strength fluctuation is not a new source. */
export class RadarShareGate {
  private lastAttempt = -Infinity;
  private lastBySignal = new Map<string, number>();

  take(input: {
    enabled: boolean;
    clubId: string | null;
    source: RadarSource | null;
    recognized: boolean;
    healthy: boolean;
    alerts: RadarAlert[];
    fix: RadarFix | null;
    now: number;
  }): RadarAlert | null {
    const { enabled, clubId, source, recognized, healthy, alerts, fix, now } = input;
    if (
      !enabled ||
      !clubId ||
      !source ||
      source === 'manual' ||
      !recognized ||
      !healthy ||
      !freshRadarFix(fix, now) ||
      now - this.lastAttempt < 30_000
    )
      return null;
    for (const [key, time] of this.lastBySignal)
      if (now - time >= 300_000) this.lastBySignal.delete(key);
    const candidates = alerts
      .filter((a) => a.muted === false)
      .sort((a, b) => b.strength - a.strength);
    for (const alert of candidates) {
      const key = `${clubId}:${alert.band}:${alert.frequencyGhz?.toFixed(2) ?? '?'}`;
      if (this.lastBySignal.has(key)) continue;
      this.lastAttempt = now;
      this.lastBySignal.set(key, now);
      return alert;
    }
    return null;
  }
}
