#!/usr/bin/env bash
# UNDERGROUND database maintenance on Atlas. Replaces the pg_cron jobs from
# 20261127000002 and 20261127000010, since the local Supabase stack has no pg_cron.
#   daily  : public.purge_raw_run_data() (90-day default) and public.supercargo_purge()
#   weekly : public.supercargo_settle_marks(<Monday of the week just ended, UTC>)
# Same calls and arguments as the cron jobs. Run by underground-db-maintenance.timer and
# underground-db-settle-marks.timer (systemd user units). No secrets: it connects through
# docker exec as the container's local postgres role.
set -euo pipefail
mode="${1:-daily}"
container="${UG_DB_CONTAINER:-supabase_db_underground-atlas-test}"
psql_run() {
  sudo -n docker exec "$container" psql -U postgres -d postgres -X -v ON_ERROR_STOP=1 -P pager=off "$@" </dev/null
}
echo "$(date -Is) underground-db-maintenance ${mode} start"
case "$mode" in
  daily)
    psql_run -c "select 'purge_raw_run_data' as job, * from public.purge_raw_run_data()" \
             -c "select 'supercargo_purge' as job, public.supercargo_purge() as rows_deleted"
    ;;
  weekly)
    psql_run -c "select 'supercargo_settle_marks' as job, ((date_trunc('week', now() AT TIME ZONE 'UTC'))::date - 7) as week, public.supercargo_settle_marks(((date_trunc('week', now() AT TIME ZONE 'UTC'))::date - 7)) as marks_added"
    ;;
  *) echo "usage: $0 daily|weekly" >&2; exit 2 ;;
esac
echo "$(date -Is) underground-db-maintenance ${mode} done"
