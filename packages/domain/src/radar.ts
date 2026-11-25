import { z } from 'zod';

export const RadarBandSchema = z.enum([
  'X',
  'K',
  'KA',
  'K POP',
  'KA POP',
  'LASER',
  'MRCD',
  'MRCT',
  'RT3',
  'RT4',
]);
export const RadarDirectionSchema = z.enum(['front', 'side', 'rear']);
export const RadarSourceSchema = z.enum(['manual', 'uniden_r8', 'uniden_r8w']);
export const RadarFixSchema = z.object({
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  accuracyM: z.number().finite().min(0).max(100),
  timestamp: z.number().finite(),
});
export type RadarFix = z.infer<typeof RadarFixSchema>;
export type RadarBand = z.infer<typeof RadarBandSchema>;
export type RadarSource = z.infer<typeof RadarSourceSchema>;
export type RadarAlert = {
  band: RadarBand;
  strength: number;
  direction: z.infer<typeof RadarDirectionSchema>;
  frequencyGhz: number | null;
  muted: boolean | null;
};

export const ClubRadarReportSchema = z.object({
  id: z.string().uuid(),
  club_id: z.string().uuid(),
  reporter_id: z.string().uuid(),
  kind: z.enum(['radar', 'police_visual']),
  source: RadarSourceSchema,
  band: RadarBandSchema.nullable(),
  strength: z.number().int().min(1).max(8).nullable(),
  direction: RadarDirectionSchema.nullable(),
  frequency_ghz: z.number().finite().positive().max(100).nullable(),
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  accuracy_m: z.number().finite().min(0).max(100),
  created_at: z.string().datetime({ offset: true }),
  expires_at: z.string().datetime({ offset: true }),
});
export type ClubRadarReport = z.infer<typeof ClubRadarReportSchema>;
export const RadarConfirmationSchema = z.object({
  report_id: z.string().uuid(),
  member_id: z.string().uuid(),
  vote: z.enum(['still_present', 'gone']),
});
export type RadarConfirmation = z.infer<typeof RadarConfirmationSchema>;

export function freshRadarFix(value: unknown, now: number): RadarFix | null {
  const parsed = RadarFixSchema.safeParse(value);
  if (!parsed.success || now - parsed.data.timestamp > 15_000 || parsed.data.timestamp > now + 2000)
    return null;
  return parsed.data;
}

export function radarDistanceM(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad;
  const dLon = (b.longitude - a.longitude) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLon / 2) ** 2;
  return 12_742_000 * Math.asin(Math.sqrt(Math.min(1, h)));
}

export function nearbyRadarReports(
  reports: readonly ClubRadarReport[],
  fix: RadarFix | null,
  now: number,
): ClubRadarReport[] {
  if (!freshRadarFix(fix, now)) return [];
  return reports.filter((r) => Date.parse(r.expires_at) > now && radarDistanceM(fix!, r) <= 5000);
}

/** Observations never certify an officer's coordinates or award gameplay points. */
export function radarReportLabel(report: Pick<ClubRadarReport, 'kind' | 'band'>): string {
  return report.kind === 'police_visual'
    ? 'Police sighting · member reported'
    : `${report.band ?? 'Radar'} detected`;
}
