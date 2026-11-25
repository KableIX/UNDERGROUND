import { RadarBandSchema, type RadarAlert } from '@underground/domain';

// Community-documented, receive-only protocol. See docs/RADAR_INTEGRATION.md.
export const UNIDEN_DATA_SERVICE = '18424398-7cbc-11e9-8f9e-2a86e4085a59';
export const UNIDEN_ALERTS = '6eb675ab-8bd1-1b9a-7444-621e52ec6823';
export const UNIDEN_TELEMETRY = '6c290d2e-1c03-aca1-ab48-a9b908bae79e';
export type AlertSnapshot = { recognized: boolean; alerts: RadarAlert[] };

/** Reject unknown/truncated slots as unknown, never turn a parse failure into all-clear. */
export function parseUnidenAlerts(packet: string): AlertSnapshot {
  if (!packet || packet.length > 2048 || /[^\x20-\x7e]/.test(packet))
    return { recognized: false, alerts: [] };
  const slots = packet.split('&');
  if (slots.length !== 4) return { recognized: false, alerts: [] };
  const alerts: RadarAlert[] = [];
  let recognized = true;
  for (const slot of slots) {
    if (slot === '0') continue;
    const f = slot.split(',');
    const band = RadarBandSchema.safeParse(f[2]);
    const direction = ({ F: 'front', S: 'side', R: 'rear' } as const)[f[6] as 'F' | 'S' | 'R'];
    if (
      (f.length !== 8 && f.length !== 9) ||
      f[0] !== '1' ||
      !band.success ||
      !/^[1-8]$/.test(f[3] ?? '') ||
      !direction
    ) {
      recognized = false;
      continue;
    }
    const frequency = /^(?:\d+)(?:\.\d+)?$/.test(f[5] ?? '') ? Number(f[5]) : NaN;
    const isMicrowave = ['X', 'K', 'KA', 'K POP', 'KA POP'].includes(band.data);
    alerts.push({
      band: band.data,
      strength: Number(f[3]),
      direction,
      frequencyGhz: isMicrowave && frequency > 0 && frequency < 100 ? frequency : null,
      muted: f[7] === '1' ? false : /^[2-6]$/.test(f[7] ?? '') ? true : null,
    });
  }
  return { recognized, alerts };
}

export function isUnidenHeartbeat(packet: string): boolean {
  const f = packet.split('&');
  return (
    packet.length <= 512 &&
    f.length === 7 &&
    /^\d{1,2}\.\d+$/.test(f[0] ?? '') &&
    Number(f[0]) > 0 &&
    Number(f[0]) < 40
  );
}

export function unidenModel(name: string | null): 'uniden_r8' | 'uniden_r8w' | null {
  if (!name) return null;
  if (/^(?:UNIDEN[ -])?R8W(?:@|\b)/i.test(name)) return 'uniden_r8w';
  if (/^(?:UNIDEN[ -])?R8(?:@|\b)/i.test(name)) return 'uniden_r8';
  return null;
}
