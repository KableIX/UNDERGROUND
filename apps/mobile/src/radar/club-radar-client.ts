import {
  ClubRadarReportSchema,
  RadarConfirmationSchema,
  freshRadarFix,
  type RadarAlert,
  type RadarFix,
  type RadarSource,
} from '@underground/domain';
import { getMobileSupabaseClient } from '../session/supabase-session';

function client() {
  const db = getMobileSupabaseClient();
  if (!db) throw new Error('Club sharing needs a configured member backend.');
  return db;
}

export async function loadRadarClubs(
  memberId: string,
): Promise<Array<{ id: string; name: string }>> {
  const { data, error } = await client()
    .from('club_memberships')
    .select('club_id, clubs(id,name)')
    .eq('member_id', memberId);
  if (error) throw new Error('Could not load your clubs.');
  return (data ?? []).flatMap((row) => {
    const club = row.clubs as unknown as { id: string; name: string } | null;
    return club?.id && club?.name ? [club] : [];
  });
}

export async function loadClubRadar(clubId: string) {
  const db = client();
  const { data, error } = await db
    .from('club_radar_reports')
    .select('*')
    .eq('club_id', clubId)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw new Error('Club radar is unavailable.');
  const reports = ClubRadarReportSchema.array().parse(data ?? []);
  if (!reports.length) return { reports, confirmations: [] };
  const result = await db
    .from('club_radar_confirmations')
    .select('report_id, member_id, vote')
    .in(
      'report_id',
      reports.map((r) => r.id),
    );
  if (result.error) throw new Error('Club confirmations are unavailable.');
  return { reports, confirmations: RadarConfirmationSchema.array().parse(result.data ?? []) };
}

export async function submitClubRadar(input: {
  clubId: string;
  eventId: string;
  kind: 'radar' | 'police_visual';
  source: RadarSource;
  fix: RadarFix;
  alert?: RadarAlert;
}) {
  const fix = freshRadarFix(input.fix, Date.now());
  if (!fix) throw new Error('A fresh GPS fix within 100 m is required.');
  const { error } = await client().rpc('submit_club_radar', {
    p_club_id: input.clubId,
    p_event_id: input.eventId,
    p_kind: input.kind,
    p_source: input.source,
    p_latitude: fix.latitude,
    p_longitude: fix.longitude,
    p_accuracy_m: fix.accuracyM,
    p_observed_at: new Date(fix.timestamp).toISOString(),
    p_band: input.alert?.band ?? null,
    p_strength: input.alert?.strength ?? null,
    p_direction: input.alert?.direction ?? null,
    p_frequency_ghz: input.alert?.frequencyGhz ?? null,
  });
  if (error)
    throw new Error(
      error.message === 'report_rate_limited'
        ? 'Wait 10 seconds between reports.'
        : 'Report was not shared. Check club membership and connection.',
    );
}

export async function confirmClubRadar(reportId: string, vote: 'still_present' | 'gone') {
  const { error } = await client().rpc('confirm_club_radar', {
    p_report_id: reportId,
    p_vote: vote,
  });
  if (error) throw new Error('Confirmation was not saved. The report may have expired.');
}
